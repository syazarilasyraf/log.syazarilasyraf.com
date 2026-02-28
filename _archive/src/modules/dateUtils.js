// modules/dateUtils.js
export function groupChatByDate(chats, bulkEditMode, displayChat) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const sections = { today: [], yesterday: [], last7: [], last30: [], months: {}, years: {} };
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];

  chats.forEach((chat, index) => {
    const rawDate = chat.date || chat.timestamp || chat.createdAt;
    const date = new Date(rawDate);
    if (isNaN(date)) return;

    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const year = date.getFullYear();
    const monthName = monthNames[date.getMonth()];

    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    entry.setAttribute('data-index', index);

    if (bulkEditMode) {
      entry.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${chat.title || `Chat ${index + 1}`}</span>
        <input type="checkbox" class="chat-select" data-index="${index}">
      </div>`;
    } else {
      entry.textContent = chat.title || `Chat ${index + 1}`;
      entry.onclick = () => displayChat(index);
    }

    if (diffDays === 0) {
      sections.today.push(entry);
    } else if (diffDays === 1) {
      sections.yesterday.push(entry);
    } else if (diffDays <= 7) {
      sections.last7.push(entry);
    } else if (diffDays <= 30) {
      sections.last30.push(entry);
    } else if (year === currentYear) {
      if (!sections.months[monthName]) sections.months[monthName] = [];
      sections.months[monthName].push(entry);
    } else {
      if (!sections.years[year]) sections.years[year] = [];
      sections.years[year].push(entry);
    }
  });

  return sections;
}
