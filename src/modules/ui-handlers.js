// ========== UI Handlers & Event Management ==========
import { getDecks, getQuestion, updateQuestion, getNotes, getNote, addNote, updateNote, deleteNote as deleteNoteRow } from './database.js';

// UI update functions are available globally from app.js
// updateHeader, updateDeckSelects, updateDeckList, updateQuestionList, updateSettingsPanel, updateStats

// Global session reference
let session = null;
export function setSession(newSession) { session = newSession; }
export function getSession() { return session; }

// ========== Tab Management ==========
export async function showTab(e, tabName) {
 // Fade out current tab
 const currentTab = document.querySelector('.tab-content[style*="block"]');
 if (currentTab) {
   currentTab.style.opacity = '0';
   await new Promise(resolve => setTimeout(resolve, 150));
 }
 
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  
  // Gracefully handle calls without an event object
  if (e && e.target) {
    e.target.classList.add('active');
  } else {
    // Try to set the corresponding tab button active if possible
    const btn = document.querySelector(`.tabs .tab[onclick*="'${tabName}'"]`);
    if (btn) btn.classList.add('active');
  }
  const newTab = document.getElementById(tabName + 'Tab');
 newTab.style.display = 'block';
 newTab.style.opacity = '0';
 
 if (tabName === 'study') {
   // Reset study session to reflect any changes from other tabs
   if (window.resetStudySession) {
     window.resetStudySession();
   }
 } else if (tabName === 'manage') {
   await window.updateDeckList();
   await window.updateQuestionList();
   await window.updateSettingsPanel();
 } else if (tabName === 'stats') {
   // Reset charts flag to allow re-initialization
   if (typeof resetChartsFlag === 'function') resetChartsFlag();
   await window.updateStats();
 } else if (tabName === 'notes') {
   await refreshNoteDeckFilters();
   await renderNotesList();
   updateSaveEnabled();
 }
 
 // Fade in new tab
 newTab.classList.add('fade-in');
 newTab.style.opacity = '1';
}

export function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

  const btn = document.getElementById('tab-btn-' + tab);
  const panel = document.getElementById('tab-' + tab) || document.getElementById(tab + 'Tab');
  if (btn) btn.classList.add('active');
  if (panel) {
    panel.style.display = 'block';
    panel.classList.add('fade-in');
  }

  if (tab === 'manage') {
    window.updateDeckList(); window.updateQuestionList(); window.updateSettingsPanel();
  } else if (tab === 'stats') {
    window.updateStats();
  } else if (tab === 'notes') {
    refreshNoteDeckFilters(); renderNotesList();
  }
}

// ========== Toast Notifications ==========
export function showToast(message, type = 'info') {
 const toast = document.getElementById('toast');
 toast.innerHTML = `
   <div style="display:flex;align-items:center;gap:8px">
     <span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'danger' ? '❌' : 'ℹ️'}</span>
     <span>${message}</span>
   </div>
 `;
 toast.classList.add('show');
 
 setTimeout(() => {
   toast.classList.remove('show');
 }, 3000);
}

// ========== Utility Functions ==========
export function shuffle(arr) {
 const copy = [...arr];
 for (let i = copy.length - 1; i > 0; i--) {
   const j = Math.floor(Math.random() * (i + 1));
   [copy[i], copy[j]] = [copy[j], copy[i]];
 }
 return copy;
}

export function escapeHtml(str) {
 const div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
}

// ========== Loading States ==========
export function showQuestionSkeleton() {
  const qArea = document.getElementById('qArea');
  if (qArea) {
    qArea.innerHTML = `
      <div class="skeleton-line" style="width:80%"></div>
      <div class="skeleton-line" style="width:60%"></div>
      <div class="skeleton-line" style="width:90%"></div>
      <div style="margin-top:16px">
        <div class="skeleton-line" style="width:120px;height:40px"></div>
      </div>
    `;
  }
}

export function hideQuestionSkeleton() {
  const qArea = document.getElementById('qArea');
  if (qArea) {
    qArea.classList.add('fade-in');
  }
}

