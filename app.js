// ========== 데이터베이스 설정 (IndexedDB with Dexie) ==========
const db = new Dexie('CSStudyApp');
const APP_SCHEMA_VERSION = 5; // App-level schema/meta version (not Dexie version)

// Schema versioning - Version 1 (initial schema)
db.version(1).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created',
  review: '++id, questionId, ease, interval, due, count, created, updated'
});

// Schema versioning - Version 2 (add indexes and optimize)
db.version(2).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, *tags',
  review: '++id, questionId, ease, interval, due, count, created, updated'
});

// Migration hook for version 2
db.version(2).upgrade(async (trans) => {
  // Add tags field to existing questions
  await trans.table('questions').toCollection().modify(question => {
    if (!question.tags) {
      question.tags = [];
    }
  });
});

// Dexie schema v3: add meta table for app-level metadata
db.version(3).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, *tags',
  review: '++id, questionId, ease, interval, due, count, created, updated',
  meta: 'key'
});

// Dexie schema v4: add notes tables
db.version(4).stores({
  notes: '++id, deckId, title, source',
  note_items: '++id, noteId, ts, text, *tags'
});

// Dexie schema v5: add sortOrder to questions
db.version(5).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, sortOrder, *tags',
  review: '++id, questionId, ease, interval, due, count, created, updated',
  meta: 'key',
  notes: '++id, deckId, title, source',
  note_items: '++id, noteId, ts, text, *tags'
});

// Migration hook for version 5 - add sortOrder to existing questions
db.version(5).upgrade(async (trans) => {
  const questions = await trans.table('questions').toArray();
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    if (question.sortOrder === undefined) {
      await trans.table('questions').update(question.id, { sortOrder: i });
    }
  }
});

// Legacy localStorage keys for migration
const LEGACY_KEY = {
  PROFILE: 'cs.profile',
  DECKS: 'cs.decks',
  QUESTIONS: 'cs.questions',
  REVIEW: 'cs.review',
  LAST: 'cs.lastStudy'
};

// Meta helpers
async function getSchemaVersion() {
  try {
    const row = await db.table('meta').get('schemaVersion');
    return row?.value ?? null;
  } catch (_) {
    return null;
  }
}

async function setSchemaVersion(v) {
  await db.table('meta').put({ key: 'schemaVersion', value: v });
}

async function getDailyRollup() {
  try {
    const row = await db.table('meta').get('dailyRollup');
    return row?.value || {};
  } catch (_) {
    return {};
  }
}

async function setDailyRollup(obj) {
  await db.table('meta').put({ key: 'dailyRollup', value: obj });
}

// ========== Settings & Daily Stats ==========
const SETTINGS_KEY = 'cs.settings';
const DAILY_STATS_KEY = 'cs.dailyStats';
const DEFAULT_DAILY_REVIEW_LIMIT = 30; // configurable via localStorage settings
const EASE_LOW_THRESHOLD = 1.5; // heuristic for low-confidence
const SHORT_FUZZY = 0.85; // fuzzy threshold for SHORT answers and synonyms

function getSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      dailyReviewLimit: Number.isFinite(s.dailyReviewLimit) ? s.dailyReviewLimit : DEFAULT_DAILY_REVIEW_LIMIT,
    };
  } catch (_) {
    return { dailyReviewLimit: DEFAULT_DAILY_REVIEW_LIMIT };
  }
}

function setSettings(next) {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...next }));
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getDailyStats() {
  const today = todayStr();
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_STATS_KEY) || '{}');
    if (!raw.date || raw.date !== today) {
      return { date: today, reviewsDone: 0, totalDone: 0 };
    }
    return { date: raw.date, reviewsDone: raw.reviewsDone || 0, totalDone: raw.totalDone || 0 };
  } catch (_) {
    return { date: today, reviewsDone: 0, totalDone: 0 };
  }
}

function setDailyStats(stats) {
  localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
}

// ========== 데이터 마이그레이션 ==========
async function migrateFromLocalStorage() {
	try {
		// Idempotent check using meta.schemaVersion
		const currentMetaVersion = await getSchemaVersion();
		if (currentMetaVersion && currentMetaVersion >= APP_SCHEMA_VERSION) {
			return;
		}

		console.log('Starting localStorage to IndexedDB migration...');

		// Migrate profile data
		const legacyProfileRaw = localStorage.getItem(LEGACY_KEY.PROFILE);
		if (legacyProfileRaw) {
			const legacyProfile = JSON.parse(legacyProfileRaw);
			const legacyLastStudy = localStorage.getItem(LEGACY_KEY.LAST);
			const existingProfile = await db.profile.toCollection().first();
			if (!existingProfile) {
				await db.profile.add({
					xp: legacyProfile.xp || 0,
					streak: legacyProfile.streak || 0,
					lastStudy: legacyLastStudy || null
				});
			}
		}

		// Migrate decks data
		const legacyDecksRaw = localStorage.getItem(LEGACY_KEY.DECKS);
		const deckIdMap = {};
		if (legacyDecksRaw && (await db.decks.count()) === 0) {
			const legacyDecks = JSON.parse(legacyDecksRaw);
			for (const deck of legacyDecks) {
				const newId = await db.decks.add({ name: deck.name, created: new Date() });
				deckIdMap[deck.id] = newId;
			}
		}

		// Migrate questions data
		const legacyQuestionsRaw = localStorage.getItem(LEGACY_KEY.QUESTIONS);
		if (legacyQuestionsRaw && (await db.questions.count()) === 0) {
			const legacyQuestions = JSON.parse(legacyQuestionsRaw);
      let miscDeckId = null;
			for (const question of legacyQuestions) {
        let deckId = deckIdMap[question.deck];
        if (!deckId) {
            if (miscDeckId === null) {
                const miscDeck = await db.decks.where('name').equalsIgnoreCase('Miscellaneous').first();
                miscDeckId = miscDeck ? miscDeck.id : await db.decks.add({ name: 'Miscellaneous', created: new Date() });
            }
            deckId = miscDeckId;
        }

				await db.questions.add({
					deck: deckId,
					type: question.type,
					prompt: question.prompt,
					answer: question.answer,
					keywords: question.keywords || [],
					synonyms: question.synonyms || [],
					explain: question.explain || '',
					tags: [],
					created: new Date()
				});
			}
		}

		// Clear localStorage after successful migration
		Object.values(LEGACY_KEY).forEach(k => localStorage.removeItem(k));

		await setSchemaVersion(APP_SCHEMA_VERSION);
		console.log('Migration completed successfully to meta v' + APP_SCHEMA_VERSION);
		showToast('데이터 저장소가 준비되었습니다', 'success');

	} catch (error) {
		console.error('Migration failed:', error);
		showToast('데이터 마이그레이션 중 오류가 발생했습니다', 'danger');
	}
}

// 기본 덱
const defaultDecks = [
  {id: 'net', name: '네트워크'},
  {id: 'os', name: '운영체제'},
  {id: 'db', name: '데이터베이스'},
  {id: 'ds', name: '자료구조'},
  {id: 'algo', name: '알고리즘'},
  {id: 'web', name: '웹개발'},
  {id: 'security', name: '보안'}
];

// 샘플 문제
const sampleQuestions = [
  {id:1, deck:'net', type:'OX', prompt:'TCP는 연결 지향이며 신뢰성을 보장한다.', answer:'true', explain:'3-way handshake, 재전송, 순서 보장'},
  {id:2, deck:'net', type:'OX', prompt:'UDP는 흐름제어나 혼잡제어를 제공한다.', answer:'false', explain:'UDP는 비연결·비신뢰, 대신 지연 적음'},
  {id:3, deck:'os', type:'KEYWORD', prompt:'프로세스와 스레드의 차이를 설명하시오.', keywords:['독립','메모리','공유','컨텍스트'], explain:'프로세스는 독립적 메모리, 스레드는 프로세스 내 메모리 공유'},
  {id:4, deck:'db', type:'SHORT', prompt:'트랜잭션의 ACID 중 A는?', answer:'Atomicity', explain:'원자성 - 전부 성공 또는 전부 실패'},
  {id:5, deck:'ds', type:'OX', prompt:'HashMap은 평균 O(1) 조회가 가능하다.', answer:'true', explain:'해시 충돌이 적을 때'}
];

// ========== 상태 ==========
let session = {
  active: false,
  deck: null,
  queue: [],
  index: 0,
  ok: 0,
  ng: 0,
  score: 0
};

// ========== 데이터 액세스 레이어 (IndexedDB) ==========
const DataStore = {
  // Profile operations
  async getProfile() {
    const profile = await db.profile.toCollection().first();
    return profile || {};
  },

  async setProfile(profileData) {
    const existing = await db.profile.toCollection().first();
    if (existing) {
      await db.profile.update(existing.id, {
        xp: profileData.xp,
        streak: profileData.streak,
        lastStudy: profileData.lastStudy
      });
    } else {
      await db.profile.add({
        xp: profileData.xp || 0,
        streak: profileData.streak || 0,
        lastStudy: profileData.lastStudy || null
      });
    }
  },

  // Decks operations
    async getDecks() {
    const decks = await db.decks.orderBy('name').toArray();
    return decks;
  },

  async addDeck(deck) {
    return await db.decks.add({
      name: deck.name,
      created: new Date()
    });
  },

  async deleteDeck(deckId) {
    await db.decks.delete(deckId);
  },

  // Questions operations
  async getQuestions() {
    const questions = await db.questions.toArray();
    return questions;
  },

  async addQuestion(question) {
    try {
      // Get current max sortOrder
      const maxOrder = await db.questions.orderBy('sortOrder').reverse().first();
      const nextOrder = (maxOrder?.sortOrder ?? 0) + 1;
      
      return await db.questions.add({
        ...question,
        created: new Date(),
        sortOrder: nextOrder
      });
    } catch (error) {
      if (error.name === 'SchemaError' && error.message.includes('sortOrder')) {
        // Fallback: add without sortOrder for old schema
        console.warn('Database schema outdated, adding question without sortOrder');
        return await db.questions.add({
          ...question,
          created: new Date()
        });
      }
      throw error;
    }
  },

  async updateQuestion(id, updates) {
    return await db.questions.update(id, updates);
  },

  async deleteQuestion(id) {
    await db.questions.delete(id);
    await db.review.where('questionId').equals(id).delete();
  },

  async getQuestionsByDeck(deckId) {
    return await db.questions.where('deck').equals(deckId).toArray();
  },

  // Review operations
  async getReview() {
    const reviews = await db.review.toArray();
    const reviewMap = {};
    reviews.forEach(r => {
      reviewMap[r.questionId] = {
        ease: r.ease,
        interval: r.interval,
        due: r.due,
        count: r.count,
        correct: r.correct || 0,
        lastResult: r.lastResult || null,
        againCount: r.againCount || 0
      };
    });
    return reviewMap;
  },

  async getReviewByQuestion(questionId) {
    return await db.review.where('questionId').equals(questionId).first();
  },

  async setReview(questionId, reviewData) {
    const existing = await db.review.where('questionId').equals(questionId).first();
    const now = new Date();
    
    if (existing) {
      await db.review.update(existing.id, {
        ease: reviewData.ease,
        interval: reviewData.interval,
        due: reviewData.due,
        count: reviewData.count,
        correct: reviewData.correct || 0,
        lastResult: reviewData.lastResult || null,
        againCount: reviewData.againCount || 0,
        updated: now
      });
    } else {
      await db.review.add({
        questionId: questionId,
        ease: reviewData.ease,
        interval: reviewData.interval,
        due: reviewData.due,
        count: reviewData.count,
        correct: reviewData.correct || 0,
        lastResult: reviewData.lastResult || null,
        againCount: reviewData.againCount || 0,
        created: now,
        updated: now
      });
    }
  },

  async getDueReviews(date = todayStr()) {
    return await db.review.where('due').belowOrEqual(date).toArray();
  },

  // Notes operations
  async getNotes() {
    return await db.notes.toArray();
  },

  async getNote(id) {
    return await db.notes.get(id);
  },

  async addNote(note) {
    return await db.notes.add(note);
  },

  async updateNote(id, updates) {
    return await db.notes.update(id, updates);
  },

  async deleteNote(id) {
    await db.transaction('rw', db.notes, db.note_items, async () => {
      await db.note_items.where('noteId').equals(id).delete();
      await db.notes.delete(id);
    });
  },

  async getNoteItems(noteId) {
    return await db.note_items.where('noteId').equals(noteId).sortBy('order');
  },

  async addNoteItem(item) {
    return await db.note_items.add(item);
  },

  async updateNoteItem(id, updates) {
    return await db.note_items.update(id, updates);
  },

  async deleteNoteItem(id) {
    return await db.note_items.delete(id);
  },

  async bulkAddNoteItems(items) {
    return await db.note_items.bulkAdd(items);
  }
};

