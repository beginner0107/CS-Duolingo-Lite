// ========== Adaptive Difficulty Management ==========

import { withErrorHandling } from '../utils/db-error-handler.js';

/**
 * Difficulty levels for questions
 */
export const DIFFICULTY_LEVELS = {
  BEGINNER: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  EXPERT: 5
};

/**
 * Difficulty level names in Korean
 */
export const DIFFICULTY_NAMES = {
  [DIFFICULTY_LEVELS.BEGINNER]: '입문',
  [DIFFICULTY_LEVELS.EASY]: '쉬움',
  [DIFFICULTY_LEVELS.MEDIUM]: '보통',
  [DIFFICULTY_LEVELS.HARD]: '어려움',
  [DIFFICULTY_LEVELS.EXPERT]: '전문가'
};

/**
 * User performance thresholds for difficulty adjustment
 */
export const PERFORMANCE_THRESHOLDS = {
  INCREASE_DIFFICULTY: 0.8,  // 80% accuracy or higher
  DECREASE_DIFFICULTY: 0.5,  // 50% accuracy or lower
  STABLE_RANGE_MIN: 0.5,     // Stable range: 50-80%
  STABLE_RANGE_MAX: 0.8
};

/**
 * Calculate user's current accuracy for a specific question or overall
 * @param {Object} reviewData - Review data from IndexedDB
 * @returns {number} Accuracy between 0 and 1
 */
export function calculateAccuracy(reviewData) {
  if (!reviewData || !reviewData.count || reviewData.count === 0) {
    return 0.5; // Default to medium difficulty for new questions
  }
  
  const correctCount = reviewData.correct || 0;
  const totalCount = reviewData.count || 0;
  
  return totalCount > 0 ? correctCount / totalCount : 0.5;
}

/**
 * Get the current difficulty level for a user based on their performance
 * @param {Object} userPerformance - User performance data
 * @returns {number} Current difficulty level
 */
export function getCurrentUserDifficulty(userPerformance) {
  if (!userPerformance || userPerformance.difficulty === undefined) {
    return DIFFICULTY_LEVELS.MEDIUM; // Default to medium difficulty
  }
  
  return Math.max(
    DIFFICULTY_LEVELS.BEGINNER,
    Math.min(DIFFICULTY_LEVELS.EXPERT, userPerformance.difficulty)
  );
}

/**
 * Determine if difficulty should be adjusted based on recent performance
 * @param {number} accuracy - Current accuracy (0-1)
 * @param {number} currentDifficulty - Current difficulty level
 * @returns {Object} Adjustment recommendation
 */
export function shouldAdjustDifficulty(accuracy, currentDifficulty) {
  const result = {
    shouldAdjust: false,
    newDifficulty: currentDifficulty,
    reason: 'Performance within stable range'
  };
  
  // Check if accuracy is high enough to increase difficulty
  if (accuracy >= PERFORMANCE_THRESHOLDS.INCREASE_DIFFICULTY) {
    if (currentDifficulty < DIFFICULTY_LEVELS.EXPERT) {
      result.shouldAdjust = true;
      result.newDifficulty = Math.min(DIFFICULTY_LEVELS.EXPERT, currentDifficulty + 1);
      result.reason = `High accuracy (${Math.round(accuracy * 100)}%) - increasing difficulty`;
    } else {
      result.reason = 'Already at maximum difficulty level';
    }
  }
  // Check if accuracy is low enough to decrease difficulty
  else if (accuracy <= PERFORMANCE_THRESHOLDS.DECREASE_DIFFICULTY) {
    if (currentDifficulty > DIFFICULTY_LEVELS.BEGINNER) {
      result.shouldAdjust = true;
      result.newDifficulty = Math.max(DIFFICULTY_LEVELS.BEGINNER, currentDifficulty - 1);
      result.reason = `Low accuracy (${Math.round(accuracy * 100)}%) - decreasing difficulty`;
    } else {
      result.reason = 'Already at minimum difficulty level';
    }
  }
  
  return result;
}

