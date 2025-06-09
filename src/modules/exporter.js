// modules/exporter.js
import { getSelectedIndexes } from './selection.js';
import { getStoredChats } from './storage.js';

export function exportSelectedChatsAsMarkdown() {
  const selected = getSelectedIndexes();
  if (!selected.length) {
    alert('No chats selected for export.');
    return;
  }

  const chats = getStoredChats().filter((_, idx) => selected.includes(idx));

  chats.forEach((chat, index) => {
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
    const filename = `${metadata.chatGPT_conversation_title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'chat'}.md`;
    const linkElem = document.createElement('a');
    linkElem.href = URL.createObjectURL(blob);
    linkElem.download = filename;
    document.body.appendChild(linkElem);
    linkElem.click();
    document.body.removeChild(linkElem);
  });
}
