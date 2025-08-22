// ========== Database Operations ==========
// This module re-exports database functions for use by other modules

// Lazily access the global Dexie instance to avoid import-time errors.
function getDb() {
  const db = window.db;
  if (!db) {
    throw new Error('Database not initialized. Ensure app.js sets window.db before calling DB methods.');
  }
  return db;
}

export async function getProfile() {
  const profiles = await getDb().table('profile').toArray();
  return profiles.length > 0 ? profiles[0] : { xp: 0, streak: 0, lastStudy: null };
}

export async function setProfile(profile) {
  const profiles = await getDb().table('profile').toArray();
  if (profiles.length > 0) {
    await getDb().table('profile').update(profiles[0].id, profile);
  } else {
    await getDb().table('profile').add(profile);
  }
}

export async function getDecks() {
  return await getDb().table('decks').orderBy('created').toArray();
}

export async function getDeck(id) {
  return await getDb().table('decks').get(id);
}

export async function addDeck(deck) {
  return await getDb().table('decks').add(deck);
}

export async function updateDeck(id, updates) {
  return await getDb().table('decks').update(id, updates);
}

export async function deleteDeck(id) {
  return await getDb().table('decks').delete(id);
}

export async function getQuestions(deckId = null) {
  let query = getDb().table('questions');
  if (deckId) {
    query = query.where('deck').equals(deckId);
  }
  return await query.orderBy('sortOrder').toArray();
}

export async function getQuestion(id) {
  return await getDb().table('questions').get(id);
}

export async function addQuestion(question) {
  return await getDb().table('questions').add(question);
}

export async function updateQuestion(id, updates) {
  return await getDb().table('questions').update(id, updates);
}

export async function deleteQuestion(id) {
  return await getDb().table('questions').delete(id);
}

export async function getReview() {
  return await getDb().table('review').toArray();
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
