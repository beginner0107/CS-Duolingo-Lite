import { LocalAdapter, CloudAdapter } from './adapter.js';

/**
 * Routes grading requests between local and cloud adapters based on policy
 * @param {import('./adapter.js').GradingInput} input
 * @returns {Promise<import('./adapter.js').GradingOutput>}
 */
export async function decideGrade(input) {
  const localAdapter = new LocalAdapter();
  const localResult = await localAdapter.grade(input);
  
  // Record local result
  recordMetrics({ used: localResult.used, score: localResult.score });
  
  // Check if we should escalate to cloud (borderline logic)
  const isKeyword = Array.isArray(input?.reference?.keywords) && input.reference.keywords.length > 0;
  const isShort = !isKeyword; // OX is typically not routed here
  const s = Number(localResult.score) || 0;
  const borderline = (isShort && (s === 0 || (s >= 0.5 && s < 0.9))) ||
                     (isKeyword && s > 0 && s < 0.9);
  const shouldUseCloud = borderline && window.__AI_CONF?.enableCloud === true;
  
  if (shouldUseCloud) {
    try {
      const cloudAdapter = new CloudAdapter();
      const cloudResult = await cloudAdapter.grade(input);
      
      // Record cloud result
      recordMetrics({ used: cloudResult.used, score: cloudResult.score });
      
      return cloudResult;
    } catch (error) {
      console.warn('Cloud grading failed, falling back to local result:', error);
      return localResult;
    }
  }
  
  return localResult;
}

/**
 * Records grading metrics to localStorage ring buffer
 * @param {{used: string, score: number}} metric
 */
function recordMetrics(metric) {
  try {
    const key = 'ai.metrics';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ ...metric, timestamp: Date.now() });
    
    // Keep only last 100 entries (ring buffer)
    const metrics = existing.slice(-100);
    localStorage.setItem(key, JSON.stringify(metrics));
  } catch (error) {
    console.warn('Failed to record AI metrics:', error);
  }
}
