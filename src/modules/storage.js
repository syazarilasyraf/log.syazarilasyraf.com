// modules/storage.js
export function getStoredChats() {
  try {
    const stored = localStorage.getItem('uploadedChats');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to parse stored chats:', e);
    return [];
  }
}

export function saveChats(chats) {
  localStorage.setItem('uploadedChats', JSON.stringify(chats));
}

export function clearStoredChats() {
  localStorage.removeItem('uploadedChats');
}