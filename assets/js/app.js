// app.js - Main application entry point

import {
  getStoredChats,
  saveChatsToDB,
  clearChatsInDB,
  getPinnedChats,
  savePinnedChats,
  migrateFromLocalStorage,
  migrateTagsToChatIds,
  exportAllData,
  importFromBackup
} from './storage.js';

import { parseJSONChats, mergeChats } from './parser.js';
import { VirtualList } from './virtual-list.js';
import { 
  getChatTags, 
  getAllTags,
  addTag, 
  removeTag, 
  getUniqueTags, 
  searchByTag
} from './tags.js';
import { calculateStats, formatStatsHTML } from './stats.js';
import { 
  isSyncConfigured, 
  configureSync, 
  clearSyncConfig,
  syncToCloud, 
  syncFromCloud, 
  getSyncStatus 
} from './sync.js';
import {
  hasApiKey,
  setApiKey,
  getApiKey,
  clearApiKey,
  validateApiKey,
  getTagPrompt,
  setTagPrompt,
  generateTags,
  generateSummary,
  estimateTagCost
} from './ai.js';
import {
  DURATION_PRESETS,
  getBatchPrompt,
  setBatchPrompt,
  getSinglePrompt,
  setSinglePrompt,
  getConversationsForDuration,
  generateBatchSummary,
  generateSingleSummary,
  exportSummaryAsMarkdown as exportFlexSummary,
  copySummaryToClipboard as copyFlexSummary,
  estimateCost as estimateSummaryCost
} from './summarizer.js';
import {
  getFilterState,
  saveFilterState,
  resetFilters,
  applyFilters,
  getAvailableTags,
  getFilterDescription,
  DEFAULT_FILTERS
} from './search-filters.js';
import {
  getUserMode,
  setUserMode,
  toggleUserMode,
  isFeatureVisible,
  getFeatureDescription,
  initializeUserMode,
  shouldPromptAdvanced,
  markAdvancedPromptSeen,
  MODES
} from './user-mode.js';
import {
  renderConversationCards,
  createEmptyStateCard,
  formatRelativeTime,
  getTagColor
} from './cards.js';
import {
  isMobile,
  initMobileNav,
  switchMobileTab
} from './mobile-nav.js';
import {
  fadeIn,
  slideInUp,
  createSpinner,
  createSkeleton,
  staggerAnimation,
  addRipple,
  initAnimations
} from './animations.js';

// ==================== STATE ====================
let folderViewEnabled = false;
let lastAiRequestTime = 0;
const AI_COOLDOWN_MS = 2000; // 2 second cooldown between AI requests

// ==================== DOM ELEMENTS ====================
const elements = {
  fileInput: () => document.getElementById('fileInput'),
  chatList: () => document.getElementById('chatList'),
  chatContainer: () => document.getElementById('chatContainer'),
  searchInput: () => document.getElementById('chatSearch'),
  searchResults: () => document.getElementById('searchResults'),
  searchContainer: () => document.getElementById('searchContainer'),
  sidebar: () => document.getElementById('sidebar'),
  burgerButton: () => document.getElementById('burgerButton'),
  blurOverlay: () => document.getElementById('search-float-blur')
};

