// tags.js - Tagging system for chats

import { getAllTags, saveAllTags } from './storage.js';

// Get tags for a specific chat
export async function getChatTags(chatId) {
  const allTags = await getAllTags();
  return allTags[chatId] || [];
}

// Add tag to chat
export async function addTag(chatId, tag) {
  const allTags = await getAllTags();
  const normalizedTag = tag.toLowerCase().trim();
  
  if (!normalizedTag) return false;
  
  if (!allTags[chatId]) {
    allTags[chatId] = [];
  }
  
  if (!allTags[chatId].includes(normalizedTag)) {
    allTags[chatId].push(normalizedTag);
    await saveAllTags(allTags);
    return true;
  }
  return false;
}

// Remove tag from chat
export async function removeTag(chatId, tag) {
  const allTags = await getAllTags();
  const normalizedTag = tag.toLowerCase().trim();
  
  if (allTags[chatId]) {
    allTags[chatId] = allTags[chatId].filter(t => t !== normalizedTag);
    if (allTags[chatId].length === 0) {
      delete allTags[chatId];
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
  
  for (const [chatId, tags] of Object.entries(allTags)) {
    if (tags.includes(normalizedTag)) {
      results.push(chatId);
    }
  }
  
  return results;
}

// Export tags with chats (for backup)
export async function exportTags() {
  return await getAllTags();
}

// Import tags from backup
export async function importTags(tags) {
  await saveAllTags(tags);
}

// Re-export for backward compatibility
export { getAllTags, saveAllTags };
