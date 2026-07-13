// classification-cache.js - Cache privacy classification results per chat

import { openDB } from '../storage.js';
import { hashChat } from './result-cache.js';

const CLASSIFICATION_CACHE_KEY = 'classificationCache';
const STORE_NAME = 'chats';

/**
 * Get cached classification results.
 * @returns {Promise<Record<string, {hash: string, result: object, classifiedAt: string}>>}
 */
export async function getClassificationCache() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CLASSIFICATION_CACHE_KEY);
      req.onsuccess = () => resolve(req.result?.cache || {});
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Classification] Failed to load cache:', err);
    return {};
  }
}

/**
 * Save classification results cache.
 * @param {Record<string, {hash: string, result: object, classifiedAt: string}>} cache
 */
export async function saveClassificationCache(cache) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: CLASSIFICATION_CACHE_KEY,
        cache,
        timestamp: new Date().toISOString()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Classification] Failed to save cache:', err);
  }
}

/**
 * Clear all classification cache.
 */
export async function clearClassificationCache() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(CLASSIFICATION_CACHE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Classification] Failed to clear cache:', err);
  }
}

/**
 * Check if a chat needs re-classification.
 * @param {object} chat
 * @param {object} cacheEntry
 * @returns {boolean}
 */
export function needsClassificationRescan(chat, cacheEntry) {
  if (!cacheEntry) return true;
  const currentHash = hashChat(chat);
  return cacheEntry.hash !== currentHash;
}
