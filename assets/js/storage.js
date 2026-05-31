// storage.js - IndexedDB storage with localStorage migration

const DB_NAME = 'ChatLogDB';
const STORE_NAME = 'chats';
const DB_VERSION = 1;

let db = null;

// Initialize the database
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Get all chats
async function getStoredChats() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('uploadedChats');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result && result.chats ? result.chats : []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting chats from IndexedDB:', error);
    // Fallback to empty array
    return [];
  }
}

// Save all chats
async function saveChatsToDB(chats) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put({
      id: 'uploadedChats',
      chats: chats,
      timestamp: new Date().toISOString()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Clear all chats
async function clearChatsInDB() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete('uploadedChats');
    store.delete('pinnedChats');
    store.delete('chatTags');

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Get pinned chats
async function getPinnedChats() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('pinnedChats');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result && result.indices ? result.indices : []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting pinned chats:', error);
    return [];
  }
}

// Save pinned chats
async function savePinnedChats(indices) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put({
      id: 'pinnedChats',
      indices: indices,
      timestamp: new Date().toISOString()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// MIGRATION: Move data from localStorage to IndexedDB
async function migrateFromLocalStorage() {
  const legacyKey = 'uploadedChats';
  const legacyPinnedKey = 'pinnedChats';
  
  const legacyData = localStorage.getItem(legacyKey);
  const legacyPinned = localStorage.getItem(legacyPinnedKey);
  
  let migrated = false;

  if (legacyData) {
    try {
      const chats = JSON.parse(legacyData);
      if (Array.isArray(chats) && chats.length > 0) {
        console.log(`Migrating ${chats.length} chats from localStorage to IndexedDB...`);
        await saveChatsToDB(chats);
        console.log('Chats migrated successfully.');
        migrated = true;
      }
      // Clear localStorage after successful migration
      localStorage.removeItem(legacyKey);
    } catch (error) {
      console.error('Error migrating chats:', error);
    }
  }

  if (legacyPinned) {
    try {
      const indices = JSON.parse(legacyPinned);
      if (Array.isArray(indices)) {
        console.log(`Migrating ${indices.length} pinned chats...`);
        await savePinnedChats(indices);
        console.log('Pinned chats migrated successfully.');
      }
      localStorage.removeItem(legacyPinnedKey);
    } catch (error) {
      console.error('Error migrating pinned chats:', error);
    }
  }

  return migrated;
}

// Migrate tags from index-based (numeric keys) to chat ID-based format
async function migrateTagsToChatIds(chats) {
  const allTags = await getAllTags();
  const keys = Object.keys(allTags);
  
  // Check if any key is a numeric index (old format)
  const hasNumericKeys = keys.some(k => /^\d+$/.test(k));
  if (!hasNumericKeys) return false;
  
  const newTags = {};
  for (const [key, tags] of Object.entries(allTags)) {
    const index = parseInt(key, 10);
    if (!isNaN(index) && chats[index] && chats[index].id) {
      newTags[chats[index].id] = tags;
    }
  }
  
  await saveAllTags(newTags);
  console.log(`[Migration] Converted ${keys.length} index-based tags to chat ID format.`);
  return true;
}

// Get all tags
async function getAllTags() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('chatTags');

      request.onsuccess = () => {
        resolve(request.result?.tags || {});
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting tags from IndexedDB:', error);
    return {};
  }
}

// Save all tags
async function saveAllTags(tags) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put({
      id: 'chatTags',
      tags: tags,
      timestamp: new Date().toISOString()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Export all data as a JSON file for backup
async function exportAllData() {
  const chats = await getStoredChats();
  const pinned = await getPinnedChats();
  const tags = await getAllTags();
  
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    chats: chats,
    pinnedIndices: pinned,
    tags: tags
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import data from a backup file
async function importFromBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.chats && Array.isArray(data.chats)) {
          await saveChatsToDB(data.chats);
        }
        
        if (data.pinnedIndices && Array.isArray(data.pinnedIndices)) {
          await savePinnedChats(data.pinnedIndices);
        }
        
        if (data.tags && typeof data.tags === 'object') {
          await saveAllTags(data.tags);
        }
        
        resolve(data.chats ? data.chats.length : 0);
      } catch (error) {
        reject(new Error('Invalid backup file format'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export {
  openDB,
  getStoredChats,
  saveChatsToDB,
  clearChatsInDB,
  getPinnedChats,
  savePinnedChats,
  getAllTags,
  saveAllTags,
  migrateFromLocalStorage,
  migrateTagsToChatIds,
  exportAllData,
  importFromBackup
};
