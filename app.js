import { getAdapter } from './ai/index.js';
import { openEditQuestion as uiOpenEditQuestion, closeEditModal as uiCloseEditModal, saveEditQuestion as uiSaveEditQuestion, showTab as uiShowTab, bindEvents, getCurrentNoteId, setCurrentNoteId } from './src/modules/ui-handlers.js';
import { gradeQuestionAsync } from './src/modules/scoring.js';
import { updateStats, updateDailyStreak, generateAchievements, openLearningCalendar, closeLearningCalendar } from './src/modules/statistics.js';
import { /* startSession, gradeAnswer, */ endSession, pauseSession, resumeSession, resetSession } from './src/modules/session.js';
import { exportData as dmExportData, importData as dmImportData, showGuidedImport, hideGuidedImport, handleGuidedImport, confirmImport, cancelImport, showQuickAdd, hideQuickAdd, submitQuickAdd } from './src/modules/data-management.js';
import { initTheme, toggleTheme, setTheme } from './src/modules/theme.js';
import { createNote, updateNoteList, editNote, saveNote, closeNoteEditor, deleteNoteConfirm, exportNoteToMarkdown, convertSelectionToQuestions } from './src/modules/notes.js';
import { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } from './src/modules/drag-drop.js';
import { updateUserPerformance, selectQuestionsByDifficulty, getCurrentUserDifficulty, getDifficultyStats } from './src/modules/adaptive-difficulty.js';

// Immediately bind critical functions for HTML onclick handlers
// This ensures they're available even before DOMContentLoaded
window.showTab = uiShowTab;
window.openEditQuestion = uiOpenEditQuestion;
window.saveEditQuestion = uiSaveEditQuestion;
window.closeEditModal = uiCloseEditModal;
window.openLearningCalendar = openLearningCalendar;
window.closeLearningCalendar = closeLearningCalendar;
// Use in-file legacy implementations for session to match current UI structure
window.startSession = startSessionLegacy;
window.gradeAnswer = gradeAnswerLegacy;
window.endSession = endSession;
window.pauseSession = pauseSession;
window.resumeSession = resumeSession;
window.resetSession = resetSession;
// Bind data-management functions and legacy aliases
window.confirmImport = confirmImport;
window.exportData = dmExportData;
window.importData = dmImportData;
window.showGuidedImport = showGuidedImport;
window.hideGuidedImport = hideGuidedImport;
window.handleGuidedImport = handleGuidedImport;
window.cancelImport = cancelImport;
window.showQuickAdd = showQuickAdd;
window.hideQuickAdd = hideQuickAdd;
window.submitQuickAdd = submitQuickAdd;
// Legacy names for backward compatibility
window.initializeImport = showGuidedImport;
window.showImportPreview = handleGuidedImport;
window.quickAddFromText = showQuickAdd;
window.quickAddQuestion = submitQuickAdd;
window.toggleTheme = toggleTheme;
window.createNote = createNote;
window.editNote = editNote;
window.saveNote = saveNote;
window.closeNoteEditor = closeNoteEditor;
window.deleteNoteConfirm = deleteNoteConfirm;
window.exportNoteToMarkdown = exportNoteToMarkdown;
window.convertSelectionToQuestions = convertSelectionToQuestions;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;

// Forward declaration for deleteQuestion (defined later in file)
window.deleteQuestion = (...args) => deleteQuestion(...args);

// ========== 데이터베이스 설정 (IndexedDB with Dexie) ==========
const db = new Dexie('CSStudyApp');
window.db = db; // Make db globally accessible for modules
const APP_SCHEMA_VERSION = 51; // App-level schema/meta version (not Dexie version)

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

// Dexie schema v51: compatibility fix for existing databases
db.version(51).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, sortOrder, *tags',
  review: '++id, questionId, ease, interval, due, count, created, updated',
  meta: 'key',
  notes: '++id, deckId, title, source, content, createdAt, updatedAt',
  note_items: '++id, noteId, ts, text, *tags'
});

// Migration hook for version 51 - add missing fields to notes
db.version(51).upgrade(async (trans) => {
  const notes = await trans.table('notes').toArray();
  for (const note of notes) {
    const updates = {};
    if (!note.content) updates.content = '';
    if (!note.createdAt) updates.createdAt = new Date();
    if (!note.updatedAt) updates.updatedAt = new Date();
    
    if (Object.keys(updates).length > 0) {
      await trans.table('notes').update(note.id, updates);
    }
  }
});

// Dexie schema v52: add adaptive difficulty fields to review table
db.version(52).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, sortOrder, *tags',
  review: '++id, questionId, ease, interval, due, count, created, updated, difficulty, difficultyUpdated',
  meta: 'key',
  notes: '++id, deckId, title, source, content, createdAt, updatedAt',
  note_items: '++id, noteId, ts, text, *tags'
});

