// ========== Data Management (Import/Export) ==========
import { getDecks, getQuestions, getReview, getProfile, addDeck, addQuestion } from './database.js';

export async function exportData() {
  const decks = await getDecks();
  const questions = await getQuestions();
  const review = await getReview();
  const profile = await getProfile();
  
  const data = { decks, questions, review, profile };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `cs-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('데이터를 내보냈습니다', 'success');
}

export async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 데이터 유효성 검사
      if (!data.decks || !data.questions) {
        throw new Error('올바른 백업 파일이 아닙니다');
      }
      
      const confirmed = confirm('기존 데이터가 모두 삭제됩니다. 계속하시겠습니까?');
      if (!confirmed) return;
      
      // 기존 데이터 삭제
      await db.decks.clear();
      await db.questions.clear();
      await db.review.clear();
      await db.profile.clear();
      
      // 새 데이터 추가
      if (data.decks?.length > 0) await db.decks.bulkAdd(data.decks);
      if (data.questions?.length > 0) await db.questions.bulkAdd(data.questions);
      if (data.review?.length > 0) await db.review.bulkAdd(data.review);
      if (data.profile) await db.profile.add(data.profile);
      
      showToast('데이터를 가져왔습니다', 'success');
      location.reload(); // 페이지 새로고침
      
    } catch (error) {
      console.error('Import error:', error);
      showToast('데이터 가져오기에 실패했습니다: ' + error.message, 'error');
    }
  };
  
  input.click();
}

// CSV/TSV 가져오기 관련 변수
let importPreviewData = null;
let currentDeckForImport = null;

export function showGuidedImport() {
  document.getElementById('importGuide').style.display = 'block';
}

export function hideGuidedImport() {
  document.getElementById('importGuide').style.display = 'none';
  importPreviewData = null;
  currentDeckForImport = null;
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('importActions').style.display = 'none';
}

export async function handleGuidedImport() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv,.tsv,.txt';
  
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const delimiter = file.name.endsWith('.tsv') ? '\t' : ',';
      await previewImport(text, delimiter);
    } catch (error) {
      showToast('파일을 읽는데 실패했습니다: ' + error.message, 'error');
    }
  };
  
  fileInput.click();
}

async function previewImport(text, delimiter) {
  const lines = text.trim().split('\n').filter(line => line.trim());
  if (lines.length === 0) {
    showToast('빈 파일입니다', 'warning');
    return;
  }
  
  // 첫 번째 줄이 헤더인지 확인
  const firstLine = lines[0].split(delimiter);
  const hasHeader = firstLine.some(cell => 
    cell.toLowerCase().includes('question') || 
    cell.toLowerCase().includes('answer') ||
    cell.toLowerCase().includes('prompt') ||
    cell.toLowerCase().includes('문제') ||
    cell.toLowerCase().includes('답')
  );
  
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const questions = [];
  
  dataLines.forEach((line, index) => {
    const cells = line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
    if (cells.length >= 2) {
      questions.push({
        prompt: cells[0] || `문제 ${index + 1}`,
        answer: cells[1] || '',
        explain: cells[2] || '',
        type: 'short'
      });
    }
  });
  
  if (questions.length === 0) {
    showToast('유효한 문제를 찾을 수 없습니다', 'warning');
    return;
  }
  
  importPreviewData = questions;
  
  // 미리보기 표시
  let previewHtml = `
    <div style="margin-bottom: 16px;">
      <h4>가져올 문제 미리보기 (${questions.length}개)</h4>
      <p>처음 5개 문제만 표시됩니다.</p>
    </div>
    <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px; padding: 12px;">
  `;
  
  questions.slice(0, 5).forEach((q, index) => {
    previewHtml += `
      <div style="margin-bottom: 12px; padding: 8px; background: var(--card-bg); border-radius: 4px;">
        <div><strong>문제 ${index + 1}:</strong> ${escapeHtml(q.prompt)}</div>
        <div><strong>답:</strong> ${escapeHtml(q.answer)}</div>
        ${q.explain ? `<div><strong>설명:</strong> ${escapeHtml(q.explain)}</div>` : ''}
      </div>
    `;
  });
  
  previewHtml += '</div>';
  
  document.getElementById('importPreview').innerHTML = previewHtml;
  document.getElementById('importActions').style.display = 'block';
}

export async function confirmImport() {
  if (!importPreviewData) {
    showToast('가져올 데이터가 없습니다', 'warning');
    return;
  }
  
  const deckSelect = document.getElementById('importDeckSelect');
  let deckId = parseInt(deckSelect.value);
  
  // 새 덱 생성 옵션인 경우
  if (deckId === -1) {
    const deckName = prompt('새 덱의 이름을 입력하세요:');
    if (!deckName?.trim()) {
      showToast('덱 이름이 필요합니다', 'warning');
      return;
    }
    
    deckId = await addDeck(deckName.trim());
  }
  
  if (!deckId) {
    showToast('덱을 선택해주세요', 'warning');
    return;
  }
  
  try {
    // 문제들을 데이터베이스에 추가
    for (const questionData of importPreviewData) {
      await addQuestion({
        ...questionData,
        deck: deckId
      });
    }
    
    showToast(`${importPreviewData.length}개 문제를 가져왔습니다`, 'success');
    hideGuidedImport();
    await updateDeckSelects();
    await updateQuestionList();
    
  } catch (error) {
    console.error('Import error:', error);
    showToast('문제를 가져오는데 실패했습니다: ' + error.message, 'error');
  }
}

export function cancelImport() {
  hideGuidedImport();
}

// 빠른 추가 기능
export async function showQuickAdd() {
  await updateDeckSelects(); // 덱 목록 업데이트
  document.getElementById('quickAdd').style.display = 'block';
}

export function hideQuickAdd() {
  document.getElementById('quickAdd').style.display = 'none';
  document.getElementById('quickAddForm').reset();
}

export async function submitQuickAdd() {
  const form = document.getElementById('quickAddForm');
  const formData = new FormData(form);
  
  const deckId = parseInt(formData.get('deck'));
  const prompt = formData.get('prompt')?.trim();
  const answer = formData.get('answer')?.trim();
  const explain = formData.get('explain')?.trim();
  const type = formData.get('type') || 'short';
  
  if (!prompt || !answer) {
    showToast('문제와 답을 모두 입력해주세요', 'warning');
    return;
  }
  
  if (!deckId) {
    showToast('덱을 선택해주세요', 'warning');
    return;
  }
  
  try {
    await addQuestion({
      deck: deckId,
      type,
      prompt,
      answer,
      explain: explain || null
    });
    
    showToast('문제가 추가되었습니다', 'success');
    form.reset();
    
    // 선택사항: 폼을 닫거나 계속 추가할 수 있게 둠
    const continueAdding = confirm('문제가 추가되었습니다. 계속 추가하시겠습니까?');
    if (!continueAdding) {
      hideQuickAdd();
    }
    
    await updateQuestionList();
    await updateHeader();
    
  } catch (error) {
    console.error('Quick add error:', error);
    showToast('문제 추가에 실패했습니다: ' + error.message, 'error');
  }
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