// todayStr declared earlier (hoisted function)

// ========== 레거시 함수들 (비동기 버전으로 교체) ==========
async function getDecks() {
  return await DataStore.getDecks();
}

async function setDecks(decks) {
  // This function is replaced by individual deck operations
  console.warn('setDecks is deprecated, use DataStore.addDeck instead');
}

async function getQuestions() {
  return await DataStore.getQuestions();
}

async function setQuestions(questions) {
  // This function is replaced by individual question operations
  console.warn('setQuestions is deprecated, use DataStore.addQuestion instead');
}

async function getProfile() {
  return await DataStore.getProfile();
}

async function setProfile(profile) {
  await DataStore.setProfile(profile);
  await updateHeader();
}

async function getReview() {
  return await DataStore.getReview();
}

async function setReview(questionId, reviewData) {
  await DataStore.setReview(questionId, reviewData);
}

// ========== SM-2 알고리즘 (간격 반복) ==========
function nextSchedule(correct, state, grade = null) {
  if (!state) {
    state = {ease: 2.5, interval: 0, due: todayStr(), count: 0, correct: 0};
  }
  
  state.count = (state.count || 0) + 1;
  
  if (grade !== null && grade !== undefined) {
    // SM-2 with grade (0=again, 1=hard, 2=good, 3=easy)
    if (grade === 0) {
      state.interval = 0; // immediate retry today
      state.ease = Math.max(1.3, state.ease - 0.8);
    } else {
      if (state.interval === 0) {
        state.interval = grade === 1 ? 1 : grade === 2 ? 1 : 4;
      } else if (state.interval === 1) {
        state.interval = grade === 1 ? 3 : grade === 2 ? 6 : 6;
      } else {
        const factor = grade === 1 ? 1.2 : grade === 2 ? state.ease : state.ease * 1.3;
        state.interval = Math.round(state.interval * factor);
      }
      
      // Ease adjustments
      if (grade === 1) {
        state.ease = Math.max(1.3, state.ease - 0.15);
      } else if (grade === 2) {
        state.ease = Math.max(1.3, state.ease - 0.02);
      } else if (grade === 3) {
        state.ease = Math.min(2.5, state.ease + 0.15);
      }
    }
  } else {
    // Legacy correct/incorrect logic
    if (!correct) {
      state.interval = 1;
      state.ease = Math.max(1.3, state.ease - 0.2);
    } else {
      if (state.interval === 0) {
        state.interval = 1;
      } else if (state.interval === 1) {
        state.interval = 3;
      } else {
        state.interval = Math.round(state.interval * state.ease);
      }
      state.ease = Math.min(2.5, state.ease + 0.13);
    }
  }
  
  const due = new Date();
  due.setDate(due.getDate() + state.interval);
  state.due = due.toISOString().slice(0, 10);
  
  return state;
}

function simulateNextInterval(state, grade) {
  const copy = state ? { ...state } : { ease: 2.5, interval: 0, due: todayStr(), count: 0 };
  const res = nextSchedule(true, copy, grade);
  return res.interval;
}

function simulateNextDueDate(state, grade) {
  const copy = state ? { ...state } : { ease: 2.5, interval: 0, due: todayStr(), count: 0 };
  const res = nextSchedule(true, copy, grade);
  return res.due;
}

function formatInterval(days) {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return days + ' days';
}

// ========== Tests (pure functions) ==========
function runSM2PreviewTests() {
  const cases = [
    { state: { ease: 2.5, interval: 0, due: todayStr(), count: 0 }, grade: 0 },
    { state: { ease: 2.5, interval: 0, due: todayStr(), count: 0 }, grade: 2 },
    { state: { ease: 2.2, interval: 1, due: todayStr(), count: 3 }, grade: 1 },
    { state: { ease: 1.8, interval: 6, due: todayStr(), count: 10 }, grade: 3 }
  ];
  cases.forEach((c, idx) => {
    const a = simulateNextInterval(c.state, c.grade);
    const copy = { ...c.state };
    const b = nextSchedule(true, copy, c.grade).interval;
    console.assert(a === b, `simulateNextInterval mismatch in case ${idx}: ${a} != ${b}`);
    const d1 = simulateNextDueDate(c.state, c.grade);
    const copy2 = { ...c.state };
    const d2 = nextSchedule(true, copy2, c.grade).due;
    console.assert(d1 === d2, `simulateNextDueDate mismatch in case ${idx}: ${d1} != ${d2}`);
  });
}

