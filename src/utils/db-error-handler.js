// ========== IndexedDB Error Handling Utilities ==========

import { showToast } from './dom.js';

/**
 * IndexedDB Error Types
 */
export const DB_ERROR_TYPES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  QUERY_FAILED: 'QUERY_FAILED',
  NO_DATA_FOUND: 'NO_DATA_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  LOW: 'low',        // No data found, empty results
  MEDIUM: 'medium',  // Query failures, recoverable errors
  HIGH: 'high',      // Connection failures, critical errors
  CRITICAL: 'critical' // Data corruption, quota exceeded
};

/**
 * IndexedDB specific error class
 */
export class IndexedDBError extends Error {
  constructor(type, originalError, context = {}) {
    const message = getErrorMessage(type, context);
    super(message);
    
    this.name = 'IndexedDBError';
    this.type = type;
    this.originalError = originalError;
    this.context = context;
    this.severity = getErrorSeverity(type);
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Get user-friendly error message based on error type
 * @param {string} type - Error type from DB_ERROR_TYPES
 * @param {Object} context - Additional context information
 * @returns {string} User-friendly error message
 */
function getErrorMessage(type, context) {
  const operation = context.operation || '작업';
  const table = context.table || '데이터';
  
  switch (type) {
    case DB_ERROR_TYPES.CONNECTION_FAILED:
      return `데이터베이스 연결에 실패했습니다. 브라우저를 새로고침해 주세요.`;
    
    case DB_ERROR_TYPES.QUERY_FAILED:
      return `${operation} 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.`;
    
    case DB_ERROR_TYPES.NO_DATA_FOUND:
      return `요청한 ${table} 정보를 찾을 수 없습니다.`;
    
    case DB_ERROR_TYPES.QUOTA_EXCEEDED:
      return `저장 공간이 부족합니다. 일부 데이터를 삭제하거나 내보내기 후 정리해 주세요.`;
    
    case DB_ERROR_TYPES.TRANSACTION_FAILED:
      return `데이터 처리 중 오류가 발생했습니다. 다시 시도해 주세요.`;
    
    case DB_ERROR_TYPES.SCHEMA_ERROR:
      return `데이터 구조 오류가 발생했습니다. 앱을 새로고침해 주세요.`;
    
    case DB_ERROR_TYPES.PERMISSION_DENIED:
      return `데이터베이스 접근 권한이 없습니다. 브라우저 설정을 확인해 주세요.`;
    
    default:
      return `예상치 못한 오류가 발생했습니다.`;
  }
}

/**
 * Get error severity based on error type
 * @param {string} type - Error type
 * @returns {string} Severity level
 */
function getErrorSeverity(type) {
  switch (type) {
    case DB_ERROR_TYPES.NO_DATA_FOUND:
      return ERROR_SEVERITY.LOW;
    
    case DB_ERROR_TYPES.QUERY_FAILED:
    case DB_ERROR_TYPES.TRANSACTION_FAILED:
      return ERROR_SEVERITY.MEDIUM;
    
    case DB_ERROR_TYPES.CONNECTION_FAILED:
    case DB_ERROR_TYPES.SCHEMA_ERROR:
    case DB_ERROR_TYPES.PERMISSION_DENIED:
      return ERROR_SEVERITY.HIGH;
    
    case DB_ERROR_TYPES.QUOTA_EXCEEDED:
      return ERROR_SEVERITY.CRITICAL;
    
    default:
      return ERROR_SEVERITY.MEDIUM;
  }
}

/**
 * Classify IndexedDB native errors into our error types
 * @param {Error} error - Original IndexedDB error
 * @returns {string} Classified error type
 */
function classifyError(error) {
  if (!error) return DB_ERROR_TYPES.QUERY_FAILED;
  
  const errorName = error.name?.toLowerCase() || '';
  const errorMessage = error.message?.toLowerCase() || '';
  
  // Connection and database access errors
  if (errorName.includes('invalidstate') || 
      errorMessage.includes('database') && errorMessage.includes('closed')) {
    return DB_ERROR_TYPES.CONNECTION_FAILED;
  }
  
  // Quota exceeded errors
  if (errorName.includes('quota') || 
      errorMessage.includes('quota') ||
      errorMessage.includes('storage')) {
    return DB_ERROR_TYPES.QUOTA_EXCEEDED;
  }
  
  // Permission and security errors
  if (errorName.includes('security') || 
      errorName.includes('permission') ||
      errorMessage.includes('access denied')) {
    return DB_ERROR_TYPES.PERMISSION_DENIED;
  }
  
  // Transaction errors
  if (errorName.includes('transaction') || 
      errorMessage.includes('transaction')) {
    return DB_ERROR_TYPES.TRANSACTION_FAILED;
  }
  
  // Schema and version errors
  if (errorName.includes('version') || 
      errorName.includes('schema') ||
      errorMessage.includes('object store')) {
    return DB_ERROR_TYPES.SCHEMA_ERROR;
  }
  
  // Default to query failure
  return DB_ERROR_TYPES.QUERY_FAILED;
}

/**
 * Main error handler function for IndexedDB operations
 * @param {Error} originalError - The original error that occurred
 * @param {Object} context - Context information about the operation
 * @param {string} context.operation - The operation that was being performed
 * @param {string} context.table - The table/store being accessed
 * @param {string} context.method - The method that failed
 * @param {any} context.data - Data involved in the operation (for logging)
 * @param {boolean} showUserMessage - Whether to show toast message to user
 * @returns {IndexedDBError} Structured error object
 */
export function handleDBError(originalError, context = {}, showUserMessage = true) {
  const errorType = classifyError(originalError);
  const dbError = new IndexedDBError(errorType, originalError, context);
  
  // Log error details for debugging
  logError(dbError);
  
  // Show user-friendly message if requested
  if (showUserMessage && errorType !== DB_ERROR_TYPES.NO_DATA_FOUND) {
    const toastType = getToastType(dbError.severity);
    showToast(dbError.message, toastType);
  }
  
  return dbError;
}

/**
 * Handle specific case: No data found
 * @param {Object} context - Context information
 * @param {boolean} showUserMessage - Whether to show user message
 * @returns {IndexedDBError}
 */
export function handleNoDataFound(context = {}, showUserMessage = false) {
  const dbError = new IndexedDBError(DB_ERROR_TYPES.NO_DATA_FOUND, null, context);
  
  logError(dbError, false); // Log as info, not error
  
  if (showUserMessage) {
    showToast(dbError.message, 'info');
  }
  
  return dbError;
}

/**
 * Wrapper for database operations with automatic error handling
 * @param {Function} operation - Async database operation function
 * @param {Object} context - Operation context
 * @returns {Promise<any>} Operation result or null on error
 */
export async function withErrorHandling(operation, context = {}) {
  try {
    const result = await operation();
    
    // Handle no data found case for queries
    if (context.expectData && (result === undefined || result === null || 
        (Array.isArray(result) && result.length === 0))) {
      handleNoDataFound(context, false);
      return null;
    }
    
    return result;
  } catch (error) {
    const dbError = handleDBError(error, context);
    throw dbError;
  }
}

/**
 * Log error information for debugging
 * @param {IndexedDBError} dbError - The database error
 * @param {boolean} isError - Whether to log as error or info
 */
function logError(dbError, isError = true) {
  const logData = {
    type: dbError.type,
    severity: dbError.severity,
    message: dbError.message,
    context: dbError.context,
    timestamp: dbError.timestamp,
    originalError: dbError.originalError?.message || 'No original error',
    stack: dbError.originalError?.stack
  };
  
  const logMessage = `[IndexedDB ${dbError.severity.toUpperCase()}] ${dbError.type}: ${dbError.message}`;
  
  if (isError) {
    console.error(logMessage, logData);
  } else {
    console.info(logMessage, logData);
  }
  
  // Log to external monitoring service if available
  if (window.__ERROR_TRACKING__) {
    window.__ERROR_TRACKING__.logError(dbError);
  }
}

/**
 * Get toast notification type based on error severity
 * @param {string} severity - Error severity level
 * @returns {string} Toast type
 */
function getToastType(severity) {
  switch (severity) {
    case ERROR_SEVERITY.LOW:
      return 'info';
    case ERROR_SEVERITY.MEDIUM:
      return 'warning';
    case ERROR_SEVERITY.HIGH:
      return 'error';
    case ERROR_SEVERITY.CRITICAL:
      return 'error';
    default:
      return 'error';
  }
}

/**
 * Check if IndexedDB is available and working
 * @returns {Promise<boolean>} True if IndexedDB is available
 */
export async function checkIndexedDBHealth() {
  try {
    if (!window.indexedDB) {
      console.warn('IndexedDB not supported in this browser');
      return false;
    }
    
    // Try to open a test database
    const testDB = await new Promise((resolve, reject) => {
      const request = indexedDB.open('__test_health_check__', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        // Create a test store if needed
        const db = request.result;
        if (!db.objectStoreNames.contains('test')) {
          db.createObjectStore('test');
        }
      };
    });
    
    testDB.close();
    
    // Clean up test database
    indexedDB.deleteDatabase('__test_health_check__');
    
    return true;
  } catch (error) {
    console.error('IndexedDB health check failed:', error);
    return false;
  }
}

/**
 * Recovery strategies for different error types
 */
export const RECOVERY_STRATEGIES = {
  [DB_ERROR_TYPES.CONNECTION_FAILED]: {
    autoRetry: true,
    retryCount: 3,
    retryDelay: 1000,
    fallback: 'localStorage'
  },
  [DB_ERROR_TYPES.QUERY_FAILED]: {
    autoRetry: true,
    retryCount: 2,
    retryDelay: 500,
    fallback: null
  },
  [DB_ERROR_TYPES.NO_DATA_FOUND]: {
    autoRetry: false,
    retryCount: 0,
    retryDelay: 0,
    fallback: 'defaultData'
  },
  [DB_ERROR_TYPES.QUOTA_EXCEEDED]: {
    autoRetry: false,
    retryCount: 0,
    retryDelay: 0,
    fallback: 'cleanupOldData'
  }
};