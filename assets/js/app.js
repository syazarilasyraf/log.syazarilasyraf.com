// app.js - Main application entry point

import {
  getStoredChats,
  saveChatsToDB,
  clearChatsInDB,
  getPinnedChats,
  savePinnedChats,
  migrateFromLocalStorage,
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
  searchByTag,
  updateTagIndices 
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
  generateTags,
  generateSummary,
  estimateTagCost
} from './ai.js';

// ==================== STATE ====================
let bulkEditMode = false;
let folderViewEnabled = false;
let confirmClearAll = false;
let confirmDeleteSelected = false;

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
  
  // Run migration from localStorage if needed
  const migrated = await migrateFromLocalStorage();
  if (migrated) {
    console.log('Migration complete. Your data is now in IndexedDB.');
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Initial render
  await renderChatList();
  
  console.log('ChatLog ready.');
}

function setupEventListeners() {
  // File upload
  elements.fileInput()?.addEventListener('change', handleFileSelect);
  
  // Burger menu
  elements.burgerButton()?.addEventListener('click', () => {
    elements.sidebar()?.classList.toggle('open');
  });
  
  // Bulk edit toggles
  document.querySelectorAll('.toggle-bulk').forEach(btn => {
    btn.addEventListener('click', toggleBulkMode);
  });
  
  // Bulk actions
  document.querySelectorAll('.bulk-delete').forEach(btn => {
    btn.addEventListener('click', handleBulkDelete);
  });
  
  document.querySelectorAll('.bulk-export').forEach(btn => {
    btn.addEventListener('click', exportSelectedChats);
  });
  
  document.querySelectorAll('.bulk-pin').forEach(btn => {
    btn.addEventListener('click', handleBulkPin);
  });
  
  // Folder view toggle
  document.getElementById('toggleFolderView')?.addEventListener('click', () => {
    folderViewEnabled = !folderViewEnabled;
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
  const pinnedIndices = new Set(await getPinnedChats());
  const allTags = await getAllTags();
  const chatListEl = elements.chatList();
  
  if (!chatListEl) return;
  chatListEl.innerHTML = '';

  if (chats.length === 0) {
    chatListEl.innerHTML = '<p style="padding: 1rem; color: #888;">No chats yet. Upload a conversations.json file to get started.</p>';
    return;
  }
  
  // Filter by tag if specified
  let displayChats = chats;
  let displayIndices = chats.map((_, i) => i);
  
  if (filterTag) {
    const taggedIndices = await searchByTag(filterTag);
    displayChats = chats.filter((_, i) => taggedIndices.includes(i));
    displayIndices = taggedIndices;
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
      btn.onclick = () => renderChatList(tag);
      tagBar.appendChild(btn);
    });
    
    chatListEl.appendChild(tagBar);
  }

  const sections = groupChatsByDateWithTags(displayChats, displayIndices, pinnedIndices, allTags);

  if (folderViewEnabled) {
    renderFolderView(chatListEl, sections);
  } else {
    renderFlatView(chatListEl, sections);
  }
}