// ========== 세션 관리 ==========
async function startSession() {
  const deckId = document.getElementById('deckSelect').value;
  const count = parseInt(document.getElementById('questionCount').value);
  
  // Show loading skeleton
  if (typeof showQuestionSkeleton === 'function') showQuestionSkeleton();
  
  const questions = await getQuestions();
  const review = await getReview();
  const today = todayStr();

  // Classify questions by category
  const inDeck = questions.filter(q => q.deck === deckId);
  const seenIds = new Set(Object.keys(review).map(Number));

  const isDue = (q) => review[q.id]?.due && review[q.id].due <= today;
  const isNew = (q) => !seenIds.has(q.id);
  const isLow = (q) => !isNew(q) && !isDue(q) && ((review[q.id]?.ease ?? 2.5) <= EASE_LOW_THRESHOLD);

  // Helper: group id via tag 'group:*'
  const getGroupId = (q) => {
    const tags = q.tags || [];
    const g = tags.find(t => typeof t === 'string' && t.startsWith('group:'));
    return g || null;
  };

  // Build groups for the deck (with per-category buckets)
  const groups = new Map(); // key -> { key, due:[], new:[], low:[], rest:[], counts }
  for (const q of inDeck) {
    const key = getGroupId(q) || `solo:${q.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        due: [],
        new: [],
        low: [],
        rest: [],
        counts: { due: 0, new: 0, low: 0, rest: 0 }
      });
    }
    const g = groups.get(key);
    if (isDue(q)) { g.due.push(q); g.counts.due++; }
    else if (isNew(q)) { g.new.push(q); g.counts.new++; }
    else if (isLow(q)) { g.low.push(q); g.counts.low++; }
    else { g.rest.push(q); g.counts.rest++; }
  }

  // Prepare priority group lists
  const dueGroups = [];
  const newGroups = [];
  const lowGroups = [];
  const restGroups = [];
  for (const g of groups.values()) {
    if (g.counts.due > 0) dueGroups.push(g);
    else if (g.counts.new > 0) newGroups.push(g);
    else if (g.counts.low > 0) lowGroups.push(g);
    else restGroups.push(g);
  }

  // Shuffle within category for variety
  const sDue = shuffle(dueGroups);
  const sNew = shuffle(newGroups);
  const sLow = shuffle(lowGroups);
  const sRest = shuffle(restGroups);

  // Enforce daily review limit (applies to due items only)
  const { dailyReviewLimit } = getSettings();
  const stats = getDailyStats();
  let dueRemaining = Math.max(0, dailyReviewLimit - (stats.reviewsDone || 0));

  const queue = [];
  let slotsRemaining = count;
  const buriedIds = new Set();

  const addGroupIfFits = (g, constrainDue) => {
    if (slotsRemaining <= 0) return false;
    const items = [...g.due, ...g.new, ...g.low, ...g.rest];
    const size = items.length;
    const groupDue = g.counts.due;
    if (size > slotsRemaining) return false; // all-or-nothing inclusion
    if (constrainDue && groupDue > dueRemaining) return false;
    for (const item of items) {
      let _src = 'rest';
      if (isDue(item)) _src = 'due';
      else if (isNew(item)) _src = 'new';
      else if (isLow(item)) _src = 'low';
      queue.push({ ...item, _src });
    }
    slotsRemaining -= size;
    if (constrainDue) dueRemaining -= groupDue;
    return true;
  };

  // Priority: due -> new -> low -> rest (skip due groups that exceed today's quota)
  let anyDueAdded = false;
  for (const g of sDue) {
    if (slotsRemaining <= 0) break;
    const added = addGroupIfFits(g, true);
    anyDueAdded = anyDueAdded || added;
  }
  for (const g of sNew) { if (slotsRemaining <= 0) break; addGroupIfFits(g, false); }
  for (const g of sLow) { if (slotsRemaining <= 0) break; addGroupIfFits(g, false); }
  for (const g of sRest) { if (slotsRemaining <= 0) break; addGroupIfFits(g, false); }

  if (dueGroups.length > 0 && dueRemaining === 0) {
    showToast('일일 복습 한도 도달: 새 문제/기타 우선 진행합니다', 'info');
  }
  
  if (queue.length === 0) {
    showToast('문제가 없습니다. 문제를 추가해주세요!', 'warning');
    return;
  }
  
  session = {
    active: true,
    deck: deckId,
    queue: queue,
    buried: Array.from(buriedIds),
    index: 0,
    ok: 0,
    ng: 0,
    score: 0,
    total: queue.length
  };
  
  await updateProgress();
  await showQuestion();
}

async function showQuestion() {
  if (session.index >= session.queue.length) {
    await finishSession();
    return;
  }
  
  const q = session.queue[session.index];
  const qArea = document.getElementById('qArea');
  const decks = await getDecks();
  const deckName = (decks.find(d => Number(d.id) === Number(q.deck)) || {}).name || 'Unknown Deck';
  
  let html = `
    <div class="badge">${deckName} · ${q.type}</div>
    <div class="prompt-box">${escapeHtml(q.prompt)}</div>
    <div style="margin-top:16px">
      <button id="revealBtn" onclick="revealAnswer()" aria-expanded="false">
        <span>🔍</span> Reveal Answer
      </button>
    </div>
  `;
  
  // Hidden answer section
  html += `
    <div id="answerSection" style="display:none" aria-hidden="true">
      <div style="margin-top:16px">
  `;
  
  if (q.type === 'OX') {
    html += `
        <div class="grid grid-2">
          <button class="success" onclick="submitAnswer('true')">⭕ True</button>
          <button class="danger" onclick="submitAnswer('false')">❌ False</button>
        </div>
    `;
  } else {
    html += `
        <textarea id="userAnswer" placeholder="답을 입력하세요..." autofocus></textarea>
        <div style="margin-top:16px">
          <button onclick="submitAnswer(document.getElementById('userAnswer').value)">제출</button>
          <button class="secondary" onclick="submitAnswer('')">모르겠음</button>
        </div>
    `;
  }
  
  html += `
      </div>
    </div>
    <div id="resultArea"></div>
  `;
  
  qArea.innerHTML = html;
  
  // Add fade-in effect
  if (typeof hideQuestionSkeleton === 'function') hideQuestionSkeleton();
}

function revealAnswer() {
  const revealBtn = document.getElementById('revealBtn');
  const answerSection = document.getElementById('answerSection');
  
  if (revealBtn && answerSection) {
    revealBtn.style.display = 'none';
    answerSection.style.display = 'block';
    answerSection.setAttribute('aria-hidden', 'false');
    
    // Focus textarea if present
    const userAnswer = document.getElementById('userAnswer');
    if (userAnswer) {
      setTimeout(() => userAnswer.focus(), 100);
    }
  }
}

async function submitAnswer(userAnswer) {
  const q = session.queue[session.index];
  // Guard against empty input for SHORT/KEYWORD
  if (q.type !== 'OX') {
    if (!userAnswer || userAnswer.trim() === '') {
      showToast('정답을 입력해주세요', 'warning');
      return;
    }
  }
  // Disable current action buttons to prevent double submit
  try {
    document.querySelectorAll('#qArea button').forEach(b => b.disabled = true);
  } catch (_) {}
  const correct = checkAnswer(q, userAnswer);
  
  // Optional AI grading for enhanced feedback
  let aiResult = null;
  try {
    const aiMode = localStorage.getItem('aiMode') || 'local';
    const input = {
      prompt: userAnswer,
      reference: { answer: q.answer, keywords: q.keywords }
    };
    
    if (aiMode === 'auto') {
      const { decideGrade } = await import('./ai/router.js');
      aiResult = await decideGrade(input);
    } else if (aiMode === 'local') {
      const { getAdapter } = await import('./ai/index.js');
      aiResult = await getAdapter('local').grade(input);
    } else if (aiMode === 'cloud') {
      const { getAdapter } = await import('./ai/index.js');
      aiResult = await getAdapter('cloud').grade(input);
    }
    
    window._lastAiResult = aiResult;
  } catch (e) { /* AI grading optional */ }
  
  // 점수 & XP (temporary for initial feedback)
  const gain = correct ? 10 : 2;
  session.score += gain;
  if (correct) session.ok++; 
  else session.ng++;
  
  const profile = await getProfile();
  profile.xp += gain;
  await setProfile(profile);
  
  // 결과 표시
  await showResult(correct, q, userAnswer);
  await updateProgress();
  
  // Store the question for grading
  session.currentQuestion = q;
  session.currentAnswer = userAnswer;
  session.currentCorrect = correct;
}

async function gradeAnswer(grade) {
  const q = session.currentQuestion;
  const correct = session.currentCorrect;
  // Disable grade buttons to prevent double clicks
  try {
    document.querySelectorAll('.grade-buttons button').forEach(b => b.disabled = true);
  } catch (_) {}
  
  // 리뷰 업데이트 with grade
  const review = await getReview();
  const updatedReview = nextSchedule(correct, review[q.id], grade);
  // increment correct counter
  const prevCorrect = (review[q.id]?.correct || 0);
  updatedReview.correct = prevCorrect + (correct ? 1 : 0);
  updatedReview.lastResult = correct ? 'ok' : 'ng';
  const prevAgain = (review[q.id]?.againCount || 0);
  updatedReview.againCount = prevAgain + (grade === 0 ? 1 : 0);
  await setReview(q.id, updatedReview);

  // Update daily rollup (per-day correct/total)
  try {
    const roll = await getDailyRollup();
    const today = todayStr();
    const cur = roll[today] || { correct: 0, total: 0 };
    cur.total += 1;
    if (correct) cur.correct += 1;
    roll[today] = cur;
    await setDailyRollup(roll);
  } catch (_) {}

  // Recompute and re-render interval previews on buttons using updated state
  try {
    updateGradePreviewsForCurrent(updatedReview);
  } catch (_) {}
  
  // Show next scheduled interval
  try {
    const iv = updatedReview.interval ?? 0;
    showToast(`다음 복습: ${formatInterval(iv)}`, 'info');
  } catch (_) {}
  
  // If grade is Again (0), re-queue this question soon
  if (grade === 0 && session) {
    const insertAt = Math.min(session.queue.length, session.index + 3);
    session.queue.splice(insertAt, 0, q);
  }
  
  // Update daily stats (count due reviews only)
  const stats = getDailyStats();
  stats.totalDone = (stats.totalDone || 0) + 1;
  if (q._src === 'due') {
    stats.reviewsDone = (stats.reviewsDone || 0) + 1;
  }
  setDailyStats(stats);
  
  // Show next question
  session.index++;
  setTimeout(() => showQuestion(), 300);
}

function updateGradePreviewsForCurrent(state) {
  const mapping = [
    { sel: '.grade-btn.again small', grade: 0 },
    { sel: '.grade-btn.hard small', grade: 1 },
    { sel: '.grade-btn.good small', grade: 2 },
    { sel: '.grade-btn.easy small', grade: 3 }
  ];
  for (const m of mapping) {
    const el = document.querySelector(m.sel);
    if (!el) continue;
    const due = simulateNextDueDate(state, m.grade);
    el.textContent = due;
  }
}

// Enhanced answer checking with fuzzy matching and synonyms
function checkAnswer(q, userAnswer) {
  if (!userAnswer || userAnswer.trim() === '') return false;
  
  if (q.type === 'OX') {
    return q.answer.toLowerCase() === userAnswer.toLowerCase();
  } else if (q.type === 'SHORT') {
    return checkShortAnswer(q.answer, userAnswer, q.synonyms, q.shortFuzzy !== false);
  } else if (q.type === 'KEYWORD') {
    const res = matchKeywordAnswer(q, userAnswer);
    return res.passed;
  }
  
  return false;
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation, keep all letters/numbers
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function fuzzyMatch(target, input, threshold = 0.8) {
  const normalized1 = normalizeText(target);
  const normalized2 = normalizeText(input);
  
  if (normalized1 === normalized2) return true;
  
  const maxLen = Math.max(normalized1.length, normalized2.length);
  const distance = levenshteinDistance(normalized1, normalized2);
  const similarity = 1 - distance / maxLen;
  
  return similarity >= threshold;
}

function checkShortAnswer(correctAnswer, userAnswer, synonyms = [], fuzzyEnabled = true) {
  const userNorm = normalizeText(userAnswer);
  const correctNorm = normalizeText(correctAnswer);
  
  // Exact match
  if (userNorm === correctNorm) return true;
  
  // Fuzzy match with correct answer
  if (fuzzyEnabled && fuzzyMatch(correctAnswer, userAnswer, SHORT_FUZZY)) return true;
  
  // Check synonyms
  if (synonyms && synonyms.length > 0) {
    for (const synonym of synonyms) {
      if (normalizeText(synonym) === userNorm) return true;
      if (fuzzyEnabled && fuzzyMatch(synonym, userAnswer, SHORT_FUZZY)) return true;
    }
  }
  
  return false;
}

// Keyword matching with N-of-M threshold, fuzzy match, and per-keyword synonyms
function buildKeywordGroups(keywords) {
  // Each entry may have alternatives separated by '|', e.g., "process|프로세스"
  return (keywords || []).map(entry =>
    String(entry)
      .split('|')
      .map(s => normalizeText(s))
      .filter(Boolean)
  );
}

function parseKeywordThreshold(q, total) {
  if (q && q.keywordThreshold != null) {
    const t = q.keywordThreshold;
    if (typeof t === 'number' && isFinite(t)) return Math.max(1, Math.min(total, Math.round(t)));
    if (typeof t === 'string') {
      const m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        const d = parseInt(m[2], 10);
        if (d > 0) return Math.max(1, Math.min(total, Math.ceil((n / d) * total)));
      }
    }
  }
  return Math.max(1, Math.ceil(total * 0.75)); // default 75%
}

function matchKeywordAnswer(question, userAnswer) {
  const groups = buildKeywordGroups(question.keywords || []);
  const total = groups.length;
  const threshold = parseKeywordThreshold(question, total);
  const userNorm = normalizeText(userAnswer || '');
  const userWords = userNorm.split(' ').filter(Boolean);

  const perGroup = groups.map(alternatives => {
    // Match if any alternative matches as substring or fuzzy to any user word
    for (const alt of alternatives) {
      if (!alt) continue;
      if (userNorm.includes(alt)) return true;
      for (const w of userWords) {
        const maxLen = Math.max(alt.length, w.length) || 1;
        const dist = levenshteinDistance(alt, w);
        const sim = 1 - dist / maxLen;
        if (sim >= 0.85) return true;
      }
    }
    return false;
  });

  const matched = perGroup.filter(Boolean).length;
  return { passed: matched >= threshold, matched, total, threshold, perGroup };
}

async function showResult(correct, question, userAnswer) {
  const resultArea = document.getElementById('resultArea');
  
  // Get detailed feedback from scoring module
  let feedback = null;
  try {
    const scoringModule = await import('./src/modules/scoring.js');
    feedback = scoringModule.gradeWithFeedback(question, userAnswer);
  } catch (e) {
    console.warn('Could not load scoring module for feedback:', e);
  }
  
  const review = await getReview();
  const state = review[question.id];
  const preview = {
    again: simulateNextDueDate(state, 0),
    hard: simulateNextDueDate(state, 1),
    good: simulateNextDueDate(state, 2),
    easy: simulateNextDueDate(state, 3)
  };
  let html = '<div class="result ' + (correct ? 'ok' : 'ng') + '">';
  
  // Add compact feedback line if available
  if (feedback) {
    const hitsStr = feedback.hits.length ? feedback.hits.join(',') : 'none';
    const missesStr = feedback.misses.length ? feedback.misses.join(',') : 'none';
    html += `<div style="font-size:14px;color:var(--muted);margin-bottom:8px">`;
    html += `Score: ${feedback.score.toFixed(2)} • Hits: {${hitsStr}} • Misses: {${missesStr}}${feedback.notes ? ' • ' + feedback.notes : ''}`;
    html += `</div>`;
  }
  
  if (correct) {
    html += '<h3>✅ 정답!';
    if (window._lastAiResult) {
      html += `<span class="ai-badge">AI:${window._lastAiResult.used}</span>`;
    }
    html += '</h3>';
  } else {
    html += '<h3>❌ 오답</h3>';
    if (question.type === 'KEYWORD' && question.keywords) {
      const match = matchKeywordAnswer(question, userAnswer);
      html += `<div>키워드 매칭 (${match.matched}/${match.total}, 임계값 ${match.threshold})</div>`;
      html += '<div>필요 키워드: ';
      question.keywords.forEach((k, idx) => {
        const found = !!match.perGroup[idx];
        html += `<span class="keyword-match" style="${found ? '' : 'opacity:0.5'}">${k}${found ? ' ✓' : ''}</span>`;
      });
      html += '</div>';
    } else if (question.answer) {
      html += `<div>정답: <strong>${question.answer}</strong></div>`;
    }
  }
  
  if (question.explain) {
    html += `<div style="margin-top:8px;color:var(--muted)">${question.explain}</div>`;
  }
  
  // Add grade buttons
  html += `
    <div class="grade-buttons">
      <button class="grade-btn again" onclick="gradeAnswer(0)" aria-label="Again">Again<br><small>${preview.again}</small></button>
      <button class="grade-btn hard" onclick="gradeAnswer(1)" aria-label="Hard">Hard<br><small>${preview.hard}</small></button>
      <button class="grade-btn good" onclick="gradeAnswer(2)" aria-label="Good">Good<br><small>${preview.good}</small></button>
      <button class="grade-btn easy" onclick="gradeAnswer(3)" aria-label="Easy">Easy<br><small>${preview.easy}</small></button>
    </div>
  `;
  
  html += '</div>';
  resultArea.innerHTML = html;
}

async function finishSession() {
  session.active = false;
  
  // 스트릭 업데이트
  const profile = await getProfile();
  const today = todayStr();
  const last = profile.lastStudy;
  
  if (last !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    
    if (last === yesterdayStr) {
      profile.streak++;
    } else {
      profile.streak = 1;
    }
    profile.lastStudy = today;
    await setProfile(profile);
  }
  
  const qArea = document.getElementById('qArea');
  qArea.innerHTML = `
    <div style="text-align:center;padding:40px">
      <h2>🎉 세션 완료!</h2>
      <div style="margin:20px 0">
        <div class="stat-card" style="display:inline-block;margin:8px">
         <div class="stat-label">획득 XP</div>
         <div class="stat-value">${session.score}</div>
       </div>
       <div class="stat-card" style="display:inline-block;margin:8px">
         <div class="stat-label">정답률</div>
         <div class="stat-value">${Math.round(session.ok / session.total * 100)}%</div>
       </div>
     </div>
     <div style="margin:20px 0">
       <span class="badge success">정답 ${session.ok}</span>
       <span class="badge danger">오답 ${session.ng}</span>
     </div>
     <button onclick="startSession()" class="success">다시 학습하기</button>
   </div>
 `;
 
 await updateHeader();
 showToast(`세션 완료! +${session.score} XP 획득`, 'success');
}

// ========== 문제 추가 ==========
async function addQuestion() {
 const deck = document.getElementById('newDeck').value;
 const type = document.getElementById('newType').value;
 const prompt = document.getElementById('newPrompt').value.trim();
 
 if (!prompt) {
   showToast('문제를 입력해주세요', 'warning');
   return;
 }
 
 const question = {
   deck: deck,
   type: type,
   prompt: prompt,
   explain: document.getElementById('newExplain').value.trim()
 };
 
  if (type === 'OX' || type === 'SHORT') {
    const answer = document.getElementById('newAnswer').value.trim();
    if (!answer) {
      showToast('정답을 입력해주세요', 'warning');
      return;
    }
    question.answer = answer;
    
    // Add synonyms for SHORT type
    if (type === 'SHORT') {
      const synonyms = document.getElementById('newSynonyms').value
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
      if (synonyms.length > 0) {
        question.synonyms = synonyms;
      }
      const fuzzyToggle = document.getElementById('shortFuzzyToggle');
      question.shortFuzzy = !!(fuzzyToggle ? fuzzyToggle.checked : true);
    }
  } else if (type === 'KEYWORD') {
    const keywords = document.getElementById('newKeywords').value
      .split(',')
      .map(k => k.trim())
      .filter(k => k);
    if (keywords.length === 0) {
      showToast('키워드를 입력해주세요', 'warning');
      return;
    }
    question.keywords = keywords;
    const mode = document.getElementById('keywordThresholdMode')?.value || 'default';
    if (mode === 'custom') {
      const thr = (document.getElementById('newKeywordThreshold')?.value || '').trim();
      if (!thr) {
        showToast('임계값을 입력하세요 (예: 3/4 또는 2)', 'warning');
        return;
      }
      question.keywordThreshold = thr;
    }
  }
 
 await DataStore.addQuestion(question);
 
 // 입력 필드 초기화
 document.getElementById('newPrompt').value = '';
 document.getElementById('newAnswer').value = '';
 document.getElementById('newSynonyms').value = '';
 document.getElementById('newKeywords').value = '';
 document.getElementById('newExplain').value = '';
 
 showToast('문제가 추가되었습니다!', 'success');
 await updateQuestionList();
}

function updateAnswerField() {
 const type = document.getElementById('newType').value;
 const answerField = document.getElementById('answerField');
 const synonymField = document.getElementById('synonymField');
 const keywordField = document.getElementById('keywordField');
 const fuzzyToggle = document.getElementById('shortFuzzyToggle');
 const thrMode = document.getElementById('keywordThresholdMode');
 const thrInputWrap = document.getElementById('keywordThresholdInput');
 
 if (type === 'OX') {
   answerField.style.display = 'block';
   synonymField.style.display = 'none';
   keywordField.style.display = 'none';
   document.getElementById('newAnswer').placeholder = 'true 또는 false';
 } else if (type === 'SHORT') {
   answerField.style.display = 'block';
   synonymField.style.display = 'block';
   keywordField.style.display = 'none';
   document.getElementById('newAnswer').placeholder = '정답을 입력하세요';
   if (fuzzyToggle) fuzzyToggle.checked = true;
 } else if (type === 'KEYWORD') {
   answerField.style.display = 'none';
   synonymField.style.display = 'none';
   keywordField.style.display = 'block';
   if (thrMode && thrInputWrap) {
     const mode = thrMode.value || 'default';
     thrInputWrap.style.display = mode === 'custom' ? 'block' : 'none';
   }
 }
}

// ========== 덱 관리 ==========
async function addDeck() {
 const name = document.getElementById('newDeckName').value.trim();
 if (!name) {
   showToast('덱 이름을 입력해주세요', 'warning');
   return;
 }
 
 const decks = await getDecks();
 if (decks.find(d => (d.name || '').toLowerCase() === name.toLowerCase())) {
   showToast('이미 존재하는 덱입니다', 'warning');
   return;
 }
 
 await DataStore.addDeck({ name: name });
 
 document.getElementById('newDeckName').value = '';
 showToast('덱이 추가되었습니다!', 'success');
 
 await updateDeckSelects();
 await updateDeckList();
}

async function deleteDeck(deckId) {
	const questionsInDeck = await db.questions.where('deck').equals(deckId).count();
	let msg = `이 덱을 삭제하시겠습니까?`;
	if (questionsInDeck > 0) {
		msg += ` 관련 문제 ${questionsInDeck}개도 모두 삭제됩니다.`;
	}

	if (!confirm(msg)) {
		return;
	}

	await db.transaction('rw', db.decks, db.questions, db.review, async () => {
		const qIds = await db.questions.where('deck').equals(deckId).primaryKeys();

		if (qIds.length > 0) {
			await db.questions.bulkDelete(qIds);
			await db.review.where('questionId').anyOf(qIds).delete();
		}

		await DataStore.deleteDeck(deckId);
	});

	showToast('덱이 삭제되었습니다', 'success');
	await updateAllLists();
}

async function deleteQuestion(id) {
 if (!confirm('이 문제를 삭제하시겠습니까?')) {
   return;
 }
 
 await DataStore.deleteQuestion(id);
 
 showToast('문제가 삭제되었습니다', 'success');
 await updateQuestionList();
}

// ========== UI 업데이트 ==========
async function updateHeader() {
 const profile = await getProfile();
 document.getElementById('xp').textContent = profile.xp;
 document.getElementById('streak').textContent = profile.streak;
 const v = await getSchemaVersion();
 const el = document.getElementById('dbVer');
 if (el) el.textContent = 'v' + (v ?? '0');
 updateDueLeftUI();
 document.getElementById('dueCount').textContent = await getDueCount();
}

async function getDueCount() {
 const review = await getReview();
 const today = todayStr();
 return Object.values(review).filter(r => r.due <= today).length;
}

async function updateProgress() {
 const percent = session.total > 0 ? (session.index / session.total * 100) : 0;
 document.getElementById('progressBar').style.width = percent + '%';
 document.getElementById('prog').textContent = `${session.index}/${session.total}`;
 document.getElementById('okCnt').textContent = session.ok;
 document.getElementById('ngCnt').textContent = session.ng;
 
  // Update daily goal progress using daily stats (reviewsDone vs limit)
  const { reviewsDone = 0 } = getDailyStats();
  const totalTarget = getSettings().dailyReviewLimit; // keep existing label and target source
  const goalPercent = Math.min(100, (reviewsDone / totalTarget) * 100);
  
  document.getElementById('goalProgressText').textContent = `${reviewsDone}/${totalTarget}`;
  document.getElementById('goalProgressBar').style.width = goalPercent + '%';
  updateDueLeftUI();
}

function updateDueLeftUI() {
  const el = document.getElementById('dueLeft');
  if (!el) return;
  const { reviewsDone = 0 } = getDailyStats();
  const totalTarget = getSettings().dailyReviewLimit;
  const left = Math.max(0, totalTarget - reviewsDone);
  el.textContent = `${left}/${totalTarget}`;
}

async function updateDeckSelects() {
 const decks = await getDecks();
 const html = decks.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
 const htmlWithAll = `<option value="">전체</option>` + html;
 
 document.getElementById('deckSelect').innerHTML = html;
 document.getElementById('newDeck').innerHTML = html;
 
 const qd = document.getElementById('quickDeck');
 if (qd) qd.innerHTML = html;
 
 const qDeckFilter = document.getElementById('qDeckFilter');
 if (qDeckFilter) qDeckFilter.innerHTML = htmlWithAll;

 const deckSelectNotes = document.getElementById('deckSelectNotes');
 if (deckSelectNotes) deckSelectNotes.innerHTML = html;

 const qNoteDeckFilter = document.getElementById('qNoteDeckFilter');
 if (qNoteDeckFilter) qNoteDeckFilter.innerHTML = htmlWithAll;
}

async function updateDeckList() {
 const decks = await getDecks();
 const questions = await getQuestions();
 
 let html = '';
 decks.forEach(d => {
   const count = questions.filter(q => String(q.deck) === String(d.id)).length;
   html += `
     <div class="question-item">
       <div>
         <strong>${d.name}</strong>
         <span class="badge">${count}문제</span>
       </div>
       <button class="danger" onclick="deleteDeck(${d.id})" style="padding:6px 12px">
         삭제
       </button>
     </div>
   `;
 });
 
 document.getElementById('deckList').innerHTML = html;
}

async function updateQuestionList() {
	const search = document.getElementById('qSearch').value.toLowerCase();
	const type = document.getElementById('qTypeFilter').value;
	const tag = document.getElementById('qTagFilter').value.toLowerCase();
	const deckId = document.getElementById('qDeckFilter').value;

	let query = db.questions.toCollection();
	if (deckId) query = query.where('deck').equals(Number(deckId));
	if (type) query = query.filter(q => q.type === type);
	if (tag) query = query.filter(q => (q.tags || []).some(t => t.toLowerCase().includes(tag)));
	if (search) {
		query = query.filter(q =>
			q.prompt.toLowerCase().includes(search) ||
			(q.answer || '').toLowerCase().includes(search) ||
			(q.explain || '').toLowerCase().includes(search)
		);
	}

	let questions;
	try {
		questions = await query.orderBy('sortOrder').toArray();
	} catch (error) {
		if (error.name === 'SchemaError' && error.message.includes('sortOrder')) {
			// Fallback to default ordering for old schema
			console.warn('Database schema outdated, using default ordering');
			questions = await query.toArray();
		} else {
			throw error;
		}
	}
	const [, decks] = await Promise.all([Promise.resolve(), getDecks()]);
	const deckMap = new Map(decks.map(d => [d.id, d.name]));

	let html = '';
	questions.forEach((q, index) => {
		const deckName = deckMap.get(q.deck) || '알 수 없음';
		html += `
      <div class="question-item" draggable="true" data-question-id="${q.id}" data-index="${index}"
           ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)" 
           ondrop="handleDrop(event)" ondragend="handleDragEnd(event)">
        <div class="drag-handle">⋮⋮</div>
        <div style="flex:1">
          <div class="badge">${deckName} · ${q.type}</div>
          <div style="margin-top:4px">${escapeHtml(q.prompt.substring(0, 50))}...</div>
        </div>
        <button class="danger" onclick="deleteQuestion(${q.id})" style="padding:6px 12px">
          삭제
        </button>
      </div>
    `;
	});

	document.getElementById('questionList').innerHTML = html || '<div style="text-align:center;color:var(--muted);padding:20px">문제가 없습니다</div>';
}

async function updateStats() {
 const profile = await getProfile();
 const questions = await getQuestions();
 const review = await getReview();
 
 // 7일 롤링 정답률
 const roll = await getDailyRollup();
 const dates = Array.from({length:7}, (_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().slice(0,10); });
 let sumC=0, sumT=0, maxT=1;
 dates.forEach(d=>{ const r=roll[d]||{correct:0,total:0}; sumC+=r.correct; sumT+=r.total; if (r.total>maxT) maxT=r.total; });
 const rolling = sumT===0?0:Math.round((sumC/sumT)*100);

 // Due counts
 const today = todayStr();
 const tomorrow = (()=>{const t=new Date(today); t.setDate(t.getDate()+1); return t.toISOString().slice(0,10);})();
 const weekEnd = (()=>{const t=new Date(today); t.setDate(t.getDate()+7); return t;})();
 const vals = Object.values(review);
 const dueToday = vals.filter(r=> r.due === today).length;
 const dueTomorrow = vals.filter(r=> r.due === tomorrow).length;
 const dueWeek = vals.filter(r=> { const d=new Date(r.due); return d>new Date(today) && d<=weekEnd; }).length;

 // Weekly activity bars
 let bars = '<div style="display:flex;gap:6px;align-items:flex-end">';
 dates.forEach(d=>{ const r=roll[d]||{total:0}; const h=Math.round((r.total/maxT)*40); bars+=`<div title="${d}: ${r.total}" style="width:12px;height:${h}px;background:#6366f1;border-radius:3px"></div>`; });
 bars += '</div>';

 // 학습 통계
 let statsHtml = `
   <div style="margin-bottom:16px">
     <div class="stat-label">총 학습 문제</div>
     <div class="stat-value">${Object.keys(review).length}</div>
   </div>
   <div style="margin-bottom:16px">
     <div class="stat-label">총 문제 수</div>
     <div class="stat-value">${questions.length}</div>
   </div>
   <div style="margin-bottom:16px">
     <div class="stat-label">7일 정답률</div>
     <div class="stat-value">${rolling}%</div>
   </div>
   <div style="margin-bottom:16px">
     <div class="stat-label">예정 항목</div>
     <div class="stat-value">오늘 ${dueToday} · 내일 ${dueTomorrow} · 이번 주 ${dueWeek}</div>
   </div>
   <div style="margin-bottom:16px">
     <h3 style="font-size:16px;color:var(--muted);margin-bottom:8px">일일 복습 활동</h3>
     <canvas id="dailyReviewChart" width="400" height="200"></canvas>
   </div>
   <div style="margin-bottom:16px">
     <h3 style="font-size:16px;color:var(--muted);margin-bottom:8px">연속 학습 현황</h3>
     <canvas id="streakChart" width="400" height="150"></canvas>
   </div>
`;
 document.getElementById('statsContent').innerHTML = statsHtml;
 
 // Initialize charts after DOM is updated
 await initStatsCharts({ roll, dates, profile });
 
 // 성취도
 let achievementHtml = '';
 const achievements = [
  {name: '🔥 불타는 열정', desc: '7일 연속 학습', achieved: profile.streak >= 7},
  {name: '💯 백점 만점', desc: '세션 정답률 100%', achieved: false},
  {name: '📚 지식 탐험가', desc: 'XP 1000 달성', achieved: profile.xp >= 1000},
  {name: '🎯 정확한 저격수', desc: '7일 정답률 80%', achieved: rolling >= 80}
];
 
 achievements.forEach(a => {
   achievementHtml += `
     <div style="margin-bottom:12px;opacity:${a.achieved ? 1 : 0.5}">
       <div>${a.name} ${a.achieved ? '✓' : ''}</div>
       <div style="font-size:12px;color:var(--muted)">${a.desc}</div>
     </div>
   `;
 });
 document.getElementById('achievementContent').innerHTML = achievementHtml;
 
 // 복습 일정
 const todayDate = new Date(today);
 const upcoming = Object.entries(review)
   .filter(([id, r]) => new Date(r.due) > todayDate)
   .sort((a, b) => new Date(a[1].due) - new Date(b[1].due))
   .slice(0, 10);
 
 let scheduleHtml = '';
 if (upcoming.length > 0) {
   upcoming.forEach(([id, r]) => {
     const q = questions.find(q => q.id == id);
     if (q) {
       scheduleHtml += `
         <div style="margin-bottom:8px">
           <div style="font-size:14px">${escapeHtml(q.prompt.substring(0, 30))}...</div>
           <div class="badge">${r.due}</div>
         </div>
       `;
     }
   });
 } else {
   scheduleHtml = '<div style="color:var(--muted)">예정된 복습이 없습니다</div>';
 }
 document.getElementById('scheduleContent').innerHTML = scheduleHtml;
 
 // Hardest 10 (by low ease, then high againCount)
 const revArr = Object.entries(review).map(([id,r])=>({id: Number(id), ease: r.ease ?? 2.5, again: r.againCount||0}));
 revArr.sort((a,b)=> (a.ease - b.ease) || (b.again - a.again));
 const hardest = revArr.slice(0,10);
 let hardHtml = '';
 hardest.forEach(item=>{
   const q = questions.find(q=> q.id == item.id);
   if (q) hardHtml += `<div style=\"margin-bottom:6px\"><span class=\"badge\">ease ${item.ease.toFixed(2)} · again ${item.again}</span> ${escapeHtml(q.prompt.substring(0,40))}</div>`;
 });
 if (!hardHtml) hardHtml = '<div style=\"color:var(--muted)\">데이터가 부족합니다</div>';
 const statsContainer = document.getElementById('statsContent');
 statsContainer.innerHTML += `<div style=\"margin-top:16px\"><div class=\"stat-label\">어려운 문제 Top 10</div>${hardHtml}</div>`;
}

