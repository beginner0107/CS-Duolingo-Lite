// ========== Data Persistence Monitor ==========
// Monitors database health and data persistence integrity

import { checkIndexedDBHealth } from './db-error-handler.js';
import { enableFallbackStorage, isFallbackEnabled, saveFallbackData, loadFallbackData } from './storage-fallback.js';
import { showToast } from './dom.js';

let monitorInterval = null;
let lastHealthCheck = null;
const MONITOR_INTERVAL = 30000; // 30 seconds
const HEALTH_CHECK_KEY = 'persistence_health_check';

/**
 * Start monitoring data persistence health
 */
export function startPersistenceMonitor() {
  if (monitorInterval) {
    stopPersistenceMonitor();
  }
  
  console.log('Starting persistence monitor...');
  
  // Initial health check
  performHealthCheck();
  
  // Set up periodic monitoring
  monitorInterval = setInterval(performHealthCheck, MONITOR_INTERVAL);
}

/**
 * Stop monitoring data persistence
 */
export function stopPersistenceMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('Persistence monitor stopped');
  }
}

/**
 * Perform a comprehensive health check
 */
async function performHealthCheck() {
  const now = Date.now();
  lastHealthCheck = now;
  
  try {
    // Test IndexedDB health
    const isIndexedDBHealthy = await checkIndexedDBHealth();
    
    if (!isIndexedDBHealthy && !isFallbackEnabled()) {
      console.warn('IndexedDB unhealthy, enabling fallback storage');
      enableFallbackStorage();
      showToast('데이터베이스 문제 감지 - 임시 저장소로 전환됨', 'warning');
    }
    
    // Test actual data persistence
    await testDataPersistence();
    
    console.log('Persistence health check completed:', {
      indexedDB: isIndexedDBHealthy,
      fallback: isFallbackEnabled(),
      timestamp: new Date(now).toISOString()
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

/**
 * Test if data can actually be written and read back
 */
async function testDataPersistence() {
  const testData = {
    timestamp: Date.now(),
    test: 'persistence_check'
  };
  
  try {
    if (isFallbackEnabled()) {
      // Test localStorage fallback
      const saved = saveFallbackData(HEALTH_CHECK_KEY, testData);
      if (!saved) {
        throw new Error('Failed to save to fallback storage');
      }
      
      const loaded = loadFallbackData(HEALTH_CHECK_KEY);
      if (!loaded || loaded.timestamp !== testData.timestamp) {
        throw new Error('Failed to load from fallback storage');
      }
    } else {
      // Test IndexedDB
      if (!window.db) {
        throw new Error('Database not available');
      }
      
      await window.db.meta.put({ 
        key: HEALTH_CHECK_KEY, 
        value: testData 
      });
      
      const loaded = await window.db.meta.get(HEALTH_CHECK_KEY);
      if (!loaded || loaded.value.timestamp !== testData.timestamp) {
        throw new Error('Failed to persist data in IndexedDB');
      }
    }
    
    console.log('Data persistence test passed');
  } catch (error) {
    console.error('Data persistence test failed:', error);
    
    if (!isFallbackEnabled()) {
      console.warn('Enabling fallback storage due to persistence failure');
      enableFallbackStorage();
      showToast('데이터 저장 문제 감지 - 백업 저장소 활성화', 'warning');
    }
    
    throw error;
  }
}

/**
 * Get monitoring status
 */
export function getMonitorStatus() {
  return {
    isRunning: monitorInterval !== null,
    lastCheck: lastHealthCheck ? new Date(lastHealthCheck).toISOString() : null,
    fallbackEnabled: isFallbackEnabled(),
    interval: MONITOR_INTERVAL
  };
}

/**
 * Manually trigger a health check
 */
export async function performManualHealthCheck() {
  console.log('Performing manual health check...');
  await performHealthCheck();
  return getMonitorStatus();
}

/**
 * Initialize persistence monitoring
 */
export function initializePersistenceMonitoring() {
  // Start monitoring after a short delay to allow app initialization
  setTimeout(() => {
    startPersistenceMonitor();
  }, 5000);
  
  // Stop monitoring when page is hidden to save resources
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPersistenceMonitor();
    } else {
      startPersistenceMonitor();
    }
  });
  
  // Stop monitoring before page unload
  window.addEventListener('beforeunload', stopPersistenceMonitor);
}