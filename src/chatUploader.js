// src/chatUploader.js

import { getStoredChats, saveChats, clearStoredChats } from './modules/storage.js';
import { getSelectedIndexes } from './modules/selection.js';
import { renderChatList } from './modules/chatList.js';
// import { exportSelectedChatsAsMarkdown } from './modules/exporter.js';

let bulkEditMode = false;
let confirmClearAll = false;
let confirmDeleteSelected = false;

export function clearAllChats(btn = null) {
  const button = btn || document.querySelector('.delete-btn');

  if (!confirmClearAll) {
    button.textContent = 'Sure?';
    button.style.color = 'orange';
    confirmClearAll = true;

    setTimeout(() => {
      button.textContent = '🗑️ Delete All';
      button.style.color = '';
      confirmClearAll = false;
    }, 3000);
  } else {
    clearStoredChats();
    renderChatList(bulkEditMode, displayChat);
    confirmClearAll = false;
  }
}

export function setupBulkDelete() {
  document.querySelectorAll('.bulk-delete').forEach(button => {
    button.addEventListener('click', function () {
      const selected = getSelectedIndexes();
      if (!selected.length) return;

      if (!confirmDeleteSelected) {
        document.querySelectorAll('.bulk-delete').forEach(btn => {
          btn.textContent = 'Sure?';
          btn.style.color = 'orange';
        });

        confirmDeleteSelected = true;

        setTimeout(() => {
          document.querySelectorAll('.bulk-delete').forEach(btn => {
            btn.textContent = btn.classList.contains('delete-btn') ? '🗑️ Delete Selected' : '🗑️';
            btn.style.color = '';
          });
          confirmDeleteSelected = false;
        }, 3000);
      } else {
        // Second tap: actually delete selected chats
        const chats = getStoredChats().filter((_, idx) => !selected.includes(idx));
        saveChats(chats);
        renderChatList(bulkEditMode, displayChat);
        confirmDeleteSelected = false;
      }
    });
  });
}

export function handleFileUpload(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    let newChats = [];
    try {
      if (file.name.endsWith('.json')) {
        newChats = parseJSONChats(e.target.result);
      } else {
        alert("Only .json files are supported.");
        return;
      }
    } catch (err) {
      alert(`Error parsing ${file.name}: ${err.message}`);
      return;
    }

    const existing = getStoredChats();
    const combined = [...existing, ...newChats];
    saveChats(combined);
    renderChatList(bulkEditMode, displayChat);
  };

  reader.readAsText(file);
}

// Your existing parseJSONChats function here or import it if in a module
function parseJSONChats(dataRaw) {
  let data;

  if (typeof dataRaw === 'string') {
    data = JSON.parse(dataRaw);
  } else {
    data = dataRaw;
  }

  const chats = Array.isArray(data) ? data : data.chats;
  if (!Array.isArray(chats)) {
    throw new Error("Invalid format: expected an array or object with 'chats' array");
  }

  return chats.map((conv, index) => {
    const rawMessages = Object.values(conv.mapping || {})
      .map(m => m.message)
      .filter(Boolean);

    const messages = rawMessages.map(msg => ({
      role: msg?.author?.role === 'user' ? 'user' : 'assistant',
      content: msg?.content?.parts?.join('\n') || '',
      createdAt: new Date(conv.create_time * 1000).toISOString()
    }));

    const title = conv.title || `Chat ${index + 1}`;
    const id = conv.conversation_id || `chat-${index}`;

    return {
      id,
      title,
      messages,
      createdAt: new Date(conv.create_time * 1000).toISOString(),
      updatedAt: new Date(conv.update_time * 1000).toISOString?.() || new Date().toISOString()
    };
  });
}

// UI for sidebar toggle
export function setupSidebarToggle() {
  const burger = document.getElementById('burgerButton');
  if (burger) {
    burger.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    });
  }
}
