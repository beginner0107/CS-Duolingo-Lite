// ========== 데이터베이스 설정 (IndexedDB with Dexie) ==========
const db = new Dexie('CSStudyApp');
const APP_SCHEMA_VERSION = 3; // App-level schema/meta version (not Dexie version)

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
      console.log('Schema up-to-date (meta v' + currentMetaVersion + '), skipping migration');
      return;
    }

    console.log('Starting localStorage to IndexedDB migration...');
    
    // Migrate profile data
    const legacyProfile = JSON.parse(localStorage.getItem(LEGACY_KEY.PROFILE) || '{"xp": 0, "streak": 0}');
    const legacyLastStudy = localStorage.getItem(LEGACY_KEY.LAST);
    
    const existingProfile = await db.profile.toCollection().first();
    if (!existingProfile) {
      await db.profile.add({
        xp: legacyProfile.xp || 0,
        streak: legacyProfile.streak || 0,
        lastStudy: legacyLastStudy || null
      });
    }

    // Migrate decks data
    const legacyDecks = JSON.parse(localStorage.getItem(LEGACY_KEY.DECKS) || JSON.stringify(defaultDecks));
    if ((await db.decks.count()) === 0) {
      for (const deck of legacyDecks) {
        await db.decks.add({
          id: deck.id, // keep legacy id if present
          name: deck.name,
          created: new Date()
        });
      }
    }

    // Migrate questions data
    const legacyQuestions = JSON.parse(localStorage.getItem(LEGACY_KEY.QUESTIONS) || JSON.stringify(sampleQuestions));
    if ((await db.questions.count()) === 0) {
      for (const question of legacyQuestions) {
        await db.questions.add({
          id: question.id, // keep legacy id if present
          deck: question.deck,
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

    // Migrate review data
    const legacyReview = JSON.parse(localStorage.getItem(LEGACY_KEY.REVIEW) || '{}');
    if ((await db.review.count()) === 0) {
      for (const [questionId, reviewData] of Object.entries(legacyReview)) {
        await db.review.add({
          questionId: parseInt(questionId),
          ease: reviewData.ease || 2.5,
          interval: reviewData.interval || 0,
          due: reviewData.due || todayStr(),
          count: reviewData.count || 0,
          correct: reviewData.correct || 0,
          created: new Date(),
          updated: new Date()
        });
      }
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(LEGACY_KEY.PROFILE);
    localStorage.removeItem(LEGACY_KEY.DECKS);
    localStorage.removeItem(LEGACY_KEY.QUESTIONS);
    localStorage.removeItem(LEGACY_KEY.REVIEW);
    localStorage.removeItem(LEGACY_KEY.LAST);
    
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
    return profile || {xp: 0, streak: 0, lastStudy: null};
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
    return decks.length > 0 ? decks : defaultDecks.map(d => ({...d, created: new Date()}));
  },

  async addDeck(deck) {
    return await db.decks.add({
      name: deck.name,
      created: new Date()
    });
  },

  async deleteDeck(deckId) {
    const key = (typeof deckId === 'string' && /^\d+$/.test(deckId)) ? Number(deckId) : deckId;
    await db.decks.where('id').equals(key).delete();
  },

  // Questions operations
  async getQuestions() {
    const questions = await db.questions.toArray();
    return questions.length > 0 ? questions : sampleQuestions;
  },

  async addQuestion(question) {
    return await db.questions.add({
      ...question,
      created: new Date()
    });
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
  const deckName = (decks.find(d => String(d.id) === String(q.deck)) || {}).name || q.deck;
  
  let html = `
    <div class="badge">${deckName} · ${q.type}</div>
    <div class="prompt-box">${escapeHtml(q.prompt)}</div>
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
  
  html += '<div id="resultArea"></div>';
  qArea.innerHTML = html;
  
  if (q.type !== 'OX') {
    setTimeout(() => document.getElementById('userAnswer')?.focus(), 100);
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
  const review = await getReview();
  const state = review[question.id];
  const preview = {
    again: simulateNextDueDate(state, 0),
    hard: simulateNextDueDate(state, 1),
    good: simulateNextDueDate(state, 2),
    easy: simulateNextDueDate(state, 3)
  };
  let html = '<div class="result ' + (correct ? 'ok' : 'ng') + '">';
  
  if (correct) {
    html += '<h3>✅ 정답!</h3>';
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

async function deleteDeck(id) {
 if (!confirm('이 덱을 삭제하시겠습니까? 관련 문제도 모두 삭제됩니다.')) {
   return;
 }
 
 // Delete deck
 await DataStore.deleteDeck(id);
 
 // Delete all questions in this deck
 const questions = await getQuestions();
 const questionsToDelete = questions.filter(q => String(q.deck) === String(id));
 for (const question of questionsToDelete) {
   await DataStore.deleteQuestion(question.id);
 }
 
 showToast('덱이 삭제되었습니다', 'success');
 await updateDeckSelects();
 await updateDeckList();
 await updateQuestionList();
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
 
 document.getElementById('deckSelect').innerHTML = html;
 document.getElementById('newDeck').innerHTML = html;
 const qd = document.getElementById('quickDeck');
 if (qd) qd.innerHTML = html;
 const qDeckFilter = document.getElementById('qDeckFilter');
 if (qDeckFilter) qDeckFilter.innerHTML = `<option value="">전체</option>` + html;
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
       <button class="danger" onclick="deleteDeck('${d.id}')" style="padding:6px 12px">
         삭제
       </button>
     </div>
   `;
 });
 
 document.getElementById('deckList').innerHTML = html;
}

async function updateQuestionList() {
 const questions = await getQuestions();
 const decks = await getDecks();
 
 let html = '';
 questions.forEach(q => {
  const deckName = (decks.find(d => String(d.id) === String(q.deck)) || {}).name || q.deck;
   html += `
     <div class="question-item">
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
   <div style="margin-bottom:8px">
     <div class="stat-label">주간 활동</div>
     ${bars}
   </div>
`;
 document.getElementById('statsContent').innerHTML = statsHtml;
 
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
 const today = todayStr();
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
     
     if (confirm('현재 데이터를 덮어씁니다. 계속하시겠습니까?')) {
       // Clear existing data
       await db.delete();
       await db.open();
       
       // Import new data
       await setProfile(data.profile || {xp: 0, streak: 0});
       
       // Import decks
       const decks = data.decks || defaultDecks;
       for (const deck of decks) {
         await DataStore.addDeck(deck);
       }
       
       // Import questions
       const questions = data.questions || [];
       for (const question of questions) {
         await DataStore.addQuestion(question);
       }
       
      // Import review data
      const review = data.review || {};
      for (const [questionId, reviewData] of Object.entries(review)) {
        await setReview(parseInt(questionId), reviewData);
      }

      // Import meta
      if (data.meta && typeof data.meta.schemaVersion !== 'undefined') {
        await setSchemaVersion(data.meta.schemaVersion);
      }
       
       await updateHeader();
       await updateDeckSelects();
       await updateDeckList();
       await updateQuestionList();
       
      showToast('데이터를 가져왔습니다', 'success');
    }
  } catch (error) {
     console.error('Import error:', error);
     showToast('파일을 읽을 수 없습니다', 'danger');
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
 localStorage.removeItem(LEGACY_KEY.PROFILE);
 localStorage.removeItem(LEGACY_KEY.DECKS);
 localStorage.removeItem(LEGACY_KEY.QUESTIONS);
 localStorage.removeItem(LEGACY_KEY.REVIEW);
 localStorage.removeItem(LEGACY_KEY.LAST);
 
 await updateHeader();
 await updateDeckSelects();
 await updateDeckList();
 await updateQuestionList();
 
 showToast('모든 데이터가 초기화되었습니다', 'success');
}

// Soft data reset: bump meta schemaVersion, refresh caches, reopen DB, and seed defaults if missing
async function resetData() {
 try {
   // Bump meta schema version to current app version
   await setSchemaVersion(APP_SCHEMA_VERSION);
   
   // Refresh service worker cache if available
   if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
     try { const reg = await navigator.serviceWorker.getRegistration(); await reg?.update(); } catch (_) {}
   }
   if ('caches' in window) {
     try {
       const names = await caches.keys();
       await Promise.all(names.map(n => caches.delete(n)));
     } catch (_) {}
   }
   
   // Reopen DB
   try { db.close(); } catch (_) {}
   await db.open();
   
   // Seed defaults if empty
   if ((await db.decks.count()) === 0) {
     for (const d of defaultDecks) { await db.decks.add({ name: d.name, created: new Date() }); }
   }
   if ((await db.questions.count()) === 0) {
     for (const q of sampleQuestions) { await db.questions.add({ ...q, created: new Date() }); }
   }
   
   await updateHeader();
   await updateDeckSelects();
   await updateDeckList();
   await updateQuestionList();
   showToast('데이터 리셋 완료 (캐시/DB 갱신)', 'success');
 } catch (e) {
   console.error('resetData error', e);
   showToast('데이터 리셋 중 오류가 발생했습니다', 'danger');
 }
}

async function updateSettingsPanel() {
  const input = document.getElementById('dailyLimitInput');
  if (!input) return;
  const s = getSettings();
  input.value = s.dailyReviewLimit;
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
   setupGuidedImport();
   
  console.log('Application initialized successfully');
  try { runSM2PreviewTests(); } catch (_) {}
 } catch (error) {
   console.error('Initialization error:', error);
   showToast('앱 초기화 중 오류가 발생했습니다', 'danger');
 }
 
 // 엔터키 지원
 document.addEventListener('keydown', function(e) {
   if (e.key === 'Enter' && !e.shiftKey) {
     const userAnswer = document.getElementById('userAnswer');
     if (userAnswer && document.activeElement === userAnswer) {
       e.preventDefault();
       submitAnswer(userAnswer.value);
     }
   }

    // Global shortcuts during active session
    const isActive = session && session.active;
    if (!isActive) return;
    const resultVisible = !!document.querySelector('.grade-buttons');

    // Space: toggle show result / default grade (Good)
    if (e.key === ' ' || e.code === 'Space') {
      if (!resultVisible) {
        const input = document.getElementById('userAnswer');
        const val = input ? input.value : '';
        e.preventDefault();
        submitAnswer(val);
      } else {
        e.preventDefault();
        gradeAnswer(2); // Good as default
      }
      return;
    }

    // 1..4: grade when result is visible (Again/Hard/Good/Easy)
    if (resultVisible && ['1','2','3','4'].includes(e.key)) {
      e.preventDefault();
      gradeAnswer(parseInt(e.key, 10) - 1);
      return;
    }

    // Esc: move to next card if result is visible
    if (resultVisible && (e.key === 'Escape' || e.code === 'Escape')) {
      e.preventDefault();
      session.index++;
      showQuestion();
      return;
    }
 });
});