// Migration hook for version 52 - add adaptive difficulty fields
db.version(52).upgrade(async (trans) => {
  const reviews = await trans.table('review').toArray();
  for (const review of reviews) {
    const updates = {};
    
    // Add default difficulty (medium = 3) for existing reviews
    if (!review.difficulty) {
      updates.difficulty = 3; // DIFFICULTY_LEVELS.MEDIUM
    }
    
    // Add difficulty update timestamp
    if (!review.difficultyUpdated) {
      updates.difficultyUpdated = new Date().toISOString();
    }
    
    // Initialize recent performance tracking
    if (!review.recentPerformance) {
      updates.recentPerformance = [];
    }
    
    // Initialize difficulty reason
    if (!review.difficultyReason) {
      updates.difficultyReason = 'Default difficulty assigned';
    }
    
    if (Object.keys(updates).length > 0) {
      await trans.table('review').update(review.id, updates);
    }
  }
  console.log('Adaptive difficulty migration completed');
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
  try {
    await db.table('meta').put({ key: 'schemaVersion', value: v });
  } catch (error) {
    console.warn('Failed to set schema version:', error);
    // If database version conflict, suggest reset
    if (error.name === 'VersionError' || error.name === 'DatabaseClosedError') {
      console.warn('Database version conflict detected. Consider clearing IndexedDB data.');
    }
    throw error;
  }
}

async function resetDatabase() {
  console.log('Resetting database...');
  try {
    // Close the database first
    if (db.isOpen()) {
      db.close();
    }
    
    // Delete the database completely
    await Dexie.delete('CSStudyApp');
    console.log('Database deleted successfully');
    
    // Wait a bit to ensure deletion is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Force a page reload to restart with fresh database
    console.log('Database reset completed, reloading page...');
    window.location.reload();
    
  } catch (error) {
    console.error('Database reset failed:', error);
    // If reset fails, suggest manual cleanup
    throw new Error('Database reset failed. Please manually clear IndexedDB data in browser developer tools.');
  }
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
      fontSize: s.fontSize || 'medium',
      focusMode: Boolean(s.focusMode),
    };
  } catch (_) {
    return { 
      dailyReviewLimit: DEFAULT_DAILY_REVIEW_LIMIT,
      fontSize: 'medium',
      focusMode: false
    };
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
		// Force database reset if version conflict exists
		try {
			const currentMetaVersion = await getSchemaVersion();
			if (currentMetaVersion && currentMetaVersion >= APP_SCHEMA_VERSION) {
				return;
			}
		} catch (error) {
			if (error.name === 'DatabaseClosedError' || error.name === 'VersionError') {
				console.warn('Database version conflict detected, forcing reset...');
				await resetDatabase();
				console.log('Database reset completed, proceeding with fresh initialization');
			}
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
		
		// If it's a version error, suggest database reset
		if (error.name === 'DatabaseClosedError' || error.name === 'VersionError') {
			console.warn('Database version conflict - attempting database reset');
			try {
				await resetDatabase();
				showToast('데이터베이스를 초기화했습니다. 페이지를 새로고침해주세요.', 'warning');
			} catch (resetError) {
				console.error('Database reset failed:', resetError);
				showToast('데이터베이스 버전 충돌 - 브라우저 개발자 도구에서 IndexedDB를 삭제해주세요', 'danger');
			}
		} else {
			showToast('데이터 마이그레이션 중 오류가 발생했습니다', 'danger');
		}
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
// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported session module
async function startSessionLegacy() {
  const deckId = document.getElementById('deckSelect').value;
  const count = parseInt(document.getElementById('questionCount').value);
  
  // Show loading skeleton
  if (typeof showQuestionSkeleton === 'function') showQuestionSkeleton();
  
  const questions = await getQuestions();
  const review = await getReview();
  const today = todayStr();

  // Classify questions by category
  const inDeck = questions.filter(q => String(q.deck) === String(deckId));
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
  
  // Apply adaptive difficulty to reorder queue based on user performance
  try {
    // Calculate current user difficulty level from recent performance
    const recentPerformance = Object.values(review)
      .filter(r => r.recentPerformance && r.recentPerformance.length > 0)
      .flatMap(r => r.recentPerformance.slice(-3)); // Last 3 attempts per question
    
    let userDifficulty = 3; // Default to medium
    if (recentPerformance.length > 0) {
      userDifficulty = getCurrentUserDifficulty({ 
        difficulty: Math.round(recentPerformance.reduce((sum, p) => sum + p.difficulty, 0) / recentPerformance.length)
      });
    }
    
    // Reorder queue using adaptive difficulty
    const adaptiveQueue = selectQuestionsByDifficulty(queue, review, userDifficulty, 1);
    
    // If we got a good selection, use it; otherwise fall back to original queue
    if (adaptiveQueue.length > 0) {
      queue.splice(0, queue.length, ...adaptiveQueue);
      console.log(`[Adaptive Difficulty] Selected ${queue.length} questions for difficulty level ${userDifficulty}`);
    }
  } catch (error) {
    console.warn('[Adaptive Difficulty] Failed to apply adaptive selection, using standard queue:', error);
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
    total: queue.length,
    originalLength: queue.length, // Track the original number of questions
    sessionRepeats: {}, // Track how many times each question has been repeated in this session
    userDifficulty: getCurrentUserDifficulty({ difficulty: 3 }) // Track user's current difficulty level
  };
  
  // Show stop button when session starts
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'inline-block';
  
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
    <div class="badge" role="status" aria-label="Question category">${deckName} · ${q.type}</div>
    <div class="prompt-box" role="main" aria-label="Question prompt">${escapeHtml(q.prompt)}</div>
    <div style="margin-top:16px">
      <button id="revealBtn" onclick="revealAnswer()" aria-expanded="false" aria-label="Reveal answer and answer options">
        <span>🔍</span> Reveal Answer
      </button>
    </div>
  `;
  
  // Hidden answer section
  html += `
    <div id="answerSection" style="display:none" aria-hidden="true" role="region" aria-label="Answer input section">
      <div style="margin-top:16px">
  `;
  
  if (q.type === 'OX') {
    html += `
        <div class="grid grid-2" role="group" aria-label="True or False answer options">
          <button class="success" onclick="submitAnswer('true')" aria-label="Submit True as answer">⭕ True</button>
          <button class="danger" onclick="submitAnswer('false')" aria-label="Submit False as answer">❌ False</button>
        </div>
    `;
  } else {
    html += `
        <textarea id="userAnswer" placeholder="답을 입력하세요..." autofocus aria-label="답을 입력하세요" aria-describedby="submitHint"></textarea>
        <div id="submitHint" style="font-size:12px;color:var(--muted);margin-top:4px">Enter를 눌러 제출하거나 제출 버튼을 클릭하세요. 키보드 단축키: R/Space(정답보기), D(모르겠음), 0-3(난이도 선택)</div>
        <div style="margin-top:16px" role="group" aria-label="Answer submission options">
          <button onclick="submitAnswer(document.getElementById('userAnswer').value)" aria-label="답안 제출하기">제출</button>
          <button class="secondary" onclick="showDontKnowAnswer()" aria-label="모르겠음을 선택하고 정답 보기">모르겠음</button>
        </div>
    `;
  }
  
  html += `
      </div>
    </div>
    <div id="resultArea" role="region" aria-live="polite" aria-label="Quiz result and grading options"></div>
  `;
  
  qArea.innerHTML = html;
  
  // Add keyboard navigation support
  addQuizKeyboardNavigation();
  
  // Add fade-in effect
  if (typeof hideQuestionSkeleton === 'function') hideQuestionSkeleton();
}

function revealAnswer() {
  const revealBtn = document.getElementById('revealBtn');
  const answerSection = document.getElementById('answerSection');
  
  if (revealBtn && answerSection) {
    revealBtn.style.display = 'none';
    revealBtn.setAttribute('aria-expanded', 'true');
    answerSection.style.display = 'block';
    answerSection.setAttribute('aria-hidden', 'false');
    
    // Announce to screen readers that answer section is now available
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.textContent = '답안 입력 영역이 표시되었습니다.';
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
    
    // Focus on first interactive element in answer section
    const userAnswer = document.getElementById('userAnswer');
    const firstButton = answerSection.querySelector('button');
    if (userAnswer) {
      setTimeout(() => userAnswer.focus(), 100);
    } else if (firstButton) {
      setTimeout(() => firstButton.focus(), 100);
    }
  }
}

// Add keyboard navigation for quiz interface
function addQuizKeyboardNavigation() {
  // Remove existing listeners to avoid duplicates
  document.removeEventListener('keydown', handleQuizKeydown);
  document.addEventListener('keydown', handleQuizKeydown);
}

function handleQuizKeydown(event) {
  // Only handle keyboard events when quiz is active
  if (!session || !session.active) return;
  
  const activeElement = document.activeElement;
  const userAnswerTextarea = document.getElementById('userAnswer');
  const revealBtn = document.getElementById('revealBtn');
  const resultArea = document.getElementById('resultArea');
  
  // Handle Enter key in textarea to submit answer
  if (event.key === 'Enter' && activeElement === userAnswerTextarea && !event.shiftKey) {
    event.preventDefault();
    submitAnswer(userAnswerTextarea.value);
    return;
  }
  
  // Skip keyboard shortcuts if user is typing in textarea
  if (activeElement === userAnswerTextarea && event.key.length === 1) {
    return;
  }
  
  // Handle keyboard shortcuts
  switch (event.key) {
    case ' ': // Spacebar to reveal answer
    case 'r': // R to reveal answer
      event.preventDefault();
      if (revealBtn && revealBtn.style.display !== 'none') {
        revealAnswer();
      }
      break;
      
    case '0': // Grade as "Again"
      event.preventDefault();
      if (resultArea && resultArea.innerHTML.includes('grade-btn')) {
        gradeAnswer(0);
      }
      break;
      
    case '1': // Grade as "Hard"
      event.preventDefault();
      if (resultArea && resultArea.innerHTML.includes('grade-btn')) {
        gradeAnswer(1);
      }
      break;
      
    case '2': // Grade as "Good"
      event.preventDefault();
      if (resultArea && resultArea.innerHTML.includes('grade-btn')) {
        gradeAnswer(2);
      }
      break;
      
    case '3': // Grade as "Easy"
      event.preventDefault();
      if (resultArea && resultArea.innerHTML.includes('grade-btn')) {
        gradeAnswer(3);
      }
      break;
      
    case 't': // T for True (OX questions)
      event.preventDefault();
      const trueBtn = document.querySelector('.success[onclick*="submitAnswer(\'true\')"');
      if (trueBtn) {
        submitAnswer('true');
      }
      break;
      
    case 'f': // F for False (OX questions)
      event.preventDefault();
      const falseBtn = document.querySelector('.danger[onclick*="submitAnswer(\'false\')"');
      if (falseBtn) {
        submitAnswer('false');
      }
      break;
      
    case 'd': // D for "Don't Know"
      event.preventDefault();
      const dontKnowBtn = document.querySelector('button[onclick="showDontKnowAnswer()"]');
      if (dontKnowBtn) {
        showDontKnowAnswer();
      }
      break;
      
    case 'Escape': // Escape to focus back to textarea or main area
      event.preventDefault();
      if (userAnswerTextarea) {
        userAnswerTextarea.focus();
      } else {
        document.getElementById('qArea').focus();
      }
      break;
  }
}

async function submitAnswer(userAnswer) {
  const q = session.queue[session.index];
  // Guard against empty input for SHORT/KEYWORD
  if (q.type !== 'OX') {
    if (!userAnswer || userAnswer.trim() === '') {
      showToast('정답을 입력해주세요', 'warning');
      // Focus back to textarea for accessibility
      const userAnswerTextarea = document.getElementById('userAnswer');
      if (userAnswerTextarea) {
        setTimeout(() => userAnswerTextarea.focus(), 100);
      }
      return;
    }
  }
  // Disable current action buttons to prevent double submit
  try {
    document.querySelectorAll('#qArea button').forEach(b => b.disabled = true);
  } catch (_) {}
  const feedback = await gradeQuestionAsync(q, userAnswer);
  const correct = feedback.correct === true;
  
  // Store AI result if available (from gradeQuestionAsync)
  if (feedback.aiGraded) {
    window._lastAiResult = { used: 'cloud', rationale: feedback.notes };
  }
  
  // 점수 & XP (temporary for initial feedback)
  const gain = correct ? 10 : 2;
  session.score += gain;
  // Note: session.ok/ng counters will be updated in gradeAnswer() for final grades only
  
  const profile = await getProfile();
  profile.xp += gain;
  await setProfile(profile);
  
  // 결과 표시
  await showResult(q, userAnswer, feedback);
  await updateProgress();
  
  // Store the question for grading
  session.currentQuestion = q;
  session.currentAnswer = userAnswer;
  session.currentCorrect = correct;
}

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported statistics module
async function updateDailyStreakLegacy() {
  const profile = await getProfile();
  const today = todayStr();
  
  // Only update if we haven't studied today yet
  if (profile.lastStudy === today) {
    return; // Already studied today
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  
  if (profile.lastStudy === yesterdayStr) {
    // Continuing streak
    profile.streak++;
  } else if (!profile.lastStudy) {
    // First time studying
    profile.streak = 1;
  } else {
    // Streak was broken, start new streak
    profile.streak = 1;
  }
  
  profile.lastStudy = today;
  await setProfile(profile);
  
  // Update UI immediately
  document.getElementById('streak').textContent = profile.streak;
}

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported session module
async function gradeAnswerLegacy(grade) {
  const q = session.currentQuestion;
  const correct = session.currentCorrect;
  // Disable grade buttons to prevent double clicks
  try {
    document.querySelectorAll('.grade-buttons button').forEach(b => b.disabled = true);
  } catch (_) {}
  
  // 리뷰 업데이트 with grade and adaptive difficulty
  const review = await getReview();
  const baseReviewData = nextSchedule(correct, review[q.id], grade);
  
  // increment correct counter
  const prevCorrect = (review[q.id]?.correct || 0);
  baseReviewData.correct = prevCorrect + (correct ? 1 : 0);
  baseReviewData.lastResult = correct ? 'ok' : 'ng';
  const prevAgain = (review[q.id]?.againCount || 0);
  baseReviewData.againCount = prevAgain + (grade === 0 ? 1 : 0);
  
  // Apply adaptive difficulty logic
  const updatedReview = updateUserPerformance(q.id, baseReviewData, correct);
  
  await setReview(q.id, updatedReview);

  // Recompute and re-render interval previews on buttons using updated state
  try {
    updateGradePreviewsForCurrent(updatedReview);
  } catch (_) {}
  
  // Show next scheduled interval
  try {
    const iv = updatedReview.interval ?? 0;
    showToast(`다음 복습: ${formatInterval(iv)}`, 'info');
  } catch (_) {}
  
  // If grade is Again (0), re-queue this question shortly and advance to next
  if (grade === 0 && session) {
    // Check session repeat limit (max 2 times per question per session)
    const questionId = q.id;
    const currentRepeats = session.sessionRepeats[questionId] || 0;
    const MAX_SESSION_REPEATS = 2;
    
    if (currentRepeats < MAX_SESSION_REPEATS) {
      // Track this repeat
      session.sessionRepeats[questionId] = currentRepeats + 1;
      
      // Insert repeated questions at the end of the queue
      // This ensures all original questions are seen before repeated ones
      session.queue.push(q);
      // Update total to reflect the new queue length
      session.total = session.queue.length;
      showToast(`문제 재등장 예정 (${currentRepeats + 1}/${MAX_SESSION_REPEATS})`, 'info');
    } else {
      // Question has been repeated too many times, skip re-queuing
      showToast('이 문제는 이미 충분히 반복했습니다', 'warning');
    }
    
    // Advance to next question now; it will reappear later from the re-queue (if under limit)
    session.index++;
    setTimeout(() => showQuestion(), 300);
    return;
  }
  
  // Only count completion stats for non-Again grades
  // Update session counters for completed questions
  if (correct) session.ok++; 
  else session.ng++;
  
  // Update streak for daily learning activity
  await updateDailyStreak();
  
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
function toKeywordsArray(keywords) {
  if (Array.isArray(keywords)) return keywords;
  if (keywords == null) return [];
  // If JSON string of array
  if (typeof keywords === 'string') {
    const str = keywords.trim();
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return str
      .split(/[ ,\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  // Object-like collections: {0:'a',1:'b'} or {keywords:[...]}
  if (typeof keywords === 'object') {
    if (Array.isArray(keywords.keywords)) return keywords.keywords;
    if (Array.isArray(keywords.items)) return keywords.items;
    const vals = Object.values(keywords);
    if (vals.every(v => typeof v === 'string')) return vals;
  }
  return [];
}

function buildKeywordGroups(keywords) {
  // Each entry may have alternatives separated by '|', e.g., "process|프로세스"
  const arr = toKeywordsArray(keywords);
  return arr.map(entry =>
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

async function showResult(question, userAnswer, feedback) {
  const resultArea = document.getElementById('resultArea');
  const correct = feedback?.correct === true;
  
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
    const hitsStr = feedback.hits.length ? feedback.hits.join(', ') : '없음';
    const missesStr = feedback.misses.length ? feedback.misses.join(', ') : '없음';
    // Always display as 100-point scale
    const scoreLabel = `${Math.round((Number(feedback.score) || 0) * 100)}/100`;
    html += `<div style="font-size:14px;color:var(--muted);margin-bottom:8px">`;
    html += `점수: ${scoreLabel} • 일치: [${hitsStr}] • 누락: [${missesStr}]${feedback.notes ? ' • ' + feedback.notes : ''}`;
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
      const kwArr = toKeywordsArray(question.keywords);
      kwArr.forEach((k, idx) => {
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
  
  // Add chatbot feature when AI was used for grading (correct or incorrect)
  if (feedback && feedback.aiGraded) {
    html += `
      <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
        <div style="margin-bottom:8px;font-weight:bold;color:var(--text)">💬 AI와 추가 질문하기</div>
        <div id="chatHistory" style="max-height:200px;overflow-y:auto;margin-bottom:8px;font-size:14px"></div>
        <div style="display:flex;gap:8px">
          <input type="text" id="chatInput" placeholder="이 문제에 대해 더 궁금한 점을 물어보세요..." 
                 style="flex:1;padding:8px;border:1px solid var(--border);border-radius:4px;font-size:14px"
                 onkeydown="if(event.key==='Enter') askChatQuestion()">
          <button onclick="askChatQuestion()" style="padding:8px 12px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer">질문</button>
        </div>
      </div>
    `;
  }
  
  // Add grade buttons
  html += `
    <div class="grade-buttons" role="group" aria-label="Difficulty grading options">
      <button class="grade-btn again" onclick="gradeAnswer(0)" aria-label="Again - Review this question again soon, next due ${preview.again}">Again<br><small>${preview.again}</small></button>
      <button class="grade-btn hard" onclick="gradeAnswer(1)" aria-label="Hard - This was difficult, next due ${preview.hard}">Hard<br><small>${preview.hard}</small></button>
      <button class="grade-btn good" onclick="gradeAnswer(2)" aria-label="Good - This was okay, next due ${preview.good}">Good<br><small>${preview.good}</small></button>
      <button class="grade-btn easy" onclick="gradeAnswer(3)" aria-label="Easy - This was easy, next due ${preview.easy}">Easy<br><small>${preview.easy}</small></button>
    </div>
  `;
  
  html += '</div>';
  resultArea.innerHTML = html;
}

async function finishSession() {
  session.active = false;
  
  // Hide stop button when session finishes
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
  
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
    } else if (last === null || last === undefined) {
      // First time studying
      profile.streak = 1;
    } else {
      // Streak broken
      profile.streak = 1;
    }
    profile.lastStudy = today;
    await setProfile(profile);
    
    // Update UI immediately
    document.getElementById('streak').textContent = profile.streak;
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
 
  if (type === 'OX') {
    const answer = document.getElementById('newAnswer').value.trim();
    if (!answer) {
      showToast('정답을 선택해주세요', 'warning');
      return;
    }
    question.answer = answer;
  } else if (type === 'SHORT') {
    // SHORT type uses explanation as answer
    const explain = document.getElementById('newExplain').value.trim();
    if (!explain) {
      showToast('해설을 입력하세요 (단답형의 정답)', 'warning');
      return;
    }
    question.answer = explain;
    
    // Add synonyms for SHORT type
    const synonyms = document.getElementById('newSynonyms').value
      .split(',')
      .map(s => s.trim())
      .filter(s => s);
    if (synonyms.length > 0) {
      question.synonyms = synonyms;
    }
    const fuzzyToggle = document.getElementById('shortFuzzyToggle');
    question.shortFuzzy = !!(fuzzyToggle ? fuzzyToggle.checked : true);
  } else if (type === 'ESSAY') {
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
   const answerSelect = document.getElementById('newAnswer');
   answerSelect.innerHTML = '<option value="">선택하세요</option><option value="true">O (참)</option><option value="false">X (거짓)</option>';
   answerSelect.value = '';
 } else if (type === 'SHORT') {
   answerField.style.display = 'none';
   synonymField.style.display = 'block';
   keywordField.style.display = 'none';
   if (fuzzyToggle) fuzzyToggle.checked = true;
 } else if (type === 'ESSAY') {
   answerField.style.display = 'none';
   synonymField.style.display = 'none';
   keywordField.style.display = 'block';
   if (thrMode && thrInputWrap) {
     const mode = thrMode.value || 'default';
     thrInputWrap.style.display = mode === 'custom' ? 'block' : 'none';
   }
 }
}

// Reset study session to reflect changes from other tabs
function resetStudySession() {
  session.started = false;
  session.queue = [];
  session.index = 0;
  session.score = 0;
  session.ok = 0;
  session.ng = 0;
  session.originalLength = 0;
  session.sessionRepeats = {};
  
  const qArea = document.getElementById('qArea');
  if (qArea) {
    qArea.innerHTML = '<div class="placeholder">덱을 선택하고 학습을 시작하세요</div>';
  }
}

// Chatbot functionality for essay questions
async function askChatQuestion() {
  const input = document.getElementById('chatInput');
  const history = document.getElementById('chatHistory');
  if (!input || !history) return;
  
  const question = input.value.trim();
  if (!question) return;
  
  // Clear input and show user question
  input.value = '';
  history.innerHTML += `<div style="margin-bottom:8px;text-align:right"><strong>You:</strong> ${question}</div>`;
  
  // Show loading
  history.innerHTML += `<div id="aiThinking" style="margin-bottom:8px;color:var(--muted);font-style:italic">AI 답변 중...</div>`;
  history.scrollTop = history.scrollHeight;
  
  try {
    const { getAdapter } = await import('./ai/index.js');
    const adapter = getAdapter('cloud');
    
    const currentQuestion = session.queue[session.index];
    const context = `문제: ${currentQuestion.prompt}\n설명: ${currentQuestion.explain || ''}`;
    
    // Use the new chat method instead of grade
    const response = await adapter.chat(question, context);
    
    // Remove loading and add AI response with markdown formatting
    document.getElementById('aiThinking').remove();
    const formattedResponse = formatMarkdown(response);
    history.innerHTML += `<div style="margin-bottom:8px"><strong>AI:</strong> ${formattedResponse}</div>`;
    history.scrollTop = history.scrollHeight;
    
  } catch (error) {
    console.error('Chat question failed:', error);
    document.getElementById('aiThinking').remove();
    history.innerHTML += `<div style="margin-bottom:8px;color:var(--error)"><strong>Error:</strong> AI 응답을 가져올 수 없습니다.</div>`;
    history.scrollTop = history.scrollHeight;
  }
}

// Simple markdown formatting for chat responses
function formatMarkdown(text) {
  if (!text) return '';
  
  return text
    // Bold: **text** -> <strong>text</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* -> <em>text</em>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code: `text` -> <code>text</code>
    .replace(/`(.*?)`/g, '<code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px;font-family:monospace">$1</code>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

// Handle "I don't know" button - show correct answer and mark as incorrect
async function showDontKnowAnswer() {
  const q = session.queue[session.index];
  
  // Mark as incorrect and prepare for "Again" grading
  session.currentQuestion = q;
  session.currentAnswer = '';
  session.currentCorrect = false;
  
  // Show the correct answer immediately
  await showResult(q, '', { correct: false, score: 0, hits: [], misses: [q.answer] });
  
  // Add "Next Question" button instead of grade buttons
  const resultArea = document.getElementById('resultArea');
  if (resultArea) {
    // Remove existing grade buttons
    const gradeButtons = resultArea.querySelector('.grade-buttons');
    if (gradeButtons) {
      gradeButtons.remove();
    }
    
    // Add next question button
    const nextButton = document.createElement('div');
    nextButton.innerHTML = `
      <div style="text-align:center;margin-top:16px">
        <button onclick="proceedAfterDontKnow()" style="padding:12px 24px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold">다음 문제</button>
      </div>
    `;
    resultArea.appendChild(nextButton);
  }
}

// Proceed to next question after "I don't know" - automatically grade as "Again"
async function proceedAfterDontKnow() {
  // Automatically grade as "Again" (0)
  await gradeAnswer(0);
}

// Stop learning session
async function stopLearning() {
  if (!session.active || !confirm('학습을 중단하시겠습니까?')) {
    return;
  }
  
  session.active = false;
  
  // Hide stop button
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) stopBtn.style.display = 'none';
  
  // Show completion message
  const qArea = document.getElementById('qArea');
  qArea.innerHTML = `
    <div style="text-align:center;padding:40px">
      <h3>📚 학습을 중단했습니다</h3>
      <p>완료한 문제: ${session.index}개 / 전체: ${session.total}개</p>
      <p>정답률: ${session.ok}/${session.ok + session.ng} (${Math.round(session.ok / Math.max(1, session.ok + session.ng) * 100)}%)</p>
      <button onclick="startSession()" style="margin-top:16px;padding:12px 24px;background:var(--primary);color:white;border:none;border-radius:8px;cursor:pointer">
        다시 학습하기
      </button>
    </div>
  `;
  
  // Reset session data
  session.queue = [];
  session.index = 0;
  session.ok = 0;
  session.ng = 0;
  session.total = 0;
  session.originalLength = 0;
  session.sessionRepeats = {};
  
  await updateProgress();
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

 const aiDeckSelect = document.getElementById('aiDeckSelect');
 if (aiDeckSelect) aiDeckSelect.innerHTML = html;
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

	let query;
	
	// Start with deck filter if specified (most efficient)
	if (deckId) {
		query = db.questions.where('deck').equals(Number(deckId));
	} else {
		query = db.questions.toCollection();
	}
	
	// Apply other filters
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
		// If we have filters, we need to get all and sort manually
		if (deckId || type || tag || search) {
			questions = await query.toArray();
			questions = questions.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
		} else {
			// If no filters, use orderBy directly on the table
			questions = await db.questions.orderBy('sortOrder').toArray();
		}
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
        <div style="display:flex; gap:8px">
          <button class="secondary" onclick="openEditQuestion(${q.id})" style="padding:6px 12px">수정</button>
          <button class="danger" onclick="deleteQuestion(${q.id})" style="padding:6px 12px">삭제</button>
        </div>
      </div>
    `;
	});

	document.getElementById('questionList').innerHTML = html || '<div style="text-align:center;color:var(--muted);padding:20px">문제가 없습니다</div>';
}

