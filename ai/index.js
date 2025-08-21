import { CloudAdapter, LocalAdapter } from './adapter.js';

/**
 * Factory function to get an AI adapter instance
 * @param {'cloud'|'local'} mode - The adapter type to create
 * @returns {import('./adapter.js').AIAdapter} The adapter instance
 */
export function getAdapter(mode) {
  switch (mode) {
    case 'cloud':
      return new CloudAdapter();
    case 'local':
      return new LocalAdapter();
    default:
      throw new Error(`Unknown adapter mode: ${mode}`);
  }
}

// Smoke test for console usage
window.aiTest = async function() {
  console.log('Testing AI adapters...');
  const cloud = getAdapter('cloud');
  const local = getAdapter('local');
  console.log('Cloud result:', await cloud.grade({ prompt: 'test answer' }));
  console.log('Local result:', await local.grade({ prompt: 'test answer' }));
};

/**
 * Get AI configuration with safe defaults
 * @returns {{enableCloud: boolean, baseUrl?: string, apiKey?: string, provider?: string, model?: string}}
 */
export function getConfig() {
  const config = window.__AI_CONF || {};
  return {
    enableCloud: config.enableCloud === true,
    ...config
  };
}