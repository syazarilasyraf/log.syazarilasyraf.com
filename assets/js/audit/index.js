// audit/index.js - Main privacy audit controller

import { getStoredChats } from '../storage.js';
import { defaultRegistry } from './scanner-registry.js';
import {
  getAuditCache,
  saveAuditCache,
  clearAuditCache,
  hashChat,
  needsRescan
} from './result-cache.js';

let scanCancelled = false;
let currentFindings = [];

/**
 * Run privacy audit on all chats.
 * Processes in chunks to avoid blocking the UI.
 * @param {(progress: {scanned: number, total: number, findings: number}) => void} onProgress
 * @returns {Promise<object[]>}
 */
export async function runAudit(onProgress) {
  scanCancelled = false;
  currentFindings = [];

  const chats = await getStoredChats();
  const cache = await getAuditCache();
  const registry = defaultRegistry;

  let scannedCount = 0;
  const total = chats.length;
  const updatedCache = { ...cache };

  // Process in chunks of 10 chats
  const CHUNK_SIZE = 10;
  for (let i = 0; i < chats.length; i += CHUNK_SIZE) {
    if (scanCancelled) break;

    const chunk = chats.slice(i, i + CHUNK_SIZE);

    for (const chat of chunk) {
      if (scanCancelled) break;

      const chatId = chat.id;
      const cacheEntry = updatedCache[chatId];

      if (needsRescan(chat, cacheEntry)) {
        const findings = registry.scanChat(chat);
        updatedCache[chatId] = {
          hash: hashChat(chat),
          findings,
          scannedAt: new Date().toISOString()
        };
        currentFindings.push(...findings);
      } else {
        currentFindings.push(...cacheEntry.findings);
      }

      scannedCount++;
    }

    if (onProgress) {
      onProgress({ scanned: scannedCount, total, findings: currentFindings.length });
    }

    // Yield to UI thread
    if (i + CHUNK_SIZE < chats.length) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (!scanCancelled) {
    await saveAuditCache(updatedCache);
  }

  return currentFindings;
}

/**
 * Cancel an in-progress audit.
 */
export function cancelAudit() {
  scanCancelled = true;
}

/**
 * Get the most recent findings without rescanning.
 * @returns {Promise<object[]>}
 */
export async function getCachedFindings() {
  if (currentFindings.length > 0) return currentFindings;

  const chats = await getStoredChats();
  const cache = await getAuditCache();
  const findings = [];

  for (const chat of chats) {
    const entry = cache[chat.id];
    if (entry?.findings) {
      findings.push(...entry.findings);
    }
  }

  currentFindings = findings;
  return findings;
}

/**
 * Clear cache and force a full rescan.
 */
export async function clearAndRescan() {
  await clearAuditCache();
  currentFindings = [];
}

/**
 * Get current findings for export.
 */
export function getCurrentFindings() {
  return currentFindings;
}