// ========== 문제 수정 모달 ==========
function createModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:9998';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:8px;max-width:640px;width:90%;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:9999';
  modal.innerHTML = html;
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal(overlay) {
  try { overlay.remove(); } catch (_) {}
}

async function openEditQuestion(id) {
  const q = await db.questions.get(id);
  if (!q) { showToast('문제를 찾을 수 없습니다', 'danger'); return; }
  const decks = await getDecks();
  const deckOptions = decks.map(d => `<option value="${d.id}" ${String(d.id)===String(q.deck)?'selected':''}>${d.name}</option>`).join('');
  const kwDisplay = Array.isArray(q.keywords)
    ? q.keywords
    : (typeof q.keywords === 'string'
        ? q.keywords.split(',').map(s=>s.trim()).filter(Boolean)
        : []);
  const html = `
    <h3 style="margin-top:0">문제 수정</h3>
    <div class="grid">
      <div>
        <label style="color:var(--muted);font-size:14px">덱</label>
        <select id="editDeck">${deckOptions}</select>
      </div>
      <div>
        <label style="color:var(--muted);font-size:14px">유형</label>
        <select id="editType">
          <option value="OX" ${q.type==='OX'?'selected':''}>OX</option>
          <option value="SHORT" ${q.type==='SHORT'?'selected':''}>단답형</option>
          <option value="ESSAY" ${q.type==='ESSAY'||q.type==='KEYWORD'?'selected':''}>서술형</option>
        </select>
      </div>
      <div style="grid-column:1/-1">
        <label style="color:var(--muted);font-size:14px">문제</label>
        <textarea id="editPrompt">${q.prompt || ''}</textarea>
      </div>
      <div id="editAnswerWrap" style="display:${q.type==='OX'||q.type==='SHORT'?'block':'none'}">
        <label style="color:var(--muted);font-size:14px">정답</label>
        <input type="text" id="editAnswer" value="${q.answer || ''}" placeholder="true/false 또는 단답">
      </div>
      <div id="editSynWrap" style="display:${q.type==='SHORT'?'block':'none'}">
        <label style="color:var(--muted);font-size:14px">동의어 (쉼표)</label>
        <input type="text" id="editSynonyms" value="${(q.synonyms||[]).join(', ')}">
        <div><input type="checkbox" id="editFuzzy" ${q.shortFuzzy!==false?'checked':''}> 퍼지 허용</div>
      </div>
      <div id="editKeyWrap" style="display:${q.type==='ESSAY'||q.type==='KEYWORD'?'block':'none'}">
        <label style="color:var(--muted);font-size:14px">키워드 (쉼표, 항목 내 a|b 허용)</label>
        <input type="text" id="editKeywords" value="${kwDisplay.join(', ')}">
        <label style="color:var(--muted);font-size:14px;margin-top:8px">임계값 (예: 7/10 또는 숫자)</label>
        <input type="text" id="editKeyThr" value="${q.keywordThreshold||''}">
      </div>
      <div style="grid-column:1/-1">
        <label style="color:var(--muted);font-size:14px">해설</label>
        <textarea id="editExplain">${q.explain || ''}</textarea>
      </div>
      <div style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px">
        <button class="secondary" onclick="closeEditModal(this)">취소</button>
        <button class="success" onclick="saveEditQuestion(${id}, this)">저장</button>
      </div>
    </div>
    <script>
      (function(){
        const typeEl=document.getElementById('editType');
        const ans=document.getElementById('editAnswerWrap');
        const syn=document.getElementById('editSynWrap');
        const key=document.getElementById('editKeyWrap');
        typeEl.addEventListener('change',()=>{
          const t=typeEl.value;
          ans.style.display=(t==='OX'||t==='SHORT')?'block':'none';
          syn.style.display=(t==='SHORT')?'block':'none';
          key.style.display=(t==='ESSAY')?'block':'none';
        });
      })();
    </script>
  `;
  const overlay = createModal(html);
  overlay.dataset.modal = 'edit-question';
}

