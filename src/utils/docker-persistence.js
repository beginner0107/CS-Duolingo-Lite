// Docker Data Persistence Utility
// Provides automatic backup/restore for container environments

import { 
  getProfile, getDecks, getQuestions, getReview, getNotes, getDailyRollup,
  setProfile, addDeck, addQuestion, addReview, addNote, setDailyRollup
} from '../modules/database.js';

const BACKUP_KEY = 'cs_study_backup';
const BACKUP_VERSION = '1.0';

// Export all data to a backup object
export async function exportAllData() {
  try {
    const data = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      profile: await getProfile(),
      decks: await getDecks(),
      questions: await getQuestions(),
      reviews: await getReview(),
      notes: await getNotes(),
      dailyRollup: await getDailyRollup()
    };
    
    console.log('Data exported successfully:', Object.keys(data));
    return data;
  } catch (error) {
    console.error('Failed to export data:', error);
    throw error;
  }
}

// Import all data from a backup object
export async function importAllData(data) {
  if (!data || data.version !== BACKUP_VERSION) {
    throw new Error('Invalid or incompatible backup data');
  }

  try {
    // Clear existing data first (optional - comment out to merge instead)
    // await clearAllData();

    // Import profile
    if (data.profile) {
      await setProfile(data.profile);
    }

    // Import decks
    if (data.decks && Array.isArray(data.decks)) {
      for (const deck of data.decks) {
        await addDeck(deck);
      }
    }

    // Import questions
    if (data.questions && Array.isArray(data.questions)) {
      for (const question of data.questions) {
        await addQuestion(question);
      }
    }

    // Import reviews
    if (data.reviews && Array.isArray(data.reviews)) {
      for (const review of data.reviews) {
        await addReview(review);
      }
    }

    // Import notes
    if (data.notes && Array.isArray(data.notes)) {
      for (const note of data.notes) {
        await addNote(note);
      }
    }

    // Import daily rollup
    if (data.dailyRollup) {
      await setDailyRollup(data.dailyRollup);
    }

    console.log('Data imported successfully');
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    throw error;
  }
}

// Save backup to localStorage (persists across container restarts if volume mounted)
export async function saveBackupToStorage() {
  try {
    const data = await exportAllData();
    const backupData = JSON.stringify(data);
    
    // Try to save to localStorage
    localStorage.setItem(BACKUP_KEY, backupData);
    
    // Also save to a downloadable file as fallback
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create hidden download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `cs-study-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    
    console.log('Backup saved to localStorage and available for download');
    return { localStorage: true, downloadUrl: url };
  } catch (error) {
    console.error('Failed to save backup:', error);
    throw error;
  }
}

// Restore backup from localStorage
export async function restoreBackupFromStorage() {
  try {
    const backupData = localStorage.getItem(BACKUP_KEY);
    if (!backupData) {
      console.log('No backup found in localStorage');
      return false;
    }

    const data = JSON.parse(backupData);
    await importAllData(data);
    
    console.log('Backup restored from localStorage');
    return true;
  } catch (error) {
    console.error('Failed to restore backup:', error);
    throw error;
  }
}

// Auto-backup on app close/beforeunload
export function enableAutoBackup() {
  window.addEventListener('beforeunload', async () => {
    try {
      await saveBackupToStorage();
    } catch (error) {
      console.error('Auto-backup failed:', error);
    }
  });

  // Also backup periodically (every 5 minutes)
  setInterval(async () => {
    try {
      await saveBackupToStorage();
      console.log('Periodic backup completed');
    } catch (error) {
      console.error('Periodic backup failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Check and restore on app start
export async function checkAndRestore() {
  try {
    // Check if we have data in IndexedDB
    const existingDecks = await getDecks();
    const existingQuestions = await getQuestions();
    
    // If no data exists, try to restore from backup
    if (existingDecks.length === 0 && existingQuestions.length === 0) {
      console.log('No existing data found, checking for backup...');
      const restored = await restoreBackupFromStorage();
      
      if (restored) {
        // Show user notification
        if (window.showToast) {
          window.showToast('데이터가 백업에서 복원되었습니다!', 'success');
        }
        return true;
      } else {
        // If no backup exists, load initial backend interview sample data
        console.log('No backup found, loading initial sample data...');
        const loaded = await loadInitialBackendInterviewData();
        
        if (loaded) {
          if (window.showToast) {
            window.showToast('백엔드 면접 샘플 데이터가 로드되었습니다!', 'success');
          }
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Failed to check and restore:', error);
    return false;
  }
}

// Load initial backend interview data
async function loadInitialBackendInterviewData() {
  try {
    // Import the loader functions dynamically to avoid circular dependencies
    const { loadBackendInterviewData, getBackendInterviewSampleData } = await import('./backend-interview-loader.js');
    const { addDeck, addQuestion } = await import('../modules/database.js');
    
    // Try to load backend interview data from markdown file
    let { questions: interviewQuestions, decks: interviewDecks } = await loadBackendInterviewData();
    
    // If loading fails, use fallback sample data
    if (interviewQuestions.length === 0) {
      console.log('Using fallback sample data for initial load');
      const fallbackData = getBackendInterviewSampleData();
      interviewQuestions = fallbackData.questions;
      interviewDecks = fallbackData.decks;
    }

    // Add decks first
    const deckIdMap = {};
    for (const deck of interviewDecks) {
      const newId = await addDeck(deck);
      deckIdMap[deck.id] = newId;
    }

    // Add questions
    for (const question of interviewQuestions) {
      const newQ = { ...question, id: undefined, deck: deckIdMap[question.deck] || null, created: new Date() };
      await addQuestion(newQ);
    }

    console.log(`Loaded ${interviewQuestions.length} questions from ${interviewDecks.length} categories as initial data`);
    return true;
  } catch (error) {
    console.error('Failed to load initial backend interview data:', error);
    return false;
  }
}

// Manual export for user download
export async function downloadBackup() {
  try {
    const data = await exportAllData();
    const backupData = JSON.stringify(data, null, 2);
    
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cs-study-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    if (window.showToast) {
      window.showToast('백업 파일이 다운로드되었습니다!', 'success');
    }
  } catch (error) {
    console.error('Failed to download backup:', error);
    if (window.showToast) {
      window.showToast('백업 다운로드에 실패했습니다.', 'error');
    }
  }
}

// Manual import from user file
export async function uploadBackup(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    await importAllData(data);
    
    if (window.showToast) {
      window.showToast('백업 파일에서 데이터를 가져왔습니다!', 'success');
    }
    
    // Refresh the UI
    if (window.location.reload) {
      window.location.reload();
    }
  } catch (error) {
    console.error('Failed to upload backup:', error);
    if (window.showToast) {
      window.showToast('백업 파일 가져오기에 실패했습니다.', 'error');
    }
  }
}