// ========== Event Binding & Initialization ==========
export function bindEvents() {
  // Tab handling
  window.showTab = showTab;
  window.switchTab = switchTab;
  
  // Logo click handler
  document.addEventListener("DOMContentLoaded", () => {
    const logo = document.querySelector(".logo");
    if (logo) {
      logo.style.cursor = "pointer";
      logo.addEventListener("click", () => {
        switchTab("study");
      });
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Skip if user is typing in input/textarea
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    
    // Enter/Space: reveal answer or submit (only when not typing)
    if ((e.key === 'Enter' || e.key === ' ' || e.code === 'Space') && !e.shiftKey) {
      if (isTyping) {
        // Allow normal behavior in inputs
        if (e.key === 'Enter' && activeEl.id === 'userAnswer') {
          e.preventDefault();
          if (typeof submitAnswer === 'function') submitAnswer(activeEl.value);
        }
        return;
      }
      
      e.preventDefault();
      
      // Check if reveal button is visible (answer not yet revealed)
      const revealBtn = document.getElementById('revealBtn');
      if (revealBtn && revealBtn.style.display !== 'none') {
        // First press: reveal answer
        if (typeof revealAnswer === 'function') revealAnswer();
        return;
      }
      
      // Check if in grading phase
      const resultVisible = !!document.querySelector('.grade-buttons');
      if (resultVisible) {
        // Second press after result: grade as Good
        if (typeof gradeAnswer === 'function') gradeAnswer(2);
        return;
      }
      
      // Answer is revealed but not yet submitted
      const input = document.getElementById('userAnswer');
      const val = input ? input.value : '';
      if (typeof submitAnswer === 'function') {
        submitAnswer(val);
      }
      return;
    }

    // Skip remaining shortcuts if typing
    if (isTyping) return;

    // Arrow navigation within session
    const isActive = session && session.active;
    if (isActive && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      if (e.key === 'ArrowLeft' && session.index > 0) {
        session.index--;
        if (typeof showQuestion === 'function') showQuestion();
      } else if (e.key === 'ArrowRight' && session.index < session.queue.length - 1) {
        session.index++;
        if (typeof showQuestion === 'function') showQuestion();
      }
      return;
    }

    // Esc: cancel/exit current prompt or close modal
    if (e.key === 'Escape' || e.code === 'Escape') {
      e.preventDefault();
      
      // Close edit modal if open
      if (document.getElementById('editModal')?.style.display !== 'none') {
        closeEditModal();
        return;
      }
      
      // In session: move to next card if result is visible, otherwise do nothing
      const resultVisible = !!document.querySelector('.grade-buttons');
      if (isActive && resultVisible) {
        session.index++;
        if (typeof showQuestion === 'function') showQuestion();
      }
      return;
    }

    // Grade shortcuts during active session
    if (isActive) {
      const resultVisible = !!document.querySelector('.grade-buttons');
      
      // 1..4: grade when result is visible (Again/Hard/Good/Easy)
      if (resultVisible && ['1','2','3','4'].includes(e.key)) {
        e.preventDefault();
        if (typeof gradeAnswer === 'function') gradeAnswer(parseInt(e.key, 10) - 1);
        return;
      }
    }
  });

  // Notes tab: wire buttons and inputs
  window.newNote = newNote;
  const saveBtn = document.querySelector('#notesTab .card:nth-of-type(2) button.success');
  if (saveBtn) saveBtn.addEventListener('click', () => saveNote());
  const searchEl = document.getElementById('qNoteSearch');
  const deckFilterEl = document.getElementById('qNoteDeckFilter');
  if (searchEl) searchEl.addEventListener('input', debounce(renderNotesList, 200));
  if (deckFilterEl) deckFilterEl.addEventListener('change', renderNotesList);
  const titleEl = document.getElementById('noteTitle');
  const contentEl = document.getElementById('noteTextarea');
  if (titleEl) titleEl.addEventListener('input', updateSaveEnabled);
  if (contentEl) contentEl.addEventListener('input', updateSaveEnabled);
}

// Notes UI state
let currentNoteId = null;

export function getCurrentNoteId() {
  return currentNoteId;
}

export function setCurrentNoteId(id) {
  currentNoteId = id;
}

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function updateSaveEnabled() {
  const titleEl = document.getElementById('noteTitle');
  const contentEl = document.getElementById('noteTextarea');
  const saveBtn = document.querySelector('#notesTab .card:nth-of-type(2) button.success');
  if (!saveBtn) return;
  const ok = (titleEl?.value || '').trim() && (contentEl?.value || '').trim();
  saveBtn.disabled = !ok;
}

async function renderNotesList() {
  const search = document.getElementById('qNoteSearch')?.value || '';
  const deckId = document.getElementById('qNoteDeckFilter')?.value || '';
  let notes = await getNotes();
  
  // Apply filters
  if (search) {
    notes = notes.filter(n => 
      (n.title && n.title.toLowerCase().includes(search.toLowerCase())) ||
      (n.content && n.content.toLowerCase().includes(search.toLowerCase())) ||
      (n.source && n.source.toLowerCase().includes(search.toLowerCase()))
    );
  }
  if (deckId) {
    notes = notes.filter(n => n.deckId == deckId);
  }
  
  const list = document.getElementById('notesList');
  let html = '';
  notes.forEach(n => {
    const dateStr = n.updatedAt ? new Date(n.updatedAt).toLocaleString() : '';
    html += `
      <div class="question-item" style="align-items:center">
        <div style="flex:1">
          <div style="font-weight:600">${escapeHtml(n.title || '(제목 없음)')}</div>
          <div style="font-size:12px;color:var(--muted)">${escapeHtml(n.source || '')} ${dateStr ? '• '+dateStr : ''}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="secondary" data-note-edit="${n.id}">수정</button>
          <button class="danger" data-note-del="${n.id}">삭제</button>
        </div>
      </div>`;
  });
  list.innerHTML = html || '<div style="text-align:center;color:var(--muted);padding:20px">노트가 없습니다</div>';
  // Wire edit/delete buttons
  list.querySelectorAll('[data-note-edit]').forEach(btn => btn.addEventListener('click', () => editNote(btn.getAttribute('data-note-edit'))));
  list.querySelectorAll('[data-note-del]').forEach(btn => btn.addEventListener('click', () => deleteNote(btn.getAttribute('data-note-del'))));
}

async function refreshNoteDeckFilters() {
  const decks = await getDecks();
  const build = (selId) => {
    const el = document.getElementById(selId);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = ['<option value="">전체</option>'].concat(decks.map(d => `<option value="${d.id}">${d.name}</option>`)).join('');
    if (cur) el.value = cur;
  };
  build('qNoteDeckFilter');
  const notesSel = document.getElementById('deckSelectNotes');
  if (notesSel) {
    const cur = notesSel.value;
    notesSel.innerHTML = decks.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (cur) notesSel.value = cur;
  }
}

export async function newNote() {
  currentNoteId = null;
  await refreshNoteDeckFilters();
  const titleEl = document.getElementById('noteTitle');
  const sourceEl = document.getElementById('noteSource');
  const contentEl = document.getElementById('noteTextarea');
  titleEl.value = '';
  sourceEl.value = '';
  contentEl.value = '';
  updateSaveEnabled();
}

async function editNote(id) {
  const n = await getNote(id);
  if (!n) return;
  currentNoteId = n.id;
  await refreshNoteDeckFilters();
  document.getElementById('deckSelectNotes').value = n.deckId || '';
  document.getElementById('noteTitle').value = n.title || '';
  document.getElementById('noteSource').value = n.source || '';
  document.getElementById('noteTextarea').value = n.content || '';
  updateSaveEnabled();
}

export async function saveNote() {
  const deckId = document.getElementById('deckSelectNotes')?.value || '';
  const title = (document.getElementById('noteTitle')?.value || '').trim();
  const source = (document.getElementById('noteSource')?.value || '').trim();
  const content = (document.getElementById('noteTextarea')?.value || '').trim();
  if (!title || !content) { showToast('제목과 내용을 입력하세요', 'warning'); return; }
  if (!currentNoteId) {
    const id = await addNote({ 
      deckId, 
      title, 
      source, 
      content, 
      createdAt: new Date(),
      updatedAt: new Date()
    });
    currentNoteId = id;
    showToast('노트가 저장되었습니다', 'success');
  } else {
    await updateNote(currentNoteId, { 
      deckId, 
      title, 
      source, 
      content, 
      updatedAt: new Date()
    });
    showToast('노트가 업데이트되었습니다', 'success');
  }
  await renderNotesList();
}

async function deleteNote(id) {
  if (!confirm('이 노트를 삭제하시겠습니까?')) return;
  await deleteNoteRow(Number(id));
  if (currentNoteId === Number(id)) {
    currentNoteId = null;
    await newNote();
  }
  await renderNotesList();
  showToast('삭제되었습니다', 'success');
}

// ========== Accessible Edit Modal ==========
let lastFocusedTrigger = null;

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent !== null);
}

