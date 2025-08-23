// ========== Adaptive Difficulty Test Utilities ==========

import { 
  calculateAccuracy, 
  shouldAdjustDifficulty, 
  updateUserPerformance,
  selectQuestionsByDifficulty,
  getDifficultyStats,
  DIFFICULTY_LEVELS,
  PERFORMANCE_THRESHOLDS 
} from '../modules/adaptive-difficulty.js';

/**
 * Test scenarios for adaptive difficulty system
 * These functions can be called from browser console for testing
 */

// Test Case 1: High performance should increase difficulty
export function testHighPerformanceIncrease() {
  console.log('🧪 Testing High Performance → Difficulty Increase...');
  
  const mockReviewData = {
    correct: 8,
    count: 10,
    difficulty: DIFFICULTY_LEVELS.MEDIUM
  };
  
  const accuracy = calculateAccuracy(mockReviewData);
  console.log(`Current accuracy: ${Math.round(accuracy * 100)}%`);
  
  const adjustment = shouldAdjustDifficulty(accuracy, mockReviewData.difficulty);
  console.log('Adjustment result:', adjustment);
  
  if (adjustment.shouldAdjust && adjustment.newDifficulty > mockReviewData.difficulty) {
    console.log('✅ High performance correctly increased difficulty');
  } else {
    console.log('❌ High performance did not increase difficulty as expected');
  }
}

// Test Case 2: Low performance should decrease difficulty
export function testLowPerformanceDecrease() {
  console.log('🧪 Testing Low Performance → Difficulty Decrease...');
  
  const mockReviewData = {
    correct: 3,
    count: 10,
    difficulty: DIFFICULTY_LEVELS.HARD
  };
  
  const accuracy = calculateAccuracy(mockReviewData);
  console.log(`Current accuracy: ${Math.round(accuracy * 100)}%`);
  
  const adjustment = shouldAdjustDifficulty(accuracy, mockReviewData.difficulty);
  console.log('Adjustment result:', adjustment);
  
  if (adjustment.shouldAdjust && adjustment.newDifficulty < mockReviewData.difficulty) {
    console.log('✅ Low performance correctly decreased difficulty');
  } else {
    console.log('❌ Low performance did not decrease difficulty as expected');
  }
}

// Test Case 3: Medium performance should keep difficulty stable
export function testMediumPerformanceStable() {
  console.log('🧪 Testing Medium Performance → Stable Difficulty...');
  
  const mockReviewData = {
    correct: 6,
    count: 10,
    difficulty: DIFFICULTY_LEVELS.MEDIUM
  };
  
  const accuracy = calculateAccuracy(mockReviewData);
  console.log(`Current accuracy: ${Math.round(accuracy * 100)}%`);
  
  const adjustment = shouldAdjustDifficulty(accuracy, mockReviewData.difficulty);
  console.log('Adjustment result:', adjustment);
  
  if (!adjustment.shouldAdjust) {
    console.log('✅ Medium performance correctly kept difficulty stable');
  } else {
    console.log('❌ Medium performance unexpectedly adjusted difficulty');
  }
}

// Test Case 4: User performance update integration
export function testUserPerformanceUpdate() {
  console.log('🧪 Testing User Performance Update...');
  
  const initialReview = {
    correct: 7,
    count: 10,
    difficulty: DIFFICULTY_LEVELS.MEDIUM,
    recentPerformance: []
  };
  
  console.log('Initial review:', initialReview);
  
  // Simulate a correct answer
  const updatedReview = updateUserPerformance(123, initialReview, true);
  
  console.log('Updated review:', updatedReview);
  
  // Check if difficulty was adjusted for high performance (8/11 = ~73% - should increase to 4)
  if (updatedReview.difficulty > initialReview.difficulty) {
    console.log('✅ User performance update correctly increased difficulty');
  } else if (updatedReview.difficulty === initialReview.difficulty) {
    console.log('ℹ️ Difficulty remained stable (expected for this accuracy level)');
  } else {
    console.log('❌ User performance update had unexpected result');
  }
}

