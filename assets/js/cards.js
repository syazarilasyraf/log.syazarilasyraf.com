// cards.js - Card-based conversation display

import { getChatTags } from './tags.js';
import { getUserMode, MODES } from './user-mode.js';
import { getPinnedChats, savePinnedChats } from './storage.js';

// Format relative time for cards
export function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get message preview for card
export function getMessagePreview(messages, maxLength = 80) {
  if (!messages || messages.length === 0) return 'No messages';
  
  // Find first user message for preview
  const userMessage = messages.find(m => m.role === 'user');
  const preview = userMessage ? userMessage.content : messages[0].content;
  
  if (preview.length <= maxLength) return preview;
  return preview.substring(0, maxLength) + '...';
}

// Get tag color based on name (consistent hashing)
export function getTagColor(tagName) {
  const colors = [
    '#2D5A4A', '#4A7C59', '#5B8A72', '#8FBC8F',
    '#4682B4', '#5F9EA0', '#6495ED', '#87CEEB',
    '#8B4513', '#A0522D', '#CD853F', '#DEB887',
    '#483D8B', '#6A5ACD', '#7B68EE', '#9370DB'
  ];
  
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// Create conversation card element
export async function createConversationCard(chat, index, options = {}) {
  const { showTags = true, compact = false, selected = false } = options;
  const mode = getUserMode();
  
  const card = document.createElement('div');
  card.className = `conversation-card ${selected ? 'selected' : ''}`;
  card.setAttribute('data-index', index);
  
  // Get metadata
  const messageCount = chat.messages?.length || 0;
  const preview = getMessagePreview(chat.messages);
  const timeAgo = formatRelativeTime(chat.createdAt);
  const tags = showTags ? await getChatTags(index) : [];
  
  // Check for content types
  const hasCode = chat.messages?.some(m => m.content?.includes('```'));
  const hasLinks = chat.messages?.some(m => /https?:\/\/[^\s]+/.test(m.content));
  
  // Check if pinned
  const pinnedChats = await getPinnedChats();
  const isPinned = pinnedChats.includes(index);
  
  // Build card HTML
  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${escapeHtml(chat.title || 'Untitled Chat')}</h3>
      <div class="card-actions">
        <button class="card-btn pin-btn ${isPinned ? 'pinned' : ''}" title="${isPinned ? 'Unpin' : 'Pin'}">
          ${isPinned ? '📌' : '📍'}
        </button>
        <button class="card-btn export-btn" title="Export as Markdown">
          📝
        </button>
        <span class="card-time">${timeAgo}</span>
      </div>
    </div>
    
    <p class="card-preview">${escapeHtml(preview)}</p>
    
    <div class="card-footer">
      <div class="card-meta">
        <span class="message-count">${messageCount} message${messageCount !== 1 ? 's' : ''}</span>
        ${hasCode ? '<span class="content-badge code">💻</span>' : ''}
        ${hasLinks ? '<span class="content-badge link">🔗</span>' : ''}
      </div>
      
      ${tags.length > 0 ? `
        <div class="card-tags">
          ${tags.slice(0, 3).map(tag => `
            <span class="card-tag" style="background: ${getTagColor(tag)}20; color: ${getTagColor(tag)}; border: 1px solid ${getTagColor(tag)}40;">
              ${escapeHtml(tag)}
            </span>
          `).join('')}
          ${tags.length > 3 ? `<span class="card-tag more">+${tags.length - 3}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
  
  // Add pin button handler
  const pinBtn = card.querySelector('.pin-btn');
  pinBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await togglePinChat(index);
    // Refresh the card
    const newPinned = await getPinnedChats();
    const newIsPinned = newPinned.includes(index);
    pinBtn.innerHTML = newIsPinned ? '📌' : '📍';
    pinBtn.title = newIsPinned ? 'Unpin' : 'Pin';
    pinBtn.classList.toggle('pinned', newIsPinned);
  });
  
  // Add export button handler
  const exportBtn = card.querySelector('.export-btn');
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportChatAsMarkdown(chat, index);
  });
  
  // Add click handler for card selection
  card.addEventListener('click', () => {
    // Remove selected from all cards
    document.querySelectorAll('.conversation-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    
    // Dispatch custom event
    card.dispatchEvent(new CustomEvent('cardSelect', { 
      bubbles: true, 
      detail: { index, chat } 
    }));
  });
  
  return card;
}

// Toggle pin status for a chat
async function togglePinChat(index) {
  const pinned = await getPinnedChats();
  const set = new Set(pinned);
  if (set.has(index)) {
    set.delete(index);
  } else {
    set.add(index);
  }
  await savePinnedChats([...set].sort((a, b) => a - b));
  
  // Dispatch event to refresh list
  window.dispatchEvent(new CustomEvent('chatListUpdated'));
}