async function calculateAvgAccuracy() {
 const review = await getReview();
 const totals = Object.values(review).reduce((acc, r) => {
   acc.count += (r.count || 0);
   acc.correct += (r.correct || 0);
   return acc;
 }, {count: 0, correct: 0});
 if (totals.count === 0) return 0;
 return Math.round((totals.correct / totals.count) * 100);
}

// ========== 데이터 관리 ==========
async function exportData() {
 const data = {
   version: '1.0',
   date: new Date().toISOString(),
   profile: await getProfile(),
   decks: await getDecks(),
   questions: await getQuestions(),
   review: await getReview(),
   notes: await DataStore.getNotes(),
   note_items: await db.note_items.toArray(),
   meta: { schemaVersion: await getSchemaVersion() }
 };
 
 const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `cs-study-backup-${todayStr()}.json`;
 a.click();
 
 showToast('데이터를 내보냈습니다', 'success');
}

async function importData(event) {
	const file = event.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = async function(e) {
		try {
			const data = JSON.parse(e.target.result);

			if (!data || typeof data !== 'object') {
				throw new Error('Invalid data format');
			}

			if (confirm('현재 데이터를 덮어씁니다. 계속하시겠습니까?')) {
				await db.delete();
				await db.open();

				if (data.profile) await setProfile(data.profile);

				if (Array.isArray(data.decks)) {
					await db.decks.bulkAdd(data.decks);
				}

				if (Array.isArray(data.questions)) {
					await db.questions.bulkAdd(data.questions);
				}

				if (Array.isArray(data.notes)) {
					await db.notes.bulkAdd(data.notes);
				}

				if (Array.isArray(data.note_items)) {
					await db.note_items.bulkAdd(data.note_items);
				}

				if (data.review) {
          const reviews = Object.entries(data.review).map(([qid, r]) => ({...r, questionId: parseInt(qid)}));
          if (reviews.length > 0) await db.review.bulkAdd(reviews);
				}

				if (data.meta && data.meta.schemaVersion) {
					await setSchemaVersion(data.meta.schemaVersion);
				}

				await updateAllLists();
				showToast('데이터를 가져왔습니다', 'success');
			}
		} catch (error) {
			console.error('Import error:', error);
			showToast(`가져오기 실패: ${error.message}`, 'danger');
		}
	};
	reader.readAsText(file);
}

