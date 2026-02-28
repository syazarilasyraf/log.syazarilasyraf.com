// stats.js - Chat statistics and analytics

import { getStoredChats } from './storage.js';
import { getAllTags } from './tags.js';

export async function calculateStats() {
  const chats = await getStoredChats();
  const allTags = await getAllTags();
  
  if (chats.length === 0) {
    return null;
  }

  const stats = {
    // Basic counts
    totalChats: chats.length,
    totalMessages: 0,
    userMessages: 0,
    assistantMessages: 0,
    
    // Word counts
    totalWords: 0,
    userWords: 0,
    assistantWords: 0,
    
    // Time analysis
    dateRange: { first: null, last: null },
    mostActiveDay: null,
    mostActiveMonth: null,
    
    // Tag stats
    totalTags: 0,
    uniqueTags: 0,
    
    // Top chats
    longestChat: null,
    mostActiveChat: null,
    
    // Daily distribution
    messagesByDay: {},
    messagesByMonth: {},
    
    // Hour distribution (when are you most active?)
    messagesByHour: new Array(24).fill(0)
  };

  const chatMessageCounts = [];
  const tagCounts = {};

  chats.forEach((chat, index) => {
    const messages = chat.messages || [];
    const msgCount = messages.length;
    
    stats.totalMessages += msgCount;
    chatMessageCounts.push({ index, title: chat.title, count: msgCount });

    // Track longest chat
    if (!stats.longestChat || msgCount > stats.longestChat.messageCount) {
      stats.longestChat = {
        title: chat.title,
        messageCount: msgCount,
        index: index
      };
    }

    messages.forEach(msg => {
      // Role counts
      if (msg.role === 'user') {
        stats.userMessages++;
        stats.userWords += countWords(msg.content);
      } else {
        stats.assistantMessages++;
        stats.assistantWords += countWords(msg.content);
      }
      
      stats.totalWords += countWords(msg.content);

      // Time analysis
      if (msg.createdAt) {
        const date = new Date(msg.createdAt);
        if (!isNaN(date)) {
          // Date range
          if (!stats.dateRange.first || date < stats.dateRange.first) {
            stats.dateRange.first = date;
          }
          if (!stats.dateRange.last || date > stats.dateRange.last) {
            stats.dateRange.last = date;
          }

          // Daily distribution
          const dayKey = date.toISOString().split('T')[0];
          stats.messagesByDay[dayKey] = (stats.messagesByDay[dayKey] || 0) + 1;

          // Monthly distribution
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          stats.messagesByMonth[monthKey] = (stats.messagesByMonth[monthKey] || 0) + 1;

          // Hour distribution
          stats.messagesByHour[date.getHours()]++;
        }
      }
    });

    // Tag counting
    const chatTags = allTags[index] || [];
    stats.totalTags += chatTags.length;
    chatTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  // Calculate derived stats
  stats.uniqueTags = Object.keys(tagCounts).length;
  stats.mostUsedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Most active day
  const dayEntries = Object.entries(stats.messagesByDay);
  if (dayEntries.length > 0) {
    const [day, count] = dayEntries.sort((a, b) => b[1] - a[1])[0];
    stats.mostActiveDay = { date: day, messages: count };
  }

  // Most active month
  const monthEntries = Object.entries(stats.messagesByMonth);
  if (monthEntries.length > 0) {
    const [month, count] = monthEntries.sort((a, b) => b[1] - a[1])[0];
    stats.mostActiveMonth = { month, messages: count };
  }

  // Peak hour
  const peakHour = stats.messagesByHour.indexOf(Math.max(...stats.messagesByHour));
  stats.peakHour = peakHour;

  // Average messages per chat
  stats.avgMessagesPerChat = Math.round(stats.totalMessages / stats.totalChats);

  // Top 5 most active chats
  stats.topChats = chatMessageCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return stats;
}

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

export function formatStatsHTML(stats) {
  if (!stats) {
    return '<p>No data available. Upload some chats first!</p>';
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString() : 'N/A';
  const formatNumber = (n) => n.toLocaleString();

  const formatHour = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour} ${ampm}`;
  };

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${formatNumber(stats.totalChats)}</div>
        <div class="stat-label">Total Chats</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatNumber(stats.totalMessages)}</div>
        <div class="stat-label">Total Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatNumber(stats.totalWords)}</div>
        <div class="stat-label">Total Words</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formatNumber(stats.avgMessagesPerChat)}</div>
        <div class="stat-label">Avg Messages/Chat</div>
      </div>
    </div>

    <div class="stats-section">
      <h3>Message Distribution</h3>
      <div class="stats-bar">
        <div class="bar-segment user" style="width: ${(stats.userMessages / stats.totalMessages * 100).toFixed(1)}%">
          You: ${formatNumber(stats.userMessages)}
        </div>
        <div class="bar-segment assistant" style="width: ${(stats.assistantMessages / stats.totalMessages * 100).toFixed(1)}%">
          ChatGPT: ${formatNumber(stats.assistantMessages)}
        </div>
      </div>
    </div>

    <div class="stats-section">
      <h3>Word Count Distribution</h3>
      <div class="stats-bar">
        <div class="bar-segment user" style="width: ${(stats.userWords / stats.totalWords * 100).toFixed(1)}%">
          You: ${formatNumber(stats.userWords)}
        </div>
        <div class="bar-segment assistant" style="width: ${(stats.assistantWords / stats.totalWords * 100).toFixed(1)}%">
          ChatGPT: ${formatNumber(stats.assistantWords)}
        </div>
      </div>
    </div>

    <div class="stats-section">
      <h3>Activity Insights</h3>
      <ul class="stats-list">
        <li><strong>Date Range:</strong> ${formatDate(stats.dateRange.first)} — ${formatDate(stats.dateRange.last)}</li>
        <li><strong>Most Active Day:</strong> ${stats.mostActiveDay ? `${stats.mostActiveDay.date} (${formatNumber(stats.mostActiveDay.messages)} msgs)` : 'N/A'}</li>
        <li><strong>Most Active Month:</strong> ${stats.mostActiveMonth ? `${stats.mostActiveMonth.month} (${formatNumber(stats.mostActiveMonth.messages)} msgs)` : 'N/A'}</li>
        <li><strong>Peak Hour:</strong> ${formatHour(stats.peakHour)}</li>
        <li><strong>Longest Chat:</strong> ${stats.longestChat ? `${escapeHtml(stats.longestChat.title)} (${formatNumber(stats.longestChat.messageCount)} msgs)` : 'N/A'}</li>
      </ul>
    </div>

    ${stats.mostUsedTags.length > 0 ? `
    <div class="stats-section">
      <h3>Most Used Tags</h3>
      <div class="tag-cloud">
        ${stats.mostUsedTags.map(([tag, count]) => `
          <span class="tag" style="font-size: ${0.8 + Math.min(count / 5, 0.5)}em">${escapeHtml(tag)} (${count})</span>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="stats-section">
      <h3>Top 5 Most Active Chats</h3>
      <ol class="stats-list">
        ${stats.topChats.map(chat => `
          <li><strong>${escapeHtml(chat.title)}</strong> — ${formatNumber(chat.count)} messages</li>
        `).join('')}
      </ol>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