function groupChatsByDate(chats, pinnedIndices) {
  return groupChatsByDateWithTags(chats, chats.map((_, i) => i), pinnedIndices, {});
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

    const entry = createChatEntryElement(chat, originalIndex, allTags[originalIndex] || []);

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

  if (bulkEditMode) {
    entry.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
        <span class="chat-title" style="flex: 1;">${escapeHtml(chat.title) || `Chat ${index + 1}`}</span>
        <input type="checkbox" class="chat-select" data-index="${index}" style="margin-left: 0.5em; width: 1em; height: 1em;">
      </div>
      ${tagsHtml}
    `;
    entry.querySelector('.chat-title')?.addEventListener('click', () => selectChat(index));
  } else {
    entry.innerHTML = `
      <div class="chat-title">${escapeHtml(chat.title) || `Chat ${index + 1}`}</div>
      ${tagsHtml}
    `;
    entry.onclick = () => selectChat(index);
  }

  return entry;
}

function selectChat(index) {
  document.querySelectorAll('.chat-entry').forEach(el => el.classList.remove('selected'));
  const entry = document.querySelector(`.chat-entry[data-index="${index}"]`);
  entry?.classList.add('selected');
  
  const container = elements.chatContainer();
  if (container) container.innerHTML = '';
  displayChat(index);
}

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
  container.innerHTML = await buildMetadataHTML(metadata, index);
  
  // Attach tag handlers
  attachTagHandlers(container, index);

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

function attachTagHandlers(container, chatIndex) {
  const tagEditor = container.querySelector('.tag-editor');
  if (!tagEditor) return;
  
  // Remove tag on click
  tagEditor.querySelectorAll('.tag.removable').forEach(tagEl => {
    tagEl.addEventListener('click', async () => {
      const tag = tagEl.dataset.tag;
      if (confirm(`Remove tag "${tag}"?`)) {
        await removeTag(chatIndex, tag);
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
          await addTag(chatIndex, tag);
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

async function buildMetadataHTML(metadata, chatIndex) {
  const link = `https://chat.openai.com/c/${metadata.id}`;
  const created = new Date(metadata.createdAt).toLocaleString();
  const tags = await getChatTags(chatIndex);
  const aiEnabled = hasApiKey();

  return `
    <details open class="metadata-box">
      <summary>Metadata</summary>
      <pre><code>${escapeHtml(JSON.stringify(metadata, null, 2))}</code></pre>
    </details>
    <p><em>Chat started ${created}</em> · <a href="${link}" target="_blank" rel="noopener">Continue at ChatGPT</a></p>
    <div class="tag-editor" data-chat-index="${chatIndex}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="color: #888;">Tags:</span>
        ${aiEnabled ? `<button id="autoTagBtn" onclick="autoTagChat(${chatIndex})" class="ai-tag-btn" title="AI-powered auto-tagging">🏷️ Auto-Tag</button>` : ''}
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

// ==================== BULK OPERATIONS ====================
function toggleBulkMode() {
  bulkEditMode = !bulkEditMode;
  document.querySelectorAll('.bulk-controls').forEach(el => {
    el.style.display = bulkEditMode ? 'block' : 'none';
  });
  renderChatList();
}

function getSelectedIndexes() {
  return Array.from(document.querySelectorAll('.chat-select:checked'))
    .map(cb => parseInt(cb.dataset.index));
}

async function handleBulkDelete() {
  const selected = getSelectedIndexes();
  if (!selected.length) return;

  if (!confirmDeleteSelected) {
    document.querySelectorAll('.bulk-delete').forEach(btn => {
      btn.textContent = 'Sure?';
      btn.style.color = 'orange';
    });
    confirmDeleteSelected = true;
    setTimeout(() => {
      document.querySelectorAll('.bulk-delete').forEach(btn => {
        btn.textContent = btn.classList.contains('delete-btn') ? '🗑️ Delete Selected' : '🗑️';
        btn.style.color = '';
      });
      confirmDeleteSelected = false;
    }, 3000);
  } else {
    const chats = await getStoredChats();
    const filtered = chats.filter((_, idx) => !selected.includes(idx));
    await saveChatsToDB(filtered);
    
    // Update pinned indices
    const pinned = await getPinnedChats();
    const newPinned = pinned
      .filter(idx => !selected.includes(idx))
      .map(idx => {
        const removedBefore = selected.filter(s => s < idx).length;
        return idx - removedBefore;
      });
    await savePinnedChats(newPinned);
    
    // Update tag indices
    await updateTagIndices(selected);
    
    resetSearchIndex(); // Reset fuzzy search cache
    await renderChatList();
    confirmDeleteSelected = false;
  }
}

async function handleBulkPin() {
  const selected = getSelectedIndexes();
  if (!selected.length) return;

  const pinned = new Set(await getPinnedChats());
  selected.forEach(idx => {
    if (pinned.has(idx)) pinned.delete(idx);
    else pinned.add(idx);
  });

  await savePinnedChats([...pinned]);
  await renderChatList();
}

async function exportSelectedChats() {
  const selected = getSelectedIndexes();
  if (!selected.length) {
    alert('No chats selected for export.');
    return;
  }

  const chats = await getStoredChats();
  const toExport = selected.map(idx => chats[idx]).filter(Boolean);

  for (let i = 0; i < toExport.length; i++) {
    const chat = toExport[i];
    const metadata = {
      chatGPT_conversation_title: chat.title || `Chat ${i + 1}`,
      chatGPT_dates: [...new Set(chat.messages?.map(m => m.createdAt?.split('T')[0]))],
      chatGPT_create_time: chat.createdAt,
      chatGPT_update_time: chat.updatedAt,
      chatGPT_converted_time: new Date().toISOString(),
      chatGPT_conversation_id: chat.id
    };

    let md = `---\n`;
    for (const [key, value] of Object.entries(metadata)) {
      md += `${key}: ${Array.isArray(value) ? JSON.stringify(value) : `'${value}'`}\n`;
    }
    md += `---\n\n`;
    md += `*Chat started ${new Date(metadata.chatGPT_create_time).toLocaleString()}*\n`;
    md += `- [Continue at ChatGPT](https://chat.openai.com/c/${metadata.chatGPT_conversation_id})\n\n---\n`;

    chat.messages?.forEach((msg, j) => {
      const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
      const timestamp = new Date(msg.createdAt).toLocaleString();
      const content = msg.content.trim().split('\n').map(line => `> ${line}`).join('\n');
      md += `\n### ${j + 1}. ${speaker} — _${timestamp}_\n\n${content}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const filename = `${metadata.chatGPT_conversation_title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)}.md`;
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Small delay between downloads
    await new Promise(r => setTimeout(r, 100));
  }
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
  const fuse = await getFuseInstance();
  const results = fuse.search(query);
  
  // Split by match type for UI
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

  renderSearchResults(byTitle, byContent, query);
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

function renderSearchResults(byTitle, byContent, query) {
  const container = elements.searchResults();
  container.innerHTML = '';

  if (byTitle.length === 0 && byContent.length === 0) {
    container.innerHTML = '<p style="padding: 1rem;">No results found.</p>';
    return;
  }

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
  const maskedKey = apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(-4)}` : '';
  
  container.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h2>🤖 AI Features</h2>
      
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
      
      <div class="ai-section">
        <h3>Features</h3>
        <ul style="line-height: 1.8; margin: 0; padding-left: 1.5rem;">
          <li><strong>Auto-tagging:</strong> AI suggests relevant tags for your chats</li>
          <li><strong>Summarization:</strong> Generate concise summaries of long conversations</li>
        </ul>
        
        <div style="background: var(--bg); padding: 1rem; border-radius: 6px; margin-top: 1rem;">
          <p style="margin: 0; color: #888; font-size: 0.9em;">
            <strong>Cost estimate:</strong> ~$0.001 per chat tagged
            <br>You'll only be charged by OpenAI for actual usage.
          </p>
        </div>
      </div>
      
      <div class="ai-section">
        <h3>Privacy</h3>
        <p style="color: #888; font-size: 0.9em; margin: 0;">
          • Your API key never leaves your browser (stored in localStorage)<br>
          • Conversation data is sent directly to OpenAI's API<br>
          • We don't store or log any of your data<br>
          • You can remove your key at any time
        </p>
      </div>
      
      <button onclick="displayChat(0)" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
    </div>
  `;
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

window.autoTagChat = async function(chatIndex) {
  const chats = await getStoredChats();
  const chat = chats[chatIndex];
  if (!chat) return;
  
  const existingTags = await getChatTags(chatIndex);
  
  // Show loading state
  const btn = document.getElementById('autoTagBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating tags...';
  }
  
  try {
    const newTags = await generateTags(chat, existingTags);
    
    // Add tags one by one
    for (const tag of newTags) {
      await addTag(chatIndex, tag);
    }
    
    // Refresh display
    await displayChat(chatIndex);
    await renderChatList();
    
    alert(`Added ${newTags.length} tags: ${newTags.join(', ')}`);
  } catch (error) {
    alert('Error generating tags: ' + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🏷️ Auto-Tag';
    }
  }
};

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
      
      <button onclick="displayChat(0)" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
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
        <button onclick="displayChat(0)" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
      </div>
    `;
  }, 100);
};

window.clearAllChats = async function(btn) {
  const button = btn || document.querySelector('.delete-btn');

  if (!confirmClearAll) {
    button.textContent = 'Sure?';
    button.style.color = 'orange';
    confirmClearAll = true;

    setTimeout(() => {
      button.textContent = '🗑️ Delete All';
      button.style.color = '';
      confirmClearAll = false;
    }, 3000);
  } else {
    await clearChatsInDB();
    resetSearchIndex(); // Reset fuzzy search cache
    await renderChatList();
    confirmClearAll = false;
  }
};

window.exportAllData = exportAllData;

// ==================== UTILITIES ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