async function resetAll() {
 if (!confirm('모든 데이터를 초기화합니다. 계속하시겠습니까?')) {
   return;
 }
 
	// Clear IndexedDB
	await db.delete();
	await db.open();

	// Clear any remaining localStorage
	Object.values(LEGACY_KEY).forEach(k => localStorage.removeItem(k));
 
 await updateHeader();
 await updateDeckSelects();
 await updateDeckList();
 await updateQuestionList();
 
 showToast('모든 데이터가 초기화되었습니다', 'success');
}

async function resetData() {
	if (!confirm('샘플 데이터를 추가하시겠습니까? 기존 데이터는 유지됩니다.')) {
		return;
	}
	try {
		const deckCount = await db.decks.count();
		const questionCount = await db.questions.count();

		if (deckCount > 0 && questionCount > 0) {
			showToast('이미 데이터가 존재하여 샘플을 추가하지 않았습니다.', 'info');
			return;
		}

		const deckIdMap = {};
		for (const d of defaultDecks) {
			const existing = await db.decks.where('name').equalsIgnoreCase(d.name).first();
			if (existing) {
				deckIdMap[d.id] = existing.id;
			} else {
				const newId = await db.decks.add({ name: d.name, created: new Date() });
				deckIdMap[d.id] = newId;
			}
		}

		for (const q of sampleQuestions) {
			const newQ = { ...q, id: undefined, deck: deckIdMap[q.deck] || null, created: new Date() };
			await db.questions.add(newQ);
		}

		showToast('샘플 데이터가 추가되었습니다.', 'success');
		await updateAllLists();
	} catch (e) {
		console.error('resetData error', e);
		showToast('샘플 데이터 추가 중 오류 발생', 'danger');
	}
}