/**
 * Update user performance data with difficulty information
 * @param {number} questionId - Question ID
 * @param {Object} reviewData - Current review data
 * @param {boolean} isCorrect - Whether the answer was correct
 * @returns {Object} Updated review data with difficulty info
 */
export function updateUserPerformance(questionId, reviewData, isCorrect) {
  const updatedReview = { ...reviewData };
  
  // Initialize difficulty if not present
  if (!updatedReview.difficulty) {
    updatedReview.difficulty = DIFFICULTY_LEVELS.MEDIUM;
  }
  
  // Calculate current accuracy
  const newCorrect = (reviewData.correct || 0) + (isCorrect ? 1 : 0);
  const newCount = (reviewData.count || 0) + 1;
  const currentAccuracy = newCorrect / newCount;
  
  // Check if difficulty should be adjusted
  const difficultyAdjustment = shouldAdjustDifficulty(
    currentAccuracy, 
    updatedReview.difficulty
  );
  
  if (difficultyAdjustment.shouldAdjust) {
    updatedReview.difficulty = difficultyAdjustment.newDifficulty;
    updatedReview.difficultyUpdated = new Date().toISOString();
    updatedReview.difficultyReason = difficultyAdjustment.reason;
    
    console.log(`[Adaptive Difficulty] Question ${questionId}: ${difficultyAdjustment.reason}`);
  }
  
  // Store recent performance for trend analysis
  if (!updatedReview.recentPerformance) {
    updatedReview.recentPerformance = [];
  }
  
  // Keep only last 10 results for trend analysis
  updatedReview.recentPerformance.push({
    correct: isCorrect,
    timestamp: new Date().toISOString(),
    difficulty: updatedReview.difficulty
  });
  
  if (updatedReview.recentPerformance.length > 10) {
    updatedReview.recentPerformance = updatedReview.recentPerformance.slice(-10);
  }
  
  return updatedReview;
}

/**
 * Calculate overall user difficulty level based on recent session performance
 * @param {Array} sessionResults - Array of recent session results
 * @returns {number} Recommended user difficulty level
 */
export function calculateSessionDifficulty(sessionResults) {
  if (!sessionResults || sessionResults.length === 0) {
    return DIFFICULTY_LEVELS.MEDIUM;
  }
  
  // Calculate accuracy from recent results
  const correctAnswers = sessionResults.filter(r => r.correct).length;
  const sessionAccuracy = correctAnswers / sessionResults.length;
  
  // Get average difficulty of attempted questions
  const avgDifficulty = sessionResults.reduce((sum, r) => sum + (r.difficulty || DIFFICULTY_LEVELS.MEDIUM), 0) / sessionResults.length;
  
  // Adjust based on performance
  const adjustment = shouldAdjustDifficulty(sessionAccuracy, Math.round(avgDifficulty));
  
  return adjustment.shouldAdjust ? adjustment.newDifficulty : Math.round(avgDifficulty);
}

/**
 * Filter and sort questions based on user's current difficulty level
 * @param {Array} questions - Available questions
 * @param {Object} reviewData - User's review data 
 * @param {number} targetDifficulty - Target difficulty level
 * @param {number} tolerance - How far from target difficulty to include (default: 1)
 * @returns {Array} Filtered and sorted questions
 */
