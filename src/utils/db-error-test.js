// ========== IndexedDB Error Handling Test Utilities ==========

import { handleDBError, handleNoDataFound, withErrorHandling, DB_ERROR_TYPES } from './db-error-handler.js';

/**
 * Test scenarios for IndexedDB error handling
 * These functions can be called from browser console for testing
 */

// Test Case 1: DB Connection Failure
export async function testConnectionFailure() {
  console.log('🧪 Testing DB Connection Failure...');
  
  try {
    // Simulate a connection failure
    const mockError = new Error('Database connection failed');
    mockError.name = 'InvalidStateError';
    
    handleDBError(mockError, {
      operation: '데이터베이스 연결',
      method: 'testConnectionFailure',
      table: 'test'
    });
  } catch (error) {
    console.log('✅ Connection failure handled:', error.message);
  }
}

// Test Case 2: Query Failure
export async function testQueryFailure() {
  console.log('🧪 Testing Query Failure...');
  
  try {
    // Simulate a query failure
    const mockError = new Error('Transaction failed');
    mockError.name = 'TransactionInactiveError';
    
    handleDBError(mockError, {
      operation: '문제 조회',
      method: 'testQueryFailure',
      table: 'questions',
      data: { id: 123 }
    });
  } catch (error) {
    console.log('✅ Query failure handled:', error.message);
  }
}

// Test Case 3: No Data Found
export async function testNoDataFound() {
  console.log('🧪 Testing No Data Found...');
  
  try {
    handleNoDataFound({
      operation: '사용자 프로필 조회',
      method: 'testNoDataFound',
      table: 'profile',
      data: { userId: 999 }
    }, true);
    
    console.log('✅ No data found handled gracefully');
  } catch (error) {
    console.log('✅ No data found handled:', error.message);
  }
}

// Test Case 4: Quota Exceeded
export async function testQuotaExceeded() {
  console.log('🧪 Testing Quota Exceeded...');
  
  try {
    const mockError = new Error('The quota has been exceeded');
    mockError.name = 'QuotaExceededError';
    
    handleDBError(mockError, {
      operation: '대용량 데이터 저장',
      method: 'testQuotaExceeded',
      table: 'questions'
    });
  } catch (error) {
    console.log('✅ Quota exceeded handled:', error.message);
  }
}

// Test Case 5: WithErrorHandling wrapper
export async function testWithErrorHandling() {
  console.log('🧪 Testing withErrorHandling wrapper...');
  
  try {
    // Test successful operation
    const result1 = await withErrorHandling(async () => {
      return { success: true, data: 'test data' };
    }, {
      operation: '성공적인 작업',
      method: 'testWithErrorHandling'
    });
    console.log('✅ Successful operation:', result1);
    
    // Test failing operation
    const result2 = await withErrorHandling(async () => {
      throw new Error('Simulated database error');
    }, {
      operation: '실패하는 작업',
      method: 'testWithErrorHandling',
      table: 'test'
    });
    console.log('❌ This should not be reached');
    
  } catch (error) {
    console.log('✅ Error caught by wrapper:', error.message);
  }
}

// Test Case 6: Edge cases
export async function testEdgeCases() {
  console.log('🧪 Testing Edge Cases...');
  
  // Test null error
  try {
    handleDBError(null, { operation: 'null 에러 테스트' });
  } catch (error) {
    console.log('✅ Null error handled:', error.message);
  }
  
  // Test undefined error
  try {
    handleDBError(undefined, { operation: 'undefined 에러 테스트' });
  } catch (error) {
    console.log('✅ Undefined error handled:', error.message);
  }
  
  // Test empty context
  try {
    handleDBError(new Error('Test error'), {});
  } catch (error) {
    console.log('✅ Empty context handled:', error.message);
  }
}

// Run all tests
export async function runAllErrorTests() {
  console.log('🚀 Running all IndexedDB error handling tests...\n');
  
  await testConnectionFailure();
  console.log('');
  
  await testQueryFailure();
  console.log('');
  
  await testNoDataFound();
  console.log('');
  
  await testQuotaExceeded();
  console.log('');
  
  await testWithErrorHandling();
  console.log('');
  
  await testEdgeCases();
  console.log('');
  
  console.log('🎉 All tests completed!');
}

// Make functions available in browser console for manual testing
if (typeof window !== 'undefined') {
  window.dbErrorTests = {
    testConnectionFailure,
    testQueryFailure,
    testNoDataFound,
    testQuotaExceeded,
    testWithErrorHandling,
    testEdgeCases,
    runAllErrorTests
  };
  
  console.log('🧪 DB Error Tests available! Run window.dbErrorTests.runAllErrorTests() to test all scenarios');
}