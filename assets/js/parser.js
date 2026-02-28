// parser.js - ChatGPT conversation parsing

/**
 * Parse ChatGPT conversations.json format
 * @param {string|object} dataRaw - Raw JSON string or parsed object
 * @returns {Array} Array of normalized chat objects
 */
function parseJSONChats(dataRaw) {
  let data;

  if (typeof dataRaw === 'string') {
    try {
      data = JSON.parse(dataRaw);
    } catch (err) {
      throw new Error('Invalid JSON file');
    }
  } else {
    data = dataRaw;
  }

  const conversations = Array.isArray(data) ? data : data.chats;
  
  if (!Array.isArray(conversations)) {
    throw new Error("Invalid format: expected an array or object with 'chats' array");
  }

  return conversations.map((conv, index) => {
    const rawMessages = Object.values(conv.mapping || {})
      .map(m => m.message)
      .filter(Boolean);

    const messages = rawMessages.map(msg => ({
      role: msg?.author?.role === 'user' ? 'user' : 'assistant',
      content: msg?.content?.parts?.join('\n') || '',
      createdAt: conv.create_time ? new Date(conv.create_time * 1000).toISOString() : new Date().toISOString()
    })).filter(m => m.content.trim().length > 0);

    const title = conv.title?.trim() || `Chat ${index + 1}`;
    const id = conv.conversation_id || `chat-${index}-${Date.now()}`;

    return {
      id,
      title,
      messages,
      createdAt: conv.create_time ? new Date(conv.create_time * 1000).toISOString() : new Date().toISOString(),
      updatedAt: conv.update_time ? new Date(conv.update_time * 1000).toISOString() : new Date().toISOString()
    };
  }).filter(chat => chat.messages.length > 0);
}

/**
 * Merge new chats with existing, avoiding duplicates by ID
 * @param {Array} existing - Current chats
 * @param {Array} newChats - New chats to merge
 * @returns {Array} Merged chats
 */
function mergeChats(existing, newChats) {
  const existingIds = new Set(existing.map(c => c.id));
  const uniqueNew = newChats.filter(c => !existingIds.has(c.id));
  return [...existing, ...uniqueNew];
}

export { parseJSONChats, mergeChats };