export async function openEditQuestion(id) {
  try {
    lastFocusedTrigger = document.activeElement;
  } catch (_) {}

  const q = await getQuestion(id);
  const decks = await getDecks();
  const deckOptions = decks.map(d => `<option value="${d.id}" ${String(d.id)===String(q.deck)?'selected':''}>${d.name}</option>`).join('');

  const body = document.getElementById('editModalBody');
  body.innerHTML = `
    <div class="grid">
      <div>
        <label style="color:var(--muted);font-size:14px">덱</label>
        <select id="editDeck">${deckOptions}</select>
      </div>
      <div>
        <label style="color:var(--muted);font-size:14px">유형</label>
        <select id="editType">
          <option value="OX" ${q.type==='OX'?'selected':''}>OX</option>
          <option value="SHORT" ${q.type==='SHORT'?'selected':''}>단답형</option>
          <option value="ESSAY" ${q.type==='ESSAY'||q.type==='KEYWORD'?'selected':''}>서술형</option>
        </select>
      </div>
      <div style="grid-column:1/-1">
        <label style="color:var(--muted);font-size:14px">문제</label>
        <textarea id="editPrompt">${q.prompt||''}</textarea>
      </div>
      <div id="editAnswerWrap" style="display:${q.type==='OX'?'block':'none'}">
        <label style="color:var(--muted);font-size:14px">정답</label>
        <select id="editAnswer">
          <option value="">선택하세요</option>
          <option value="true" ${q.answer==='true'?'selected':''}>O (참)</option>
          <option value="false" ${q.answer==='false'?'selected':''}>X (거짓)</option>
        </select>
      </div>
      <div id="editSynWrap" style="display:${q.type==='SHORT'?'block':'none'}">
        <label style="color:var(--muted);font-size:14px">동의어 (쉼표)</label>
        <input type="text" id="editSynonyms" value="${(q.synonyms||[]).join(', ')}" />
        <div><input type="checkbox" id="editFuzzy" ${q.shortFuzzy!==false?'checked':''}/> 퍼지 허용</div>
      </div>
      <div id="editKeyWrap" style="display:${q.type==='ESSAY'||q.type==='KEYWORD'?'block':'none'}">
        <label style="color:var(--muted);font-size:14px">키워드 (쉼표, 항목 내 a|b 허용)</label>
        <input type="text" id="editKeywords" value="${(q.keywords||[]).join(', ')}" />
        <label style="color:var(--muted);font-size:14px;margin-top:8px">임계값 (예: 7/10 또는 숫자)</label>
        <input type="text" id="editKeyThr" value="${q.keywordThreshold||''}" />
      </div>
      <div style="grid-column:1/-1">
        <label style="color:var(--muted);font-size:14px">해설</label>
        <textarea id="editExplain">${q.explain||''}</textarea>
      </div>
    </div>
  `;

  // Toggle sections on type change
  const typeEl = document.getElementById('editType');
  typeEl.addEventListener('change', () => {
    const t = typeEl.value;
    document.getElementById('editAnswerWrap').style.display = (t==='OX') ? 'block' : 'none';
    document.getElementById('editSynWrap').style.display = (t==='SHORT') ? 'block' : 'none';
    document.getElementById('editKeyWrap').style.display = (t==='ESSAY') ? 'block' : 'none';
  });

  const overlay = document.getElementById('editOverlay');
  const modal = document.getElementById('editModal');
  const closeBtn = document.getElementById('editModalClose');
  const cancelBtn = document.getElementById('editModalCancel');
  const saveBtn = document.getElementById('editModalSave');

  // Wire buttons
  overlay.onclick = () => closeEditModal();
  closeBtn.onclick = () => closeEditModal();
  cancelBtn.onclick = () => closeEditModal();
  saveBtn.onclick = () => saveEditQuestion(id);

  // Show and trap focus
  overlay.style.display = 'block';
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  modal.setAttribute('aria-hidden', 'false');
  modal.focus();

  // Focus the first focusable control inside modal
  const focusables = getFocusableElements(modal);
  if (focusables.length) setTimeout(() => focusables[0].focus(), 0);

  // Focus trap
  function onKeydown(e){
    if (e.key !== 'Tab') return;
    const els = getFocusableElements(modal);
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  modal.addEventListener('keydown', onKeydown);
  modal.dataset.focusTrap = 'true';
}

export function closeEditModal() {
  const overlay = document.getElementById('editOverlay');
  const modal = document.getElementById('editModal');
  overlay.style.display = 'none';
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  // Restore focus
  try { if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') lastFocusedTrigger.focus(); } catch(_){}
}

export async function saveEditQuestion(id) {
  console.log('saveEditQuestion called with id:', id);
  const updates = {
    deck: Number(document.getElementById('editDeck').value),
    type: document.getElementById('editType').value,
    prompt: document.getElementById('editPrompt').value.trim(),
    explain: document.getElementById('editExplain').value.trim()
  };
  console.log('Updates to save:', updates);
  if (!updates.prompt) { showToast('문제를 입력하세요', 'warning'); return; }
  if (updates.type === 'OX') {
    updates.answer = (document.getElementById('editAnswer').value || '').trim();
    if (!updates.answer) { showToast('정답을 선택하세요', 'warning'); return; }
  } else if (updates.type === 'SHORT') {
    // SHORT type uses explanation as answer
    if (!updates.explain) { showToast('해설을 입력하세요 (단답형의 정답)', 'warning'); return; }
    updates.answer = updates.explain;
    const syn = (document.getElementById('editSynonyms').value || '').split(',').map(s=>s.trim()).filter(Boolean);
    updates.synonyms = syn;
    updates.shortFuzzy = !!document.getElementById('editFuzzy').checked;
  }
  if (updates.type === 'ESSAY') {
    const keys = (document.getElementById('editKeywords').value || '').split(',').map(s=>s.trim()).filter(Boolean);
    if (!keys.length) { showToast('키워드를 입력하세요', 'warning'); return; }
    updates.keywords = keys;
    const thr = (document.getElementById('editKeyThr').value || '').trim();
    if (thr) updates.keywordThreshold = thr; else delete updates.keywordThreshold;
  }

  try {
    console.log('Calling updateQuestion...');
    const result = await updateQuestion(id, updates);
    console.log('updateQuestion result:', result);
    
    console.log('Calling updateQuestionList...');
    await window.updateQuestionList();
    console.log('updateQuestionList completed');
    
    showToast('수정되었습니다', 'success');
    closeEditModal();
  } catch (error) {
    console.error('Error saving question:', error);
    showToast('저장 중 오류가 발생했습니다: ' + error.message, 'danger');
  }
}

// ========== Service Worker & PWA ==========
export function initServiceWorker() {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful');
      })
      .catch(function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
  });

  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
  });

  function showInstallButton() {
    const btn = document.getElementById('installBtn');
    if (btn) {
      btn.style.display = 'block';
      btn.addEventListener('click', () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
            btn.style.display = 'none';
          });
        }
      });
    }
  }
}