async function updateSettingsPanel() {
  const input = document.getElementById('dailyLimitInput');
  if (!input) return;
  const s = getSettings();
  input.value = s.dailyReviewLimit;
  
  const aiMode = document.getElementById('aiMode');
  if (aiMode) {
    aiMode.value = localStorage.getItem('aiMode') || 'local';
  }
}

async function saveSettings() {
  const input = document.getElementById('dailyLimitInput');
  if (!input) return;
  const raw = input.value.trim();
  const val = parseInt(raw, 10);
  if (!Number.isFinite(val) || val < 1 || val > 500) {
    showToast('1~500 사이의 숫자를 입력하세요', 'warning');
    return;
  }
  setSettings({ dailyReviewLimit: val });
  
  const aiMode = document.getElementById('aiMode');
  if (aiMode) {
    localStorage.setItem('aiMode', aiMode.value);
  }
  
  updateDueLeftUI();
  await updateProgress();
  showToast('설정이 저장되었습니다', 'success');
}

// ========== 유틸리티 ==========
async function showTab(e, tabName) {
 document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
 document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
 
 e.target.classList.add('active');
 document.getElementById(tabName + 'Tab').style.display = 'block';
 
 if (tabName === 'manage') {
   await updateDeckList();
   await updateQuestionList();
   await updateSettingsPanel();
 } else if (tabName === 'stats') {
   await updateStats();
 } else if (tabName === 'notes') {
   await updateDeckSelects();
   await loadNotes();
 }
}

function showToast(message, type = 'info') {
 const toast = document.getElementById('toast');
 toast.innerHTML = `
   <div style="display:flex;align-items:center;gap:8px">
     <span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'danger' ? '❌' : 'ℹ️'}</span>
     <span>${message}</span>
   </div>
 `;
 toast.classList.add('show');
 
 setTimeout(() => {
   toast.classList.remove('show');
 }, 3000);
}

// ========== Guided Import (CSV/TSV + 미리보기/되돌리기) ==========
function setupGuidedImport() {
  const drop = document.getElementById('importDrop');
  const fileInput = document.getElementById('importDelimitedFile');
  if (!drop || !fileInput) return; // UI가 없으면 조용히 종료
  // 클릭으로 파일 선택
  drop.addEventListener('click', () => fileInput.click());
  // 드래그 스타일
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.background = 'rgba(99,102,241,0.08)'; });
  drop.addEventListener('dragleave', () => { drop.style.background = ''; });
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.style.background = ''; handleDelimitedFile(e.dataTransfer.files[0]); });
  // 파일 선택 처리
  fileInput.addEventListener('change', (e) => handleDelimitedFile(e.target.files[0]));
}