// Test Case 5: Question selection by difficulty
export function testQuestionSelection() {
  console.log('🧪 Testing Question Selection by Difficulty...');
  
  // Mock questions with different types
  const mockQuestions = [
    { id: 1, type: 'OX', prompt: 'Easy OX question' },
    { id: 2, type: 'SHORT', prompt: 'Medium short question' },
    { id: 3, type: 'ESSAY', prompt: 'Hard essay question' },
    { id: 4, type: 'OX', prompt: 'Another OX question' },
    { id: 5, type: 'KEYWORD', prompt: 'Complex keyword question' }
  ];
  
  // Mock review data with different difficulty levels
  const mockReviewData = {
    1: { difficulty: DIFFICULTY_LEVELS.EASY, correct: 8, count: 10 },
    2: { difficulty: DIFFICULTY_LEVELS.MEDIUM, correct: 6, count: 10 },
    3: { difficulty: DIFFICULTY_LEVELS.HARD, correct: 4, count: 10 },
    4: { difficulty: DIFFICULTY_LEVELS.EASY, correct: 9, count: 10 },
    5: { difficulty: DIFFICULTY_LEVELS.EXPERT, correct: 2, count: 10 }
  };
  
  const targetDifficulty = DIFFICULTY_LEVELS.MEDIUM;
  console.log(`Target difficulty: ${targetDifficulty}`);
  
  const selectedQuestions = selectQuestionsByDifficulty(
    mockQuestions, 
    mockReviewData, 
    targetDifficulty,
    1 // tolerance
  );
  
  console.log('Selected questions:', selectedQuestions.map(q => ({
    id: q.id,
    assignedDifficulty: q.assignedDifficulty,
    userAccuracy: Math.round(q.userAccuracy * 100) + '%'
  })));
  
  if (selectedQuestions.length > 0) {
    console.log('✅ Question selection by difficulty completed');
  } else {
    console.log('❌ No questions selected (may indicate issue with selection logic)');
  }
}

// Test Case 6: Difficulty statistics
export function testDifficultyStats() {
  console.log('🧪 Testing Difficulty Statistics...');
  
  const mockUserPerformance = {
    difficulty: DIFFICULTY_LEVELS.HARD,
    recentPerformance: [
      { correct: true, difficulty: DIFFICULTY_LEVELS.MEDIUM, timestamp: '2024-01-01T10:00:00Z' },
      { correct: false, difficulty: DIFFICULTY_LEVELS.MEDIUM, timestamp: '2024-01-01T10:05:00Z' },
      { correct: true, difficulty: DIFFICULTY_LEVELS.HARD, timestamp: '2024-01-01T10:10:00Z' },
      { correct: true, difficulty: DIFFICULTY_LEVELS.HARD, timestamp: '2024-01-01T10:15:00Z' },
      { correct: true, difficulty: DIFFICULTY_LEVELS.HARD, timestamp: '2024-01-01T10:20:00Z' }
    ]
  };
  
  const stats = getDifficultyStats(mockUserPerformance);
  
  console.log('Difficulty statistics:', stats);
  
  if (stats.currentLevel && stats.currentLevelName && stats.recentAccuracy >= 0) {
    console.log('✅ Difficulty statistics generated successfully');
  } else {
    console.log('❌ Difficulty statistics had missing or invalid data');
  }
}

