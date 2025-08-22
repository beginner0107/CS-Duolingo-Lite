// ========== Drag & Drop for Question Reordering ==========
import { updateQuestion } from './database.js';

let draggedElement = null;

export function handleDragStart(e) {
  draggedElement = e.target.closest('.question-item');
  if (draggedElement) {
    draggedElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
}

export function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const questionItem = e.target.closest('.question-item');
  if (!questionItem || questionItem === draggedElement) return;
  
  // Remove existing indicators
  document.querySelectorAll('.question-item').forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  
  // Determine drop position
  const rect = questionItem.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  
  if (e.clientY < midY) {
    questionItem.classList.add('drag-over-top');
  } else {
    questionItem.classList.add('drag-over-bottom');
  }
}

export function handleDragLeave(e) {
  const questionItem = e.target.closest('.question-item');
  if (questionItem) {
    questionItem.classList.remove('drag-over-top', 'drag-over-bottom');
  }
}

export function handleDrop(e) {
  e.preventDefault();
  
  if (!draggedElement) return;
  
  const target = e.target.closest('.question-item');
  if (!target || target === draggedElement) return;
  
  const container = target.parentNode;
  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  
  if (e.clientY < midY) {
    container.insertBefore(draggedElement, target);
  } else {
    container.insertBefore(draggedElement, target.nextSibling);
  }
  
  // Update question order in database
  updateQuestionOrder();
  
  // Clean up visual indicators
  document.querySelectorAll('.question-item').forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

export function handleDragEnd(e) {
  if (e.target.closest('.question-item')) {
    e.target.closest('.question-item').classList.remove('dragging');
  }
  draggedElement = null;
  
  // Clean up any remaining visual indicators
  document.querySelectorAll('.question-item').forEach(item => {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

async function updateQuestionOrder() {
  const questionItems = document.querySelectorAll('.question-item[data-question-id]');
  const updates = [];
  
  questionItems.forEach((item, index) => {
    const questionId = parseInt(item.dataset.questionId);
    updates.push(updateQuestion(questionId, { sortOrder: index }));
  });
  
  await Promise.all(updates);
}