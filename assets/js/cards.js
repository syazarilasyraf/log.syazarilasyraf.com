// cards.js - Card-based conversation display

import { getChatTags } from './tags.js';
import { getUserMode, MODES } from './user-mode.js';

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
  
  // Build card HTML
  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${escapeHtml(chat.title || 'Untitled Chat')}</h3>
      <span class="card-time">${timeAgo}</span>
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
  
  // Add click handler
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
  container.innerHTML = '';
  
  if (chats.length === 0) {
    container.appendChild(createEmptyStateCard('default'));
    return;
  }
  
  // Group by date sections
  const sections = groupChatsBySection(chats);
  
  for (const [sectionTitle, sectionChats] of sections) {
    // Add section header
    container.appendChild(createSectionHeader(sectionTitle, sectionChats.length));
    
    // Add cards
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    
    for (const { chat, originalIndex } of sectionChats) {
      const card = await createConversationCard(chat, originalIndex, options);
      cardsContainer.appendChild(card);
    }
    
    container.appendChild(cardsContainer);
  }
}

// Group chats by time sections
function groupChatsBySection(chats) {
  const now = new Date();
  const sections = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'This Month': [],
    'Earlier': []
  };
  
  chats.forEach((chat, index) => {
    const date = new Date(chat.createdAt);
    const diffDays = Math.floor((now - date) / 86400000);
    
    const item = { chat, originalIndex: index };
    
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
