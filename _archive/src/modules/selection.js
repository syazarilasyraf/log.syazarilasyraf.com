// modules/selection.js
export function getSelectedIndexes() {
  return Array.from(document.querySelectorAll('.chat-select:checked'))
    .map(cb => parseInt(cb.dataset.index));
}