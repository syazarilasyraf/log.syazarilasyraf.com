// chat-uploader.js

function clearAllChats() {
  localStorage.removeItem('uploadedChats');
  renderChatList();
}

function deleteChat(index) {
  const chats = getStoredChats();
  chats.splice(index, 1);
  localStorage.setItem('uploadedChats', JSON.stringify(chats));
  renderChatList();
}

function getStoredChats() {
  const stored = localStorage.getItem('uploadedChats');
  return stored ? JSON.parse(stored) : [];
}

function renderChatList() {
  const chats = getStoredChats();
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

    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const year = date.getFullYear();
    const monthName = monthNames[date.getMonth()];

    const entry = document.createElement('div');
    entry.className = 'chat-entry';
    entry.textContent = chat.title || `Chat ${index + 1}`;
    entry.setAttribute('data-index', index);

    entry.onclick = () => {
      const container = document.getElementById('chatContainer');
      container.innerHTML = '';
      displayChat(index);
    };

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

  renderSection('Today', sections.today);
  renderSection('Yesterday', sections.yesterday);
  renderSection('Last 7 Days', sections.last7);
  renderSection('Last 30 Days', sections.last30);

  for (const [month, entries] of Object.entries(sections.months)) {
    renderSection(month, entries);
  }

  for (const [year, entries] of Object.entries(sections.years)) {
    renderSection(year, entries);
  }
}

// 👇 NEW version of displayChat()
function displayChat(index) {
  const chats = getStoredChats();
  const chat = chats[index];
  const chatContainer = document.getElementById('chatContainer');
  chatContainer.innerHTML = '';

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = chat.title || `Chat ${index + 1}`;

  const content = document.createElement('div');
  content.classList.add('chat-content');

  if (chat.messages) {
    chat.messages.forEach(message => {
      const role = document.createElement('div');
      role.className = `message ${message.role}`;
      role.innerHTML = `<strong>${message.role}:</strong> ${formatMessageContent(message.content)}`;
      content.appendChild(role);
    });
  } else if (chat.content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(chat.content, 'text/html');
    const rawMessages = [...doc.querySelectorAll('.chat-msg')];

    for (let i = 0; i < rawMessages.length; i += 2) {
      const q = rawMessages[i];
      const a = rawMessages[i + 1];
      const qText = q?.textContent?.trim();
      const aText = a?.textContent?.trim();

      if (!qText && !aText) continue;

      const row = document.createElement('div');
      row.className = 'chat-row';

      if (qText) {
        const qDetails = document.createElement('details');
        qDetails.className = 'half-box';
        const qSummary = document.createElement('summary');
        qSummary.textContent = qText.slice(0, 100);
        const qBox = document.createElement('div');
        qBox.className = 'chat-msg-box question-box';
        qBox.innerHTML = q.innerHTML;
        qDetails.appendChild(qSummary);
        qDetails.appendChild(qBox);
        row.appendChild(qDetails);
      }

      if (aText) {
        const aDetails = document.createElement('details');
        aDetails.className = 'half-box';
        const aSummary = document.createElement('summary');
        aSummary.textContent = aText.slice(0, 100);
        const aBox = document.createElement('div');
        aBox.className = 'chat-msg-box answer-box';
        aBox.innerHTML = a.innerHTML;
        aDetails.appendChild(aSummary);
        aDetails.appendChild(aBox);
        row.appendChild(aDetails);
      }

      content.appendChild(row);
    }
  }

  details.appendChild(summary);
  details.appendChild(content);
  chatContainer.appendChild(details);
}

function parseMarkdown(text) {
  const blocks = text.split(/\*\*\s*(You|ChatGPT)\s*:\s*\*\*/i);
  let messages = [];
  let role = null;

  for (let i = 0; i < blocks.length; i++) {
    if (i % 2 === 1) {
      role = blocks[i].trim().toLowerCase() === 'you' ? 'you' : 'assistant';
    } else if (blocks[i].trim() !== '') {
      const msg = blocks[i].trim().replace(/~~~/g, '');
      const html = applySyntaxHighlighting(msg);
      messages.push(`<div class="chat-msg" data-role="${role}">${html}</div>`);
    }
  }

  return messages.join('\n\n');
}

function parseJSONChats(jsonText) {
  const data = JSON.parse(jsonText);
  return data.map((conv, index) => {
    const messages = Object.values(conv.mapping || {}).map(m => m.message).filter(Boolean);
    const parts = messages.map(msg => {
      const role = msg?.author?.role || 'unknown';
      const label = role === 'user' ? 'you' : role;
      const contentParts = msg?.content?.parts || [];
      const safeText = Array.isArray(contentParts) ? contentParts.join('\n') : '';
      const html = applySyntaxHighlighting(safeText);
      return `<div class="chat-msg" data-role="${label}">${html}</div>`;
    });

    const titleMsg = messages.find(m => m?.author?.role === 'user');
    const title = titleMsg?.content?.parts?.[0]?.slice(0, 50) || `Chat ${index + 1}`;
    const timestamp = conv.create_time ? new Date(conv.create_time * 1000).toISOString() : new Date().toISOString();

    return {
      title,
      content: parts.join('\n\n'),
      createdAt: timestamp
    };
  });
}

function applySyntaxHighlighting(text) {
  return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang = 'plaintext', code) => {
    if (typeof Prism === 'undefined') return match;
    const grammar = Prism.languages[lang] || Prism.languages.plaintext;
    const highlighted = Prism.highlight(code, grammar, lang);
    return `<pre><code class="language-${lang}">${highlighted}</code></pre>`;
  });
}

function formatMessageContent(content) {
  return applySyntaxHighlighting(content);
}

function handleFileUpload(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    let newChats = [];
    try {
      if (file.name.endsWith('.json')) {
        newChats = parseJSONChats(e.target.result);
      } else if (file.name.endsWith('.md')) {
        newChats.push({
          title: file.name.replace('.md', ''),
          content: parseMarkdown(e.target.result),
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      alert(`Error parsing ${file.name}: ${err.message}`);
      return;
    }

    const existing = getStoredChats();
    const combined = [...existing, ...newChats];
    localStorage.setItem('uploadedChats', JSON.stringify(combined));
    renderChatList();
  };

  reader.readAsText(file);
}

window.onload = function () {
  document.getElementById('fileInput').addEventListener('change', function (e) {
    for (const file of e.target.files) {
      handleFileUpload(file);
    }
  });

  renderChatList();
};