export function selectQuestionsByDifficulty(questions, reviewData, targetDifficulty, tolerance = 1) {
  // Assign difficulty to questions based on user performance or defaults
  const questionsWithDifficulty = questions.map(q => {
    const review = reviewData[q.id];
    let questionDifficulty;
    
    if (review && review.difficulty) {
      // Use tracked difficulty
      questionDifficulty = review.difficulty;
    } else {
      // Assign default difficulty based on question type
      questionDifficulty = getDefaultQuestionDifficulty(q);
    }
    
    return {
      ...q,
      assignedDifficulty: questionDifficulty,
      userAccuracy: review ? calculateAccuracy(review) : 0.5
    };
  });
  
  // Filter questions within tolerance range
  const minDifficulty = Math.max(DIFFICULTY_LEVELS.BEGINNER, targetDifficulty - tolerance);
  const maxDifficulty = Math.min(DIFFICULTY_LEVELS.EXPERT, targetDifficulty + tolerance);
  
  const filteredQuestions = questionsWithDifficulty.filter(q => 
    q.assignedDifficulty >= minDifficulty && q.assignedDifficulty <= maxDifficulty
  );
  
  // Sort by closeness to target difficulty, then by user accuracy (prioritize challenging but not impossible)
  return filteredQuestions.sort((a, b) => {
    const aDifficultyDistance = Math.abs(a.assignedDifficulty - targetDifficulty);
    const bDifficultyDistance = Math.abs(b.assignedDifficulty - targetDifficulty);
    
    if (aDifficultyDistance !== bDifficultyDistance) {
      return aDifficultyDistance - bDifficultyDistance;
    }
    
    // If same difficulty distance, prioritize questions with medium accuracy (challenging but doable)
    const aAccuracyDistance = Math.abs(a.userAccuracy - 0.65); // Target 65% success rate
    const bAccuracyDistance = Math.abs(b.userAccuracy - 0.65);
    
    return aAccuracyDistance - bAccuracyDistance;
  });
}

/**
 * Assign default difficulty to a question based on its characteristics
 * @param {Object} question - Question object
 * @returns {number} Default difficulty level
 */
function getDefaultQuestionDifficulty(question) {
  // Basic heuristics for default difficulty
  switch (question.type) {
    case 'OX':
      return DIFFICULTY_LEVELS.EASY; // True/false questions are generally easier
    
    case 'SHORT':
      // Short answer difficulty based on answer complexity
      if (question.synonyms && question.synonyms.length > 3) {
        return DIFFICULTY_LEVELS.HARD; // Many possible answers = harder
      }
      return DIFFICULTY_LEVELS.MEDIUM;
    
    case 'KEYWORD':
    case 'ESSAY':
      return DIFFICULTY_LEVELS.HARD; // Keyword and essay questions are generally harder
    
    default:
      return DIFFICULTY_LEVELS.MEDIUM;
  }
}

/**
 * Get difficulty statistics for display
 * @param {Object} userPerformance - User performance data
 * @returns {Object} Difficulty statistics
 */
export function getDifficultyStats(userPerformance) {
  const currentDifficulty = getCurrentUserDifficulty(userPerformance);
  const difficultyName = DIFFICULTY_NAMES[currentDifficulty];
  
  let trend = 'stable';
  let recentAccuracy = 0.5;
  
  if (userPerformance && userPerformance.recentPerformance && userPerformance.recentPerformance.length > 0) {
    const recent = userPerformance.recentPerformance.slice(-5); // Last 5 attempts
    const correctCount = recent.filter(r => r.correct).length;
    recentAccuracy = correctCount / recent.length;
    
    // Determine trend based on recent difficulty changes
    const recentDifficulties = recent.map(r => r.difficulty);
    if (recentDifficulties.length > 1) {
      const oldDifficulty = recentDifficulties[0];
      const newDifficulty = recentDifficulties[recentDifficulties.length - 1];
      
      if (newDifficulty > oldDifficulty) {
        trend = 'increasing';
      } else if (newDifficulty < oldDifficulty) {
        trend = 'decreasing';
      }
    }
  }
  
  return {
    currentLevel: currentDifficulty,
    currentLevelName: difficultyName,
    recentAccuracy: Math.round(recentAccuracy * 100),
    trend,
    isAdaptive: true
  };
}

/**
 * Reset user difficulty to default (useful for testing or user request)
 * @param {Object} userPerformance - User performance data to reset
 * @returns {Object} Reset performance data
 */
export function resetUserDifficulty(userPerformance = {}) {
  return {
    ...userPerformance,
    difficulty: DIFFICULTY_LEVELS.MEDIUM,
    difficultyUpdated: new Date().toISOString(),
    difficultyReason: 'Reset to default difficulty',
    recentPerformance: []
  };
}