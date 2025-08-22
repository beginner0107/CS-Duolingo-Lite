// ========== Session Management ==========
import { getQuestions, getReview, updateReview, setProfile, getProfile } from './database.js';
import { updateDailyStreak } from './statistics.js';
import { grade } from './scoring.js';
import { nextReview } from './spaced-repetition.js';

let session = null;

export function getSession() {
  return session;
}

export function setSession(newSession) {
  session = newSession;
}

export async function startSession() {
  const questions = await getQuestions();
  const reviewRaw = await getReview();
  
  if (questions.length === 0) {
    showToast('문제가 없습니다. 먼저 문제를 추가해주세요.', 'warning');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  // Normalize review into a map keyed by questionId for compatibility
  const reviewById = Array.isArray(reviewRaw)
    ? Object.fromEntries(
        reviewRaw
          .filter(r => r && (r.questionId !== undefined && r.questionId !== null))
          .map(r => [String(r.questionId), r])
      )
    : reviewRaw || {};

  const due = Object.entries(reviewById)
    .filter(([id, r]) => r.due <= today && questions.some(q => String(q.id) === String(id)))
    .map(([id, r]) => ({ questionId: Number(id), ...r }));

  if (due.length === 0) {
    showToast('오늘 복습할 문제가 없습니다!', 'info');
    return;
  }

  // 섞기
  for (let i = due.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [due[i], due[j]] = [due[j], due[i]];
  }

  session = {
    questions: due,
    currentIndex: 0,
    results: [],
    completed: 0,
    total: due.length
  };

  document.getElementById('sessionProgress').textContent = `문제 ${session.completed}/${session.total}`;
  displayCurrentQuestion();
  showTab(null, 'session');
}

export function displayCurrentQuestion() {
  if (!session || session.currentIndex >= session.questions.length) {
    endSession();
    return;
  }

  const current = session.questions[session.currentIndex];
  const questions = getQuestions();
  const q = questions.find(q => q.id === current.questionId);
  
  if (!q) {
    session.currentIndex++;
    displayCurrentQuestion();
    return;
  }

  document.getElementById('sessionQuestion').textContent = q.prompt;
  document.getElementById('sessionAnswer').value = '';
  document.getElementById('sessionFeedback').style.display = 'none';
  document.getElementById('sessionInput').style.display = 'block';
  
  document.getElementById('sessionProgress').textContent = 
    `문제 ${session.currentIndex + 1}/${session.total}`;
}

export async function submitAnswer() {
  if (!session) return;

  const userAnswer = document.getElementById('sessionAnswer').value.trim();
  if (!userAnswer) {
    showToast('답을 입력해주세요', 'warning');
    return;
  }

  const current = session.questions[session.currentIndex];
  const questions = await getQuestions();
  const q = questions.find(q => q.id === current.questionId);

  const result = grade(q, userAnswer);
  
  // 결과 저장
  session.results.push({
    questionId: current.questionId,
    userAnswer,
    correct: result.grade > 0,
    grade: result.grade,
    feedback: result.feedback,
    question: q
  });

  // 피드백 표시
  displayFeedback(result, q);
}

function displayFeedback(result, question) {
  const feedback = document.getElementById('sessionFeedback');
  const input = document.getElementById('sessionInput');
  
  input.style.display = 'none';
  feedback.style.display = 'block';

  let gradeText = '';
  let gradeColor = '';
  
  if (result.grade === 0) {
    gradeText = '다시 (Again)';
    gradeColor = '#ef4444';
  } else if (result.grade === 1) {
    gradeText = '어려움 (Hard)';
    gradeColor = '#f59e0b';
  } else if (result.grade === 2) {
    gradeText = '보통 (Good)';
    gradeColor = '#10b981';
  } else {
    gradeText = '쉬움 (Easy)';
    gradeColor = '#06b6d4';
  }

  feedback.innerHTML = `
    <div style="margin-bottom: 16px;">
      <div style="font-weight: bold; color: ${gradeColor}; margin-bottom: 8px;">
        ${gradeText}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>정답:</strong> ${escapeHtml(question.answer)}
      </div>
      ${question.explain ? `<div style="margin-bottom: 8px;"><strong>설명:</strong> ${escapeHtml(question.explain)}</div>` : ''}
      <div style="font-size: 14px; color: #666;">
        ${result.feedback}
      </div>
    </div>
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button onclick="gradeAnswer(0)" class="grade-btn again">다시 (0)</button>
      <button onclick="gradeAnswer(1)" class="grade-btn hard">어려움 (1)</button>
      <button onclick="gradeAnswer(2)" class="grade-btn good">보통 (2)</button>
      <button onclick="gradeAnswer(3)" class="grade-btn easy">쉬움 (3)</button>
      <button onclick="skipQuestion()" class="secondary">모르겠음</button>
    </div>
  `;
}

export async function gradeAnswer(grade) {
  if (!session) return;
  
  // Update the last result with the manual grade
  const lastResult = session.results[session.results.length - 1];
  if (lastResult) {
    lastResult.grade = grade;
    lastResult.correct = grade > 0;
  }

  const current = session.questions[session.currentIndex];
  const reviewState = current;
  
  // Apply spaced repetition algorithm
  const newState = nextReview(reviewState, grade);
  
  // Update review in database
  await updateReview(current.questionId, newState);
  
  // Update XP for correct answers
  if (grade > 0) {
    const profile = await getProfile();
    const xpGain = grade === 3 ? 10 : grade === 2 ? 8 : 5;
    profile.xp = (profile.xp || 0) + xpGain;
    await setProfile(profile);
    
    // Update daily streak
    await updateDailyStreak();
    
    // Only increment completed count for correct answers
    session.completed++;
  }
  
  // Return early for "Again" answers - don't increment index or move to next question
  if (grade === 0) {
    displayCurrentQuestion(); // Show same question again
    return;
  }
  
  // Move to next question
  session.currentIndex++;
  displayCurrentQuestion();
}

export async function skipQuestion() {
  if (!session) return;
  
  // Mark as skipped but don't affect review state
  const lastResult = session.results[session.results.length - 1];
  if (lastResult) {
    lastResult.skipped = true;
  }
  
  session.currentIndex++;
  displayCurrentQuestion();
}

export async function endSession() {
  if (!session) return;

  const correct = session.results.filter(r => r.correct && !r.skipped).length;
  const total = session.results.filter(r => !r.skipped).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  // XP 계산
  let totalXP = 0;
  session.results.forEach(r => {
    if (r.correct && !r.skipped) {
      const xp = r.grade === 3 ? 10 : r.grade === 2 ? 8 : 5;
      totalXP += xp;
    }
  });

  // 세션 결과 표시
  document.getElementById('sessionResults').innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <h3>세션 완료! 🎉</h3>
      <div style="margin: 20px 0;">
        <div style="font-size: 24px; margin-bottom: 10px;">
          정답률: ${accuracy}% (${correct}/${total})
        </div>
        <div style="font-size: 18px; color: #10b981;">
          획득 XP: +${totalXP}
        </div>
      </div>
      <button onclick="showTab(null, 'study')" class="primary">계속 학습하기</button>
      <button onclick="showTab(null, 'stats')" class="secondary">통계 보기</button>
    </div>
  `;
  
  document.getElementById('sessionInput').style.display = 'none';
  document.getElementById('sessionFeedback').style.display = 'none';
  document.getElementById('sessionResults').style.display = 'block';
  
  // 업데이트
  await updateHeader();
  await updateStats();
  
  session = null;
}

// Optional session controls for backward compatibility
export function pauseSession() {
  if (!session) return;
  session.paused = true;
}

export function resumeSession() {
  if (!session) return;
  session.paused = false;
  displayCurrentQuestion();
}

export function resetSession() {
  session = null;
  try { if (typeof window.showTab === 'function') window.showTab(null, 'study'); } catch (_) {}
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}
