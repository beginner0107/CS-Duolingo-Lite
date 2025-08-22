// ========== Notes Management ==========
import { getNotes, getNote, addNote, updateNote, deleteNote, addQuestion } from './database.js';

let currentNoteId = null;

export function getCurrentNoteId() {
  return currentNoteId;
}

export function setCurrentNoteId(id) {
  currentNoteId = id;
}

export async function createNote() {
  const name = prompt('노트 제목을 입력하세요:');
  if (!name?.trim()) return;
  
  try {
    const id = await addNote({ name: name.trim(), content: '', created: new Date() });
    await updateNoteList();
    showToast('노트가 생성되었습니다', 'success');
  } catch (error) {
    console.error('Note creation error:', error);
    showToast('노트 생성에 실패했습니다', 'error');
  }
}

export async function updateNoteList() {
  const notes = await getNotes();
  const container = document.getElementById('noteList');
  
  if (!container) return;
  
  if (notes.length === 0) {
    container.innerHTML = '<div class="empty-state">노트가 없습니다</div>';
    return;
  }
  
  container.innerHTML = notes.map(note => `
    <div class="note-item" data-note-id="${note.id}">
      <div class="note-header">
        <span class="note-name">${escapeHtml(note.name)}</span>
        <div class="note-actions">
          <button onclick="editNote(${note.id})" class="btn-sm secondary">수정</button>
          <button onclick="deleteNoteConfirm(${note.id})" class="btn-sm danger">삭제</button>
        </div>
      </div>
      <div class="note-preview">${escapeHtml((note.content || '').substring(0, 100))}...</div>
    </div>
  `).join('');
}

export async function editNote(id) {
  currentNoteId = id;
  const note = await getNote(id);
  
  if (!note) {
    showToast('노트를 찾을 수 없습니다', 'error');
    return;
  }
  
  // 노트 편집기 표시
  document.getElementById('noteEditor').style.display = 'block';
  document.getElementById('noteTitle').textContent = note.name;
  document.getElementById('noteContent').value = note.content || '';
  
  // 줄 번호 업데이트
  updateLineNumbers();
}

export function updateLineNumbers() {
  const content = document.getElementById('noteContent');
  const lineNumbers = document.getElementById('lineNumbers');
  
  if (!content || !lineNumbers) return;
  
  const lines = content.value.split('\n');
  const numbers = lines.map((_, index) => 
    `<div class="line-number" data-line="${index + 1}">${index + 1}</div>`
  ).join('');
  
  lineNumbers.innerHTML = numbers;
}

export async function saveNote() {
  if (!currentNoteId) return;
  
  const content = document.getElementById('noteContent').value;
  
  try {
    await updateNote(currentNoteId, { content, updated: new Date() });
    showToast('노트가 저장되었습니다', 'success');
    await updateNoteList();
  } catch (error) {
    console.error('Note save error:', error);
    showToast('노트 저장에 실패했습니다', 'error');
  }
}

export function closeNoteEditor() {
  document.getElementById('noteEditor').style.display = 'none';
  currentNoteId = null;
}

export async function deleteNoteConfirm(id) {
  const note = await getNote(id);
  if (!note) return;
  
  const confirmed = confirm(`"${note.name}" 노트를 삭제하시겠습니까?`);
  if (!confirmed) return;
  
  try {
    await deleteNote(id);
    await updateNoteList();
    showToast('노트가 삭제되었습니다', 'success');
    
    if (currentNoteId === id) {
      closeNoteEditor();
    }
  } catch (error) {
    console.error('Note deletion error:', error);
    showToast('노트 삭제에 실패했습니다', 'error');
  }
}

export function addLine() {
  const content = document.getElementById('noteContent');
  if (!content) return;
  
  const cursorPosition = content.selectionStart;
  const beforeCursor = content.value.substring(0, cursorPosition);
  const afterCursor = content.value.substring(cursorPosition);
  
  content.value = beforeCursor + '\n• ' + afterCursor;
  content.selectionStart = content.selectionEnd = cursorPosition + 3;
  content.focus();
  
  updateLineNumbers();
}

