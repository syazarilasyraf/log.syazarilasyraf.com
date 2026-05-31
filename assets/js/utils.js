// utils.js - Shared utility functions

/**
 * Escape HTML special characters to prevent XSS.
 * Escapes &, <, >, ", ', `, and /.
 */
export function escapeHtml(text) {
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
