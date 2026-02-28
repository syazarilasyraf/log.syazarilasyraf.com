// tags.js - Tagging system for chats

import { getStoredChats, saveChatsToDB } from './storage.js';

// Tag storage key in IndexedDB
const TAGS_KEY = 'chatTags';
const DB_NAME = 'ChatLogDB';
const STORE_NAME = 'chats';

let db = null;

async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
  });
}

// Get all tags (returns object: { chatIndex: ['tag1', 'tag2'] })
export async function getAllTags() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(TAGS_KEY);
    
    request.onsuccess = () => {
      resolve(request.result?.tags || {});
    };
    request.onerror = () => reject(request.error);
  });
}

// Save all tags
export async function saveAllTags(tags) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({
      id: TAGS_KEY,
      tags: tags,
      timestamp: new Date().toISOString()
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get tags for a specific chat
export async function getChatTags(chatIndex) {
  const allTags = await getAllTags();
  return allTags[chatIndex] || [];
}

// Add tag to chat
export async function addTag(chatIndex, tag) {
  const allTags = await getAllTags();
  const normalizedTag = tag.toLowerCase().trim();
  
  if (!normalizedTag) return false;
  
  if (!allTags[chatIndex]) {
    allTags[chatIndex] = [];
  }
  
  if (!allTags[chatIndex].includes(normalizedTag)) {
    allTags[chatIndex].push(normalizedTag);
    await saveAllTags(allTags);
    return true;
  }
  return false;
}

// Remove tag from chat
export async function removeTag(chatIndex, tag) {
  const allTags = await getAllTags();
  const normalizedTag = tag.toLowerCase().trim();
  
  if (allTags[chatIndex]) {
    allTags[chatIndex] = allTags[chatIndex].filter(t => t !== normalizedTag);
    if (allTags[chatIndex].length === 0) {
      delete allTags[chatIndex];
    }
    await saveAllTags(allTags);
    return true;
  }
  return false;
}

// Get all unique tags across all chats
export async function getUniqueTags() {
  const allTags = await getAllTags();
  const unique = new Set();
  Object.values(allTags).forEach(tags => {
    tags.forEach(tag => unique.add(tag));
  });
  return Array.from(unique).sort();
}

// Search chats by tag
export async function searchByTag(tag) {
  const allTags = await getAllTags();
  const normalizedTag = tag.toLowerCase().trim();
  const results = [];
  
  for (const [index, tags] of Object.entries(allTags)) {
    if (tags.includes(normalizedTag)) {
      results.push(parseInt(index));
    }
  }
  
  return results;
}

// Update tag indices after chat deletion (indices shift)
export async function updateTagIndices(deletedIndices) {
  const allTags = await getAllTags();
  const newTags = {};
  
  for (const [indexStr, tags] of Object.entries(allTags)) {
    const oldIndex = parseInt(indexStr);
    const deletedBefore = deletedIndices.filter(idx => idx < oldIndex).length;
    const newIndex = oldIndex - deletedBefore;
    
    if (!deletedIndices.includes(oldIndex)) {
      newTags[newIndex] = tags;
    }
  }
  
  await saveAllTags(newTags);
}

// Export tags with chats (for backup)
export async function exportTags() {
  return await getAllTags();
}

// Import tags from backup
export async function importTags(tags) {
  await saveAllTags(tags);
}