function closeEditModal(el) {
  const overlay = el.closest('.modal')?.parentElement;
  if (overlay) closeModal(overlay);
}

async function saveEditQuestion(id, btn) {
  try { btn.disabled = true; } catch(_){}
  const updates = {
    deck: Number(document.getElementById('editDeck').value),
    type: document.getElementById('editType').value,
    prompt: document.getElementById('editPrompt').value.trim(),
    explain: document.getElementById('editExplain').value.trim()
  };
  if (updates.type === 'OX' || updates.type === 'SHORT') {
    updates.answer = document.getElementById('editAnswer').value.trim();
  }
  if (updates.type === 'SHORT') {
    const syn = document.getElementById('editSynonyms').value.split(',').map(s=>s.trim()).filter(Boolean);
    if (syn.length) updates.synonyms = syn; else updates.synonyms = [];
    updates.shortFuzzy = !!document.getElementById('editFuzzy').checked;
  }
  if (updates.type === 'KEYWORD' || updates.type === 'ESSAY') {
    const keys = document.getElementById('editKeywords').value.split(',').map(s=>s.trim()).filter(Boolean);
    updates.keywords = keys;
    const thr = document.getElementById('editKeyThr').value.trim();
    if (thr) updates.keywordThreshold = thr; else delete updates.keywordThreshold;
  }
  await DataStore.updateQuestion(id, updates);
  showToast('수정되었습니다', 'success');
  const overlay = document.querySelector('.modal-overlay[data-modal="edit-question"]');
  if (overlay) closeModal(overlay);
  await updateQuestionList();
}