export function toggleSelectLine(lineNumber) {
  const lineElement = document.querySelector(`.line-number[data-line="${lineNumber}"]`);
  if (!lineElement) return;
  
  lineElement.classList.toggle('selected');
}

export function deleteLine() {
  const content = document.getElementById('noteContent');
  if (!content) return;
  
  const lines = content.value.split('\n');
  const selectedLines = document.querySelectorAll('.line-number.selected');
  
  if (selectedLines.length === 0) {
    showToast('삭제할 줄을 선택해주세요', 'warning');
    return;
  }
  
  // 선택된 줄 번호들을 배열로 변환 (내림차순 정렬)
  const lineNumbers = Array.from(selectedLines)
    .map(el => parseInt(el.dataset.line))
    .sort((a, b) => b - a);
  
  // 뒤에서부터 삭제 (인덱스가 변경되지 않도록)
  lineNumbers.forEach(lineNum => {
    lines.splice(lineNum - 1, 1);
  });
  
  content.value = lines.join('\n');
  updateLineNumbers();
  showToast(`${selectedLines.length}줄이 삭제되었습니다`, 'success');
}

export async function deleteNoteCascade(id) {
  // 노트와 관련된 모든 데이터 삭제 (필요시 구현)
  await deleteNote(id);
}

export function saveNoteMeta() {
  // 노트 메타데이터 저장 (필요시 구현)
  console.log('Note metadata saved');
}

export async function addNewNote() {
  await createNote();
}

export async function addNoteItem() {
  addLine();
}

export async function saveNoteItem() {
  await saveNote();
}

export async function deleteNoteItem() {
  deleteLine();
}

export async function deleteCurrentNote() {
  if (currentNoteId) {
    await deleteNoteConfirm(currentNoteId);
  }
}

export async function exportNoteToMarkdown() {
  if (!currentNoteId) {
    showToast('내보낼 노트를 선택해주세요', 'warning');
    return;
  }
  
  const note = await getNote(currentNoteId);
  if (!note) {
    showToast('노트를 찾을 수 없습니다', 'error');
    return;
  }
  
  const markdown = `# ${note.name}\n\n${note.content || ''}\n\n---\n생성일: ${formatDate(note.created)}\n수정일: ${formatDate(note.updated || note.created)}`;
  
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.name}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('노트를 마크다운으로 내보냈습니다', 'success');
}

export async function convertSelectionToQuestions() {
  if (!currentNoteId) {
    showToast('노트를 선택해주세요', 'warning');
    return;
  }
  
  const selectedLines = document.querySelectorAll('.line-number.selected');
  if (selectedLines.length === 0) {
    showToast('문제로 변환할 줄을 선택해주세요', 'warning');
    return;
  }
  
  const content = document.getElementById('noteContent').value;
  const lines = content.split('\n');
  const selectedContent = Array.from(selectedLines)
    .map(el => parseInt(el.dataset.line))
    .sort((a, b) => a - b)
    .map(lineNum => lines[lineNum - 1])
    .join('\n');
  
  // 간단한 Q&A 형식 파싱 시도
  const qaPattern = /^(.+?)[:：]\s*(.+)$/gm;
  let matches;
  let questions = [];
  
  while ((matches = qaPattern.exec(selectedContent)) !== null) {
    questions.push({
      prompt: matches[1].trim(),
      answer: matches[2].trim(),
      type: 'short'
    });
  }
  
  if (questions.length === 0) {
    showToast('Q&A 형식을 찾을 수 없습니다. "질문: 답" 형식으로 작성해주세요', 'warning');
    return;
  }
  
  const deckId = prompt('문제를 추가할 덱 ID를 입력하세요:');
  if (!deckId) return;
  
  try {
    for (const q of questions) {
      await addQuestion({
        ...q,
        deck: parseInt(deckId)
      });
    }
    
    showToast(`${questions.length}개 문제가 생성되었습니다`, 'success');
  } catch (error) {
    console.error('Question conversion error:', error);
    showToast('문제 변환에 실패했습니다', 'error');
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('ko-KR');
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