// result-cache.js - Cache audit results per chat to avoid rescanning unchanged chats

import { openDB } from '../storage.js';

const AUDIT_CACHE_KEY = 'auditCache';
const STORE_NAME = 'chats';

/**
 * Compute a fast content hash for a chat.
 * Used to determine if a chat needs rescanning.
 */
export function hashChat(chat) {
  const title = chat.title || '';
  const msgCount = chat.messages?.length || 0;
  let msgLength = 0;
  if (chat.messages) {
    for (const m of chat.messages) {
      msgLength += (m.content || '').length;
    }
  }
  const updatedAt = chat.updatedAt || '';
  const str = `${title}:${msgCount}:${msgLength}:${updatedAt}`;

  // Simple FNV-1a hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

async function getCacheDb() {
  return openDB();
}

/**
 * Get cached audit results.
 * @returns {Promise<Record<string, {hash: string, findings: object[], scannedAt: string}>>}
 */
export async function getAuditCache() {
  try {
    const db = await getCacheDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AUDIT_CACHE_KEY);
      req.onsuccess = () => resolve(req.result?.cache || {});
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Audit] Failed to load cache:', err);
    return {};
  }
}

/**
 * Save audit results cache.
 * @param {Record<string, {hash: string, findings: object[], scannedAt: string}>} cache
 */
export async function saveAuditCache(cache) {
  try {
    const db = await getCacheDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: AUDIT_CACHE_KEY,
        cache,
        timestamp: new Date().toISOString()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Audit] Failed to save cache:', err);
  }
}

/**
 * Clear all audit cache.
 */
export async function clearAuditCache() {
  try {
    const db = await getCacheDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(AUDIT_CACHE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('[Audit] Failed to clear cache:', err);
  }
}

/**
 * Check if a chat needs rescanning.
 * @param {object} chat
 * @param {object} cacheEntry
 * @returns {boolean}
 */
export function needsRescan(chat, cacheEntry) {
  if (!cacheEntry) return true;
  const currentHash = hashChat(chat);
  return cacheEntry.hash !== currentHash;
}
