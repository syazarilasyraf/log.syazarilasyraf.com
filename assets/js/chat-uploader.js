// chat-uploader.js

let bulkEditMode = false;
let confirmClearAll = false;
let confirmDeleteSelected = false;
// let folderViewEnabled = false;

function clearAllChats(btn = null) {
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
    localStorage.removeItem('uploadedChats');
    renderChatList();
    confirmClearAll = false;
  }
}

// Attach event to all buttons with the 'bulk-delete' class
document.querySelectorAll('.bulk-delete').forEach(button => {
  button.addEventListener('click', function () {
    const selected = getSelectedIndexes();
    if (!selected.length) return;

    if (!confirmDeleteSelected) {
      // First tap: show confirmation
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
      localStorage.setItem('uploadedChats', JSON.stringify(chats));
      renderChatList();
      confirmDeleteSelected = false;
    }
  });
});

// modules/storage.js
function getStoredChats() {
  const stored = localStorage.getItem('uploadedChats');
  return stored ? JSON.parse(stored) : [];
}

// modules/selection.js
function getSelectedIndexes() {
  return Array.from(document.querySelectorAll('.chat-select:checked'))
    .map(cb => parseInt(cb.dataset.index));
}

// modules/exporter.js
function exportSelectedChatsAsMarkdown() {
  const selected = getSelectedIndexes();
  if (!selected.length) {
    alert('No chats selected for export.');
    return;
  }

  const chats = getStoredChats().filter((_, idx) => selected.includes(idx));

  chats.forEach((chat, index) => {
    const metadata = {
      chatGPT_conversation_title: chat.title || `Chat ${index + 1}`,
      chatGPT_dates: [...new Set(chat.messages?.map(m => m.createdAt?.split('T')[0]))] || [],
      chatGPT_create_time: chat.createdAt || new Date().toISOString(),
      chatGPT_update_time: chat.updatedAt || new Date().toISOString(),
      chatGPT_converted_time: new Date().toISOString(),
      chatGPT_conversation_id: chat.id || `chat-${index}`,
    };

    let frontmatter = `---\n`;
    for (const [key, value] of Object.entries(metadata)) {
      frontmatter += `${key}: ${Array.isArray(value) ? JSON.stringify(value) : `'${value}'`}\n`;
    }
    frontmatter += `---`;

    const link = `https://chat.openai.com/c/${metadata.chatGPT_conversation_id}`;
    const chatStarted = `*Chat started ${new Date(metadata.chatGPT_create_time).toLocaleString()}*`;

    let md = `${frontmatter}

${chatStarted}
- [Continue at ChatGPT](${link})

---
`;

    chat.messages.forEach((msg, i) => {
      const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
      const timestamp = new Date(msg.createdAt || new Date()).toLocaleString();
      const content = msg.content.trim().split('\n').map(line => `> ${line}`).join('\n');
      md += `\n### ${i + 1}. ${speaker} — _${timestamp}_\n\n${content}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const filename = `${metadata.chatGPT_conversation_title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'chat'}.md`;
    const linkElem = document.createElement('a');
    linkElem.href = URL.createObjectURL(blob);
    linkElem.download = filename;
    document.body.appendChild(linkElem);
    linkElem.click();
    document.body.removeChild(linkElem);
  });
}

// function formatSectionLabel(label) {
//   return label.replace(/\b\w/g, char => char.toUpperCase());
// }

// function renderFolderStyleView(sections) {
//   const chatList = document.getElementById('chatList');
//   if (!chatList) return;

//   chatList.innerHTML = '';

//   for (const [label, entries] of Object.entries(sections)) {
//     if (!entries || entries.length === 0) continue;

//     const folder = document.createElement('details');
//     folder.open = true;

//     const summary = document.createElement('summary');
//     summary.textContent = formatSectionLabel(label);
//     folder.appendChild(summary);

//     entries.forEach(entry => folder.appendChild(entry));
//     chatList.appendChild(folder);
//   }
// }

// modules/chatList.js
function renderChatList() {
  const chats = getStoredChats();
  const pinnedIndices = new Set(JSON.parse(localStorage.getItem('pinnedChats') || '[]'));
  const chatList = document.getElementById('chatList');
  chatList.innerHTML = '';

  const now = new Date();
  const currentYear = now.getFullYear();

  const sections = {
    today: [],
    yesterday: [],
    last7: [],
    last30: [],
    months: {},
    years: {}
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  chats.forEach((chat, index) => {
  const rawDate = chat.date || chat.timestamp || chat.createdAt;
  const date = new Date(rawDate);

  if (isNaN(date)) return;

  const entry = document.createElement('div');
  entry.className = 'chat-entry';
  entry.setAttribute('data-index', index);

  if (bulkEditMode) {
    entry.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
      <span class="chat-title" style="flex: 1;">${chat.title || `Chat ${index + 1}`}</span>
      <input type="checkbox" class="chat-select" data-index="${index}" style="margin-left: 0.5em; width: 1em; height: 1em;">
    </div>
    `;
    entry.querySelector('.chat-title').addEventListener('click', () => {
      document.querySelectorAll('.chat-entry').forEach(el => el.classList.remove('selected'));
      entry.classList.add('selected');
      const container = document.getElementById('chatContainer');
      container.innerHTML = '';
      displayChat(index);
    });
  } else {
    entry.textContent = chat.title || `Chat ${index + 1}`;
    entry.onclick = () => {
      if (!bulkEditMode) {
        document.querySelectorAll('.chat-entry').forEach(el => el.classList.remove('selected'));
        entry.classList.add('selected');
        const container = document.getElementById('chatContainer');
        container.innerHTML = '';
        displayChat(index);
      }
    };
  }

  if (pinnedIndices.has(index)) {
    if (!sections.pinned) sections.pinned = [];
    sections.pinned.push(entry);
    return;
  }

  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const year = date.getFullYear();
  const monthName = monthNames[date.getMonth()];

  if (diffDays === 0) {
    sections.today.push(entry);
  } else if (diffDays === 1) {
    sections.yesterday.push(entry);
  } else if (diffDays <= 7) {
    sections.last7.push(entry);
  } else if (diffDays <= 30) {
    sections.last30.push(entry);
  } else if (year === currentYear) {
    if (!sections.months[monthName]) sections.months[monthName] = [];
    sections.months[monthName].push(entry);
  } else {
    if (!sections.years[year]) sections.years[year] = [];
    sections.years[year].push(entry);
  }
});

  function renderSection(title, entries) {
    if (!entries.length) return;
    const section = document.createElement('div');
    section.className = 'chat-section';
    const header = document.createElement('h3');
    header.textContent = title;
    section.appendChild(header);
    entries.forEach(entry => section.appendChild(entry));
    chatList.appendChild(section);
  }
  
  if (folderViewEnabled) { // folder features - not finish yet
    renderFolderStyleView(sections); // folder features - not finish yet
  } else { // folder features - not finish yet
    // Render normally in flat sections
    if (sections.pinned) { // folder features - not finish yet
      renderSection('📌 Pinned', sections.pinned);
    } // folder features - not finish yet
  renderSection('Today', sections.today);
  renderSection('Yesterday', sections.yesterday);
  renderSection('Last 7 Days', sections.last7);
  renderSection('Last 30 Days', sections.last30);
  } // folder features - not finish yet

  for (const [month, entries] of Object.entries(sections.months)) {
    renderSection(month, entries);
  }

  for (const [year, entries] of Object.entries(sections.years)) {
    renderSection(year, entries);
  }
}

document.addEventListener('DOMContentLoaded', () => {

  // All toggle buttons with the same behavior
  document.querySelectorAll('.toggle-bulk').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', () => {
      bulkEditMode = !bulkEditMode;
      document.querySelectorAll('.bulk-controls').forEach(control => {
        control.style.display = bulkEditMode ? 'block' : 'none';
      });
      renderChatList();
    });
  });

  const searchInput = document.getElementById('chatSearch');
  const searchContainer = document.getElementById('searchContainer');

  searchInput.addEventListener('focus', () => {
    if (window.innerWidth >= 768) {
      searchContainer.classList.add('floating');
    }
  });

  // Hook up export buttons in both places
  document.querySelectorAll('.bulk-export').forEach(exportBtn => {
    exportBtn.addEventListener('click', exportSelectedChatsAsMarkdown);
  });

  document.getElementById('chatSearch').addEventListener('input', async (e) => {
    const query = e.target.value.toLowerCase();
    const chats = await getStoredChats();
    const resultsByTitle = [];
    const resultsByContent = [];

      chats.forEach((chat, index) => {
        const inTitle = chat.title && chat.title.toLowerCase().includes(query);
        const inContent = chat.messages?.some(m => m.content.toLowerCase().includes(query));

        if (inTitle) {
          resultsByTitle.push({ chat, index });
        }
        if (!inTitle && inContent) {
          resultsByContent.push({ chat, index });
        }
      });

    renderSearchResults(resultsByTitle, resultsByContent);
    });
});

