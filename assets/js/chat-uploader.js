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

  chat.messages.forEach((msg, i) => {
    const speaker = msg.role === 'user' ? 'You' : 'ChatGPT';
    const timestamp = new Date(msg.createdAt || new Date()).toLocaleString();
    const content = msg.content.trim().split('\n').map(line => `> ${line}`).join('\n');

    md += `
  <details class="chat-message" open>
    <summary><strong>${i + 1}. ${speaker}</strong> — <em>${timestamp}</em></summary>

    \n\n${content}\n
  </details>
  \n\n
  `;
  });

  const html = marked.parse(md);

  const div = document.createElement('div');
  div.classList.add('rendered-chat');
  div.innerHTML = html;
  container.appendChild(div);
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
