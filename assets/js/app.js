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

  const existingChats = await getStoredChats();
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

      // Check if this looks like a backup file
      const parsed = JSON.parse(content);
      if (parsed.version && parsed.chats) {
        const count = await importFromBackup(file);
        totalImported += count;
        alert(`Restored ${count} chats from backup.`);
      } else {
        // Merge with existing
        const merged = mergeChats(existingChats, newChats);
        await saveChatsToDB(merged);
        totalImported += newChats.length;
      }
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      alert(`Error processing ${file.name}: ${err.message}`);
    }
  }

  if (totalImported > 0) {
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
async function renderChatList() {
  const chats = await getStoredChats();
  const pinnedIndices = new Set(await getPinnedChats());
  const chatListEl = elements.chatList();
  
  if (!chatListEl) return;
  chatListEl.innerHTML = '';

  if (chats.length === 0) {
    chatListEl.innerHTML = '<p style="padding: 1rem; color: #888;">No chats yet. Upload a conversations.json file to get started.</p>';
    return;
  }

  const sections = groupChatsByDate(chats, pinnedIndices);

  if (folderViewEnabled) {
    renderFolderView(chatListEl, sections);
  } else {
    renderFlatView(chatListEl, sections);
  }
}

function groupChatsByDate(chats, pinnedIndices) {
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

  chats.forEach((chat, index) => {
    const rawDate = chat.createdAt || chat.date || chat.timestamp;
    const date = new Date(rawDate);
    if (isNaN(date)) return;

    const entry = createChatEntryElement(chat, index);

    if (pinnedIndices.has(index)) {
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

function createChatEntryElement(chat, index) {
  const entry = document.createElement('div');
  entry.className = 'chat-entry';
  entry.setAttribute('data-index', index);

  if (bulkEditMode) {
    entry.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
        <span class="chat-title" style="flex: 1;">${escapeHtml(chat.title) || `Chat ${index + 1}`}</span>
        <input type="checkbox" class="chat-select" data-index="${index}" style="margin-left: 0.5em; width: 1em; height: 1em;">
      </div>
    `;
    entry.querySelector('.chat-title')?.addEventListener('click', () => selectChat(index));
  } else {
    entry.textContent = chat.title || `Chat ${index + 1}`;
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
async function displayChat(index) {
  const chats = await getStoredChats();
  const chat = chats[index];
  const container = elements.chatContainer();
  
  if (!chat || !container) return;
  container.innerHTML = '';

  const metadata = {
    title: chat.title || `Chat ${index + 1}`,
    id: chat.id || `chat-${index}`,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages?.length || 0
  };

  const html = buildChatHTML(metadata, chat.messages, index);
  container.innerHTML = html;

  // Attach delete handlers
  container.querySelectorAll('.delete-msg-btn').forEach(btn => {
    setupDeleteHandler(btn, index);
  });
}

function buildChatHTML(metadata, messages, chatIndex) {
  const link = `https://chat.openai.com/c/${metadata.id}`;
  const created = new Date(metadata.createdAt).toLocaleString();

  let md = `<details open class="metadata-box">
    <summary>Metadata</summary>
    <pre><code>${escapeHtml(JSON.stringify(metadata, null, 2))}</code></pre>
  </details>

  <p><em>Chat started ${created}</em> · <a href="${link}" target="_blank" rel="noopener">Continue at ChatGPT</a></p>
  <hr>`;

  if (!messages || messages.length === 0) {
    md += '<p><em>No messages in this chat.</em></p>';
  } else {
    messages.forEach((msg, i) => {
      const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
      const speakerClass = msg.role === 'user' ? 'you' : 'chatgpt';
      const content = escapeHtml(msg.content).split('\n').map(line => `> ${line}`).join('\n');

      md += `
<details class="chat-message ${speakerClass}" open>
  <summary>
    <strong>${i + 1}. ${speaker}</strong>
    <button class="delete-msg-btn" data-msg-index="${i}" title="Delete message">×</button>
  </summary>
  <div class="message-content">${marked.parse(content)}</div>
</details>`;
    });
  }

  return md;
}

function setupDeleteHandler(btn, chatIndex) {
  let confirmDelete = false;
  
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
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
      await displayChat(chatIndex);
    }
  });
}

async function deleteMessage(chatIndex, msgIndex) {
  const chats = await getStoredChats();
  if (!chats[chatIndex]) return;
  
  chats[chatIndex].messages.splice(msgIndex, 1);
  await saveChatsToDB(chats);
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

async function performSearch(query) {
  const chats = await getStoredChats();
  const resultsByTitle = [];
  const resultsByContent = [];

  chats.forEach((chat, index) => {
    const inTitle = chat.title?.toLowerCase().includes(query);
    const inContent = chat.messages?.some(m => m.content.toLowerCase().includes(query));

    if (inTitle) resultsByTitle.push({ chat, index });
    else if (inContent) resultsByContent.push({ chat, index, query });
  });

  renderSearchResults(resultsByTitle, resultsByContent, query);
}

function renderSearchResults(byTitle, byContent, query) {
  const container = elements.searchResults();
  container.innerHTML = '';

  if (byTitle.length === 0 && byContent.length === 0) {
    container.innerHTML = '<p style="padding: 1rem;">No results found.</p>';
    return;
  }

  const createResult = ({ chat, index }, snippet = null) => {
    const div = document.createElement('div');
    div.className = 'search-result';
    
    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = chat.title || `Chat ${index + 1}`;
    div.appendChild(title);

    if (snippet) {
      const snip = document.createElement('div');
      snip.className = 'result-snippet';
      snip.textContent = snippet;
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

  const addSection = (label, items, showSnippets = false) => {
    if (!items.length) return;
    const header = document.createElement('h3');
    header.textContent = label;
    header.className = 'search-section-title';
    container.appendChild(header);

    items.forEach(item => {
      let snippet = null;
      if (showSnippets && item.query) {
        const match = item.chat.messages?.find(m => 
          m.content.toLowerCase().includes(item.query)
        );
        if (match) {
          const idx = match.content.toLowerCase().indexOf(item.query);
          const start = Math.max(0, idx - 30);
          const end = Math.min(match.content.length, idx + 30);
          snippet = (start > 0 ? '…' : '') + match.content.slice(start, end).trim() + (end < match.content.length ? '…' : '');
        }
      }
      container.appendChild(createResult(item, snippet));
    });
  };

  addSection('Matches in Title', byTitle);
  addSection('Matches in Messages', byContent, true);
}

// ==================== GLOBAL ACTIONS ====================
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

// ==================== START ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
