// ========== 데이터베이스 설정 (IndexedDB with Dexie) ==========
const db = new Dexie('CSStudyApp');
const APP_SCHEMA_VERSION = 4; // App-level schema/meta version (not Dexie version)

// Schema versioning - Version 1 (initial schema)
db.version(1).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, sortOrder',
  review: '++id, questionId, ease, interval, due, count, created, updated'
});

// Schema versioning - Version 2 (add indexes and optimize)
db.version(2).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, sortOrder, *tags',
  review: '++id, questionId, ease, interval, due, count, created, updated'
});

// Migration hook for version 2
db.version(2).upgrade(async (trans) => {
  // Add tags field to existing questions
  await trans.table('questions').toCollection().modify((question, ref) => {
    if (!question.tags) {
      question.tags = [];
    }
    if (question.sortOrder === undefined) {
      question.sortOrder = ref.primKey; // Use primary key as initial sort order
    }
  });
});

// Dexie schema v3: add meta table for app-level metadata
db.version(3).stores({
  profile: '++id, xp, streak, lastStudy',
  decks: '++id, name, created',
  questions: '++id, deck, type, prompt, answer, keywords, synonyms, explain, created, sortOrder, *tags',
  review: '++id, questionId, ease, interval, due, count, created, updated',
  meta: 'key'
});

// Dexie schema v4: add notes tables
db.version(4).stores({
  notes: '++id, deckId, title, source',
  note_items: '++id, noteId, ts, text, *tags'
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
export async function getSchemaVersion() {
  try {
    const row = await db.table('meta').get('schemaVersion');
    return row?.value ?? null;
  } catch (_) {
    return null;
  }
}

export async function setSchemaVersion(v) {
  await db.table('meta').put({ key: 'schemaVersion', value: v });
}

export async function getDailyRollup() {
  try {
    const row = await db.table('meta').get('dailyRollup');
    return row?.value || {};
  } catch (_) {
    return {};
  }
}

export async function setDailyRollup(obj) {
  await db.table('meta').put({ key: 'dailyRollup', value: obj });
}

// ========== Settings & Daily Stats ==========
const SETTINGS_KEY = 'cs.settings';
const DAILY_STATS_KEY = 'cs.dailyStats';
const DEFAULT_DAILY_REVIEW_LIMIT = 30; // configurable via localStorage settings
const EASE_LOW_THRESHOLD = 1.5; // heuristic for low-confidence
const SHORT_FUZZY = 0.85; // fuzzy threshold for SHORT answers and synonyms

export function getSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      dailyReviewLimit: Number.isFinite(s.dailyReviewLimit) ? s.dailyReviewLimit : DEFAULT_DAILY_REVIEW_LIMIT,
    };
  } catch (_) {
    return { dailyReviewLimit: DEFAULT_DAILY_REVIEW_LIMIT };
  }
}

export function setSettings(next) {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...next }));
}

export function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function getDailyStats() {
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

export function setDailyStats(stats) {
  localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
}

// ========== 데이터 마이그레이션 ==========
export async function migrateFromLocalStorage() {
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
	} catch (e) {
		console.error('Migration failed:', e);
		throw e;
	}
}

// ========== Database Accessors ==========
export async function getDecks() {
  return await db.decks.orderBy('created').reverse().toArray();
}

export async function setDecks(decks) {
  // Not implemented - use individual operations
  throw new Error('setDecks deprecated - use individual deck operations');
}

export async function getQuestions() {
  return await db.questions.toArray();
}

export async function setQuestions(questions) {
  // Not implemented - use individual operations
  throw new Error('setQuestions deprecated - use individual question operations');
}

export async function getProfile() {
  return await db.profile.toCollection().first() || { xp: 0, streak: 0, lastStudy: null };
}

export async function setProfile(profile) {
  const existing = await db.profile.toCollection().first();
  if (existing) {
    await db.profile.update(existing.id, profile);
  } else {
    await db.profile.add(profile);
  }
}

export async function getReview() {
  return await db.review.toArray();
}

export async function setReview(questionId, reviewData) {
  const existing = await db.review.where('questionId').equals(questionId).first();
  if (existing) {
    await db.review.update(existing.id, { ...reviewData, updated: new Date() });
  } else {
    await db.review.add({ ...reviewData, questionId, created: new Date(), updated: new Date() });
  }
}

// Export constants and db instance
export { db, APP_SCHEMA_VERSION, EASE_LOW_THRESHOLD, SHORT_FUZZY };