// chat-uploader.js using IndexedDB instead of localStorage

const DB_NAME = 'ChatUploaderDB';
const STORE_NAME = 'Chats';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveChatsToDB(chats) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.put({ id: 'uploadedChats', chats });
  return tx.complete;
}

async function getChatsFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('uploadedChats');
    request.onsuccess = () => resolve(request.result?.chats || []);
    request.onerror = () => reject(request.error);
  });
}

async function clearChatsInDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await store.delete('uploadedChats');
  return tx.complete;
}

async function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const data = JSON.parse(content);
      const chats = Array.isArray(data) ? data : data.chats || [];
      await saveChatsToDB(chats);
      renderChats(chats);
    } catch (err) {
      console.error('Error parsing file:', err);
    }
  };
  reader.readAsText(file);
}

function exportSelectedChatsAsMarkdown() {
  const selected = getSelectedIndexes();
  if (!selected.length) {
    alert('No chats selected for export.');
    return;
  }

  getChatsFromDB().then(chats => {
    const selectedChats = chats.filter((_, idx) => selected.includes(idx));

    selectedChats.forEach((chat, index) => {
      const metadata = {
        chatGPT_conversation_id: chat.id || `chat-${index}`,
        chatGPT_conversation_title: chat.title || `Chat ${index + 1}`,
        chatGPT_create_time: chat.createdAt || new Date().toISOString(),
        chatGPT_update_time: chat.updatedAt || new Date().toISOString(),
        chatGPT_converted_time: new Date().toISOString(),
        chatGPT_first_message_time: chat.messages?.[0]?.createdAt || '',
        chatGPT_last_message_time: chat.messages?.[chat.messages.length - 1]?.createdAt || '',
        chatGPT_dates: [...new Set(chat.messages?.map(m => m.createdAt?.split('T')[0]))] || [],
      };

      let frontmatter = `---\n`;
      for (const [key, value] of Object.entries(metadata)) {
        frontmatter += `${key}: ${Array.isArray(value) ? JSON.stringify(value) : `'${value}'`}\n`;
      }
      frontmatter += `---`;

      const link = `https://chat.openai.com/c/${metadata.chatGPT_conversation_id}`;
      const chatStarted = `*Chat started ${new Date(metadata.chatGPT_create_time).toLocaleString()}*`;

      let md = `${frontmatter}\n\n${chatStarted}\n- [Continue at ChatGPT](${link})\n\n---\n`;

      chat.messages.forEach((msg, i) => {
        const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
        const timestamp = new Date(msg.createdAt || new Date()).toLocaleString();
        const content = msg.content.trim().split('\n').map(line => `> ${line}`).join('\n');
        md += `\n### ${i + 1}. ${speaker} — _${timestamp}_\n\n${content}\n\n`;
      });

      const blob = new Blob([md], { type: 'text/markdown' });
      const filename = `${metadata.chatGPT_conversation_title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)}_${metadata.chatGPT_conversation_id}.md`;
      const linkElem = document.createElement('a');
      linkElem.href = URL.createObjectURL(blob);
      linkElem.download = filename;
      document.body.appendChild(linkElem);
      linkElem.click();
      document.body.removeChild(linkElem);
    });
  });
}

function getSelectedIndexes() {
  return Array.from(document.querySelectorAll('.chat-select:checked'))
    .map(cb => parseInt(cb.dataset.index));
}

function renderChats(chats, bulkEditMode = false) {
  const container = document.getElementById('chatList');
  container.innerHTML = '';
  chats.forEach((chat, index) => {
    const div = document.createElement('div');
    div.className = 'chat-entry';
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = chat.title || `Chat ${index + 1}`;
    div.appendChild(titleSpan);

    if (bulkEditMode) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'chat-select';
      checkbox.dataset.index = index;
      checkbox.style.marginLeft = '1em';
      checkbox.style.width = '1em';
      checkbox.style.height = '1em';
      div.appendChild(checkbox);
    }

    container.appendChild(div);
  });
}

async function renderChatsFromDB(bulkEditMode = false) {
  const chats = await getChatsFromDB();
  renderChats(chats, bulkEditMode);
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const clearButton = document.getElementById('clearButton');
  const burgerButton = document.getElementById('burgerButton');
  const sidebar = document.getElementById('sidebar');

  const toggleBulkButtons = document.querySelectorAll('.toggle-bulk');
  const bulkControls = document.querySelectorAll('#bulkControls');
  const bulkDelete = document.querySelectorAll('#bulkDelete');
  const bulkExport = document.querySelectorAll('#bulkExport');

  let bulkEditMode = false;

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
  });

  clearButton?.addEventListener('click', async () => {
    await clearChatsInDB();
    document.getElementById('chatContainer').innerHTML = '';
    renderChatsFromDB();
  });

  burgerButton?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  toggleBulkButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      bulkEditMode = !bulkEditMode;
      bulkControls.forEach(el => el.style.display = bulkEditMode ? 'block' : 'none');
      renderChatsFromDB(bulkEditMode);
    });
  });

  bulkDelete.forEach(btn => {
    btn.addEventListener('click', async () => {
      const selected = getSelectedIndexes();
      if (!selected.length) return;
      const chats = await getChatsFromDB();
      const filtered = chats.filter((_, idx) => !selected.includes(idx));
      await saveChatsToDB(filtered);
      renderChatsFromDB(bulkEditMode);
    });
  });

  bulkExport.forEach(btn => {
    btn.addEventListener('click', exportSelectedChatsAsMarkdown);
  });

  renderChatsFromDB(); // initial render
});
