import { todayStr } from './database.js';

// ========== SM-2 Algorithm & Scheduling ==========
export function nextSchedule(correct, state, grade = null) {
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

export function simulateNextInterval(state, grade) {
  const copy = state ? { ...state } : { ease: 2.5, interval: 0, due: todayStr(), count: 0 };
  const res = nextSchedule(true, copy, grade);
  return res.interval;
}

export function simulateNextDueDate(state, grade) {
  const copy = state ? { ...state } : { ease: 2.5, interval: 0, due: todayStr(), count: 0 };
  const res = nextSchedule(true, copy, grade);
  return res.due;
}

export function formatInterval(days) {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return days + ' days';
}

// ========== Tests (pure functions) ==========
export function runSM2PreviewTests() {
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

// ========== Answer Checking & Grading ==========
export function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix = Array.from(Array(len1 + 1), () => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return matrix[len1][len2];
}

export function fuzzyMatch(target, input, threshold = 0.8) {
  const normalizedTarget = normalizeText(target);
  const normalizedInput = normalizeText(input);
  
  if (normalizedTarget === normalizedInput) return true;
  if (normalizedInput.includes(normalizedTarget) || normalizedTarget.includes(normalizedInput)) return true;
  
  const distance = levenshteinDistance(normalizedTarget, normalizedInput);
  const maxLen = Math.max(normalizedTarget.length, normalizedInput.length);
  
  if (maxLen === 0) return true;
  
  const similarity = 1 - (distance / maxLen);
  return similarity >= threshold;
}

export function checkShortAnswer(correctAnswer, userAnswer, synonyms = [], fuzzyEnabled = true) {
  const normalizedCorrect = normalizeText(correctAnswer);
  const normalizedUser = normalizeText(userAnswer);
  
  // Exact match
  if (normalizedCorrect === normalizedUser) return true;
  
  // Check synonyms
  for (const syn of synonyms) {
    if (normalizeText(syn) === normalizedUser) return true;
  }
  
  // Fuzzy matching if enabled
  if (fuzzyEnabled) {
    if (fuzzyMatch(normalizedCorrect, normalizedUser, 0.85)) return true;
    for (const syn of synonyms) {
      if (fuzzyMatch(syn, userAnswer, 0.85)) return true;
    }
  }
  
  return false;
}

export function buildKeywordGroups(keywords) {
  return keywords.map(k => {
    const parts = k.split('|').map(p => p.trim());
    return parts.length > 1 ? parts : [k.trim()];
  });
}

export function parseKeywordThreshold(q, total) {
  const thresh = q.keywordThreshold;
  if (!thresh || thresh === 'default') {
    return Math.ceil(total * 0.75);
  }
  
  if (thresh.includes('/')) {
    const [n, m] = thresh.split('/').map(x => parseInt(x.trim()));
    return Number.isFinite(n) ? n : Math.ceil(total * 0.75);
  }
  
  const val = parseInt(thresh);
  return Number.isFinite(val) ? val : Math.ceil(total * 0.75);
}

export function matchKeywordAnswer(question, userAnswer) {
  if (!question.keywords?.length) return false;
  
  const groups = buildKeywordGroups(question.keywords);
  const required = parseKeywordThreshold(question, groups.length);
  const normalizedAnswer = normalizeText(userAnswer);
  
  let matched = 0;
  for (const group of groups) {
    let groupMatched = false;
    for (const variant of group) {
      if (normalizedAnswer.includes(normalizeText(variant))) {
        groupMatched = true;
        break;
      }
    }
    if (groupMatched) matched++;
  }
  
  return matched >= required;
}

export function checkAnswer(q, userAnswer) {
  if (!userAnswer || typeof userAnswer !== 'string') return false;
  
  if (q.type === 'OX') {
    const normalized = normalizeText(userAnswer);
    const correctNormalized = normalizeText(q.answer);
    return normalized === correctNormalized;
  }
  
  if (q.type === 'SHORT') {
    return checkShortAnswer(q.answer, userAnswer, q.synonyms || [], q.fuzzyEnabled !== false);
  }
  
  if (q.type === 'KEYWORD') {
    return matchKeywordAnswer(q, userAnswer);
  }
  
  return false;
}