// New — binds to *all* elements with the 'bulk-pin' class
document.querySelectorAll('.bulk-pin').forEach(pinBtn => {
  pinBtn.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.chat-select:checked');
    const pinnedIndices = new Set(JSON.parse(localStorage.getItem('pinnedChats') || '[]'));

    checkboxes.forEach(checkbox => {
      const index = parseInt(checkbox.getAttribute('data-index'));
      if (pinnedIndices.has(index)) {
        pinnedIndices.delete(index);
      } else {
        pinnedIndices.add(index);
      }
    });

    localStorage.setItem('pinnedChats', JSON.stringify([...pinnedIndices]));
    renderChatList();
  });
});

function renderSearchResults(resultsByTitle, resultsByContent) {
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = '';

  if (resultsByTitle.length === 0 && resultsByContent.length === 0) {
    resultsContainer.innerHTML = '<p>No results found.</p>';
    return;
  }

  const createResultItem = ({ chat, index }, matchSnippet = null) => {
    const div = document.createElement('div');
    div.className = 'search-result';

    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = chat.title || `Chat ${index + 1}`;

    div.appendChild(title);

    if (matchSnippet) {
      const snippet = document.createElement('div');
      snippet.className = 'result-snippet';
      snippet.textContent = matchSnippet;
      div.appendChild(snippet);
    }

  div.addEventListener('click', () => {
    displayChat(index); 

    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('chatSearch').value = '';
    document.getElementById('searchContainer').classList.remove('floating');
  });

    return div;
  };

  const appendSection = (label, results, showSnippets = false) => {
    if (results.length === 0) return;

    const sectionTitle = document.createElement('h3');
    sectionTitle.innerText = label;
    sectionTitle.className = 'search-section-title';
    resultsContainer.appendChild(sectionTitle);

    results.forEach(({ chat, index }) => {
      let snippet = null;

      if (showSnippets) {
        const messageMatch = chat.messages?.find(m =>
          m.content.toLowerCase().includes(document.getElementById('chatSearch').value.toLowerCase())
        );
        if (messageMatch) {
          const content = messageMatch.content;
          const query = document.getElementById('chatSearch').value.toLowerCase();
          const matchIndex = content.toLowerCase().indexOf(query);
          if (matchIndex !== -1) {
            const start = Math.max(0, matchIndex - 30);
            const end = Math.min(content.length, matchIndex + 30);
            snippet = (start > 0 ? '…' : '') +
              content.substring(start, end).trim() +
              (end < content.length ? '…' : '');
          }
        }
      }

      resultsContainer.appendChild(createResultItem({ chat, index }, snippet));
    });
  };

  appendSection('Matches in Title', resultsByTitle);
  appendSection('Matches in Messages', resultsByContent, true);
}

