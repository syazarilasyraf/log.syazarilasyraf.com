// popup.js - Extension popup UI logic

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[ChatLog Popup] Loaded');

  // Elements
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const convCount = document.getElementById('convCount');
  const msgCount = document.getElementById('msgCount');
  const exportBtn = document.getElementById('exportBtn');
  const openAppBtn = document.getElementById('openAppBtn');
  const clearBtn = document.getElementById('clearBtn');
  const autoSaveToggle = document.getElementById('autoSaveToggle');
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');

  // Load stats
  async function loadStats() {
    try {
      const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      convCount.textContent = stats.conversationCount || 0;
      msgCount.textContent = stats.totalMessages || 0;
      
      // Update status
      if (stats.conversationCount > 0) {
        statusIndicator.classList.remove('inactive');
        statusText.textContent = 'Auto-saving active';
      } else {
        statusText.textContent = 'Open ChatGPT to start saving';
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
      showError('Failed to load stats');
    }
  }

  // Show error message
  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 3000);
  }

  // Show success message
  function showSuccess(message) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 3000);
  }

  // Export button
  exportBtn.addEventListener('click', async () => {
    try {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Exporting...';

      const result = await chrome.runtime.sendMessage({ type: 'EXPORT_ALL' });
      
      if (result.success) {
        // Download the file using fallback method
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Try chrome.downloads first, fallback to anchor element
        try {
          if (chrome.downloads && chrome.downloads.download) {
            await chrome.downloads.download({
              url: url,
              filename: `chatlog-extension-${new Date().toISOString().split('T')[0]}.json`,
              saveAs: true
            });
          } else {
            throw new Error('downloads API not available');
          }
        } catch (downloadErr) {
          // Fallback: use anchor element
          const a = document.createElement('a');
          a.href = url;
          a.download = `chatlog-extension-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        
        showSuccess(`Exported ${result.count} conversations!`);
      } else {
        showError(result.error || 'Export failed');
      }
    } catch (error) {
      showError('Export failed: ' + error.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = '📤 Export to ChatLog App';
    }
  });

  // Open app button
  openAppBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://log.syazarilasyraf.com' });
  });

  // Clear data button
  clearBtn.addEventListener('click', async () => {
    if (confirm('Are you sure? This will delete all saved conversations from the extension.')) {
      try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_ALL' });
        showSuccess('All data cleared');
        loadStats();
      } catch (error) {
        showError('Failed to clear data');
      }
    }
  });

  // Auto-save toggle
  autoSaveToggle.addEventListener('click', async () => {
    const isActive = autoSaveToggle.classList.contains('active');
    autoSaveToggle.classList.toggle('active');
    
    try {
      const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      settings.autoSave = !isActive;
      await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  });

  // Load settings
  async function loadSettings() {
    try {
      const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (settings.autoSave) {
        autoSaveToggle.classList.add('active');
      } else {
        autoSaveToggle.classList.remove('active');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // Check if we're on ChatGPT
  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('chat.openai.com') || tab?.url?.includes('chatgpt.com')) {
        statusIndicator.classList.remove('inactive');
        if (convCount.textContent === '0') {
          statusText.textContent = 'ChatGPT detected - start chatting!';
        }
      }
    } catch (error) {
      console.error('Failed to check tab:', error);
    }
  }

  // Initialize
  await loadStats();
  await loadSettings();
  await checkCurrentTab();
});
