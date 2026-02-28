// modules/renderUtils.js
export function renderSection(title, entries, parentElement) {
  if (!entries.length) return;

  const section = document.createElement('div');
  section.className = 'chat-section';

  const header = document.createElement('h3');
  header.textContent = title;

  section.appendChild(header);
  entries.forEach(entry => section.appendChild(entry));
  parentElement.appendChild(section);
}