// TODO: Remove this entire function and just call imported updateStats
// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported statistics module
async function updateStatsLegacy() {
 const profile = await getProfile();
 const questions = await getQuestions();
 const review = await getReview();
 const studiedProblems = Object.keys(review).length;
 const accuracyColor = rolling >= 80 ? '#10b981' : rolling >= 60 ? '#f59e0b' : '#ef4444';
 const streakColor = profile.streak >= 7 ? '#8b5cf6' : profile.streak >= 3 ? '#06b6d4' : '#6b7280';
 
 let statsHtml = `
   <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
     <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:14px;border-radius:10px;color:white;text-align:center">
       <div style="font-size:20px;font-weight:bold;margin-bottom:2px">${studiedProblems}</div>
       <div style="opacity:0.9;font-size:11px">📚 학습한 문제</div>
     </div>
     <div style="background:linear-gradient(135deg,${accuracyColor} 0%,${accuracyColor}dd 100%);padding:14px;border-radius:10px;color:white;text-align:center">
       <div style="font-size:20px;font-weight:bold;margin-bottom:2px">${rolling}%</div>
       <div style="opacity:0.9;font-size:11px">🎯 7일 정답률</div>
     </div>
     <div style="background:linear-gradient(135deg,${streakColor} 0%,${streakColor}dd 100%);padding:14px;border-radius:10px;color:white;text-align:center">
       <div style="font-size:20px;font-weight:bold;margin-bottom:2px" id="streak">${profile.streak}</div>
       <div style="opacity:0.9;font-size:11px">🔥 연속 학습</div>
     </div>
   </div>
   
   <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
     <div style="background:var(--card-bg);padding:10px;border-radius:8px;border:1px solid var(--border);text-align:center">
       <div style="font-size:18px;color:#ef4444;margin-bottom:2px">${dueToday}</div>
       <div style="font-size:10px;color:var(--muted)">📅 오늘</div>
     </div>
     <div style="background:var(--card-bg);padding:10px;border-radius:8px;border:1px solid var(--border);text-align:center">
       <div style="font-size:18px;color:#f59e0b;margin-bottom:2px">${dueTomorrow}</div>
       <div style="font-size:10px;color:var(--muted)">⏰ 내일</div>
     </div>
     <div style="background:var(--card-bg);padding:10px;border-radius:8px;border:1px solid var(--border);text-align:center">
       <div style="font-size:18px;color:#06b6d4;margin-bottom:2px">${dueWeek}</div>
       <div style="font-size:10px;color:var(--muted)">🗓️ 이번 주</div>
     </div>
   </div>

   <div style="background:var(--card-bg);padding:20px;border-radius:12px;border:1px solid var(--border);margin-bottom:24px">
     <h3 style="font-size:18px;color:var(--text);margin:0 0 16px 0;display:flex;align-items:center">
       <span style="font-size:16px;margin-right:6px">📅</span> 이번 주 학습
      </h3>
      <button onclick="openLearningCalendar()" style="background:var(--accent);color:white;border:none;padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer;position:absolute;top:14px;right:14px">
        전체 보기
      </button>
      <div style="display:flex;justify-content:space-between;gap:2px;margin-bottom:8px" id="weeklyCalendar">
        <!-- Weekly calendar will be generated by JavaScript -->
      </div>
      <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px" id="streakMessage">
        ${profile.streak >= 7 ? '🚀 대단해요! 학습 습관이 완전히 자리잡았네요!' : 
          profile.streak >= 3 ? '👍 좋은 페이스로 가고 있어요!' : 
          profile.streak >= 1 ? '💪 시작이 반이에요!' : '오늘부터 새로운 학습을 시작해보세요!'}
      </div>
   </div>
`;
 document.getElementById('statsContent').innerHTML = statsHtml;
 
 // Initialize charts after DOM is updated
 // Charts removed for cleaner UI
 
 // Enhanced Achievement System
 let achievementHtml = '';
const studiedToday = roll[todayStr()]?.total || 0;
const totalQuestions = questions.length;
const completedQuestions = Object.keys(review).length;
 const achievements = [
  {name: '🔥 불타는 열정', desc: '7일 연속 학습', achieved: profile.streak >= 7, category: 'streak', progress: Math.min(profile.streak, 7), total: 7},
  {name: '⭐ 첫 발걸음', desc: '첫 문제 학습 완료', achieved: completedQuestions > 0, category: 'basic', progress: Math.min(completedQuestions, 1), total: 1},
  {name: '📚 지식 탐험가', desc: 'XP 1000 달성', achieved: profile.xp >= 1000, category: 'xp', progress: Math.min(profile.xp, 1000), total: 1000},
  {name: '🎯 정확한 저격수', desc: '7일 정답률 80%', achieved: rolling >= 80, category: 'accuracy', progress: Math.min(rolling, 80), total: 80},
 {name: '💪 오늘의 승부사', desc: '하루 10문제 학습', achieved: studiedToday >= 10, category: 'daily', progress: Math.min(studiedToday, 10), total: 10},
 {name: '🏆 마스터 클래스', desc: '문제 50개 학습', achieved: completedQuestions >= 50, category: 'master', progress: Math.min(completedQuestions, 50), total: 50},
 {name: '🚀 스피드러너', desc: '하루 20문제 학습', achieved: studiedToday >= 20, category: 'speed', progress: Math.min(studiedToday, 20), total: 20},
 {name: '💎 다이아몬드', desc: 'XP 5000 달성', achieved: profile.xp >= 5000, category: 'legend', progress: Math.min(profile.xp, 5000), total: 5000}
];

// Sort achievements: completed first, then by progress  
achievements.sort((a, b) => {
  if (a.achieved && !b.achieved) return -1;
  if (!a.achieved && b.achieved) return 1;
  return (b.progress / b.total) - (a.progress / a.total);
});
 
 achievements.forEach(a => {
   achievementHtml += `
     <div style="margin-bottom:12px;opacity:${a.achieved ? 1 : 0.5}">
       <div>${a.name} ${a.achieved ? '✓' : ''}</div>
       <div style="font-size:12px;color:var(--muted)">${a.desc}</div>
     </div>
   `;
 });
 document.getElementById('achievementContent').innerHTML = achievementHtml;
 
 // Enhanced Review Schedule
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
   scheduleHtml = `
    <div style="text-align:center;padding:32px;color:var(--muted)">
      <div style="font-size:48px;margin-bottom:16px">🎉</div>
      <div style="font-size:16px;margin-bottom:8px">예정된 복습이 없습니다</div>
      <div style="font-size:14px">모든 복습을 완료했거나 새로운 문제를 추가해보세요!</div>
    </div>
  `;
 }
 document.getElementById('scheduleContent').innerHTML = scheduleHtml;
 
 // Enhanced Top 10 Difficult Problems
 const revArr = Object.entries(review).map(([id,r])=>({
  id: Number(id), 
  ease: r.ease ?? 2.5, 
  again: r.againCount||0,
  correct: r.correct || 0,
  total: r.count || 0
}));
 revArr.sort((a,b)=> (a.ease - b.ease) || (b.again - a.again));
 const hardest = revArr.slice(0,10);
 let hardHtml = '';
 hardest.forEach((item, index) => {
   const q = questions.find(q=> q.id == item.id);
   if (!q) return;
  
  const accuracy = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
  const difficultyLevel = item.ease < 1.5 ? '🔥' : item.ease < 2.0 ? '😵' : item.ease < 2.5 ? '😰' : '😅';
  const rankColor = index < 3 ? '#ff6b6b' : index < 6 ? '#ffa726' : '#66bb6a';
  
  hardHtml += `
    <div style=\"background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;position:relative\">
      <div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:12px\">
        <div style=\"display:flex;align-items:center\">
          <div style=\"background:${rankColor};color:white;font-weight:bold;font-size:12px;padding:4px 8px;border-radius:12px;margin-right:12px;min-width:24px;text-align:center\">
            ${index + 1}
          </div>
          <div style=\"font-size:20px;margin-right:8px\">${difficultyLevel}</div>
          <div style=\"font-size:14px;color:var(--text);font-weight:500\">난이도 ${item.ease.toFixed(1)}</div>
        </div>
        <div style=\"text-align:right\">
          <div style=\"font-size:18px;font-weight:bold;color:${accuracy < 50 ? '#ff6b6b' : accuracy < 80 ? '#ffa726' : '#66bb6a'}\">${accuracy}%</div>
          <div style=\"font-size:11px;color:var(--muted)\">정답률</div>
        </div>
      </div>
      
      <div style=\"font-size:14px;color:var(--text);line-height:1.4;margin-bottom:8px\">
        ${escapeHtml(q.prompt.substring(0, 80))}${q.prompt.length > 80 ? '...' : ''}
      </div>
      
      <div style=\"display:flex;gap:8px\">
        <span style=\"background:rgba(255, 107, 107, 0.1);color:#ff6b6b;font-size:11px;padding:2px 6px;border-radius:4px\">
          ${item.again}회 틀림
        </span>
        <span style=\"background:rgba(102, 187, 106, 0.1);color:#66bb6a;font-size:11px;padding:2px 6px;border-radius:4px\">
          ${item.total}회 시도
        </span>
      </div>
    </div>
  `;
 });
 if (!hardHtml) {
  hardHtml = `
    <div style=\"text-align:center;padding:32px;color:var(--muted)\">
      <div style=\"font-size:48px;margin-bottom:16px\">🎯</div>
      <div style=\"font-size:16px;margin-bottom:8px\">아직 충분한 학습 데이터가 없어요</div>
      <div style=\"font-size:14px\">더 많은 문제를 풀어보세요!</div>
    </div>
  `;
}
 const statsContainer = document.getElementById('statsContent');
 statsContainer.innerHTML += `
  <div style=\"background:var(--card-bg);padding:20px;border-radius:12px;border:1px solid var(--border);margin-top:24px\">
    <h3 style=\"font-size:18px;color:var(--text);margin:0 0 16px 0;display:flex;align-items:center\">
      <span style=\"font-size:24px;margin-right:8px\">🎯</span> 어려운 문제 Top 10
    </h3>
    ${hardHtml}
  </div>
`;
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
  
  // Load font size setting
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  if (fontSizeSelect) {
    fontSizeSelect.value = s.fontSize;
  }
  
  // Load focus mode setting
  const focusModeToggle = document.getElementById('focusModeToggle');
  if (focusModeToggle) {
    focusModeToggle.checked = s.focusMode;
  }
  
  const aiMode = document.getElementById('aiMode');
  if (aiMode) {
    aiMode.value = localStorage.getItem('aiMode') || 'local';
  }
  
  loadAISettings();
  
  // Apply current settings to the UI
  applyFontSize(s.fontSize);
  applyFocusMode(s.focusMode);
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
  
  // Get font size and focus mode settings
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const focusModeToggle = document.getElementById('focusModeToggle');
  
  const newSettings = {
    dailyReviewLimit: val,
    fontSize: fontSizeSelect ? fontSizeSelect.value : 'medium',
    focusMode: focusModeToggle ? focusModeToggle.checked : false
  };
  
  setSettings(newSettings);
  
  const aiMode = document.getElementById('aiMode');
  if (aiMode) {
    localStorage.setItem('aiMode', aiMode.value);
  }
  
  // Apply the new settings immediately
  applyFontSize(newSettings.fontSize);
  applyFocusMode(newSettings.focusMode);
  
  updateDueLeftUI();
  await updateProgress();
  showToast('설정이 저장되었습니다', 'success');
}

