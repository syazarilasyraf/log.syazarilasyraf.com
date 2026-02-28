// background.js - Service worker for ChatLog extension

console.log('[ChatLog Background] Service worker started');

// Extension state
const state = {
  conversationsSaved: 0,
  lastSave: null,
  autoExport: false
};

// Initialize
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ChatLog] Extension installed:', details.reason);
  
  // Set default settings
  chrome.storage.local.set({
    settings: {
      autoSave: true,
      saveInterval: 5000,
      exportFormat: 'json'
    }
  });
  
  // Show welcome notification
  if (details.reason === 'install') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'ChatLog Extension Installed',
      message: 'Open ChatGPT and start chatting. Conversations will auto-save!'
    });
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ChatLog Background] Received message:', request.type);

  switch (request.type) {
    case 'CONVERSATION_SAVED':
      state.conversationsSaved++;
      state.lastSave = new Date().toISOString();
      updateBadge();
      sendResponse({ success: true });
      break;

    case 'GET_STATS':
      getStats().then(stats => sendResponse(stats));
      return true; // Async response

    case 'EXPORT_ALL':
      exportAllConversations().then(result => sendResponse(result));
      return true;

    case 'CLEAR_ALL':
      clearAllData().then(() => sendResponse({ success: true }));
      return true;

    case 'GET_SETTINGS':
      chrome.storage.local.get(['settings']).then(result => {
        sendResponse(result.settings || {});
      });
      return true;

    case 'UPDATE_SETTINGS':
      chrome.storage.local.set({ settings: request.settings }).then(() => {
        sendResponse({ success: true });
      });
      return true;
  }
});

// Update extension badge with conversation count
async function updateBadge() {
  const result = await chrome.storage.local.get(['chatlog_conversations']);
  const conversations = result.chatlog_conversations || {};
  const count = Object.keys(conversations).length;
  
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

// Get statistics
async function getStats() {
  const result = await chrome.storage.local.get(['chatlog_conversations']);
  const conversations = result.chatlog_conversations || {};
  const convArray = Object.values(conversations);
  
  const totalMessages = convArray.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
  
  return {
    conversationCount: convArray.length,
    totalMessages,
    lastSave: state.lastSave,
    storageUsed: JSON.stringify(conversations).length
  };
}

// Export all conversations
async function exportAllConversations() {
  const result = await chrome.storage.local.get(['chatlog_conversations']);
  const conversations = result.chatlog_conversations || {};
  
  if (Object.keys(conversations).length === 0) {
    return { success: false, error: 'No conversations to export' };
  }

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: 'ChatLog Extension',
    chats: Object.values(conversations)
  };

  return { 
    success: true, 
    data: exportData,
    count: Object.keys(conversations).length
  };
}

// Clear all data
async function clearAllData() {
  await chrome.storage.local.remove(['chatlog_conversations']);
  state.conversationsSaved = 0;
  state.lastSave = null;
  updateBadge();
}

// Periodic cleanup (remove old conversations if storage is full)
chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldConversations();
  }
});

// Set up periodic cleanup
if (chrome.alarms) {
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
}

async function cleanupOldConversations() {
  const result = await chrome.storage.local.get(['chatlog_conversations']);
  const conversations = result.chatlog_conversations || {};
  
  // Check storage usage
  const size = JSON.stringify(conversations).length;
  const maxSize = 5 * 1024 * 1024; // 5MB limit
  
  if (size > maxSize * 0.9) {
    console.log('[ChatLog] Storage nearly full, cleaning up old conversations');
    
    // Sort by date and keep only recent 100
    const sorted = Object.entries(conversations)
      .sort((a, b) => new Date(b[1].updatedAt) - new Date(a[1].updatedAt));
    
    const toKeep = sorted.slice(0, 100);
    const newConversations = Object.fromEntries(toKeep);
    
    await chrome.storage.local.set({ chatlog_conversations: newConversations });
    updateBadge();
  }
}

// Initialize badge on startup
updateBadge();

console.log('[ChatLog Background] Ready');
