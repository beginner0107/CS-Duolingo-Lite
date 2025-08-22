// ========== Answer Checking & Grading ==========
export const SHORT_PASS = 0.75;
export const KEYWORD_PASS = 0.60;
export const ESSAY_PASS = 0.60;

export function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Alias for clarity in new APIs
export const normalize = normalizeText;

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

export function checkShortAnswer(correctAnswer, userAnswer, synonyms = [], fuzzyEnabled = true, regexes = []) {
  const normalizedCorrect = normalizeText(correctAnswer);
  const normalizedUser = normalizeText(userAnswer);
  
  // Check regex patterns (case-insensitive)
  for (const pattern of regexes) {
    try {
      if (new RegExp(pattern, 'i').test(userAnswer)) return true;
    } catch (e) {
      // Skip invalid regex
    }
  }
  
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
    const variants = parts.length > 1 ? parts : [k.trim()];
    return variants.map(variant => {
      if (variant.startsWith('/') && variant.endsWith('/') && variant.length > 2) {
        return { type: 'regex', pattern: variant.slice(1, -1) };
      }
      return { type: 'text', value: variant };
    });
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
      if (variant.type === 'regex') {
        try {
          if (new RegExp(variant.pattern, 'i').test(userAnswer)) {
            groupMatched = true;
            break;
          }
        } catch (e) {
          // Skip invalid regex
        }
      } else if (normalizedAnswer.includes(normalizeText(variant.value))) {
        groupMatched = true;
        break;
      }
    }
    if (groupMatched) matched++;
  }
  
  return matched >= required;
}

export function gradeWithFeedback(q, userAnswer) {
  if (!userAnswer || typeof userAnswer !== 'string') {
    return { correct: false, score: 0, hits: [], misses: [], notes: 'No answer provided' };
  }
  
  if (q.type === 'OX') {
    const normalized = normalizeText(userAnswer);
    const correctNormalized = normalizeText(q.answer);
    const correct = normalized === correctNormalized;
    return {
      correct,
      score: correct ? 1 : 0,
      hits: correct ? [q.answer] : [],
      misses: correct ? [] : [q.answer]
    };
  }
  
  if (q.type === 'SHORT') {
    const regexes = q.regexes || [];
    const synonyms = q.synonyms || [];
    const fuzzyEnabled = q.fuzzyEnabled !== false;
    
    const correct = checkShortAnswer(q.answer, userAnswer, synonyms, fuzzyEnabled, regexes);
    return {
      correct,
      score: correct ? 1 : 0,
      hits: correct ? [q.answer] : [],
      misses: correct ? [] : [q.answer]
    };
  }
  
  if (q.type === 'ESSAY' || q.type === 'KEYWORD') {
    if (!q.keywords?.length) {
      return { correct: false, score: 0, hits: [], misses: [], notes: 'No keywords defined' };
    }
    
    const groups = buildKeywordGroups(q.keywords);
    const required = parseKeywordThreshold(q, groups.length);
    const normalizedAnswer = normalizeText(userAnswer);
    
    const hits = [];
    const misses = [];
    let matched = 0;
    
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      let groupMatched = false;
      
      for (const variant of group) {
        if (variant.type === 'regex') {
          try {
            if (new RegExp(variant.pattern, 'i').test(userAnswer)) {
              groupMatched = true;
              hits.push(q.keywords[i]);
              break;
            }
          } catch (e) {}
        } else if (normalizedAnswer.includes(normalizeText(variant.value))) {
          groupMatched = true;
          hits.push(q.keywords[i]);
          break;
        }
      }
      
      if (groupMatched) {
        matched++;
      } else {
        misses.push(q.keywords[i]);
      }
    }
    
    const score = groups.length > 0 ? matched / groups.length : 0;
    const correct = matched >= required;
    
    return { correct, score, hits, misses };
  }
  
  return { correct: false, score: 0, hits: [], misses: [], notes: 'Unknown question type' };
}

export function checkAnswer(q, userAnswer) {
  const result = gradeWithFeedback(q, userAnswer);
  return result.score >= 0.5;
}

