import { todayStr } from './database.js';
import { checkAnswer } from './scoring.js';

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

