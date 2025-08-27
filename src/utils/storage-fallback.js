// ========== Storage Fallback Utility ==========
// Provides localStorage fallback when IndexedDB fails

import { showToast } from './dom.js';

const FALLBACK_PREFIX = 'csstudyapp_fallback_';
const FALLBACK_ENABLED_KEY = 'fallback_storage_enabled';

/**
 * Check if fallback storage is available and working
 */
export function isLocalStorageAvailable() {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Enable fallback storage mode
 */
export function enableFallbackStorage() {
  if (isLocalStorageAvailable()) {
    localStorage.setItem(FALLBACK_ENABLED_KEY, 'true');
    showToast('임시 저장소로 전환됨 - 데이터가 제한적으로 저장됩니다', 'warning');
    return true;
  }
  return false;
}

/**
 * Check if fallback storage is currently enabled
 */
export function isFallbackEnabled() {
  return localStorage.getItem(FALLBACK_ENABLED_KEY) === 'true';
}

/**
 * Disable fallback storage mode
 */
export function disableFallbackStorage() {
  localStorage.removeItem(FALLBACK_ENABLED_KEY);
}

/**
 * Save data to localStorage fallback
 */
export function saveFallbackData(key, data) {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    const fallbackKey = FALLBACK_PREFIX + key;
    localStorage.setItem(fallbackKey, JSON.stringify({
      data,
      timestamp: new Date().toISOString(),
      version: 1
    }));
    return true;
  } catch (e) {
    console.error('Fallback storage failed:', e);
    return false;
  }
}

/**
 * Load data from localStorage fallback
 */
export function loadFallbackData(key) {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const fallbackKey = FALLBACK_PREFIX + key;
    const stored = localStorage.getItem(fallbackKey);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    return parsed.data;
  } catch (e) {
    console.error('Failed to load fallback data:', e);
    return null;
  }
}

/**
 * Clear all fallback storage data
 */
export function clearFallbackStorage() {
  if (!isLocalStorageAvailable()) return;
  
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(FALLBACK_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
  disableFallbackStorage();
}

/**
 * Get fallback storage usage info
 */
export function getFallbackStorageInfo() {
  if (!isLocalStorageAvailable()) return null;
  
  const keys = Object.keys(localStorage);
  const fallbackKeys = keys.filter(key => key.startsWith(FALLBACK_PREFIX));
  
  return {
    enabled: isFallbackEnabled(),
    itemCount: fallbackKeys.length,
    keys: fallbackKeys.map(key => key.replace(FALLBACK_PREFIX, ''))
  };
}