function displayChat(index) {
  const chats = getStoredChats();
  const chat = chats[index];
  const container = document.getElementById('chatContainer');
  container.innerHTML = '';

  const metadata = {
    chatGPT_conversation_title: chat.title || `Chat ${index + 1}`,
    chatGPT_dates: [...new Set(chat.messages?.map(m => m.createdAt?.split('T')[0]))] || [],
    chatGPT_create_time: chat.createdAt || new Date().toISOString(),
    chatGPT_update_time: chat.updatedAt || new Date().toISOString(),
    chatGPT_converted_time: new Date().toISOString(),
    chatGPT_conversation_id: chat.id || `chat-${index}`,
  };

  let frontmatter = `---\n`;
  for (const [key, value] of Object.entries(metadata)) {
    frontmatter += `${key}: ${Array.isArray(value) ? JSON.stringify(value) : `'${value}'`}\n`;
  }
  frontmatter += `---`;

  const link = `https://chat.openai.com/c/${metadata.chatGPT_conversation_id}`;
  const chatStarted = `*Chat started ${new Date(metadata.chatGPT_create_time).toLocaleString()}*`;

  let md = `<details open style="
    border: 1px solid #ddd; 
    border-radius: 4px; 
    padding: 0.5em 1em 0em 1em;
    font-family: 'Courier New', monospace;
  ">
    <summary style="
      font-weight: bold; 
      cursor: pointer; 
      padding: 0.3em 0;
      outline: none;
    ">Metadata</summary>

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
    const speakerClass = msg.role === 'user' ? 'you' : 'chatgpt';
    const timestamp = new Date(msg.createdAt || new Date()).toLocaleString();
    const content = escapeMarkdown(msg.content.trim())
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');

    md += `
<details class="chat-message ${speakerClass}" open style="position: relative; padding-right: 25px;">
  <summary>
    <strong>${i + 1}. ${speaker}</strong>
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

function handleFileUpload(file) {
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

    if (localStorage.getItem('uploadedChats')) {
      const confirmReplace = confirm("Only one file is supported at a time. Uploading a new file will replace your current chats. Continue?");
      if (!confirmReplace) return;
    }

    localStorage.setItem('uploadedChats', JSON.stringify(newChats));
    renderChatList();
  };

  reader.readAsText(file);
}

document.getElementById('burgerButton').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
});

// document.getElementById('toggleFolderView').addEventListener('click', () => { 
//   folderViewEnabled = !folderViewEnabled; 
//   renderChatList(); 
// }); 

window.onload = function () {
  document.getElementById('fileInput').addEventListener('change', function (e) {
    for (const file of e.target.files) {
      handleFileUpload(file);
    }
  });

  renderChatList();
};
