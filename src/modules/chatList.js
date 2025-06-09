// modules/chatList.js
import { getStoredChats } from './storage.js';
import { renderSection } from './renderUtils.js';
import { groupChatByDate } from './dateUtils.js';

export function renderChatList(bulkEditMode, displayChat) {
  const chats = getStoredChats();
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = '';

  const sections = groupChatByDate(chats, bulkEditMode, displayChat); // Pass in helpers

  renderSection('Today', sections.today, chatList);
  renderSection('Yesterday', sections.yesterday, chatList);
  renderSection('Last 7 Days', sections.last7, chatList);
  renderSection('Last 30 Days', sections.last30, chatList);

  for (const [month, entries] of Object.entries(sections.months)) {
    renderSection(month, entries, chatList);
  }

  for (const [year, entries] of Object.entries(sections.years)) {
    renderSection(year, entries, chatList);
  }
}