// Export single chat as markdown
function exportChatAsMarkdown(chat, index) {
  const metadata = {
    chatGPT_conversation_title: chat.title || `Chat ${index + 1}`,
    chatGPT_dates: [...new Set(chat.messages?.map(m => m.createdAt?.split('T')[0]))],
    chatGPT_create_time: chat.createdAt,
    chatGPT_update_time: chat.updatedAt,
    chatGPT_converted_time: new Date().toISOString(),
    chatGPT_conversation_id: chat.id || `chat-${index}`
  };

  let md = `---\n`;
  for (const [key, value] of Object.entries(metadata)) {
    md += `${key}: ${Array.isArray(value) ? JSON.stringify(value) : `'${value}'`}\n`;
  }
  md += `---\n\n`;
  md += `*Chat started ${new Date(metadata.chatGPT_create_time).toLocaleString()}*\n\n`;
  
  // Add Continue at ChatGPT link
  const chatId = chat.id;
  if (chatId) {
    md += `[Continue this conversation at ChatGPT](https://chat.openai.com/c/${chatId})\n\n`;
  }
  
  md += `---\n\n`;

  chat.messages?.forEach((msg, j) => {
    const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
    const timestamp = new Date(msg.createdAt).toLocaleString();
    md += `## ${speaker} — _${timestamp}_\n\n${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const filename = `${metadata.chatGPT_conversation_title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)}.md`;
  
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Create empty state card
export function createEmptyStateCard(type = 'default') {
  const card = document.createElement('div');
  card.className = 'empty-state-card';
  
  const states = {
    default: {
      icon: '📭',
      title: 'No conversations yet',
      message: 'Upload your ChatGPT export or install the extension to get started.',
      action: 'Learn how →'
    },
    search: {
      icon: '🔍',
      title: 'No matches found',
      message: 'Try adjusting your search or filters.',
      action: null
    },
    filter: {
      icon: '⚙️',
      title: 'No conversations match',
      message: 'Try clearing some filters to see more results.',
      action: 'Clear filters'
    }
  };
  
  const state = states[type] || states.default;
  
  card.innerHTML = `
    <div class="empty-state-icon">${state.icon}</div>
    <h3 class="empty-state-title">${state.title}</h3>
    <p class="empty-state-message">${state.message}</p>
    ${state.action ? `<button class="empty-state-action">${state.action}</button>` : ''}
  `;
  
  return card;
}

// Create section header (Today, Yesterday, etc.)
export function createSectionHeader(title, count) {
  const header = document.createElement('div');
  header.className = 'section-header';
  header.innerHTML = `
    <h4 class="section-title">${title}</h4>
    <span class="section-count">${count}</span>
  `;
  return header;
}

// Render conversations as cards
export async function renderConversationCards(container, chats, options = {}) {
  const { folderView = false } = options;
  container.innerHTML = '';
  
  if (chats.length === 0) {
    container.appendChild(createEmptyStateCard('default'));
    return;
  }
  
  // Group by date sections (with pinned first)
  const sections = await groupChatsBySection(chats);
  
  for (const [sectionTitle, sectionChats] of sections) {
    if (folderView) {
      // Folder view: collapsible sections
      const folder = document.createElement('details');
      folder.className = 'chat-folder';
      folder.open = sectionTitle === 'Pinned'; // Keep pinned open by default
      
      const summary = document.createElement('summary');
      summary.className = 'folder-header';
      summary.innerHTML = `
        <span class="folder-title">${sectionTitle}</span>
        <span class="folder-count">${sectionChats.length}</span>
      `;
      folder.appendChild(summary);
      
      // Add cards inside folder
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'cards-container folder-content';
      
      for (const { chat, originalIndex } of sectionChats) {
        const card = await createConversationCard(chat, originalIndex, options);
        cardsContainer.appendChild(card);
      }
      
      folder.appendChild(cardsContainer);
      container.appendChild(folder);
    } else {
      // Flat view: regular sections
      container.appendChild(createSectionHeader(sectionTitle, sectionChats.length));
      
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'cards-container';
      
      for (const { chat, originalIndex } of sectionChats) {
        const card = await createConversationCard(chat, originalIndex, options);
        cardsContainer.appendChild(card);
      }
      
      container.appendChild(cardsContainer);
    }
  }
}

// Group chats by time sections, with pinned chats first
async function groupChatsBySection(chats) {
  const now = new Date();
  const sections = {
    'Pinned': [],
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'This Month': [],
    'Earlier': []
  };
  
  // Get pinned chat indices
  const pinnedChats = await getPinnedChats();
  const pinnedSet = new Set(pinnedChats);
  
  chats.forEach((chat, index) => {
    const item = { chat, originalIndex: index };
    
    // Check if pinned first
    if (pinnedSet.has(index)) {
      sections['Pinned'].push(item);
      return;
    }
    
    // Otherwise group by date
    const date = new Date(chat.createdAt);
    const diffDays = Math.floor((now - date) / 86400000);
    
    if (diffDays === 0) sections['Today'].push(item);
    else if (diffDays === 1) sections['Yesterday'].push(item);
    else if (diffDays <= 7) sections['This Week'].push(item);
    else if (diffDays <= 30) sections['This Month'].push(item);
    else sections['Earlier'].push(item);
  });
  
  // Remove empty sections
  return Object.entries(sections).filter(([_, items]) => items.length > 0);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