// ==================== INITIALIZATION ====================
async function init() {
  console.log('Initializing ChatLog...');
  
  // Initialize user mode (Simple by default)
  const userMode = initializeUserMode();
  console.log(`User mode: ${userMode}`);
  
  // Run migration from localStorage if needed
  const migrated = await migrateFromLocalStorage();
  if (migrated) {
    console.log('Your conversations have been moved to secure local storage.');
  }
  
  // Migrate tags from index-based to chat ID-based format
  const chats = await getStoredChats();
  if (chats.length > 0) {
    await migrateTagsToChatIds(chats);
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Check if we should prompt about Advanced mode
  if (shouldPromptAdvanced()) {
    showAdvancedModePrompt();
  }
  
  // Initial render
  await renderChatList();
  updateModeUI();
  
  // Initialize mobile navigation if on mobile
  if (isMobile()) {
    initMobileNav();
  }
  
  // Initialize animations
  initAnimations();
  
  console.log('ChatLog ready.');
}

function updateModeUI() {
  const mode = getUserMode();
  
  // Set body attribute for CSS selectors
  document.body.setAttribute('data-mode', mode);
  
  // Update mode toggle button
  const btn = document.getElementById('modeToggle');
  if (btn) {
    btn.textContent = mode === MODES.SIMPLE ? 'Simple' : 'Advanced';
    btn.style.background = mode === MODES.SIMPLE ? 'var(--accent)' : '#2D5A4A';
  }
  
  // Update storage info
  const storageInfo = document.getElementById('storageInfo');
  if (storageInfo) {
    storageInfo.textContent = mode === MODES.SIMPLE 
      ? '🔒 Stored securely on your device'
      : '🔒 Local IndexedDB storage';
  }
  
  // Show/hide advanced elements - CSS handles visibility via body[data-mode]
  // Only update elements that need explicit state (like filterPanel)
  document.querySelectorAll('.advanced-only').forEach(el => {
    // Clear any previous inline display to let CSS take over
    if (el.id !== 'filterPanel') {
      el.style.display = '';
    }
  });
  
  // Update filter button visibility
  const filterBtn = document.getElementById('filterToggle');
  if (filterBtn) {
    filterBtn.style.display = mode === MODES.ADVANCED ? 'block' : 'none';
  }
}

window.toggleMode = function() {
  toggleUserMode();
  location.reload();
};

function showAdvancedModePrompt() {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; text-align: center;">
      <h3 style="margin-bottom: 1rem;">🎉 You've been using ChatLog for a while!</h3>
      <p style="color: #888; margin-bottom: 1.5rem;">
        Want to unlock more powerful features? Try Advanced mode for analytics, custom filters, and more.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button onclick="this.closest('.modal').remove(); markAdvancedPromptSeen();" class="delete-btn" style="padding: 0.5rem 1rem;">
          Keep it simple
        </button>
        <button onclick="this.closest('.modal').remove(); setUserMode('advanced'); location.reload();" class="upload-btn" style="padding: 0.5rem 1rem;">
          Try Advanced
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function setupEventListeners() {
  // File upload
  elements.fileInput()?.addEventListener('change', handleFileSelect);
  
  // Burger menu
  elements.burgerButton()?.addEventListener('click', () => {
    elements.sidebar()?.classList.toggle('open');
  });
  
  // Note: Bulk edit UI removed in redesign - functionality available in Actions menu
  
  // Folder view toggle - load saved preference
  const savedFolderView = localStorage.getItem('chatlog_folder_view');
  if (savedFolderView !== null) {
    folderViewEnabled = savedFolderView === 'true';
  }
  
  // Update button state
  const folderBtn = document.getElementById('folderViewToggle');
  if (folderBtn) {
    folderBtn.classList.toggle('active', folderViewEnabled);
    folderBtn.style.background = folderViewEnabled ? 'var(--accent)' : 'var(--bg)';
  }
  
  document.getElementById('folderViewToggle')?.addEventListener('click', () => {
    folderViewEnabled = !folderViewEnabled;
    localStorage.setItem('chatlog_folder_view', folderViewEnabled);
    
    // Update button visual state
    const btn = document.getElementById('folderViewToggle');
    if (btn) {
      btn.classList.toggle('active', folderViewEnabled);
      btn.style.background = folderViewEnabled ? 'var(--accent)' : 'var(--bg)';
    }
    
    renderChatList();
  });
  
  // Search
  setupSearch();
}

// ==================== FILE HANDLING ====================
async function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  let existingChats = await getStoredChats();
  let totalImported = 0;

  for (const file of files) {
    if (!file.name.endsWith('.json')) {
      alert(`Skipping ${file.name}: Only .json files are supported.`);
      continue;
    }

    // Check file size (warn if > 20MB)
    if (file.size > 20 * 1024 * 1024) {
      const proceed = confirm(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. Large files may take a moment to process. Continue?`);
      if (!proceed) continue;
    }

    try {
      const content = await readFileAsText(file);
      const newChats = parseJSONChats(content);
      
      if (newChats.length === 0) {
        alert(`No valid chats found in ${file.name}`);
        continue;
      }

      // Check if this looks like a backup file vs extension export
      const parsed = JSON.parse(content);
      const isFullBackup = parsed.version && parsed.chats && (parsed.pinnedIndices !== undefined || parsed.tags !== undefined);
      const isExtensionExport = parsed.source === 'ChatLog Extension';
      
      if (isFullBackup) {
        // Full backup with metadata - restore (replace)
        const count = await importFromBackup(file);
        totalImported += count;
        alert(`Restored ${count} chats from backup.`);
        // Update existingChats after restore
        existingChats = await getStoredChats();
      } else if (isExtensionExport) {
        // Extension export - merge with existing
        const merged = mergeChats(existingChats, newChats);
        await saveChatsToDB(merged);
        existingChats = merged; // Update for next iteration
        totalImported += newChats.length;
      } else {
        // Regular ChatGPT export - merge with existing
        const merged = mergeChats(existingChats, newChats);
        await saveChatsToDB(merged);
        existingChats = merged; // Update for next iteration
        totalImported += newChats.length;
      }
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      alert(`Error processing ${file.name}: ${err.message}`);
    }
  }

  if (totalImported > 0) {
    resetSearchIndex(); // Reset fuzzy search cache
    await renderChatList();
    alert(`Successfully imported ${totalImported} chat(s).`);
  }

  // Reset file input
  e.target.value = '';
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ==================== CHAT LIST RENDERING ====================
async function renderChatList(filterTag = null) {
  const chats = await getStoredChats();
  const mode = getUserMode();
  const chatListEl = elements.chatList();
  
  if (!chatListEl) return;
  
  // Show loading skeleton if empty
  if (chatListEl.children.length === 0) {
    chatListEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      chatListEl.appendChild(createSkeleton('card'));
    }
  }
  
  // Small delay for smooth transition
  await new Promise(r => setTimeout(r, 100));
  
  chatListEl.innerHTML = '';

  if (chats.length === 0) {
    // Use nice empty state card with animation
    const emptyCard = createEmptyStateCard('default');
    fadeIn(emptyCard);
    chatListEl.appendChild(emptyCard);
    return;
  }
  
  // Apply current filters if any are active (and no tag filter specified)
  let displayChats = chats;
  let displayIndices = chats.map((_, i) => i);
  
  // Check if we have active filters
  const hasActiveFilters = currentFilters && (
    currentFilters.datePreset !== 'all' ||
    currentFilters.messageRange !== 'any' ||
    currentFilters.tags.length > 0 ||
    currentFilters.hasCode ||
    currentFilters.hasLinks ||
    currentFilters.hasImages
  );
  
  if (hasActiveFilters && !filterTag) {
    // Apply filters
    const { results: filteredChats } = await applyFilters(chats, currentFilters, '');
    displayChats = filteredChats;
    // Get original indices for the filtered chats
    displayIndices = displayChats.map(c => chats.findIndex(orig => orig.id === c.id));
  } else if (filterTag) {
    const taggedIds = await searchByTag(filterTag);
    displayChats = chats.filter(c => taggedIds.includes(c.id));
    displayIndices = displayChats.map(c => chats.findIndex(orig => orig.id === c.id));
  }

  // Add tag filter bar
  const uniqueTags = await getUniqueTags();
  if (uniqueTags.length > 0) {
    const tagBar = document.createElement('div');
    tagBar.className = 'tag-filter-bar';
    tagBar.innerHTML = '<span style="color: #888; font-size: 0.85em;">Filter: </span>';
    
    // "All" button
    const allBtn = document.createElement('button');
    allBtn.className = 'tag-chip' + (!filterTag ? ' active' : '');
    allBtn.textContent = 'All';
    allBtn.onclick = () => renderChatList();
    tagBar.appendChild(allBtn);
    
    // Tag buttons
    uniqueTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-chip' + (filterTag === tag ? ' active' : '');
      btn.textContent = tag;
      btn.style.background = `${getTagColor(tag)}20`;
      btn.style.borderColor = `${getTagColor(tag)}40`;
      btn.style.color = getTagColor(tag);
      btn.onclick = () => renderChatList(tag);
      tagBar.appendChild(btn);
    });
    
    chatListEl.appendChild(tagBar);
  }

  // Use card-based layout for better UX
  await renderConversationCards(chatListEl, displayChats, {
    showTags: true,
    compact: mode === MODES.SIMPLE,
    folderView: folderViewEnabled
  });
  
  // Add click handlers to cards
  chatListEl.querySelectorAll('.conversation-card').forEach(card => {
    card.addEventListener('cardSelect', (e) => {
      selectChat(e.detail.index);
    });
  });
}

function groupChatsByDateWithTags(chats, originalIndices, pinnedIndices, allTags) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const sections = {
    pinned: [],
    today: [],
    yesterday: [],
    last7: [],
    last30: [],
    months: {},
    years: {}
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  chats.forEach((chat, displayIndex) => {
    const originalIndex = originalIndices[displayIndex];
    const rawDate = chat.createdAt || chat.date || chat.timestamp;
    const date = new Date(rawDate);
    if (isNaN(date)) return;

    const entry = createChatEntryElement(chat, originalIndex, allTags[chat.id] || []);

    if (pinnedIndices.has(originalIndex)) {
      sections.pinned.push(entry);
      return;
    }

    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const year = date.getFullYear();
    const monthName = monthNames[date.getMonth()];

    if (diffDays === 0) sections.today.push(entry);
    else if (diffDays === 1) sections.yesterday.push(entry);
    else if (diffDays <= 7) sections.last7.push(entry);
    else if (diffDays <= 30) sections.last30.push(entry);
    else if (year === currentYear) {
      if (!sections.months[monthName]) sections.months[monthName] = [];
      sections.months[monthName].push(entry);
    } else {
      if (!sections.years[year]) sections.years[year] = [];
      sections.years[year].push(entry);
    }
  });

  return sections;
}

function createChatEntryElement(chat, index, tags = []) {
  const entry = document.createElement('div');
  entry.className = 'chat-entry';
  entry.setAttribute('data-index', index);

  const tagsHtml = tags.length > 0 
    ? `<div class="entry-tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  entry.innerHTML = `
    <div class="chat-title">${escapeHtml(chat.title) || `Chat ${index + 1}`}</div>
    ${tagsHtml}
  `;
  entry.onclick = () => selectChat(index);

  return entry;
}

function selectChat(index) {
  document.querySelectorAll('.chat-entry').forEach(el => el.classList.remove('selected'));
  const entry = document.querySelector(`.chat-entry[data-index="${index}"]`);
  entry?.classList.add('selected');
  
  const container = elements.chatContainer();
  if (container) container.innerHTML = '';
  
  // Save current view state for back button
  saveViewState();
  
  displayChat(index);
}

// Save current view state (filters, etc.) for restoration
function saveViewState() {
  const state = {
    filters: currentFilters,
    hasActiveFilters: currentFilters && (
      currentFilters.datePreset !== 'all' ||
      currentFilters.messageRange !== 'any' ||
      currentFilters.tags.length > 0 ||
      currentFilters.hasCode ||
      currentFilters.hasLinks ||
      currentFilters.hasImages
    ),
    timestamp: Date.now()
  };
  sessionStorage.setItem('chatlog_view_state', JSON.stringify(state));
}

// Restore view state when going back to chat list
window.restoreViewState = async function() {
  const saved = sessionStorage.getItem('chatlog_view_state');
  if (saved) {
    const state = JSON.parse(saved);
    // Restore filters
    if (state.filters) {
      currentFilters = state.filters;
      // Update filter UI
      await populateFilterTags();
      loadFilterValues();
      updateActiveFiltersDisplay();
      // Re-render with filters
      await renderChatList();
      // Clear the saved state so we don't restore again accidentally
      sessionStorage.removeItem('chatlog_view_state');
      return;
    }
  }
  // Default: just render normal list
  await renderChatList();
};

function renderFlatView(container, sections) {
  const renderSection = (title, entries) => {
    if (!entries?.length) return;
    const section = document.createElement('div');
    section.className = 'chat-section';
    section.innerHTML = `<h3>${escapeHtml(title)}</h3>`;
    entries.forEach(entry => section.appendChild(entry));
    container.appendChild(section);
  };

  renderSection('📌 Pinned', sections.pinned);
  renderSection('Today', sections.today);
  renderSection('Yesterday', sections.yesterday);
  renderSection('Last 7 Days', sections.last7);
  renderSection('Last 30 Days', sections.last30);
  
  Object.entries(sections.months).forEach(([month, entries]) => renderSection(month, entries));
  Object.entries(sections.years).forEach(([year, entries]) => renderSection(year, entries));
}

function renderFolderView(container, sections) {
  const folderOrder = ['📌 Pinned', 'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'];
  const months = Object.keys(sections.months);
  const years = Object.keys(sections.years).sort((a, b) => b - a);

  const orderedKeys = [
    ...folderOrder.filter(k => sections[k.replace('📌 ', 'pinned').replace(' ', '').toLowerCase()]?.length),
    ...months,
    ...years
  ];

  const folderSections = {
    '📌 Pinned': sections.pinned,
    'Today': sections.today,
    'Yesterday': sections.yesterday,
    'Last 7 Days': sections.last7,
    'Last 30 Days': sections.last30,
    ...sections.months,
    ...sections.years
  };

  for (const label of orderedKeys) {
    const entries = folderSections[label];
    if (!entries?.length) continue;

    const folder = document.createElement('details');
    folder.className = 'vscode-folder';
    folder.open = false;
    
    const summary = document.createElement('summary');
    summary.className = 'vscode-folder-label';
    summary.textContent = label;
    folder.appendChild(summary);
    
    entries.forEach(entry => folder.appendChild(entry));
    container.appendChild(folder);
  }
}

// ==================== CHAT DISPLAY ====================
let currentVirtualList = null;
const VIRTUAL_SCROLL_THRESHOLD = 50; // Use virtual scrolling for 50+ messages

async function displayChat(index) {
  const chats = await getStoredChats();
  const chat = chats[index];
  const container = elements.chatContainer();
  
  if (!chat || !container) return;
  container.innerHTML = '';
  
  // Cleanup previous virtual list
  if (currentVirtualList) {
    currentVirtualList.destroy();
    currentVirtualList = null;
  }

  const metadata = {
    title: chat.title || `Chat ${index + 1}`,
    id: chat.id || `chat-${index}`,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages?.length || 0
  };

  // Build metadata section (always static)
  container.innerHTML = await buildMetadataHTML(metadata, chat.id, index);
  
  // Attach tag handlers
  attachTagHandlers(container, chat.id, index);

  // Messages section
  if (!chat.messages || chat.messages.length === 0) {
    container.innerHTML += '<p><em>No messages in this chat.</em></p>';
    return;
  }

  // For small chats: render normally
  // For large chats: use virtual scrolling
  if (chat.messages.length <= VIRTUAL_SCROLL_THRESHOLD) {
    renderMessagesStatic(container, chat.messages, index);
  } else {
    renderMessagesVirtual(container, chat.messages, index);
  }
}

function attachTagHandlers(container, chatId, chatIndex) {
  const tagEditor = container.querySelector('.tag-editor');
  if (!tagEditor) return;
  
  // Remove tag on click
  tagEditor.querySelectorAll('.tag.removable').forEach(tagEl => {
    tagEl.addEventListener('click', async () => {
      const tag = tagEl.dataset.tag;
      if (confirm(`Remove tag "${tag}"?`)) {
        await removeTag(chatId, tag);
        await displayChat(chatIndex);
        await renderChatList(); // Update sidebar
      }
    });
  });
  
  // Add tag on Enter
  const input = tagEditor.querySelector('.tag-input');
  if (input) {
    input.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const tag = input.value.trim();
        if (tag) {
          await addTag(chatId, tag);
          input.value = '';
          await displayChat(chatIndex);
          await renderChatList(); // Update sidebar
        }
      }
    });
    
    // Focus input when clicking the container
    tagEditor.addEventListener('click', (e) => {
      if (e.target === tagEditor || e.target.classList.contains('current-tags')) {
        input.focus();
      }
    });
  }
}

async function buildMetadataHTML(metadata, chatId, chatIndex) {
  const link = `https://chat.openai.com/c/${metadata.id}`;
  const created = new Date(metadata.createdAt).toLocaleString();
  const tags = await getChatTags(chatId);
  const aiEnabled = hasApiKey();

  return `
    <details open class="metadata-box">
      <summary>Metadata</summary>
      <pre><code>${escapeHtml(JSON.stringify(metadata, null, 2))}</code></pre>
    </details>
    <p><em>Chat started ${created}</em> · <a href="${link}" target="_blank" rel="noopener">Continue at ChatGPT</a></p>
    
    ${aiEnabled ? `
    <div style="margin-bottom: 1rem;">
      <button id="summarizeBtn" onclick="summarizeCurrentChat(${chatIndex})" class="ai-tag-btn" style="margin-right: 0.5rem;">
        📝 Summarize
      </button>
      <button id="autoTagBtn" onclick="autoTagChat('${chatId}')" class="ai-tag-btn">
        🏷️ Auto-Tag
      </button>
    </div>
    ` : ''}
    
    <div class="tag-editor" data-chat-index="${chatIndex}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="color: #888;">Tags:</span>
      </div>
      <div class="current-tags">
        ${tags.map(t => `<span class="tag removable" data-tag="${escapeHtml(t)}">${escapeHtml(t)} ×</span>`).join('')}
        <input type="text" class="tag-input" placeholder="+ Add tag" maxlength="20">
      </div>
    </div>
    <hr>
    <p style="color: #888; font-size: 0.9em;">
      ${metadata.messageCount} messages 
      ${metadata.messageCount > VIRTUAL_SCROLL_THRESHOLD ? '(virtual scrolling enabled)' : ''}
    </p>
  `;
}

function renderMessagesStatic(container, messages, chatIndex) {
  messages.forEach((msg, i) => {
    const msgEl = createMessageElement(msg, i, chatIndex);
    container.appendChild(msgEl);
  });
}

function renderMessagesVirtual(container, messages, chatIndex) {
  // Create virtual scroll container
  const virtualContainer = document.createElement('div');
  virtualContainer.className = 'virtual-scroll-container';
  virtualContainer.style.height = 'calc(100vh - 300px)'; // Fill remaining viewport
  container.appendChild(virtualContainer);

  currentVirtualList = new VirtualList(virtualContainer, {
    itemHeight: 120, // Estimated message height
    bufferSize: 5,
    renderFn: (msg, index) => createMessageElement(msg, index, chatIndex)
  });

  currentVirtualList.setItems(messages);
}

function createMessageElement(msg, index, chatIndex) {
  const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
  const speakerClass = msg.role === 'user' ? 'you' : 'chatgpt';
  const content = escapeHtml(msg.content).split('\n').map(line => `> ${line}`).join('\n');

  const details = document.createElement('details');
  details.className = `chat-message ${speakerClass}`;
  details.open = true;
  details.style.marginBottom = '1em';
  details.style.border = '1px solid #333';
  details.style.borderRadius = '6px';

  const summary = document.createElement('summary');
  summary.innerHTML = `
    <strong>${index + 1}. ${speaker}</strong>
    <button class="delete-msg-btn" data-msg-index="${index}" title="Delete message" 
            style="float: right; background: none; border: none; color: #ff6666; cursor: pointer;">×</button>
  `;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.style.padding = '0.5em';
  contentDiv.innerHTML = marked.parse(content);

  details.appendChild(summary);
  details.appendChild(contentDiv);

  // Attach delete handler
  const deleteBtn = details.querySelector('.delete-msg-btn');
  setupDeleteHandler(deleteBtn, chatIndex);

  return details;
}

function setupDeleteHandler(btn, chatIndex) {
  let confirmDelete = false;
  
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const msgIndex = parseInt(btn.dataset.msgIndex);

    if (!confirmDelete) {
      btn.textContent = 'Sure?';
      btn.style.color = 'orange';
      confirmDelete = true;
      setTimeout(() => {
        btn.textContent = '×';
        btn.style.color = '';
        confirmDelete = false;
      }, 3000);
    } else {
      await deleteMessage(chatIndex, msgIndex);
      // Re-render the chat to reflect changes
      await displayChat(chatIndex);
    }
  });
}

async function deleteMessage(chatIndex, msgIndex) {
  const chats = await getStoredChats();
  if (!chats[chatIndex]) return;
  
  chats[chatIndex].messages.splice(msgIndex, 1);
  await saveChatsToDB(chats);
  
  // Reset search index since content changed
  resetSearchIndex();
}

// ==================== SEARCH ====================
function setupSearch() {
  const searchInput = elements.searchInput();
  if (!searchInput) return;

  let debounceTimer;

  searchInput.addEventListener('focus', () => {
    if (window.innerWidth >= 768) {
      elements.searchContainer()?.classList.add('floating');
      elements.blurOverlay()?.classList.add('active');
    } else {
      elements.chatList().style.display = 'none';
    }
  });

  elements.blurOverlay()?.addEventListener('mousedown', () => {
    searchInput.blur();
    closeSearch();
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (!searchInput.value) closeSearch();
    }, 200);
  });

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
      elements.searchResults().innerHTML = '';
      if (window.innerWidth < 768) {
        elements.chatList().style.display = '';
      }
      return;
    }

    debounceTimer = setTimeout(() => performSearch(query), 300);
  });
}