// Font size application
function applyFontSize(fontSize) {
  const root = document.documentElement;
  
  switch (fontSize) {
    case 'small':
      root.style.setProperty('--font-size-base', '14px');
      root.style.setProperty('--font-size-lg', '16px');
      root.style.setProperty('--font-size-xl', '18px');
      break;
    case 'large':
      root.style.setProperty('--font-size-base', '18px');
      root.style.setProperty('--font-size-lg', '20px');
      root.style.setProperty('--font-size-xl', '24px');
      break;
    case 'medium':
    default:
      root.style.setProperty('--font-size-base', '16px');
      root.style.setProperty('--font-size-lg', '18px');
      root.style.setProperty('--font-size-xl', '20px');
      break;
  }
  
  // Update body class for additional font size styling
  document.body.className = document.body.className.replace(/font-size-\w+/g, '');
  document.body.classList.add(`font-size-${fontSize}`);
}

// Focus mode application
function applyFocusMode(enabled) {
  const body = document.body;
  
  if (enabled) {
    body.classList.add('focus-mode');
    
    // Hide non-essential UI elements during quiz sessions
    if (session && session.active) {
      const elementsToHide = [
        'header',
        'navigation',
        'sidebar', 
        '.stats-summary',
        '.progress-indicators:not(.session-progress)',
        '.secondary-controls'
      ];
      
      elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          el.style.display = 'none';
          el.setAttribute('data-hidden-by-focus', 'true');
        });
      });
      
      // Show only essential quiz elements
      const qArea = document.getElementById('qArea');
      const sessionProgress = document.querySelector('.session-progress');
      if (qArea) qArea.style.display = 'block';
      if (sessionProgress) sessionProgress.style.display = 'block';
    }
  } else {
    body.classList.remove('focus-mode');
    
    // Restore hidden elements
    const hiddenElements = document.querySelectorAll('[data-hidden-by-focus="true"]');
    hiddenElements.forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-hidden-by-focus');
    });
  }
}

// Initialize settings on page load
function initializeSettings() {
  const settings = getSettings();
  applyFontSize(settings.fontSize);
  applyFocusMode(settings.focusMode);
}

// Call initialize on DOM content loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSettings);
} else {
  initializeSettings();
}

// Preview functions for settings
function previewFontSize(size) {
  const preview = document.getElementById('settingsPreview');
  if (preview) {
    preview.style.display = 'block';
    applyFontSize(size);
  }
}

function previewFocusMode(enabled) {
  const preview = document.getElementById('settingsPreview');
  if (preview) {
    preview.style.display = 'block';
    preview.innerHTML = enabled 
      ? '<div style="font-size: 14px; color: var(--muted); margin-bottom: 8px;">미리보기: 집중 모드</div><div style="font-size: var(--font-size-base);">집중 모드가 활성화되면 학습 중 불필요한 UI 요소들이 숨겨져서 문제에만 집중할 수 있습니다.</div>'
      : '<div style="font-size: 14px; color: var(--muted); margin-bottom: 8px;">미리보기: 일반 모드</div><div style="font-size: var(--font-size-base);">일반 모드에서는 모든 UI 요소가 표시됩니다.</div>';
  }
}

function resetToDefaults() {
  if (confirm('모든 설정을 기본값으로 재설정하시겠습니까?')) {
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    const focusModeToggle = document.getElementById('focusModeToggle');
    const dailyLimitInput = document.getElementById('dailyLimitInput');
    
    if (fontSizeSelect) fontSizeSelect.value = 'medium';
    if (focusModeToggle) focusModeToggle.checked = false;
    if (dailyLimitInput) dailyLimitInput.value = '30';
    
    // Apply defaults immediately
    applyFontSize('medium');
    applyFocusMode(false);
    
    // Save defaults
    setSettings({
      fontSize: 'medium',
      focusMode: false,
      dailyReviewLimit: 30
    });
    
    showToast('설정이 기본값으로 재설정되었습니다', 'success');
  }
}