function downloadImportTemplate() {
  const headers = ['type','deck','prompt','answer','synonyms','keywords','keywordThreshold','explain','tags'];
  const sample = [
    ['OX','net','TCP는 연결 지향이다.','true','','','','3-way handshake 관련','net,group:transport'],
    ['SHORT','os','ACID 중 A는?','Atomicity','원자성, atomic','','','트랜잭션 성질',''],
    ['KEYWORD','db','인덱스의 장점을 설명하시오','','','검색|조회, 성능, B-Tree','','선택사항','group:index']
  ];
  const toCsvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = headers.join(',') + '\n' + sample.map(r => r.map(toCsvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cs-study-template.csv'; a.click();
}

async function handleDelimitedFile(file) {
  if (!file) return;
  const text = await file.text();
  processDelimitedText(text);
}

function detectDelimiter(text) {
  return text.indexOf('\t') !== -1 ? '\t' : ',';
}

function parseDelimited(text, delimiter) {
  // 간단 파서: TSV는 분리, CSV는 따옴표 처리(기본 수준)
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (delimiter === '\t') return lines.map(l => l.split('\t'));
  const rows = [];
  for (const line of lines) {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { cells.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

let importPreviewRows = [];

function processDelimitedText(text) {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) return;
  const headers = rows[0].map(h => h.trim());
  const body = rows.slice(1);
  const idx = (name) => headers.indexOf(name);
  importPreviewRows = body.map(cols => validateImportRow({
    type: (cols[idx('type')] || '').trim(),
    deck: (cols[idx('deck')] || '').trim(),
    prompt: (cols[idx('prompt')] || '').trim(),
    answer: (cols[idx('answer')] || '').trim(),
    synonyms: ((cols[idx('synonyms')] || '').split(',').map(s => s.trim()).filter(Boolean)),
    keywords: ((cols[idx('keywords')] || '').split(',').map(s => s.trim()).filter(Boolean)),
    keywordThreshold: (cols[idx('keywordThreshold')] || '').trim(),
    explain: (cols[idx('explain')] || ''),
    tags: ((cols[idx('tags')] || '').split(',').map(s => s.trim()).filter(Boolean))
  }));
  renderImportPreview();
}

function validateImportRow(row) {
  const errors = [];
  const t = (row.type || '').toUpperCase();
  if (!['OX', 'SHORT', 'KEYWORD'].includes(t)) errors.push('유형 오류');
  if (!row.deck) errors.push('덱 누락');
  if (!row.prompt) errors.push('문제 누락');
  if (t === 'OX') {
    if (!['true', 'false', 'TRUE', 'FALSE'].includes(String(row.answer))) errors.push('OX 정답 오류');
  } else if (t === 'SHORT') {
    if (!row.answer) errors.push('정답 누락');
  } else if (t === 'KEYWORD') {
    if (!row.keywords || row.keywords.length === 0) errors.push('키워드 누락');
  }
  return { ...row, type: t, error: errors.join(', ') };
}

function renderImportPreview() {
  const sum = document.getElementById('importSummary');
  const prev = document.getElementById('importPreview');
  const btn = document.getElementById('importValidBtn');
  const valid = importPreviewRows.filter(r => !r.error);
  const invalid = importPreviewRows.length - valid.length;
  if (sum) sum.textContent = `총 ${importPreviewRows.length}행 · 유효 ${valid.length} · 오류 ${invalid}`;
  const rows = importPreviewRows.slice(0, 10);
  let html = '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse">';
  html += '<tr><th style="text-align:left;padding:6px">type</th><th>deck</th><th>prompt</th><th>answer</th><th>synonyms</th><th>keywords</th><th>thr</th><th>tags</th><th>오류</th></tr>';
  rows.forEach((r) => {
    html += `<tr>
      <td style="padding:6px">${r.type}</td>
      <td contenteditable style="padding:6px">${escapeHtml(r.deck)}</td>
      <td contenteditable style="padding:6px">${escapeHtml(r.prompt)}</td>
      <td contenteditable style="padding:6px">${escapeHtml(r.answer||'')}</td>
      <td contenteditable style="padding:6px">${escapeHtml((r.synonyms||[]).join(', '))}</td>
      <td contenteditable style="padding:6px">${escapeHtml((r.keywords||[]).join(', '))}</td>
      <td contenteditable style="padding:6px">${escapeHtml(r.keywordThreshold||'')}</td>
      <td contenteditable style="padding:6px">${escapeHtml((r.tags||[]).join(', '))}</td>
      <td style="padding:6px;color:${r.error?'#ef4444':'#22c55e'}">${r.error||'OK'}</td>
    </tr>`;
  });
  html += '</table></div>';
  if (prev) prev.innerHTML = html;
  if (btn) btn.disabled = valid.length === 0;
}

async function importValidPreviewRows() {
  // 미리보기 편집내용 동기화 (첫 10행)
  const prev = document.getElementById('importPreview');
  if (prev) {
    const trs = prev.querySelectorAll('tr');
    for (let i = 1; i < trs.length; i++) {
      const idx = i - 1;
      if (!importPreviewRows[idx]) continue;
      const tds = trs[i].querySelectorAll('td');
      importPreviewRows[idx].deck = tds[1].textContent.trim();
      importPreviewRows[idx].prompt = tds[2].textContent.trim();
      importPreviewRows[idx].answer = tds[3].textContent.trim();
      importPreviewRows[idx].synonyms = tds[4].textContent.split(',').map(s=>s.trim()).filter(Boolean);
      importPreviewRows[idx].keywords = tds[5].textContent.split(',').map(s=>s.trim()).filter(Boolean);
      importPreviewRows[idx].keywordThreshold = tds[6].textContent.trim();
      importPreviewRows[idx].tags = tds[7].textContent.split(',').map(s=>s.trim()).filter(Boolean);
      const validated = validateImportRow(importPreviewRows[idx]);
      importPreviewRows[idx] = validated;
    }
  }
  const valid = importPreviewRows.filter(r => !r.error);
  if (valid.length === 0) { showToast('가져올 유효한 항목이 없습니다', 'warning'); return; }
  const decks = await getDecks();
  const nameToId = {}; decks.forEach(d => nameToId[(d.name||'').toLowerCase()] = d.id);
  const createdIds = [];
  for (const r of valid) {
    let deckId = nameToId[(r.deck||'').toLowerCase()];
    if (deckId === undefined) {
      await DataStore.addDeck({ name: r.deck });
      const nd = await getDecks();
      const found = nd.find(d => (d.name||'').toLowerCase() === (r.deck||'').toLowerCase());
      deckId = found?.id;
      nameToId[(r.deck||'').toLowerCase()] = deckId;
    }
    const q = { deck: deckId, type: r.type, prompt: r.prompt, explain: r.explain||'', tags: r.tags||[] };
    if (r.type === 'OX') { q.answer = String(r.answer).toLowerCase() === 'true' ? 'true' : 'false'; }
    else if (r.type === 'SHORT') { q.answer = r.answer; if (r.synonyms?.length) q.synonyms = r.synonyms; q.shortFuzzy = true; }
    else if (r.type === 'KEYWORD') { q.keywords = r.keywords; if (r.keywordThreshold) q.keywordThreshold = r.keywordThreshold; }
    const id = await DataStore.addQuestion(q);
    createdIds.push(id);
  }
  window.lastImport = { questionIds: createdIds };
  const undoBtn = document.getElementById('undoImportBtn'); if (undoBtn) undoBtn.disabled = createdIds.length === 0;
  showToast(`${createdIds.length}개 항목을 가져왔습니다`, 'success');
  await updateQuestionList();
}

function undoLastImport() {
  const last = window.lastImport;
  if (!last || !last.questionIds || last.questionIds.length === 0) { showToast('되돌릴 가져오기가 없습니다', 'warning'); return; }
  Promise.all(last.questionIds.map(id => DataStore.deleteQuestion(id))).then(async () => {
    window.lastImport = null;
    const undoBtn = document.getElementById('undoImportBtn'); if (undoBtn) undoBtn.disabled = true;
    await updateQuestionList();
    showToast('마지막 가져오기를 되돌렸습니다', 'success');
  });
}

function parseNaturalLanguage() {
  const text = document.getElementById('nlPaste')?.value || '';
  if (!text.trim()) { showToast('내용을 입력하세요', 'warning'); return; }
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/^[-•\s]+/, '').trim()).filter(Boolean);
  importPreviewRows = lines.map(line => {
    const parts = line.split(',').map(s => s.trim()).filter(Boolean);
    const prompt = parts[0];
    const keywords = parts.slice(1);
    return validateImportRow({ type: 'KEYWORD', deck: '', prompt, answer: '', synonyms: [], keywords, keywordThreshold: '', explain: '', tags: [] });
  });
  renderImportPreview();
}

// ========== 빠른 추가 (덱별) ==========
function updateQuickAddFields() {
  const type = document.getElementById('quickType')?.value || 'OX';
  const ans = document.getElementById('quickAnswerWrap');
  const syn = document.getElementById('quickSynWrap');
  const key = document.getElementById('quickKeyWrap');
  if (!ans || !syn || !key) return;
  if (type === 'OX') { ans.style.display = 'block'; syn.style.display = 'none'; key.style.display = 'none'; }
  else if (type === 'SHORT') { ans.style.display = 'block'; syn.style.display = 'block'; key.style.display = 'none'; }
  else { ans.style.display = 'none'; syn.style.display = 'none'; key.style.display = 'block'; }
}

async function quickAdd() {
  const deck = document.getElementById('quickDeck')?.value;
  const type = document.getElementById('quickType')?.value || 'OX';
  const prompt = (document.getElementById('quickPrompt')?.value || '').trim();
  if (!deck) { showToast('덱을 선택하세요', 'warning'); return; }
  if (!prompt) { showToast('문제를 입력하세요', 'warning'); return; }
  const q = { deck, type, prompt };
  if (type === 'OX' || type === 'SHORT') {
    const ans = (document.getElementById('quickAnswer')?.value || '').trim();
    if (!ans) { showToast('정답을 입력하세요', 'warning'); return; }
    q.answer = ans;
    if (type === 'SHORT') {
      const syn = (document.getElementById('quickSynonyms')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      if (syn.length) q.synonyms = syn;
      q.shortFuzzy = !!document.getElementById('quickFuzzy')?.checked;
    }
  } else if (type === 'KEYWORD') {
    const kw = (document.getElementById('quickKeywords')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!kw.length) { showToast('키워드를 입력하세요', 'warning'); return; }
    q.keywords = kw;
    const thr = (document.getElementById('quickKeyThr')?.value || '').trim(); if (thr) q.keywordThreshold = thr;
  }
  await DataStore.addQuestion(q);
  // clear inputs
  const ids = ['quickPrompt','quickAnswer','quickSynonyms','quickKeywords','quickKeyThr'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  showToast('추가되었습니다', 'success');
  await updateQuestionList();
}

function shuffle(arr) {
 const copy = [...arr];
 for (let i = copy.length - 1; i > 0; i--) {
   const j = Math.floor(Math.random() * (i + 1));
   [copy[i], copy[j]] = [copy[j], copy[i]];
 }
 return copy;
}

function escapeHtml(str) {
 const div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
}

let currentNoteId = null;
const selectedNoteItemIds = new Set();

async function loadNotes() {
  const search = document.getElementById('qNoteSearch').value.toLowerCase();
  const deckId = document.getElementById('qNoteDeckFilter').value;

  let notes = await db.notes.orderBy('title').toArray();
  if (deckId) {
    notes = notes.filter(n => Number(n.deckId) === Number(deckId));
  }
  if (search) {
    notes = notes.filter(n => n.title.toLowerCase().includes(search));
  }

  const listEl = document.getElementById('notesList');
  listEl.innerHTML = notes.map(note => `
    <div class="question-item" onclick="loadNote(${note.id})">
      ${escapeHtml(note.title)}
    </div>
  `).join('') || '<div style="text-align:center;color:var(--muted);padding:20px">노트가 없습니다.</div>';
}

async function createNote() {
  const deckId = document.getElementById('deckSelectNotes').value;
  const title = document.getElementById('noteTitle').value.trim();
  const source = document.getElementById('noteSource').value.trim();

  if (!title) {
    showToast('노트 제목을 입력하세요.', 'warning');
    return;
  }

  const newNoteId = await db.notes.add({
    deckId: Number(deckId),
    title,
    source,
    created: new Date(),
    updated: new Date(),
  });

  await loadNotes();
  loadNote(newNoteId);
}

async function loadNote(id) {
  currentNoteId = id;
  selectedNoteItemIds.clear();

  const note = await db.notes.get(id);
  if (!note) {
    // Clear editor
    return;
  }

  document.getElementById('deckSelectNotes').value = note.deckId;
  document.getElementById('noteTitle').value = note.title;
  document.getElementById('noteSource').value = note.source || '';

  const items = await db.note_items.where('noteId').equals(id).sortBy('ts');
  document.getElementById('noteTextarea').value = items.map(item => item.text).join('\n');
}

async function addLine() {
  if (!currentNoteId) return;
  // In a real implementation, this would come from a dedicated input
  // For now, we'll add a placeholder line.
  const text = `새로운 줄 - ${new Date().toLocaleTimeString()}`;

  await db.note_items.add({
    noteId: currentNoteId,
    ts: new Date().toISOString(),
    text,
    tags: [],
  });

  // Append to textarea and reload
  const textarea = document.getElementById('noteTextarea');
  textarea.value += '\n' + text;
}

function toggleSelectLine(id) {
  if (selectedNoteItemIds.has(id)) {
    selectedNoteItemIds.delete(id);
  } else {
    selectedNoteItemIds.add(id);
  }
  // In a real UI, re-render the line to show selection state
}

async function deleteLine(id) {
  await db.note_items.delete(id);
  loadNote(currentNoteId);
}

async function deleteNoteCascade(id) {
  if (!confirm('정말로 이 노트를 삭제하시겠습니까?')) return;

  await db.note_items.where('noteId').equals(id).delete();
  await db.notes.delete(id);

  currentNoteId = null;
  // Clear editor and reload list
  document.getElementById('deckSelectNotes').value = '';
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteSource').value = '';
  document.getElementById('noteTextarea').value = '';
  await loadNotes();
}

async function saveNoteMeta() {
  if (!currentNoteId) return;

  const deckId = document.getElementById('deckSelectNotes').value;
  const title = document.getElementById('noteTitle').value.trim();
  const source = document.getElementById('noteSource').value.trim();

  if (!title) {
    showToast('노트 제목은 비워둘 수 없습니다.', 'warning');
    return;
  }

  await db.notes.update(currentNoteId, {
    deckId: Number(deckId),
    title,
    source,
    updated: new Date(),
  });

  showToast('노트가 저장되었습니다.', 'success');
  await loadNotes(); // Refresh list to show new title
}

async function noteLinesToDraftQuestions() {
  if (!currentNoteId || selectedNoteItemIds.size === 0) {
    showToast('변환할 노트 줄을 선택하세요.', 'warning');
    return;
  }

  const note = await db.notes.get(currentNoteId);
  if (!note) return;

  const itemsToConvert = await db.note_items.where('id').anyOf(Array.from(selectedNoteItemIds)).toArray();

  const newQuestions = itemsToConvert.map(item => ({
    deck: note.deckId,
    type: 'SHORT',
    prompt: item.text,
    answer: '',
    explain: `노트 '${note.title}'에서 생성됨`,
    keywords: [],
    synonyms: [],
    tags: ['from:note'],
    created: new Date(),
  }));

  await db.questions.bulkAdd(newQuestions);

  selectedNoteItemIds.clear();
  showToast(`${newQuestions.length}개의 질문 초안이 생성되었습니다.`, 'success');
  // Visually clear selection in a real implementation
}

async function exportNoteAsMarkdown() {
  if (!currentNoteId) {
    showToast('내보낼 노트를 선택하세요.', 'warning');
    return;
  }

  const note = await db.notes.get(currentNoteId);
  if (!note) return;

  const items = await db.note_items.where('noteId').equals(currentNoteId).sortBy('ts');
  const decks = await getDecks();
  const deck = decks.find(d => d.id === note.deckId);

  let markdown = `# ${note.title}\n\n`;
  if (deck) {
    markdown += `- Deck: ${deck.name}\n`;
  }
  if (note.source) {
    markdown += `- Source: ${note.source}\n`;
  }
  markdown += `- Created: ${new Date(note.created).toISOString()}\n\n`;
  markdown += `## Notes\n\n`;

  markdown += items.map(item => `- [${new Date(item.ts).toLocaleString()}] ${item.text}`).join('\n');

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ========== 노트 관리 ==========
let currentNote = null;

async function updateNotesList() {
  const search = document.getElementById('noteSearch').value.toLowerCase();
  const notes = await DataStore.getNotes();
  const decks = await getDecks();
  const deckMap = new Map(decks.map(d => [d.id, d.name]));

  const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(search));

  const listEl = document.getElementById('notesList');
  listEl.innerHTML = filteredNotes.map(n => `
    <div class="question-item" onclick="openNote(${n.id})">
      <div>
        <strong>${escapeHtml(n.title)}</strong>
        <div class="badge">${deckMap.get(n.deckId) || '덱 없음'}</div>
      </div>
    </div>
  `).join('') || '<div style="text-align:center;color:var(--muted);padding:20px">노트가 없습니다</div>';
}

async function addNewNote() {
  const deckId = document.getElementById('deckSelect').value;
  if (!deckId) {
    showToast('노트를 추가하려면 먼저 학습 탭에서 덱을 선택하세요.', 'warning');
    return;
  }
  const newNoteId = await DataStore.addNote({
    deckId: Number(deckId),
    title: '새 노트',
    created: new Date(),
    updated: new Date()
  });
  await updateNotesList();
  await openNote(newNoteId);
}

async function openNote(noteId) {
  currentNote = await DataStore.getNote(noteId);
  if (!currentNote) return;

  document.getElementById('noNoteSelected').style.display = 'none';
  document.getElementById('noteEditor').style.display = 'block';

  document.getElementById('noteTitle').textContent = currentNote.title;
  const decks = await getDecks();
  const deckName = (decks.find(d => d.id === currentNote.deckId) || {}).name || '알 수 없음';
  document.getElementById('noteDeckName').textContent = deckName;

  await renderNoteItems();
}

async function renderNoteItems() {
  const items = await DataStore.getNoteItems(currentNote.id);
  const container = document.getElementById('noteItems');
  container.innerHTML = items.map(item => `
    <div class="note-item" data-id="${item.id}" data-type="${item.type}">
      <span class="note-handle">::</span>
      <div class="note-content ${item.type}" contenteditable="true" onblur="saveNoteItem(${item.id}, this)">${escapeHtml(item.content)}</div>
      <button class="note-delete" onclick="deleteNoteItem(${item.id})">×</button>
    </div>
  `).join('');
}

async function addNoteItem(type) {
  if (!currentNote) return;
  const items = await DataStore.getNoteItems(currentNote.id);
  await DataStore.addNoteItem({
    noteId: currentNote.id,
    type: type,
    content: '...',
    order: items.length,
    created: new Date(),
    updated: new Date()
  });
  await renderNoteItems();
}

async function saveNoteItem(itemId, element) {
  await DataStore.updateNoteItem(itemId, { content: element.innerText });
}

async function deleteNoteItem(itemId) {
  await DataStore.deleteNoteItem(itemId);
  await renderNoteItems();
}

async function deleteCurrentNote() {
  if (!currentNote || !confirm('정말로 이 노트를 삭제하시겠습니까?')) return;
  await DataStore.deleteNote(currentNote.id);
  currentNote = null;
  document.getElementById('noteEditor').style.display = 'none';
  document.getElementById('noNoteSelected').style.display = 'block';
  await updateNotesList();
}

async function exportNoteToMarkdown() {
  if (!currentNote) return;
  const items = await DataStore.getNoteItems(currentNote.id);
  const title = document.getElementById('noteTitle').textContent;
  let md = `# ${title}\n\n`;
  md += items.map(item => {
    if (item.type === 'h1') return `# ${item.content}`;
    if (item.type === 'h2') return `## ${item.content}`;
    if (item.type === 'code') return '```\n' + item.content + '\n```';
    return `- ${item.content}`;
  }).join('\n');

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.md`;
  a.click();
}

async function convertSelectionToQuestions() {
  // This is a placeholder for a more complex feature.
  showToast('선택한 노트 항목을 문제로 변환하는 기능은 곧 추가될 예정입니다.', 'info');
}


async function updateAllLists() {
	await updateHeader();
	await updateDeckSelects();
	await updateDeckList();
	await updateQuestionList();
  await loadNotes();
}

// ========== PWA Service Worker ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful');
      })
      .catch(function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

// Install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  const installBtn = document.createElement('button');
  installBtn.textContent = '📱 앱 설치';
  installBtn.className = 'secondary';
  installBtn.style.margin = '8px';
  installBtn.onclick = () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
      installBtn.remove();
    });
  };
  document.querySelector('.stats').appendChild(installBtn);
}

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', async function() {
 try {
   // Initialize database and run migration if needed
   await migrateFromLocalStorage();
   
   // Initialize UI
   await updateHeader();
  await updateDeckSelects();
  // Optional: guided import setup (guard if not defined)
  try { if (typeof setupGuidedImport === 'function') setupGuidedImport(); } catch (_) {}
   
  console.log('Application initialized successfully');
  try { runSM2PreviewTests(); } catch (_) {}
 } catch (error) {
   console.error('Initialization error:', error);
   showToast('앱 초기화 중 오류가 발생했습니다', 'danger');
 }
 
});

document.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".logo");
  if (logo) {
    logo.style.cursor = "pointer"; // 시각적 피드백
    logo.addEventListener("click", () => {
      switchTab("study");
    });
  }
});

// [1] 기존 showTab 함수 (그대로 두기)

// [2] 새로 추가
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

  const btn = document.getElementById('tab-btn-' + tab);
  const panel = document.getElementById('tab-' + tab) || document.getElementById(tab + 'Tab');
  if (btn) btn.classList.add('active');
  if (panel) panel.style.display = 'block';

  if (tab === 'manage') {
    updateDeckList(); updateQuestionList(); updateSettingsPanel();
  } else if (tab === 'stats') {
    updateStats();
  } else if (tab === 'notes') {
    updateDeckSelects(); loadNotes();
  }
}

// ========== Theme Management ==========
function getTheme() {
  return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}

function setTheme(theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  if (icon) {
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
}

function initTheme() {
  const theme = getTheme();
  setTheme(theme);
}

// ========== Drag & Drop for Question Reordering ==========
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.outerHTML);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.target.closest('.question-item');
  if (target && target !== draggedElement) {
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    if (e.clientY < midY) {
      target.classList.add('drag-over-top');
      target.classList.remove('drag-over-bottom');
    } else {
      target.classList.add('drag-over-bottom');
      target.classList.remove('drag-over-top');
    }
  }
}

function handleDrop(e) {
  e.preventDefault();
  
  const target = e.target.closest('.question-item');
  if (target && target !== draggedElement) {
    const container = target.parentNode;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    if (e.clientY < midY) {
      container.insertBefore(draggedElement, target);
    } else {
      container.insertBefore(draggedElement, target.nextSibling);
    }
    
    // Update question order in database
    updateQuestionOrder();
  }
  
  // Clean up visual indicators
  document.querySelectorAll('.question-item').forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedElement = null;
  
  // Clean up any remaining visual indicators
  document.querySelectorAll('.question-item').forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

async function updateQuestionOrder() {
  const questionItems = document.querySelectorAll('.question-item[data-question-id]');
  const updates = [];
  
  questionItems.forEach((item, index) => {
    const questionId = parseInt(item.dataset.questionId);
    updates.push(db.questions.update(questionId, { sortOrder: index }));
  });
  
  await Promise.all(updates);
}

// ========== Charts for Stats ==========
let chartsInitialized = false;

function resetChartsFlag() {
  chartsInitialized = false;
}

async function initStatsCharts(data) {
  // Lazy load Chart.js only when stats tab is opened
  if (!window.Chart) {
    // Chart.js is loaded via CDN with defer, so it might not be ready yet
    let attempts = 0;
    while (!window.Chart && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    if (!window.Chart) {
      console.warn('Chart.js not loaded');
      return;
    }
  }
  
  if (chartsInitialized) return;
  chartsInitialized = true;
  
  await createDailyReviewChart(data);
  await createStreakChart(data);
}

async function createDailyReviewChart(data) {
  const canvas = document.getElementById('dailyReviewChart');
  if (!canvas) return;
  
  const { roll, dates } = data;
  const reviewData = dates.map(date => {
    const dayData = roll[date] || { correct: 0, total: 0 };
    return dayData.total;
  });
  
  const correctData = dates.map(date => {
    const dayData = roll[date] || { correct: 0, total: 0 };
    return dayData.correct;
  });
  
  const labels = dates.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  });
  
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '총 복습',
          data: reviewData,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1
        },
        {
          label: '정답',
          data: correctData,
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'var(--fg)' }
        }
      },
      scales: {
        x: {
          ticks: { color: 'var(--muted)' },
          grid: { color: 'var(--border)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: 'var(--muted)' },
          grid: { color: 'var(--border)' }
        }
      }
    }
  });
}

async function createStreakChart(data) {
  const canvas = document.getElementById('streakChart');
  if (!canvas) return;
  
  const { profile } = data;
  const currentStreak = profile.streak || 0;
  
  // Generate last 14 days for streak visualization
  const streakData = [];
  const streakLabels = [];
  
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    streakLabels.push(date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }));
    
    // Simple streak visualization: active if within current streak period
    const streakValue = i <= currentStreak ? 1 : 0;
    streakData.push(streakValue);
  }
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: streakLabels,
      datasets: [{
        label: '연속 학습',
        data: streakData,
        borderColor: 'rgba(244, 63, 94, 1)',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(244, 63, 94, 1)',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'var(--fg)' }
        }
      },
      scales: {
        x: {
          ticks: { color: 'var(--muted)' },
          grid: { color: 'var(--border)' }
        },
        y: {
          beginAtZero: true,
          max: 1,
          ticks: { 
            color: 'var(--muted)',
            callback: function(value) {
              return value === 1 ? '활성' : '비활성';
            }
          },
          grid: { color: 'var(--border)' }
        }
      }
    }
  });
}

// 전역 바인딩
window.switchTab = switchTab;
window.revealAnswer = revealAnswer;
window.toggleTheme = toggleTheme;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.resetChartsFlag = resetChartsFlag;