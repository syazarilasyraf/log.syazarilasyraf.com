// src/main.js

import { renderChatList } from './modules/chatList.js';
import { exportSelectedChatsAsMarkdown } from './modules/exporter.js';
import { setupBulkDelete, clearAllChats, handleFileUpload, setupSidebarToggle } from './chatUploader.js';

let bulkEditMode = false;

function toggleBulkEditMode() {
  bulkEditMode = !bulkEditMode;
  document.querySelectorAll('.bulk-controls').forEach(control => {
    control.style.display = bulkEditMode ? 'block' : 'none';
  });
  renderChatList(bulkEditMode, displayChat);
}

function displayChat(index) {
  const chats = getStoredChats();
  const chat = chats[index];
  const container = document.getElementById('chatContainer');
  container.innerHTML = '';

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

  let md = `<details style="margin-bottom: 1em;">
  <summary style="font-weight: bold; cursor: pointer;">Metadata</summary>

  \`\`\`yaml
  ${frontmatter.trim()}
  \`\`\`

  </details>

  ${chatStarted}
  - <a href="${link}" target="_blank" rel="noopener">Continue at ChatGPT</a>

  ---
  `;

  // Escape for Markdown safety
  function escapeMarkdown(text) {
    return text.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  chat.messages.forEach((msg, i) => {
    const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
    const timestamp = new Date(msg.createdAt || new Date()).toLocaleString();
    const content = escapeMarkdown(msg.content.trim())
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');

    md += `
<details class="chat-message" open style="position: relative; padding-right: 25px;">
  <summary>
    <strong>${i + 1}. ${speaker}</strong> — <em>${timestamp}</em>
    <button class="delete-msg-btn" data-msg-index="${i}" style="position: absolute; right: 5px; top: 5px; border: none; background: transparent; color: red; font-weight: bold; cursor: pointer;">(x)</button>
  </summary>

  \n\n${content}\n
</details>\n\n`;
  });

  const html = marked.parse(md);
  const div = document.createElement('div');
  div.classList.add('rendered-chat');
  div.innerHTML = html;
  container.appendChild(div);

  // Delete logic with confirmation
  container.querySelectorAll('.delete-msg-btn').forEach(btn => {
    let confirmDelete = false;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const msgIndex = parseInt(btn.dataset.msgIndex);

      if (!confirmDelete) {
        btn.textContent = 'Sure?';
        btn.style.color = 'orange';
        confirmDelete = true;
        setTimeout(() => {
          btn.textContent = '(x)';
          btn.style.color = 'red';
          confirmDelete = false;
        }, 3000);
      } else {
        deleteMessageFromChat(index, msgIndex);
        renderChatList();
      }
    });
  });
}

function deleteMessageFromChat(chatIndex, msgIndex) {
  const chats = getStoredChats();
  if (!chats[chatIndex]) return;
  chats[chatIndex].messages.splice(msgIndex, 1);
  localStorage.setItem('uploadedChats', JSON.stringify(chats));
  displayChat(chatIndex);
}

window.onload = () => {
  renderChatList(bulkEditMode, displayChat);

  document.querySelectorAll('.toggle-bulk').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', toggleBulkEditMode);
  });

  document.querySelectorAll('.bulk-export').forEach(exportBtn => {
    exportBtn.addEventListener('click', exportSelectedChatsAsMarkdown);
  });

  document.getElementById('fileInput').addEventListener('change', function (e) {
    for (const file of e.target.files) {
      handleFileUpload(file);
    }
  });

  setupBulkDelete();
  setupSidebarToggle();

  document.querySelector('.delete-btn').addEventListener('click', () => clearAllChats());
};