// ========== 유틸리티 ==========
// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported ui-handlers module
async function showTabLegacy(e, tabName) {
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
   // Note: notes functionality is now handled by ui-handlers.js
   // This will be handled by the ui-handlers showTab function
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
  if (!['OX', 'SHORT', 'ESSAY'].includes(t)) errors.push('유형 오류');
  if (!row.deck) errors.push('덱 누락');
  if (!row.prompt) errors.push('문제 누락');
  if (t === 'OX') {
    if (!['true', 'false', 'TRUE', 'FALSE'].includes(String(row.answer))) errors.push('OX 정답 오류');
  } else if (t === 'SHORT') {
    if (!row.answer) errors.push('정답 누락');
  } else if (t === 'ESSAY') {
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
  if (type === 'OX') { 
    ans.style.display = 'block'; 
    syn.style.display = 'none'; 
    key.style.display = 'none';
    // Convert to dropdown for OX type
    const answerEl = document.getElementById('quickAnswer');
    answerEl.innerHTML = '<option value="">선택하세요</option><option value="true">O (참)</option><option value="false">X (거짓)</option>';
  }
  else if (type === 'SHORT') { 
    ans.style.display = 'none'; 
    syn.style.display = 'block'; 
    key.style.display = 'none';
  }
  else { ans.style.display = 'none'; syn.style.display = 'none'; key.style.display = 'block'; }
}

async function quickAdd() {
  const deck = document.getElementById('quickDeck')?.value;
  const type = document.getElementById('quickType')?.value || 'OX';
  const prompt = (document.getElementById('quickPrompt')?.value || '').trim();
  if (!deck) { showToast('덱을 선택하세요', 'warning'); return; }
  if (!prompt) { showToast('문제를 입력하세요', 'warning'); return; }
  const q = { deck, type, prompt };
  if (type === 'OX') {
    const ans = (document.getElementById('quickAnswer')?.value || '').trim();
    if (!ans) { showToast('정답을 선택하세요', 'warning'); return; }
    q.answer = ans;
  } else if (type === 'SHORT') {
    // SHORT type doesn't use quickAnswer - it uses explanation as answer
    q.answer = prompt; // For quick add, use prompt as answer for SHORT type
    const syn = (document.getElementById('quickSynonyms')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    if (syn.length) q.synonyms = syn;
    q.shortFuzzy = !!document.getElementById('quickFuzzy')?.checked;
  } else if (type === 'ESSAY') {
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

// Note: currentNoteId is managed in ui-handlers.js to avoid conflicts
// let currentNoteId = null; 
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

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported notes module
async function createNoteLegacy() {
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
  setCurrentNoteId(id);
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
  if (!getCurrentNoteId()) return;
  // In a real implementation, this would come from a dedicated input
  // For now, we'll add a placeholder line.
  const text = `새로운 줄 - ${new Date().toLocaleTimeString()}`;

  await db.note_items.add({
    noteId: getCurrentNoteId(),
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
  loadNote(getCurrentNoteId());
}

async function deleteNoteCascade(id) {
  if (!confirm('정말로 이 노트를 삭제하시겠습니까?')) return;

  await db.note_items.where('noteId').equals(id).delete();
  await db.notes.delete(id);

  setCurrentNoteId(null);
  // Clear editor and reload list
  document.getElementById('deckSelectNotes').value = '';
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteSource').value = '';
  document.getElementById('noteTextarea').value = '';
  await loadNotes();
}

async function saveNoteMeta() {
  if (!getCurrentNoteId()) return;

  const deckId = document.getElementById('deckSelectNotes').value;
  const title = document.getElementById('noteTitle').value.trim();
  const source = document.getElementById('noteSource').value.trim();

  if (!title) {
    showToast('노트 제목은 비워둘 수 없습니다.', 'warning');
    return;
  }

  await db.notes.update(getCurrentNoteId(), {
    deckId: Number(deckId),
    title,
    source,
    updated: new Date(),
  });

  showToast('노트가 저장되었습니다.', 'success');
  await loadNotes(); // Refresh list to show new title
}

async function noteLinesToDraftQuestions() {
  if (!getCurrentNoteId() || selectedNoteItemIds.size === 0) {
    showToast('변환할 노트 줄을 선택하세요.', 'warning');
    return;
  }

  const note = await db.notes.get(getCurrentNoteId());
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
  if (!getCurrentNoteId()) {
    showToast('내보낼 노트를 선택하세요.', 'warning');
    return;
  }

  const note = await db.notes.get(getCurrentNoteId());
  if (!note) return;

  const items = await db.note_items.where('noteId').equals(getCurrentNoteId()).sortBy('ts');
  const decks = await getDecks();
  const deck = decks.find(d => Number(d.id) === Number(note.deckId));

  let markdown = `# ${note.title}\n\n`;
  if (deck) {
    markdown += `- Deck: ${deck.name}\n`;
  }
  if (note.source) {
    markdown += `- Source: ${note.source}\n`;
  }
  // Handle created date safely
  const createdDate = note.created ? new Date(note.created) : new Date();
  const createdDateStr = !isNaN(createdDate.getTime()) ? createdDate.toISOString() : 'Unknown';
  markdown += `- Created: ${createdDateStr}\n\n`;
  
  markdown += `## Notes\n\n`;

  // Handle item timestamps safely
  markdown += items.map(item => {
    const itemDate = item.ts ? new Date(item.ts) : new Date();
    const dateStr = !isNaN(itemDate.getTime()) ? itemDate.toLocaleString() : 'Unknown time';
    return `- [${dateStr}] ${item.text}`;
  }).join('\n');

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
  const deckName = (decks.find(d => Number(d.id) === Number(currentNote.deckId)) || {}).name || '알 수 없음';
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

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported notes module
async function exportNoteToMarkdownLegacy() {
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

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported notes module
async function convertSelectionToQuestionsLegacy() {
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
   // Initialize theme first
   try { if (typeof initTheme === 'function') initTheme(); } catch (_) {}
   // Initialize database and run migration if needed
   await migrateFromLocalStorage();
   
   // Initialize UI
   await updateHeader();
  await updateDeckSelects();
  // Initialize answer field display for default OX question type
  updateAnswerField();
  // Optional: guided import setup (guard if not defined)
  try { if (typeof setupGuidedImport === 'function') setupGuidedImport(); } catch (_) {}
   
  // AI-related global assignments and event listeners
  Object.assign(window, { saveAISettings, testAIConnection, resetStudySession, askChatQuestion, showDontKnowAnswer, proceedAfterDontKnow, stopLearning });
  document.getElementById('aiProvider')?.addEventListener('change', updateModelOptions);
  document.getElementById('aiModel')?.addEventListener('change', autoSaveAISettings);
  
  // Initialize UI handlers and events
  bindEvents();
  
  // Note: Global functions are already bound at module load time for immediate HTML access
  
  // Load AI settings on startup
 loadAISettings();
  
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

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported theme module
function setThemeLegacy(theme) {
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

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported theme module
function toggleThemeLegacy() {
  const current = getTheme();
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
}

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported theme module
function initThemeLegacy() {
  const theme = getTheme();
  setTheme(theme);
}

// ========== Drag & Drop for Question Reordering ==========
let draggedElement = null;

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported drag-drop module
function handleDragStartLegacy(e) {
  draggedElement = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.outerHTML);
}

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported drag-drop module
function handleDragOverLegacy(e) {
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

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported drag-drop module
function handleDropLegacy(e) {
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

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported drag-drop module
function handleDragEndLegacy(e) {
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
let dailyReviewChartInstance = null;
let streakChartInstance = null;

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
  
  // Reset charts flag to allow re-initialization
  chartsInitialized = false;
  
  // Wait for DOM to be fully updated
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (chartsInitialized) return;
  chartsInitialized = true;
  
  await createDailyReviewChart(data);
  await createStreakChart(data);
}

async function createDailyReviewChart(data) {
  const canvas = document.getElementById('dailyReviewChart');
  if (!canvas) return;
  
  // Destroy existing chart if it exists
  if (dailyReviewChartInstance) {
    dailyReviewChartInstance.destroy();
  }
  
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
  
  dailyReviewChartInstance = new Chart(canvas, {
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
  
  // Destroy existing chart if it exists
  if (streakChartInstance) {
    streakChartInstance.destroy();
  }
  
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
  
  streakChartInstance = new Chart(canvas, {
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

// ========== AI Settings ==========
const AI_MODELS = {
  openai: ['gpt-4o-mini','gpt-4o','gpt-3.5-turbo'],
  anthropic: ['claude-3-haiku-20240307','claude-3-sonnet-20240229'],
  // Updated to supported Gemini 2.x models
  gemini: ['gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.0-flash']
};

function updateModelOptions() {
  const provider = document.getElementById('aiProvider')?.value;
  const modelSelect = document.getElementById('aiModel');
  
  if (!modelSelect) return;
  
  modelSelect.innerHTML = '<option value="">자동 선택</option>';
  if (provider && AI_MODELS[provider]) {
    AI_MODELS[provider].forEach(model => {
      modelSelect.innerHTML += `<option value="${model}">${model}</option>`;
    });
  }
  
  // Auto-save when provider changes (if API key exists and not loading)
  if (!window._isLoadingAISettings) {
    const apiKey = document.getElementById('aiApiKey')?.value;
    if (provider && apiKey) {
      saveAISettings(true); // Silent save to prevent toast spam
    }
  }
}

function autoSaveAISettings() {
  // Don't auto-save during initial loading
  if (window._isLoadingAISettings) return;
  
  const provider = document.getElementById('aiProvider')?.value;
  const apiKey = document.getElementById('aiApiKey')?.value;
  
  if (provider && apiKey) {
    saveAISettings(true); // Silent save to prevent toast spam
  }
}

function getBaseUrl(provider, model = null) {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'gemini':
      const geminiModel = model || 'gemini-2.5-flash';
      return `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function saveAISettings(silent = false) {
  const provider = document.getElementById('aiProvider')?.value;
  const apiKey = document.getElementById('aiApiKey')?.value;
  const model = document.getElementById('aiModel')?.value;
  
  if (provider && apiKey) {
    // Only use fallback model if no model is specified and no existing config
    const existingConfig = window.__AI_CONF;
    let selectedModel = model;
    
    if (!selectedModel) {
      // If we have existing config with the same provider, keep the same model
      if (existingConfig && existingConfig.provider === provider && existingConfig.model) {
        selectedModel = existingConfig.model;
      } else {
        // Only use first model as fallback if truly no model preference exists
        selectedModel = AI_MODELS[provider]?.[0] || '';
      }
    }
    
    const config = {
      provider,
      apiKey,
      model: selectedModel,
      baseUrl: getBaseUrl(provider, selectedModel),
      enableCloud: true
    };
    
    localStorage.setItem('aiConfig', JSON.stringify(config));
    window.__AI_CONF = config;
    
    if (!silent && typeof showToast === 'function') {
      showToast('AI 설정이 저장되었습니다', 'success');
    } else if (!silent) {
      console.log('AI settings saved successfully');
    }
  } else {
    if (!silent && typeof showToast === 'function') {
      showToast('Provider와 API Key를 입력하세요', 'warning');
    } else if (!silent) {
      console.log('Provider and API Key required');
    }
  }
}

function loadAISettings() {
  try {
    const saved = localStorage.getItem('aiConfig');
    if (saved) {
      const config = JSON.parse(saved);
      window.__AI_CONF = config;
      
      // Set loading flag BEFORE any DOM manipulation
      window._isLoadingAISettings = true;
      
      const providerEl = document.getElementById('aiProvider');
      const apiKeyEl = document.getElementById('aiApiKey');
      const modelEl = document.getElementById('aiModel');
      
      if (providerEl) providerEl.value = config.provider || '';
      if (apiKeyEl) apiKeyEl.value = config.apiKey || '';
      
      // Update model options first, then set the saved model value
      updateModelOptions();
      
      // Set model value after dropdown is populated
      if (modelEl && config.model) {
        modelEl.value = config.model;
      }
      
      // Clear loading flag AFTER all DOM manipulation is complete
      window._isLoadingAISettings = false;
      
      console.log('AI settings loaded:', { provider: config.provider, model: config.model });
    }
  } catch (e) {
    console.warn('Failed to load AI settings:', e);
    window._isLoadingAISettings = false; // Ensure flag is cleared even on error
  }
}

async function testAIConnection() {
  try {
    // Ensure configuration is available - if not, try to create it from form values
    if (!window.__AI_CONF || !window.__AI_CONF.apiKey) {
      const provider = document.getElementById('aiProvider')?.value;
      const apiKey = document.getElementById('aiApiKey')?.value;
      const model = document.getElementById('aiModel')?.value;
      
      if (!provider || !apiKey) {
        throw new Error('Provider와 API Key를 입력해주세요');
      }
      
      // Temporarily set config for testing
      const selectedModel = model || AI_MODELS[provider]?.[0];
      window.__AI_CONF = {
        provider,
        apiKey,
        model: selectedModel,
        baseUrl: getBaseUrl(provider, selectedModel),
        enableCloud: true
      };
    }
    
  const { getAdapter } = await import('./ai/index.js');
  const adapter = getAdapter('cloud');
  const res = await adapter.grade({ prompt: 'test', reference: { answer: 'test' } });
  
  if (typeof showToast === 'function') {
    if (res.used === 'cloud') {
      showToast('AI 연결 성공!', 'success');
    } else {
      const reason = res.rationale ? `: ${res.rationale}` : '';
      showToast(`클라우드 연결 실패, 로컬 채점으로 대체됨${reason}`, 'warning');
    }
  } else {
    console.log('AI connection result:', res);
  }
  } catch (e) {
    if (typeof showToast === 'function') {
      showToast(`연결 실패: ${e.message}`, 'danger');
    } else {
      console.log(`AI connection failed: ${e.message}`);
    }
  }
}

// ========== AI Question Generation ==========
let generatedQuestions = [];

async function generateQuestions() {
  const topic = document.getElementById('aiTopic').value.trim();
  const difficulty = document.getElementById('aiDifficulty').value;
  const questionType = document.getElementById('aiQuestionType').value;
  const deckId = document.getElementById('aiDeckSelect').value;
  const count = parseInt(document.getElementById('aiQuestionCount').value);

  if (!topic) {
    showToast('주제를 입력해주세요', 'danger');
    return;
  }

  if (!deckId) {
    showToast('덱을 선택해주세요', 'danger');
    return;
  }

  const generateBtn = document.getElementById('generateBtn');
  const generateBtnText = document.getElementById('generateBtnText');
  const originalText = generateBtnText.textContent;

  try {
    generateBtn.disabled = true;
    generateBtnText.textContent = '⏳ 생성 중...';

    const config = window.__AI_CONF;
    if (!config || !config.baseUrl || !config.apiKey) {
      throw new Error('AI 설정을 먼저 구성해주세요');
    }

    const { getAdapter } = await import('./ai/index.js');
    const adapter = getAdapter('cloud');

    const prompt = buildGenerationPrompt(topic, difficulty, questionType, count);
    
    const result = await adapter.generateQuestions({
      prompt: prompt,
      questionType: questionType,
      count: count
    });

    if (result.used !== 'cloud') {
      throw new Error('AI 문제 생성은 클라우드 모드에서만 지원됩니다');
    }

    generatedQuestions = result.questions || [];
    displayGeneratedQuestions();
    
    showToast(`${generatedQuestions.length}개 문제가 생성되었습니다`, 'success');

  } catch (error) {
    console.error('Question generation failed:', error);
    
    // Provide more user-friendly error messages
    let userMessage = error.message;
    if (error.message.includes('JSON parsing failed')) {
      userMessage = 'AI가 올바른 형식으로 응답하지 않았습니다. 다시 시도해주세요.';
    } else if (error.message.includes('HTTP 500')) {
      userMessage = 'AI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('HTTP 401')) {
      userMessage = 'API 키가 유효하지 않습니다. AI 설정을 확인해주세요.';
    } else if (error.message.includes('HTTP 429')) {
      userMessage = 'API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('timeout')) {
      userMessage = '요청 시간이 초과되었습니다. 문제 수를 줄이거나 다시 시도해주세요.';
    } else if (error.message.includes('AI configuration not found')) {
      userMessage = 'AI 설정이 필요합니다. 관리 탭에서 AI 설정을 완료해주세요.';
    }
    
    showToast(`생성 실패: ${userMessage}`, 'danger');
  } finally {
    generateBtn.disabled = false;
    generateBtnText.textContent = originalText;
  }
}

function buildGenerationPrompt(topic, difficulty, questionType, count) {
  const difficultyMap = {
    'beginner': '초급 (기본 개념과 정의 중심)',
    'intermediate': '중급 (응용과 분석 중심)', 
    'advanced': '고급 (심화 이론과 복합 개념 중심)'
  };

  const typeMap = {
    'OX': 'OX 문제 (참/거짓)',
    'SHORT': '단답형 문제 (간단한 답변)',
    'KEYWORD': '키워드형 문제 (핵심 단어들로 채점)'
  };

  return `컴퓨터 과학 주제 "${topic}"에 대해 ${difficultyMap[difficulty]} ${typeMap[questionType]}을 ${count}개 생성해주세요.

**중요: 반드시 아래의 정확한 JSON 형식으로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요.**

{
  "questions": [
    {
      "prompt": "문제 내용",
      "answer": "${questionType === 'OX' ? 'true 또는 false' : '정답 내용'}",
      ${questionType === 'KEYWORD' ? '"keywords": ["키워드1", "키워드2", "키워드3"],' : ''}
      "explanation": "상세한 해설"
    }${count > 1 ? ',\n    {\n      "prompt": "두 번째 문제...",\n      "answer": "정답",\n      "explanation": "해설"\n    }' : ''}
  ]
}

**필수 요구사항:**
- 모든 문제는 한국어로 작성
- explanation은 개념을 명확히 설명하는 상세한 해설
- ${questionType === 'OX' ? 'answer는 반드시 true 또는 false (문자열 아님)' : '정확한 정답 작성'}
- ${questionType === 'KEYWORD' ? 'keywords는 3-5개의 핵심 키워드 배열' : ''}
- 실제 CS 시험/면접 수준의 고품질 문제
- JSON 형식 엄격 준수 (문법 오류 없이)
 - 각 문제는 280자 이내, 해설은 1~2문장(60~120자)로 간결히 작성

`;
}

function displayGeneratedQuestions() {
  const previewDiv = document.getElementById('generatedPreview');
  const previewList = document.getElementById('previewList');

  if (generatedQuestions.length === 0) {
    previewDiv.style.display = 'none';
    return;
  }

  let html = '';
  generatedQuestions.forEach((q, index) => {
    const isSelected = q.selected !== false;
    html += `
      <div class="question-item ${isSelected ? 'selected' : ''}" style="border-left: ${isSelected ? '4px solid var(--primary)' : '4px solid var(--muted)'}">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleQuestionSelection(${index})">
          <div style="flex:1">
            <strong>${q.prompt}</strong>
            <div style="font-size:12px;color:var(--muted);margin:4px 0">
              정답: ${q.answer === true ? 'O (참)' : q.answer === false ? 'X (거짓)' : q.answer}
              ${q.keywords ? ` | 키워드: ${q.keywords.join(', ')}` : ''}
            </div>
            <div style="font-size:12px;color:var(--muted)">${q.explanation}</div>
          </div>
        </div>
      </div>
    `;
  });

  previewList.innerHTML = html;
  previewDiv.style.display = 'block';
}

function toggleQuestionSelection(index) {
  if (generatedQuestions[index]) {
    generatedQuestions[index].selected = !generatedQuestions[index].selected;
    displayGeneratedQuestions();
  }
}

async function saveGeneratedQuestions() {
  const selectedQuestions = generatedQuestions.filter(q => q.selected !== false);
  
  if (selectedQuestions.length === 0) {
    showToast('저장할 문제를 선택해주세요', 'warning');
    return;
  }

  const deckId = document.getElementById('aiDeckSelect').value;
  const questionType = document.getElementById('aiQuestionType').value;

  try {
    let savedCount = 0;
    
    for (const q of selectedQuestions) {
      const questionData = {
        deck: parseInt(deckId),
        type: questionType,
        prompt: q.prompt,
        answer: questionType === 'OX' ? q.answer : String(q.answer), // OX는 boolean, 나머지는 string
        explain: q.explanation,
        created: Date.now(),
        tags: ['ai-generated'],
        generated: true
      };

      if (questionType === 'KEYWORD' && q.keywords) {
        const arr = Array.isArray(q.keywords)
          ? q.keywords
          : toKeywordsArray(q.keywords);
        questionData.keywords = arr;
      }

      await db.questions.add(questionData);
      savedCount++;
    }

    showToast(`${savedCount}개 문제가 저장되었습니다`, 'success');
    
    // Clear preview and refresh UI
    cancelGeneration();
    await updateQuestionList();
    
  } catch (error) {
    console.error('Failed to save questions:', error);
    showToast('문제 저장 중 오류가 발생했습니다', 'danger');
  }
}

function cancelGeneration() {
  generatedQuestions = [];
  document.getElementById('generatedPreview').style.display = 'none';
  
  // Clear form
  document.getElementById('aiTopic').value = '';
}

// Additional global bindings for immediate HTML compatibility
// Critical functions are bound at module load time for instant availability
window.switchTab = switchTab;
window.revealAnswer = revealAnswer;
window.gradeAnswer = gradeAnswerLegacy;
window.submitAnswer = submitAnswer;
window.startSession = startSessionLegacy;
window.addQuestion = addQuestion;
window.addDeck = addDeck;
// Keep using data-management module implementations
window.exportData = dmExportData;
window.importData = dmImportData;
window.resetAll = resetAll;
window.saveSettings = saveSettings;
window.deleteDeck = deleteDeck;

// Additional functions for HTML compatibility
window.updateAnswerField = updateAnswerField;
window.updateHeader = updateHeader;
window.updateDeckSelects = updateDeckSelects;
window.updateDeckList = updateDeckList;
window.updateQuestionList = updateQuestionList;
window.updateSettingsPanel = updateSettingsPanel;
window.updateStats = updateStats;
window.downloadImportTemplate = downloadImportTemplate;
window.resetData = resetData;
window.importValidPreviewRows = importValidPreviewRows;
window.undoLastImport = undoLastImport;
window.parseNaturalLanguage = parseNaturalLanguage;
window.updateQuickAddFields = updateQuickAddFields;
window.quickAdd = quickAdd;
window.toggleTheme = toggleTheme;
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.saveAISettings = saveAISettings;
window.testAIConnection = testAIConnection;
window.generateQuestions = generateQuestions;
window.toggleQuestionSelection = toggleQuestionSelection;
window.saveGeneratedQuestions = saveGeneratedQuestions;
window.cancelGeneration = cancelGeneration;
window.applyFontSize = applyFontSize;
window.applyFocusMode = applyFocusMode;
window.previewFontSize = previewFontSize;
window.previewFocusMode = previewFocusMode;
window.resetToDefaults = resetToDefaults;
window.noteLinesToDraftQuestions = noteLinesToDraftQuestions;
window.exportNoteAsMarkdown = exportNoteAsMarkdown;
window.addLine = addLine;
window.openLearningCalendar = openLearningCalendar;
window.closeLearningCalendar = closeLearningCalendar;
// Note: saveNote is handled by addEventListener in ui-handlers.js

// ========== Learning Calendar ==========
// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported statistics module
async function openLearningCalendarLegacy() {
  const roll = await getDailyRollup();
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Generate calendar for current and previous 2 months
  const months = [];
  for (let i = 2; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    months.push(date);
  }
  
  let calendarHtml = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:14px;color:var(--muted);margin-bottom:8px">학습 활동이 있는 날에는 숫자가 표시됩니다</div>
    </div>
  `;
  
  months.forEach(monthDate => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
    
    // Get first day of month and last day
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    calendarHtml += `
      <div style="margin-bottom:30px">
        <h4 style="text-align:center;margin:0 0 16px 0;color:var(--text)">${monthName}</h4>
        <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:4px;max-width:400px;margin:0 auto">
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">일</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">월</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">화</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">수</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">목</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">금</div>
          <div style="text-align:center;padding:8px;font-size:12px;color:var(--muted);font-weight:600">토</div>
    `;
    
    // Generate calendar days
    const currentDate = new Date(startDate);
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        const dayRoll = roll[dateStr];
        const hasActivity = dayRoll && dayRoll.total > 0;
        const isToday = dateStr === todayStr();
        const isCurrentMonth = currentDate.getMonth() === month;
        const dayNum = currentDate.getDate();
        
        let cellStyle = 'text-align:center;padding:8px;border-radius:6px;min-height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;';
        
        if (!isCurrentMonth) {
          cellStyle += 'color:var(--muted);opacity:0.3;';
        } else if (isToday) {
          cellStyle += 'background:var(--accent);color:white;font-weight:bold;';
        } else if (hasActivity) {
          cellStyle += 'background:#10b981;color:white;font-weight:600;';
        } else {
          cellStyle += 'color:var(--text);';
        }
        
        const content = hasActivity ? (dayRoll.total > 9 ? '9+' : dayRoll.total) : dayNum;
        calendarHtml += `<div style="${cellStyle}" title="${dateStr}: ${hasActivity ? dayRoll.total + '개 문제 학습' : '학습 없음'}">${content}</div>`;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      // Check if we've covered all days of the month
      if (currentDate.getMonth() !== month) break;
    }
    
    calendarHtml += `
        </div>
      </div>
    `;
  });
  
  document.getElementById('calendarContent').innerHTML = calendarHtml;
  document.getElementById('calendarModal').style.display = 'flex';
}

// Legacy implementation kept for reference after module refactor
// Renamed to avoid duplicate identifier with imported statistics module
function closeLearningCalendarLegacy() {
  document.getElementById('calendarModal').style.display = 'none';
}
