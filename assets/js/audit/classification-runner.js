// classification-runner.js - Run privacy classification over all chats

import { getStoredChats } from '../storage.js';
import { classifyChat } from './classifier.js';
import {
  getClassificationCache,
  saveClassificationCache,
  clearClassificationCache,
  needsClassificationRescan
} from './classification-cache.js';
import { hashChat } from './result-cache.js';

let classificationCancelled = false;
let currentClassifications = [];

const CHUNK_SIZE = 20;

/**
 * Run privacy classification on all chats.
 * Processes in chunks to avoid blocking the UI.
 * @param {(progress: {scanned: number, total: number}) => void} onProgress
 * @returns {Promise<object[]>}
 */
export async function runClassificationAudit(onProgress) {
  classificationCancelled = false;
  currentClassifications = [];

  const chats = await getStoredChats();
  const cache = await getClassificationCache();

  let scannedCount = 0;
  const total = chats.length;
  const updatedCache = { ...cache };

  for (let i = 0; i < chats.length; i += CHUNK_SIZE) {
    if (classificationCancelled) break;

    const chunk = chats.slice(i, i + CHUNK_SIZE);

    for (const chat of chunk) {
      if (classificationCancelled) break;

      const chatId = chat.id;
      const cacheEntry = updatedCache[chatId];

      let result;
      if (needsClassificationRescan(chat, cacheEntry)) {
        result = classifyChat(chat, chats);
        updatedCache[chatId] = {
          hash: hashChat(chat),
          result,
          classifiedAt: new Date().toISOString()
        };
      } else {
        result = cacheEntry.result;
      }

      currentClassifications.push(result);
      scannedCount++;
    }

    if (onProgress) {
      onProgress({ scanned: scannedCount, total });
    }

    // Yield to UI thread between chunks
    if (i + CHUNK_SIZE < chats.length) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (!classificationCancelled) {
    await saveClassificationCache(updatedCache);
  }

  return currentClassifications;
}

/**
 * Cancel an in-progress classification.
 */
export function cancelClassification() {
  classificationCancelled = true;
}

/**
 * Get the most recent classifications without re-running.
 * @returns {Promise<object[]>}
 */
export async function getCachedClassifications() {
  if (currentClassifications.length > 0) return currentClassifications;

  const chats = await getStoredChats();
  const cache = await getClassificationCache();
  const results = [];

  for (const chat of chats) {
    const entry = cache[chat.id];
    if (entry?.result) {
      results.push(entry.result);
    }
  }

  currentClassifications = results;
  return results;
}

/**
 * Clear cache and force a full re-classification.
 */
export async function clearClassificationAudit() {
  await clearClassificationCache();
  currentClassifications = [];
}

/**
 * Get current classifications for export.
 */
export function getCurrentClassifications() {
  return currentClassifications;
}