function closeSearch() {
  elements.searchContainer()?.classList.remove('floating');
  elements.blurOverlay()?.classList.remove('active');
  elements.searchResults().innerHTML = '';
}

// Fuse.js instance for fuzzy search
let fuseInstance = null;

async function getFuseInstance() {
  if (fuseInstance) return fuseInstance;
  
  const chats = await getStoredChats();
  const fuseData = chats.map((chat, index) => ({
    index,
    title: chat.title || '',
    // Flatten messages for content search
    content: chat.messages?.map(m => m.content).join(' ') || '',
    chat
  }));

  fuseInstance = new Fuse(fuseData, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'content', weight: 0.4 }
    ],
    threshold: 0.4, // Lower = more strict, higher = more fuzzy
    includeScore: true,
    includeMatches: true
  });

  return fuseInstance;
}

// Reset fuse when data changes
export function resetSearchIndex() {
  fuseInstance = null;
}

async function performSearch(query) {
  // Apply filters first
  const chats = await getStoredChats();
  const { results: filteredChats, activeFilters } = await applyFilters(chats, currentFilters, query);
  
  // If we have filters but no text query, show filtered results directly
  if (activeFilters.length > 0 && !query.trim()) {
    renderFilteredResults(filteredChats, activeFilters);
    return;
  }
  
  // For text search, use Fuse on filtered results
  if (query.trim()) {
    // Build temporary fuse instance from filtered results
    const fuseData = filteredChats.map((chat, index) => ({
      index: chats.findIndex(c => c.id === chat.id), // Get original index
      title: chat.title || '',
      content: chat.messages?.map(m => m.content).join(' ') || '',
      chat
    }));

    const tempFuse = new Fuse(fuseData, {
      keys: [
        { name: 'title', weight: 0.6 },
        { name: 'content', weight: 0.4 }
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true
    });

    const results = tempFuse.search(query);
    
    const byTitle = [];
    const byContent = [];

    results.forEach(result => {
      const match = result.matches?.[0];
      if (match?.key === 'title') {
        byTitle.push({ 
          chat: result.item.chat, 
          index: result.item.index,
          matches: result.matches 
        });
      } else {
        byContent.push({ 
          chat: result.item.chat, 
          index: result.item.index, 
          query,
          matches: result.matches 
        });
      }
    });

    renderSearchResults(byTitle, byContent, query, activeFilters);
  } else {
    // No query, no filters - clear results
    const resultsContainer = elements.searchResults();
    if (resultsContainer) resultsContainer.innerHTML = '';
  }
}

function renderFilteredResults(chats, activeFilters) {
  const container = elements.searchResults();
  if (!container) return;
  
  container.innerHTML = '';
  
  if (chats.length === 0) {
    container.innerHTML = `
      <div style="padding: 1rem; color: #888;">
        <p>No conversations match your filters.</p>
        <p style="font-size: 0.85em; margin-top: 0.5rem;">
          Active: ${activeFilters.join(', ')}
        </p>
      </div>
    `;
    return;
  }
  
  const header = document.createElement('div');
  header.style.cssText = 'padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); color: #888; font-size: 0.9em;';
  header.innerHTML = `
    <strong>${chats.length} result${chats.length !== 1 ? 's' : ''}</strong>
    <span style="margin-left: 0.5rem; font-size: 0.85em;">(${activeFilters.join(', ')})</span>
  `;
  container.appendChild(header);
  
  chats.forEach((chat, displayIndex) => {
    // Find original index
    getStoredChats().then(allChats => {
      const originalIndex = allChats.findIndex(c => c.id === chat.id);
      const div = createSearchResultItem({ chat, index: originalIndex });
      container.appendChild(div);
    });
  });
}

function createSearchResultItem({ chat, index }) {
  const div = document.createElement('div');
  div.className = 'search-result';
  div.style.cssText = 'padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid var(--border);';
  
  const title = document.createElement('div');
  title.className = 'result-title';
  title.style.cssText = 'font-weight: 500; margin-bottom: 0.25rem;';
  title.textContent = chat.title || `Chat ${index + 1}`;
  div.appendChild(title);
  
  const meta = document.createElement('div');
  meta.style.cssText = 'font-size: 0.85em; color: #888;';
  const date = new Date(chat.createdAt).toLocaleDateString();
  const msgCount = chat.messages?.length || 0;
  meta.textContent = `${date} · ${msgCount} messages`;
  div.appendChild(meta);
  
  div.addEventListener('click', () => {
    selectChat(index);
    const searchInput = elements.searchInput();
    if (searchInput) searchInput.value = '';
    const resultsContainer = elements.searchResults();
    if (resultsContainer) resultsContainer.innerHTML = '';
    closeSearch();
  });
  
  return div;
}

function highlightMatches(text, matches, key) {
  if (!matches) return escapeHtml(text);
  
  const match = matches.find(m => m.key === key);
  if (!match) return escapeHtml(text);

  let result = '';
  let lastIndex = 0;
  
  // Sort indices by start position
  const indices = match.indices.sort((a, b) => a[0] - b[0]);
  
  indices.forEach(([start, end]) => {
    result += escapeHtml(text.slice(lastIndex, start));
    result += `<mark>${escapeHtml(text.slice(start, end + 1))}</mark>`;
    lastIndex = end + 1;
  });
  
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function renderSearchResults(byTitle, byContent, query, activeFilters = []) {
  const container = elements.searchResults();
  container.innerHTML = '';

  if (byTitle.length === 0 && byContent.length === 0) {
    const filterInfo = activeFilters.length > 0 
      ? `<p style="font-size: 0.85em; margin-top: 0.5rem; color: #888;">Active filters: ${activeFilters.join(', ')}</p>`
      : '';
    container.innerHTML = `
      <div style="padding: 1rem;">
        <p>No results found.</p>
        ${filterInfo}
      </div>
    `;
    return;
  }

  // Show filter info header
  if (activeFilters.length > 0) {
    const filterHeader = document.createElement('div');
    filterHeader.style.cssText = 'padding: 0.5rem 1rem; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 0.85em; color: #888;';
    filterHeader.innerHTML = `Filters: ${activeFilters.join(', ')}`;
    container.appendChild(filterHeader);
  }

  const totalResults = byTitle.length + byContent.length;
  const resultsHeader = document.createElement('div');
  resultsHeader.style.cssText = 'padding: 0.5rem 1rem; border-bottom: 1px solid var(--border);';
  resultsHeader.innerHTML = `<strong>${totalResults} result${totalResults !== 1 ? 's' : ''}</strong>`;
  container.appendChild(resultsHeader);

  const createResult = ({ chat, index, matches }) => {
    const div = document.createElement('div');
    div.className = 'search-result';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'result-title';
    
    // Highlight title matches
    const titleMatch = matches?.find(m => m.key === 'title');
    if (titleMatch) {
      titleDiv.innerHTML = highlightMatches(chat.title || `Chat ${index + 1}`, matches, 'title');
    } else {
      titleDiv.textContent = chat.title || `Chat ${index + 1}`;
    }
    div.appendChild(titleDiv);

    // Show content snippet for content matches
    const contentMatch = matches?.find(m => m.key === 'content');
    if (contentMatch) {
      const snip = document.createElement('div');
      snip.className = 'result-snippet';
      
      // Get the first matched content snippet
      const [start, end] = contentMatch.indices[0];
      const content = chat.messages?.map(m => m.content).join(' ') || '';
      const snippetStart = Math.max(0, start - 40);
      const snippetEnd = Math.min(content.length, end + 40);
      let snippetText = content.slice(snippetStart, snippetEnd);
      if (snippetStart > 0) snippetText = '…' + snippetText;
      if (snippetEnd < content.length) snippetText += '…';
      
      snip.innerHTML = highlightMatches(snippetText, [{
        key: 'content',
        indices: [[start - snippetStart, end - snippetStart]]
      }], 'content');
      div.appendChild(snip);
    }

    div.addEventListener('click', () => {
      selectChat(index);
      closeSearch();
      elements.searchInput().value = '';
      if (window.innerWidth < 768) {
        elements.chatList().style.display = '';
      }
    });

    return div;
  };

  const addSection = (label, items) => {
    if (!items.length) return;
    const header = document.createElement('h3');
    header.textContent = label;
    header.className = 'search-section-title';
    container.appendChild(header);
    items.forEach(item => container.appendChild(createResult(item)));
  };

  addSection('Matches in Title', byTitle);
  addSection('Matches in Messages', byContent);
}

// ==================== GLOBAL ACTIONS ====================
window.showAISettings = async function() {
  const container = elements.chatContainer();
  if (!container) return;
  
  const hasKey = hasApiKey();
  const apiKey = getApiKey();
  const maskedKey = apiKey ? `${apiKey.substring(0, 10)}...${apiKey.slice(-4)}` : '';
  
  container.innerHTML = `
    <div style="max-width: 700px; margin: 0 auto;">
      <h2>🤖 AI Features</h2>
      
      <!-- API Key Section -->
      <div class="ai-section">
        <h3>OpenAI API Key</h3>
        <p style="margin-bottom: 1rem; color: #888;">
          Bring Your Own Key (BYOK). Your API key is stored locally in your browser only.
          <br><a href="https://platform.openai.com/api-keys" target="_blank">Get your API key →</a>
        </p>
        
        ${hasKey ? `
          <div style="background: rgba(76, 175, 80, 0.1); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
            <p style="color: #4CAF50; margin: 0;">✅ API key configured</p>
            <p style="color: #888; font-size: 0.9em; margin: 0.5rem 0 0 0;">${maskedKey}</p>
          </div>
          <button onclick="removeApiKey()" class="delete-btn">Remove API Key</button>
        ` : `
          <input type="password" id="openaiKey" placeholder="sk-..." 
                 style="width: 100%; padding: 0.75rem; margin-bottom: 0.5rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px;">
          <p style="color: #888; font-size: 0.85em; margin-bottom: 1rem;">
            Key format: sk-xxxxxxxxxxxxxxxxxxxxxxxx
          </p>
          <button onclick="saveApiKey()" class="upload-btn">Save API Key</button>
          <div id="aiResult" style="margin-top: 1rem;"></div>
        `}
      </div>
      
      ${hasKey ? `
      <!-- Flexible Summary Section -->
      <div class="ai-section">
        <h3>📅 Generate Summary</h3>
        <p style="color: #888; margin-bottom: 1rem;">
          Summarize conversations from any time period. All processing happens client-side.
        </p>
        
        <div style="margin-bottom: 1rem;">
          <label style="display: block; color: #888; margin-bottom: 0.5rem;">Select Period:</label>
          <select id="summaryPeriod" onchange="updateSummaryPreview()" 
                  style="width: 100%; padding: 0.75rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px;">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7" selected>Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="all">All Time</option>
            <option value="custom">Custom Range...</option>
          </select>
        </div>
        
        <div id="customDateRange" style="display: none; margin-bottom: 1rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div>
              <label style="display: block; color: #888; font-size: 0.85em; margin-bottom: 0.25rem;">Start Date</label>
              <input type="date" id="customStartDate" style="width: 100%; padding: 0.5rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px;">
            </div>
            <div>
              <label style="display: block; color: #888; font-size: 0.85em; margin-bottom: 0.25rem;">End Date</label>
              <input type="date" id="customEndDate" style="width: 100%; padding: 0.5rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px;">
            </div>
          </div>
        </div>
        
        <div id="summaryPreview" style="background: var(--bg); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
          Loading...
        </div>
        
        <button onclick="generateFlexibleSummary()" class="upload-btn" style="margin-bottom: 1rem;">
          📝 Generate Summary
        </button>
        
        <details style="margin-top: 1rem;">
          <summary style="cursor: pointer; color: #888;">Customize Batch Summary Prompt</summary>
          <div style="margin-top: 1rem;">
            <textarea id="batchPrompt" rows="8" 
                      style="width: 100%; padding: 0.75rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.9em;"
                      placeholder="Enter your custom batch summary prompt...">${escapeHtml(getBatchPrompt())}</textarea>
            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
              <button onclick="saveBatchPrompt()" class="ai-tag-btn">Save Prompt</button>
              <button onclick="resetBatchPrompt()" class="delete-btn" style="padding: 4px 12px; font-size: 0.85em;">Reset</button>
            </div>
            <p style="color: #888; font-size: 0.85em; margin-top: 0.5rem;">
              Variables: {{duration}}, {{conversations}}, {{chatCount}}, {{messageCount}}, {{dateRange}}, {{mostActiveDay}}
            </p>
          </div>
        </details>
      </div>
      
      <!-- Custom Prompts Section -->
      <div class="ai-section">
        <h3>🎨 Custom Prompts</h3>
        
        <details style="margin-bottom: 1rem;">
          <summary style="cursor: pointer; color: #888;">Edit Tagging Prompt</summary>
          <div style="margin-top: 1rem;">
            <textarea id="tagPrompt" rows="6" 
                      style="width: 100%; padding: 0.75rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.9em;"
                      placeholder="Enter your custom tagging prompt...">${escapeHtml(getTagPrompt())}</textarea>
            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
              <button onclick="saveTagPrompt()" class="ai-tag-btn">Save</button>
              <button onclick="resetTagPrompt()" class="delete-btn" style="padding: 4px 12px; font-size: 0.85em;">Reset</button>
            </div>
            <p style="color: #888; font-size: 0.85em; margin-top: 0.5rem;">Variables: {{title}}, {{messages}}, {{existingTags}}</p>
          </div>
        </details>
        
        <details>
          <summary style="cursor: pointer; color: #888;">Edit Single Chat Summary Prompt</summary>
          <div style="margin-top: 1rem;">
            <textarea id="singlePrompt" rows="6" 
                      style="width: 100%; padding: 0.75rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px; font-family: monospace; font-size: 0.9em;"
                      placeholder="Enter your custom single chat summary prompt...">${escapeHtml(getSinglePrompt())}</textarea>
            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
              <button onclick="saveSinglePrompt()" class="ai-tag-btn">Save</button>
              <button onclick="resetSinglePrompt()" class="delete-btn" style="padding: 4px 12px; font-size: 0.85em;">Reset</button>
            </div>
            <p style="color: #888; font-size: 0.85em; margin-top: 0.5rem;">Variables: {{title}}, {{date}}, {{messageCount}}, {{messages}}</p>
          </div>
        </details>
      </div>
      ` : ''}
      
      <!-- Features Info -->
      <div class="ai-section">
        <h3>Features</h3>
        <ul style="line-height: 1.8; margin: 0; padding-left: 1.5rem;">
          <li><strong>Auto-tagging:</strong> AI suggests relevant tags for your chats</li>
          <li><strong>Single Summary:</strong> Summarize any individual conversation</li>
          <li><strong>Batch Summary:</strong> Summarize any time period (today, week, month, custom)</li>
          <li><strong>Custom Prompts:</strong> Fully customizable AI prompts</li>
        </ul>
        
        <div style="background: var(--bg); padding: 1rem; border-radius: 6px; margin-top: 1rem;">
          <p style="margin: 0; color: #888; font-size: 0.9em;">
            <strong>Cost estimates:</strong><br>
            • Auto-tagging: ~$0.001 per chat<br>
            • Single summary: ~$0.003 per conversation<br>
            • Batch summary: ~$0.01-0.05 depending on period<br>
            You only pay OpenAI for actual usage.
          </p>
        </div>
      </div>
      
      <button onclick="restoreViewState()" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
    </div>
  `;
  
  // Load preview if key exists
  if (hasKey) {
    updateSummaryPreview();
  }
};

window.saveApiKey = async function() {
  const keyInput = document.getElementById('openaiKey');
  const resultDiv = document.getElementById('aiResult');
  const key = keyInput.value.trim();
  
  if (!key || !key.startsWith('sk-')) {
    resultDiv.innerHTML = '<p style="color: #ff6666;">Please enter a valid OpenAI API key (starts with sk-)</p>';
    return;
  }
  
  resultDiv.innerHTML = '<p>Validating API key...</p>';
  
  try {
    const validation = await validateApiKey(key);
    if (validation.valid) {
      setApiKey(key);
      resultDiv.innerHTML = '<p style="color: #4CAF50;">✅ API key validated and saved!</p>';
      setTimeout(() => showAISettings(), 1000);
    } else {
      resultDiv.innerHTML = `<p style="color: #ff6666;">❌ ${validation.error}</p>`;
    }
  } catch (error) {
    resultDiv.innerHTML = `<p style="color: #ff6666;">❌ Error: ${error.message}</p>`;
  }
};

window.removeApiKey = function() {
  if (confirm('Remove your OpenAI API key?')) {
    clearApiKey();
    showAISettings();
  }
};

window.saveTagPrompt = function() {
  const prompt = document.getElementById('tagPrompt').value;
  setTagPrompt(prompt);
  alert('Tagging prompt saved!');
};

window.resetTagPrompt = function() {
  if (confirm('Reset tagging prompt to default?')) {
    localStorage.removeItem('ai_tag_prompt');
    showAISettings();
  }
};

// Flexible Summary UI Functions
window.updateSummaryPreview = async function() {
  const period = document.getElementById('summaryPeriod').value;
  const customDateDiv = document.getElementById('customDateRange');
  const previewDiv = document.getElementById('summaryPreview');
  
  // Show/hide custom date range
  if (period === 'custom') {
    customDateDiv.style.display = 'grid';
    previewDiv.innerHTML = '<p style="color: #888;">Select date range to see preview</p>';
    return;
  } else {
    customDateDiv.style.display = 'none';
  }
  
  try {
    const { conversations, startDate, endDate } = await getConversationsForDuration(period);
    const cost = estimateSummaryCost(conversations.length, 'batch');
    
    previewDiv.innerHTML = `
      <p style="margin: 0; color: var(--fg);">
        <strong>${conversations.length}</strong> conversations found
      </p>
      <p style="margin: 0.5rem 0 0 0; color: #888; font-size: 0.9em;">
        Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}<br>
        Estimated cost: ${cost.note}
      </p>
    `;
  } catch (error) {
    previewDiv.innerHTML = '<p style="color: #ff6666;">Error loading preview</p>';
  }
};

window.generateFlexibleSummary = async function() {
  const period = document.getElementById('summaryPeriod').value;
  const btn = document.querySelector('button[onclick="generateFlexibleSummary()"]');
  const originalText = btn.textContent;
  
  btn.disabled = true;
  btn.textContent = 'Generating...';
  
  try {
    let result;
    
    if (period === 'custom') {
      const startDate = document.getElementById('customStartDate').value;
      const endDate = document.getElementById('customEndDate').value;
      if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }
      result = await generateBatchSummary('custom', startDate, endDate);
    } else {
      result = await generateBatchSummary(period);
    }
    
    // Show result
    const container = elements.chatContainer();
    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <h2>📅 Summary - ${result.durationLabel}</h2>
        <p style="color: #888; margin-bottom: 1rem;">
          Generated: ${new Date(result.generatedAt).toLocaleString()}<br>
          Period: ${result.startDate.toLocaleDateString()} - ${result.endDate.toLocaleDateString()}
        </p>
        
        <div class="ai-section" style="white-space: pre-wrap;">
          ${marked.parse(result.summary)}
        </div>
        
        <div class="ai-section">
          <h3>📈 Statistics</h3>
          <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="stat-box">
              <div class="stat-value">${result.stats.chatCount}</div>
              <div class="stat-label">Conversations</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${result.stats.messageCount}</div>
              <div class="stat-label">Messages</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="font-size: 1.2em;">${result.stats.mostActiveDay}</div>
              <div class="stat-label">Most Active</div>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 2rem;">
          <button onclick="downloadFlexSummary()" class="upload-btn">💾 Download</button>
          <button onclick="copyFlexSummary()" class="export-btn">📋 Copy</button>
          <button onclick="showAISettings()" class="delete-btn">← Back</button>
        </div>
      </div>
    `;
    
    window._lastFlexSummary = result;
    
  } catch (error) {
    alert('Error generating summary: ' + error.message);
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

window.downloadFlexSummary = function() {
  if (window._lastFlexSummary) {
    exportFlexSummary(window._lastFlexSummary, 'batch');
  }
};

window.copyFlexSummary = async function() {
  if (window._lastFlexSummary) {
    await copyFlexSummary(window._lastFlexSummary, 'batch');
    alert('Copied to clipboard!');
  }
};

window.saveBatchPrompt = function() {
  const prompt = document.getElementById('batchPrompt').value;
  setBatchPrompt(prompt);
  alert('Batch summary prompt saved!');
};

window.resetBatchPrompt = function() {
  if (confirm('Reset batch summary prompt to default?')) {
    localStorage.removeItem('flexible_summary_prompt');
    showAISettings();
  }
};

window.saveSinglePrompt = function() {
  const prompt = document.getElementById('singlePrompt').value;
  setSinglePrompt(prompt);
  alert('Single chat summary prompt saved!');
};

window.resetSinglePrompt = function() {
  if (confirm('Reset single chat summary prompt to default?')) {
    localStorage.removeItem('single_chat_summary_prompt');
    showAISettings();
  }
};

// Single chat summary from chat view
window.summarizeCurrentChat = async function(chatIndex) {
  if (!checkAiRateLimit()) return;
  
  const chats = await getStoredChats();
  const chat = chats[chatIndex];
  
  if (!chat) return;
  
  const btn = document.getElementById('summarizeBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Summarizing...';
  }
  
  try {
    const result = await generateSingleSummary(chat);
    
    // Show summary in a modal-like view
    const container = elements.chatContainer();
    const originalContent = container.innerHTML;
    
    container.innerHTML = `
      <div style="max-width: 700px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2>📝 Summary: ${escapeHtml(chat.title)}</h2>
          <button onclick="restoreChatView(${chatIndex})" class="export-btn">← Back to Chat</button>
        </div>
        
        <div class="ai-section" style="white-space: pre-wrap; margin-bottom: 1rem;">
          ${marked.parse(result.summary)}
        </div>
        
        <div style="display: flex; gap: 1rem;">
          <button onclick="downloadSingleSummary(${chatIndex})" class="upload-btn">💾 Download</button>
          <button onclick="copySingleSummary()" class="export-btn">📋 Copy</button>
        </div>
      </div>
    `;
    
    window._lastSingleSummary = result;
    window._originalChatContent = originalContent;
    
  } catch (error) {
    alert('Error summarizing: ' + error.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📝 Summarize';
    }
  }
};

window.restoreChatView = function(chatIndex) {
  if (window._originalChatContent) {
    const container = elements.chatContainer();
    container.innerHTML = window._originalChatContent;
  } else {
    displayChat(chatIndex);
  }
};

window.downloadSingleSummary = function() {
  if (window._lastSingleSummary) {
    exportFlexSummary(window._lastSingleSummary, 'single');
  }
};

window.copySingleSummary = async function() {
  if (window._lastSingleSummary) {
    await copyFlexSummary(window._lastSingleSummary, 'single');
    alert('Copied to clipboard!');
  }
};

// ==================== ADVANCED SEARCH FILTERS ====================
let currentFilters = getFilterState();
let filterPanelOpen = false;

window.toggleFilterPanel = async function() {
  const panel = document.getElementById('filterPanel');
  filterPanelOpen = !filterPanelOpen;
  panel.style.display = filterPanelOpen ? 'block' : 'none';
  
  if (filterPanelOpen) {
    // Populate tags
    await populateFilterTags();
    // Load current filter values
    loadFilterValues();
  }
};

async function populateFilterTags() {
  const tags = await getAvailableTags();
  const container = document.getElementById('filterTags');
  if (!container) return;
  
  if (tags.length === 0) {
    container.innerHTML = '<span style="color: #666; font-size: 0.85em;">No tags available</span>';
    return;
  }
  
  container.innerHTML = tags.map(tag => `
    <label class="filter-tag-chip" style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 2px 8px; background: var(--accent); border-radius: 12px; font-size: 0.8em; cursor: pointer; user-select: none;">
      <input type="checkbox" value="${escapeHtml(tag)}" onchange="onFilterChange()" ${currentFilters.tags.includes(tag) ? 'checked' : ''}>
      <span>${escapeHtml(tag)}</span>
    </label>
  `).join('');
}

function loadFilterValues() {
  document.getElementById('filterDate').value = currentFilters.datePreset;
  document.getElementById('filterMessages').value = currentFilters.messageRange;
  document.getElementById('filterHasCode').checked = currentFilters.hasCode;
  document.getElementById('filterHasLinks').checked = currentFilters.hasLinks;
  document.getElementById('filterHasImages').checked = currentFilters.hasImages;
  document.getElementById('searchInTitle').checked = currentFilters.searchIn.includes('title');
  document.getElementById('searchInContent').checked = currentFilters.searchIn.includes('content');
  
  // Tag mode
  const tagModeRadio = document.querySelector(`input[name="tagMode"][value="${currentFilters.tagMode}"]`);
  if (tagModeRadio) tagModeRadio.checked = true;
  
  // Custom date
  if (currentFilters.datePreset === 'custom') {
    document.getElementById('filterCustomDate').style.display = 'grid';
    if (currentFilters.customStartDate) {
      document.getElementById('filterStartDate').value = currentFilters.customStartDate;
    }
    if (currentFilters.customEndDate) {
      document.getElementById('filterEndDate').value = currentFilters.customEndDate;
    }
  }
}

window.onFilterChange = function() {
  const datePreset = document.getElementById('filterDate').value;
  
  // Show/hide custom date range
  const customDateDiv = document.getElementById('filterCustomDate');
  if (customDateDiv) {
    customDateDiv.style.display = datePreset === 'custom' ? 'grid' : 'none';
  }
  
  // Collect selected tags
  const selectedTags = Array.from(document.querySelectorAll('#filterTags input:checked'))
    .map(cb => cb.value);
  
  // Get tag mode
  const tagMode = document.querySelector('input[name="tagMode"]:checked')?.value || 'any';
  
  // Update filters
  currentFilters = {
    datePreset,
    customStartDate: document.getElementById('filterStartDate')?.value || null,
    customEndDate: document.getElementById('filterEndDate')?.value || null,
    messageRange: document.getElementById('filterMessages').value,
    tags: selectedTags,
    tagMode,
    hasCode: document.getElementById('filterHasCode').checked,
    hasLinks: document.getElementById('filterHasLinks').checked,
    hasImages: document.getElementById('filterHasImages').checked,
    searchIn: [
      document.getElementById('searchInTitle').checked ? 'title' : null,
      document.getElementById('searchInContent').checked ? 'content' : null
    ].filter(Boolean)
  };
  
  saveFilterState(currentFilters);
  updateActiveFiltersDisplay();
  
  // Trigger search with new filters
  const searchInput = elements.searchInput();
  if (searchInput) {
    performSearch(searchInput.value);
  }
};

window.clearAllFilters = function() {
  currentFilters = resetFilters();
  loadFilterValues();
  updateActiveFiltersDisplay();
  
  const searchInput = elements.searchInput();
  if (searchInput) {
    performSearch(searchInput.value);
  }
};

function updateActiveFiltersDisplay() {
  const display = document.getElementById('activeFilters');
  if (!display) return;
  
  const description = getFilterDescription(currentFilters);
  const hasActiveFilters = description !== 'No filters active';
  
  display.style.display = hasActiveFilters ? 'block' : 'none';
  display.innerHTML = hasActiveFilters 
    ? `<strong>Active filters:</strong> ${description} <button onclick="clearAllFilters()" style="background: none; border: none; color: #ff6666; cursor: pointer; margin-left: 0.5rem;">✕</button>`
    : '';
}

function checkAiRateLimit() {
  const now = Date.now();
  if (now - lastAiRequestTime < AI_COOLDOWN_MS) {
    const wait = Math.ceil((AI_COOLDOWN_MS - (now - lastAiRequestTime)) / 1000);
    alert(`Please wait ${wait} second${wait !== 1 ? 's' : ''} between AI requests.`);
    return false;
  }
  lastAiRequestTime = now;
  return true;
}

window.autoTagChat = async function(chatId) {
  if (!checkAiRateLimit()) return;
  
  const chats = await getStoredChats();
  const chatIndex = chats.findIndex(c => c.id === chatId);
  const chat = chats[chatIndex];
  if (!chat) return;
  
  const existingTags = await getChatTags(chatId);
  
  // Show cost confirmation in simple mode
  const mode = getUserMode();
  if (mode === MODES.SIMPLE) {
    const confirmed = confirm(
      `🏷️ Auto-tag this conversation?\n\n` +
      `Estimated cost: ~$0.001\n` +
      `Charged to your OpenAI account`
    );
    if (!confirmed) return;
  }
  
  // Show loading state
  const btn = document.getElementById('autoTagBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = mode === MODES.SIMPLE ? 'Tagging...' : 'Generating tags...';
  }
  
  try {
    const newTags = await generateTags(chat, existingTags);
    
    // Add tags one by one
    for (const tag of newTags) {
      await addTag(chatId, tag);
    }
    
    // Refresh display
    await displayChat(chatIndex);
    await renderChatList();
    
    // Success message based on mode
    if (mode === MODES.SIMPLE) {
      showToast(`✅ Added ${newTags.length} tags`);
    } else {
      alert(`Added ${newTags.length} tags: ${newTags.join(', ')}`);
    }
  } catch (error) {
    alert('Error generating tags: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🏷️ Auto-Tag';
    }
  }
};

// Toast notification for simple mode
function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: #2D5A4A;
    color: white;
    padding: 1rem 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideUp 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.showSyncSettings = async function() {
  const container = elements.chatContainer();
  if (!container) return;
  
  const status = getSyncStatus();
  const isConfigured = isSyncConfigured();
  
  container.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h2>☁️ Cloud Sync</h2>
      
      <div class="sync-section">
        <h3>Status</h3>
        <p>
          <span class="sync-status ${isConfigured ? 'configured' : 'not-configured'}">
            ${isConfigured ? '✅ Configured' : '❌ Not configured'}
          </span>
        </p>
        ${status.lastSync ? `<p>Last sync: ${new Date(status.lastSync).toLocaleString()}</p>` : ''}
        <p style="color: #888; font-size: 0.9em;">Device ID: ${status.deviceId}</p>
      </div>
      
      ${isConfigured ? `
        <div class="sync-section">
          <h3>Sync Actions</h3>
          <button onclick="performSyncToCloud()" class="upload-btn" style="margin-right: 0.5rem;">
            ⬆️ Upload to Cloud
          </button>
          <button onclick="performSyncFromCloud()" class="upload-btn">
            ⬇️ Download from Cloud
          </button>
          <button onclick="disconnectSync()" class="delete-btn" style="margin-left: 1rem;">
            Disconnect
          </button>
          <div id="syncResult" style="margin-top: 1rem;"></div>
        </div>
      ` : `
        <div class="sync-section">
          <h3>Setup</h3>
          <p style="margin-bottom: 1rem;">
            Sync requires a free <a href="https://supabase.com" target="_blank">Supabase</a> account.
            <br>Create a project, then enter your credentials below.
          </p>
          <input type="text" id="sbUrl" placeholder="Supabase URL (https://...supabase.co)" 
                 style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px;">
          <input type="password" id="sbKey" placeholder="Supabase Anon Key" 
                 style="width: 100%; padding: 0.5rem; margin-bottom: 1rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 4px;">
          <button onclick="saveSyncConfig()" class="upload-btn">Connect</button>
          <div id="syncResult" style="margin-top: 1rem;"></div>
        </div>
        
        <div class="sync-section" style="margin-top: 1rem; background: #1a1a2e;">
          <h3>🚀 Quick Setup Guide</h3>
          <ol style="line-height: 1.8;">
            <li>Go to <a href="https://supabase.com" target="_blank">supabase.com</a> and sign up (free)</li>
            <li>Create a new project</li>
            <li>In the SQL Editor, run the SQL from sync.js comments</li>
            <li>Go to Project Settings → API</li>
            <li>Copy "Project URL" and "anon public" key</li>
            <li>Paste them above and click Connect</li>
          </ol>
        </div>
      `}
      
      <button onclick="restoreViewState()" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
    </div>
  `;
};

window.saveSyncConfig = async function() {
  const url = document.getElementById('sbUrl').value.trim();
  const key = document.getElementById('sbKey').value.trim();
  const resultDiv = document.getElementById('syncResult');
  
  if (!url || !key) {
    resultDiv.innerHTML = '<p style="color: #ff6666;">Please enter both URL and Key</p>';
    return;
  }
  
  resultDiv.innerHTML = '<p>Testing connection...</p>';
  
  try {
    const success = configureSync(url, key);
    if (success) {
      // Test the connection
      const result = await syncToCloud();
      if (result.success) {
        resultDiv.innerHTML = '<p style="color: #4CAF50;">✅ Connected and synced successfully!</p>';
        setTimeout(() => showSyncSettings(), 1500);
      } else {
        resultDiv.innerHTML = `<p style="color: #ff6666;">⚠️ Connected but sync test failed: ${result.error}</p>`;
      }
    } else {
      resultDiv.innerHTML = '<p style="color: #ff6666;">Failed to initialize sync</p>';
    }
  } catch (error) {
    resultDiv.innerHTML = `<p style="color: #ff6666;">Error: ${error.message}</p>`;
  }
};

window.performSyncToCloud = async function() {
  const resultDiv = document.getElementById('syncResult');
  resultDiv.innerHTML = '<p>Syncing to cloud...</p>';
  
  const result = await syncToCloud();
  
  if (result.success) {
    resultDiv.innerHTML = `<p style="color: #4CAF50;">✅ Uploaded ${result.chats} chats</p>`;
  } else {
    resultDiv.innerHTML = `<p style="color: #ff66666;">❌ Error: ${result.error}</p>`;
  }
};

window.performSyncFromCloud = async function() {
  const resultDiv = document.getElementById('syncResult');
  resultDiv.innerHTML = '<p>Syncing from cloud...</p>';
  
  const result = await syncFromCloud();
  
  if (result.success) {
    if (result.empty) {
      resultDiv.innerHTML = '<p style="color: #888;">ℹ️ No data found in cloud</p>';
    } else {
      resultDiv.innerHTML = `<p style="color: #4CAF50;">✅ Downloaded ${result.chats} chats</p>`;
      // Refresh the chat list
      await renderChatList();
    }
  } else {
    resultDiv.innerHTML = `<p style="color: #ff6666;">❌ Error: ${result.error}</p>`;
  }
};

window.disconnectSync = function() {
  if (confirm('Disconnect from cloud sync? Local data will be kept.')) {
    clearSyncConfig();
    showSyncSettings();
  }
};

window.showStats = async function() {
  const container = elements.chatContainer();
  if (!container) return;
  
  container.innerHTML = '<p style="padding: 2rem; text-align: center;">Calculating statistics...</p>';
  
  // Use setTimeout to allow UI to update before heavy calculation
  setTimeout(async () => {
    const stats = await calculateStats();
    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;">📊 Chat Statistics</h2>
        ${formatStatsHTML(stats)}
        <button onclick="restoreViewState()" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
      </div>
    `;
  }, 100);
};

window.clearAllChats = async function(btn) {
  const button = btn || document.querySelector('.delete-btn');

  // Use button-local state instead of global to prevent stale confirmation
  if (button.dataset.confirming !== 'true') {
    button.textContent = 'Sure?';
    button.style.color = 'orange';
    button.dataset.confirming = 'true';

    setTimeout(() => {
      button.textContent = '🗑️ Delete All';
      button.style.color = '';
      delete button.dataset.confirming;
    }, 3000);
  } else {
    await clearChatsInDB();
    resetSearchIndex(); // Reset fuzzy search cache
    await renderChatList();
    delete button.dataset.confirming;
  }
};

window.exportAllData = exportAllData;
window.displayChat = displayChat;

// Update mode toggle button
function updateModeIndicator() {
  const mode = getUserMode();
  const btn = document.getElementById('modeToggle');
  if (btn) {
    btn.textContent = mode === MODES.SIMPLE ? 'Simple' : 'Advanced';
    btn.style.background = mode === MODES.SIMPLE ? 'var(--accent)' : '#10a37f';
  }
  
  // Update storage info text
  const storageInfo = document.getElementById('storageInfo');
  if (storageInfo) {
    storageInfo.innerHTML = mode === MODES.SIMPLE 
      ? '🔒 Stored securely on your device'
      : '🔒 IndexedDB local storage';
  }
  
  // Show/hide advanced features - CSS handles this via body[data-mode]
  // Only handle special cases like filterPanel
  document.querySelectorAll('.advanced-only').forEach(el => {
    if (el.id !== 'filterPanel') {
      el.style.display = ''; // Clear inline styles, let CSS handle it
    }
  });
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
  if (text == null) return '';
  const str = String(text);
  const div = document.createElement('div');
  div.textContent = str;
  let result = div.innerHTML;
  // Also escape single quotes, backticks, and forward slashes
  // to prevent attribute injection in various contexts
  result = result.replace(/'/g, '&#39;').replace(/`/g, '&#96;').replace(/\//g, '&#47;');
  return result;
}

// ==================== PWA SERVICE WORKER ====================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[PWA] Service Worker registered:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available');
              // Could show update notification here
            }
          });
        });
      })
      .catch(error => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  }
}

// ==================== START ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    registerServiceWorker();
  });
} else {
  init();
  registerServiceWorker();
}
