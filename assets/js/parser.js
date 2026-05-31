// parser.js - ChatGPT conversation parsing

let fallbackIdCounter = 0;

/**
 * Detect the format of the imported data
 * @param {object} data - Parsed JSON data
 * @returns {string} Format type: 'chatgpt', 'chatlog-extension', 'chatlog-backup', 'unknown'
 */
function detectFormat(data) {
  if (!data) return 'unknown';
  
  // Check for extension export format
  if (data.source === 'ChatLog Extension' && data.chats) {
    return 'chatlog-extension';
  }
  
  // Check for ChatLog backup format
  if (data.version && data.chats && data.pinnedIndices !== undefined) {
    return 'chatlog-backup';
  }
  
  // Check for ChatGPT raw format
  if (Array.isArray(data) && data.length > 0 && data[0].mapping !== undefined) {
    return 'chatgpt';
  }
  
  if (data.chats && data.chats.length > 0 && data.chats[0].mapping !== undefined) {
    return 'chatgpt';
  }
  
  return 'unknown';
}

/**
 * Parse ChatGPT conversations.json format
 * Also handles ChatLog extension exports and backups
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

  const format = detectFormat(data);
  console.log('[Parser] Detected format:', format);

  // Handle ChatLog extension export (already in correct format)
  if (format === 'chatlog-extension') {
    return data.chats.map(conv => ({
      id: conv.id || `chat-${Date.now()}-${++fallbackIdCounter}`,
      title: conv.title || 'Untitled Chat',
      messages: (conv.messages || []).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
        createdAt: m.createdAt || new Date().toISOString()
      })),
      createdAt: conv.createdAt || new Date().toISOString(),
      updatedAt: conv.updatedAt || new Date().toISOString()
    })).filter(chat => chat.messages.length > 0);
  }

  // Handle ChatLog backup (has pinnedIndices too)
  if (format === 'chatlog-backup') {
    return data.chats.map(conv => ({
      id: conv.id || `chat-${Date.now()}-${++fallbackIdCounter}`,
      title: conv.title || 'Untitled Chat',
      messages: (conv.messages || []).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
        createdAt: m.createdAt || new Date().toISOString()
      })),
      createdAt: conv.createdAt || new Date().toISOString(),
      updatedAt: conv.updatedAt || new Date().toISOString()
    })).filter(chat => chat.messages.length > 0);
  }

  // Handle raw ChatGPT format
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