// New unified grader used by app and AI local adapter
export function gradeQuestion(q, userAnswer) {
  if (!userAnswer || typeof userAnswer !== 'string') {
    return { correct: false, score: 0, hits: [], misses: [], notes: 'No answer provided' };
  }

  // OX exact match
  if (q.type === 'OX') {
    const isCorrect = normalize(q.answer) === normalize(userAnswer);
    return {
      correct: isCorrect,
      score: isCorrect ? 1 : 0,
      hits: isCorrect ? [q.answer] : [],
      misses: isCorrect ? [] : [q.answer]
    };
  }

  // SHORT: try strict/fuzzy/synonyms/regex. If fail and keywords exist, fallback to keyword grading (capped at 0.8)
  if (q.type === 'SHORT') {
    const regexes = q.regexes || [];
    const synonyms = q.synonyms || [];
    const fuzzyEnabled = q.fuzzyEnabled !== false;

    const shortOk = checkShortAnswer(q.answer || '', userAnswer, synonyms, fuzzyEnabled, regexes);
    if (shortOk) {
      return { correct: true, score: 1, hits: [q.answer], misses: [] };
    }

    // Fallback to keyword grading for essay-like SHORT with keywords present
    if (Array.isArray(q.keywords) && q.keywords.length > 0) {
      const groups = buildKeywordGroups(q.keywords);
      const total = groups.length;
      const normAns = normalize(userAnswer);
      const hits = [];
      const misses = [];
      let matched = 0;

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        let groupMatched = false;
        for (const variant of group) {
          if (variant.type === 'regex') {
            try {
              if (new RegExp(variant.pattern, 'i').test(userAnswer)) { groupMatched = true; break; }
            } catch (_) {}
          } else if (normalize(variant.value).length && normAns.includes(normalize(variant.value))) {
            groupMatched = true; break;
          }
        }
        if (groupMatched) { matched++; hits.push(q.keywords[i]); }
        else { misses.push(q.keywords[i]); }
      }
      const rawScore = total > 0 ? matched / total : 0;
      const score = Math.min(0.8, rawScore);
      const correct = score >= SHORT_PASS; // still respect SHORT_PASS for fallback
      return { correct, score, hits, misses };
    }

    return { correct: false, score: 0, hits: [], misses: [q.answer] };
  }

  // ESSAY/KEYWORD: N-of-M with regex and fuzzy; success if either pass ratio or required count
  if (q.type === 'ESSAY' || q.type === 'KEYWORD') {
    if (!q.keywords?.length) {
      return { correct: false, score: 0, hits: [], misses: [], notes: 'No keywords defined' };
    }

    const groups = buildKeywordGroups(q.keywords);
    const required = parseKeywordThreshold(q, groups.length);
    const normalizedAnswer = normalize(userAnswer);
    const hits = [];
    const misses = [];
    let matched = 0;

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      let groupMatched = false;
      for (const variant of group) {
        if (variant.type === 'regex') {
          try {
            if (new RegExp(variant.pattern, 'i').test(userAnswer)) { groupMatched = true; break; }
          } catch (_) {}
        } else if (normalizedAnswer.includes(normalize(variant.value))) {
          groupMatched = true; break;
        }
      }
      if (groupMatched) { matched++; hits.push(q.keywords[i]); }
      else { misses.push(q.keywords[i]); }
    }

    const score = groups.length > 0 ? matched / groups.length : 0;
    const passByRatio = score >= KEYWORD_PASS;
    const passByCount = matched >= required;
    const correct = passByRatio || passByCount;
    return { correct, score, hits, misses };
  }

  return { correct: false, score: 0, hits: [], misses: [], notes: 'Unknown question type' };
}

// Async version that uses local AI modules for advanced grading
export async function gradeQuestionAsync(q, userAnswer) {
  if (q?.type === 'ESSAY') {
    try {
      // Use local AI modules instead of external server
      const { decideGrade } = await import('../../ai/router.js');
      
      const input = {
        prompt: userAnswer,
        reference: {
          answer: q.answer || q.reference || '',
          keywords: q.keywords || []
        }
      };
      
      const result = await decideGrade(input);
      return { 
        correct: result.correct, 
        score: result.score, 
        hits: [], 
        misses: [], 
        notes: result.rationale || 'AI graded response' 
      };
    } catch (e) {
      console.warn('AI grading failed, falling back to local scoring:', e);
      // Fallback: treat as KEYWORD if keywords exist
      if (Array.isArray(q.keywords) && q.keywords.length) {
        return gradeQuestion({ ...q, type: 'KEYWORD' }, userAnswer);
      }
      return { correct: false, score: 0, hits: [], misses: [], notes: 'Essay grading unavailable' };
    }
  }
  // Default: reuse sync grading and wrap in Promise
  return Promise.resolve(gradeQuestion(q, userAnswer));
}
