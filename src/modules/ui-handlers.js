// ========== UI Handlers & Event Management ==========
import { updateHeader, updateDeckSelects, updateDeckList, updateQuestionList, updateSettingsPanel, updateStats, loadNotes, submitAnswer } from './database.js';

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
 
 e.target.classList.add('active');
 const newTab = document.getElementById(tabName + 'Tab');
 newTab.style.display = 'block';
 newTab.style.opacity = '0';
 
 if (tabName === 'manage') {
   await updateDeckList();
   await updateQuestionList();
   await updateSettingsPanel();
 } else if (tabName === 'stats') {
   // Reset charts flag to allow re-initialization
   if (typeof resetChartsFlag === 'function') resetChartsFlag();
   await updateStats();
 } else if (tabName === 'notes') {
   await updateDeckSelects();
   await loadNotes();
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
    updateDeckList(); updateQuestionList(); updateSettingsPanel();
  } else if (tab === 'stats') {
    updateStats();
  } else if (tab === 'notes') {
    updateDeckSelects(); loadNotes();
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
      
      // Check for modals or active prompts first
      const modal = document.querySelector('.modal, .popup, [role="dialog"]');
      if (modal) {
        modal.style.display = 'none';
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