// Test Case 7: Boundary conditions
export function testBoundaryConditions() {
  console.log('🧪 Testing Boundary Conditions...');
  
  // Test with empty data
  console.log('Testing with empty review data...');
  const emptyAccuracy = calculateAccuracy({});
  console.log(`Empty data accuracy: ${emptyAccuracy}`);
  
  // Test with minimum difficulty
  const minDifficultyAdjustment = shouldAdjustDifficulty(0.3, DIFFICULTY_LEVELS.BEGINNER);
  console.log('Min difficulty adjustment:', minDifficultyAdjustment);
  
  // Test with maximum difficulty  
  const maxDifficultyAdjustment = shouldAdjustDifficulty(0.9, DIFFICULTY_LEVELS.EXPERT);
  console.log('Max difficulty adjustment:', maxDifficultyAdjustment);
  
  // Test with edge accuracy values
  const edgeAccuracy80 = shouldAdjustDifficulty(PERFORMANCE_THRESHOLDS.INCREASE_DIFFICULTY, DIFFICULTY_LEVELS.MEDIUM);
  const edgeAccuracy50 = shouldAdjustDifficulty(PERFORMANCE_THRESHOLDS.DECREASE_DIFFICULTY, DIFFICULTY_LEVELS.MEDIUM);
  
  console.log('80% accuracy adjustment:', edgeAccuracy80);
  console.log('50% accuracy adjustment:', edgeAccuracy50);
  
  console.log('✅ Boundary conditions testing completed');
}

// Run all tests
export function runAllAdaptiveDifficultyTests() {
  console.log('🚀 Running all Adaptive Difficulty tests...\n');
  
  testHighPerformanceIncrease();
  console.log('');
  
  testLowPerformanceDecrease();
  console.log('');
  
  testMediumPerformanceStable();
  console.log('');
  
  testUserPerformanceUpdate();
  console.log('');
  
  testQuestionSelection();
  console.log('');
  
  testDifficultyStats();
  console.log('');
  
  testBoundaryConditions();
  console.log('');
  
  console.log('🎉 All Adaptive Difficulty tests completed!');
}

// Performance simulation
export function simulateSessionPerformance(sessionCount = 5, questionsPerSession = 10) {
  console.log(`🎮 Simulating ${sessionCount} sessions with ${questionsPerSession} questions each...`);
  
  let userDifficulty = DIFFICULTY_LEVELS.MEDIUM;
  
  for (let session = 1; session <= sessionCount; session++) {
    console.log(`\n--- Session ${session} ---`);
    console.log(`Starting difficulty: ${userDifficulty}`);
    
    let sessionCorrect = 0;
    for (let q = 1; q <= questionsPerSession; q++) {
      // Simulate question performance based on difficulty gap
      const baseSuccess = 0.7; // Base 70% success rate
      const difficultyFactor = (DIFFICULTY_LEVELS.MEDIUM - userDifficulty) * 0.1;
      const successProb = Math.max(0.1, Math.min(0.9, baseSuccess + difficultyFactor));
      
      const isCorrect = Math.random() < successProb;
      if (isCorrect) sessionCorrect++;
    }
    
    const sessionAccuracy = sessionCorrect / questionsPerSession;
    console.log(`Session accuracy: ${Math.round(sessionAccuracy * 100)}%`);
    
    // Update difficulty based on session performance
    const adjustment = shouldAdjustDifficulty(sessionAccuracy, userDifficulty);
    if (adjustment.shouldAdjust) {
      userDifficulty = adjustment.newDifficulty;
      console.log(`Difficulty adjusted: ${adjustment.reason}`);
    }
    
    console.log(`Ending difficulty: ${userDifficulty}`);
  }
  
  console.log('\n🏁 Simulation completed!');
}

// Make functions available in browser console for manual testing
if (typeof window !== 'undefined') {
  window.adaptiveDifficultyTests = {
    testHighPerformanceIncrease,
    testLowPerformanceDecrease,
    testMediumPerformanceStable,
    testUserPerformanceUpdate,
    testQuestionSelection,
    testDifficultyStats,
    testBoundaryConditions,
    runAllAdaptiveDifficultyTests,
    simulateSessionPerformance
  };
  
  console.log('🧪 Adaptive Difficulty Tests available! Run window.adaptiveDifficultyTests.runAllAdaptiveDifficultyTests() to test all scenarios');
}