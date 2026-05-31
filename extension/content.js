// content.js - Extracts ChatGPT conversation data

(function() {
  'use strict';

  // Only run on ChatGPT domains to prevent data extraction from unrelated sites
  const ALLOWED_HOSTS = ['chat.openai.com', 'chatgpt.com'];
  if (!ALLOWED_HOSTS.some(host => window.location.hostname.endsWith(host))) {
    return;
  }

  console.log('[ChatLog] Content script loaded');

  // Configuration
  const CONFIG = {
    debounceMs: 2000, // Wait 2 seconds after changes before saving
    minMessages: 2,   // Only save if at least 2 messages exist
    debug: true
  };

  let lastSavedData = null;
  let saveTimeout = null;
  let isObserving = false;

  // Debug logging
  function log(...args) {
    if (CONFIG.debug) {
      console.log('[ChatLog]', ...args);
    }
  }

  // Get conversation ID from URL
  function getConversationId() {
    const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  // Get conversation title
  function getConversationTitle() {
    // Try multiple selectors since ChatGPT changes their DOM
    const selectors = [
      '[data-testid="conversation-turn-1"]',
      '.conversation-title',
      'title',
      'h1',
      '[class*="title"]'
    ];

    // First message often contains the title/prompt
    const firstMessage = document.querySelector('[data-testid*="conversation-turn"]');
    if (firstMessage) {
      const text = firstMessage.textContent?.substring(0, 100);
      if (text) return text;
    }

    // Fallback to document title
    const title = document.title;
    if (title && title !== 'ChatGPT') {
      return title.replace(' - ChatGPT', '').substring(0, 100);
    }

    return 'Untitled Chat';
  }

  // Extract messages from the conversation
  function extractMessages() {
    const messages = [];
    
    // ChatGPT uses data-testid attributes
    const messageElements = document.querySelectorAll('[data-testid*="conversation-turn"]');
    
    messageElements.forEach((el, index) => {
      // Determine role (user or assistant)
      const isUser = el.querySelector('[data-message-author-role="user"]') !== null ||
                     el.textContent.includes('You said:') ||
                     el.querySelector('img[alt="User"]') !== null;
      
      const role = isUser ? 'user' : 'assistant';
      
      // Extract content - try multiple selectors
      let content = '';
      const contentSelectors = [
        '.markdown',
        '[data-message-content]',
        '.message-content',
        '.text-message',
        'div[class*="content"]',
        'div[class*="message"]'
      ];
      
      for (const selector of contentSelectors) {
        const contentEl = el.querySelector(selector);
        if (contentEl && contentEl.textContent.trim()) {
          content = contentEl.textContent.trim();
          break;
        }
      }
      
      // Fallback to element text if no content found
      if (!content) {
        content = el.textContent?.substring(0, 500) || '';
      }
      
      // Extract timestamp if available
      let timestamp = new Date().toISOString();
      const timeEl = el.querySelector('time');
      if (timeEl) {
        const timeAttr = timeEl.getAttribute('datetime');
        if (timeAttr) timestamp = timeAttr;
      }
      
      if (content) {
        messages.push({
          role,
          content,
          createdAt: timestamp
        });
      }
    });

    return messages;
  }

  // Extract full conversation data
  function extractConversation() {
    const id = getConversationId();
    if (!id) {
      log('No conversation ID found');
      return null;
    }

    const messages = extractMessages();
    if (messages.length < CONFIG.minMessages) {
      log('Not enough messages:', messages.length);
      return null;
    }

    const title = getConversationTitle();
    
    return {
      id,
      title,
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: window.location.href
    };
  }

  // Save conversation to extension storage
  async function saveConversation() {
    const data = extractConversation();
    if (!data) return;

    // Check if data changed
    const dataHash = JSON.stringify(data.messages.map(m => m.content));
    if (lastSavedData === dataHash) {
      log('No changes detected, skipping save');
      return;
    }

    try {
      // Get existing conversations
      const result = await chrome.storage.local.get(['chatlog_conversations']);
      const conversations = result.chatlog_conversations || {};
      
      // Update this conversation
      const existing = conversations[data.id];
      if (existing) {
        // Merge messages, keeping newest
        const messageMap = new Map();
        [...existing.messages, ...data.messages].forEach(m => {
          messageMap.set(m.content.substring(0, 100), m);
        });
        data.messages = Array.from(messageMap.values());
        data.createdAt = existing.createdAt; // Keep original creation time
      }
      
      conversations[data.id] = data;
      
      // Save back
      await chrome.storage.local.set({ chatlog_conversations: conversations });
      lastSavedData = dataHash;
      
      log('Saved conversation:', data.title, `(${data.messages.length} messages)`);
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'CONVERSATION_SAVED',
        data: { id: data.id, title: data.title, messageCount: data.messages.length }
      });
      
    } catch (error) {
      console.error('[ChatLog] Save failed:', error);
    }
  }

  // Debounced save
  function debouncedSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(saveConversation, CONFIG.debounceMs);
  }

  // Set up mutation observer
  function setupObserver() {
    if (isObserving) return;
    
    const targetNode = document.body;
    if (!targetNode) {
      setTimeout(setupObserver, 1000);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      // Check if mutations contain conversation changes
      const hasConversationChanges = mutations.some(m => {
        return m.target && (
          m.target.getAttribute?.('data-testid')?.includes('conversation') ||
          m.target.querySelector?.('[data-testid*="conversation-turn"]')
        );
      });

      if (hasConversationChanges) {
        debouncedSave();
      }
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid']
    });

    isObserving = true;
    log('Mutation observer started');
    
    // Initial save
    setTimeout(saveConversation, 3000);
  }

  // Handle messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CURRENT_CONVERSATION') {
      const data = extractConversation();
      sendResponse({ data });
    }
    else if (request.type === 'EXPORT_TO_APP') {
      exportToApp();
      sendResponse({ success: true });
    }
    return true;
  });

  // Export to main ChatLog app
  async function exportToApp() {
    const result = await chrome.storage.local.get(['chatlog_conversations']);
    const conversations = Object.values(result.chatlog_conversations || {});
    
    if (conversations.length === 0) {
      alert('No conversations saved yet. Chat with ChatGPT first!');
      return;
    }

    // Convert to ChatLog format
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'ChatLog Extension',
      chats: conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        messages: conv.messages,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))
    };

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatlog-extension-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    log('Exported', conversations.length, 'conversations');
  }

  // Initialize
  function init() {
    log('Initializing...');
    
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupObserver);
    } else {
      setupObserver();
    }
    
    // Also set up on URL changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        lastSavedData = null;
        setTimeout(saveConversation, 2000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Start
  init();

})();
