// ========== Database Operations ==========
// This module re-exports database functions for use by other modules

import { 
  handleDBError, 
  handleNoDataFound, 
  withErrorHandling, 
  DB_ERROR_TYPES,
  checkIndexedDBHealth 
} from '../utils/db-error-handler.js';

// Lazily access the global Dexie instance to avoid import-time errors.
function getDb() {
  try {
    const db = window.db;
    if (!db) {
      throw new Error('Database not initialized. Ensure app.js sets window.db before calling DB methods.');
    }
    return db;
  } catch (error) {
    handleDBError(error, { 
      operation: '데이터베이스 초기화',
      method: 'getDb'
    });
    throw error;
  }
}

export async function getProfile() {
  return await withErrorHandling(async () => {
    const profiles = await getDb().table('profile').toArray();
    return profiles.length > 0 ? profiles[0] : { xp: 0, streak: 0, lastStudy: null };
  }, {
    operation: '프로필 조회',
    table: 'profile',
    method: 'getProfile'
  });
}

export async function setProfile(profile) {
  return await withErrorHandling(async () => {
    const profiles = await getDb().table('profile').toArray();
    if (profiles.length > 0) {
      return await getDb().table('profile').update(profiles[0].id, profile);
    } else {
      return await getDb().table('profile').add(profile);
    }
  }, {
    operation: '프로필 저장',
    table: 'profile',
    method: 'setProfile',
    data: profile
  });
}

export async function getDecks() {
  return await withErrorHandling(async () => {
    return await getDb().table('decks').orderBy('created').toArray();
  }, {
    operation: '덱 목록 조회',
    table: 'decks',
    method: 'getDecks',
    expectData: false // Empty deck list is valid
  });
}

export async function getDeck(id) {
  return await withErrorHandling(async () => {
    const deck = await getDb().table('decks').get(id);
    if (!deck) {
      throw handleNoDataFound({
        operation: '덱 조회',
        table: 'decks',
        method: 'getDeck',
        data: { id }
      });
    }
    return deck;
  }, {
    operation: '덱 조회',
    table: 'decks',
    method: 'getDeck',
    data: { id }
  });
}

export async function addDeck(deck) {
  return await withErrorHandling(async () => {
    return await getDb().table('decks').add(deck);
  }, {
    operation: '덱 추가',
    table: 'decks',
    method: 'addDeck',
    data: deck
  });
}

export async function updateDeck(id, updates) {
  return await withErrorHandling(async () => {
    const result = await getDb().table('decks').update(id, updates);
    if (result === 0) {
      throw handleNoDataFound({
        operation: '덱 업데이트',
        table: 'decks',
        method: 'updateDeck',
        data: { id, updates }
      }, true);
    }
    return result;
  }, {
    operation: '덱 업데이트',
    table: 'decks',
    method: 'updateDeck',
    data: { id, updates }
  });
}

export async function deleteDeck(id) {
  return await withErrorHandling(async () => {
    const result = await getDb().table('decks').delete(id);
    if (result === 0) {
      throw handleNoDataFound({
        operation: '덱 삭제',
        table: 'decks',
        method: 'deleteDeck',
        data: { id }
      }, true);
    }
    return result;
  }, {
    operation: '덱 삭제',
    table: 'decks',
    method: 'deleteDeck',
    data: { id }
  });
}

export async function getQuestions(deckId = null) {
  return await withErrorHandling(async () => {
    let query = getDb().table('questions');
    if (deckId) {
      query = query.where('deck').equals(deckId);
    }
    return await query.orderBy('sortOrder').toArray();
  }, {
    operation: '문제 목록 조회',
    table: 'questions',
    method: 'getQuestions',
    data: { deckId },
    expectData: false // Empty question list is valid
  });
}

export async function getQuestion(id) {
  return await withErrorHandling(async () => {
    const question = await getDb().table('questions').get(id);
    if (!question) {
      throw handleNoDataFound({
        operation: '문제 조회',
        table: 'questions',
        method: 'getQuestion',
        data: { id }
      });
    }
    return question;
  }, {
    operation: '문제 조회',
    table: 'questions',
    method: 'getQuestion',
    data: { id }
  });
}

export async function addQuestion(question) {
  return await withErrorHandling(async () => {
    return await getDb().table('questions').add(question);
  }, {
    operation: '문제 추가',
    table: 'questions',
    method: 'addQuestion',
    data: question
  });
}

export async function updateQuestion(id, updates) {
  return await withErrorHandling(async () => {
    const result = await getDb().table('questions').update(id, updates);
    if (result === 0) {
      throw handleNoDataFound({
        operation: '문제 업데이트',
        table: 'questions',
        method: 'updateQuestion',
        data: { id, updates }
      }, true);
    }
    return result;
  }, {
    operation: '문제 업데이트',
    table: 'questions',
    method: 'updateQuestion',
    data: { id, updates }
  });
}

export async function deleteQuestion(id) {
  return await withErrorHandling(async () => {
    const result = await getDb().table('questions').delete(id);
    if (result === 0) {
      throw handleNoDataFound({
        operation: '문제 삭제',
        table: 'questions',
        method: 'deleteQuestion',
        data: { id }
      }, true);
    }
    return result;
  }, {
    operation: '문제 삭제',
    table: 'questions',
    method: 'deleteQuestion',
    data: { id }
  });
}

// Add database health check function
export async function initializeDatabaseWithHealthCheck() {
  return await withErrorHandling(async () => {
    // Check if IndexedDB is available
    const isHealthy = await checkIndexedDBHealth();
    if (!isHealthy) {
      throw new Error('IndexedDB is not available or not working properly');
    }
    
    // Verify database connection
    const db = getDb();
    await db.open();
    
    return { success: true, message: 'Database initialized successfully' };
  }, {
    operation: '데이터베이스 초기화',
    method: 'initializeDatabaseWithHealthCheck'
  });
}

export async function getReview() {
  return await withErrorHandling(async () => {
    return await getDb().table('review').toArray();
  }, {
    operation: '복습 데이터 조회',
    table: 'review',
    method: 'getReview',
    expectData: false
  });
}

export async function getReviewItem(questionId) {
  return await getDb().table('review').where('questionId').equals(questionId).first();
}

export async function addReview(review) {
  return await getDb().table('review').add(review);
}

export async function updateReview(id, updates) {
  return await getDb().table('review').update(id, updates);
}

export async function deleteReview(id) {
  return await getDb().table('review').delete(id);
}

export async function getNotes() {
  return await getDb().table('notes').orderBy('createdAt').toArray();
}

export async function getNote(id) {
  return await getDb().table('notes').get(id);
}

export async function addNote(note) {
  return await getDb().table('notes').add(note);
}

export async function updateNote(id, updates) {
  return await getDb().table('notes').update(id, updates);
}

export async function deleteNote(id) {
  return await getDb().table('notes').delete(id);
}

export async function getDailyRollup() {
  try {
    const row = await getDb().table('meta').get('dailyRollup');
    return row?.value || {};
  } catch (_) {
    return {};
  }
}

export async function setDailyRollup(obj) {
  await getDb().table('meta').put({ key: 'dailyRollup', value: obj });
}
