// ai.js - OpenAI integration for auto-tagging and summarization
// Users provide their own API key (BYOK - Bring Your Own Key)

import { getSecureItem, setSecureItem, removeSecureItem } from './secure-storage.js';

const API_KEY_STORAGE_KEY = 'openai_api_key';
const TAG_PROMPT_KEY = 'ai_tag_prompt';
const API_BASE_URL = 'https://api.openai.com/v1';

// Default tagging prompt (users can customize)
const DEFAULT_TAG_PROMPT = `Analyze this conversation and generate 3-5 relevant tags.

Conversation Title: {{title}}

First messages:
{{messages}}

Existing tags to avoid duplicates: {{existingTags}}

Rules:
- Use lowercase, single words or short phrases
- Be specific but not too narrow
- Focus on topics, technologies, or domains
- Avoid generic tags like "chat" or "conversation"
- Return ONLY a comma-separated list, nothing else

Example output: javascript, debugging, api, troubleshooting

Tags:`;

// Get user's custom tag prompt or default
export function getTagPrompt() {
  return localStorage.getItem(TAG_PROMPT_KEY) || DEFAULT_TAG_PROMPT;
}

// Save custom tag prompt
export function setTagPrompt(prompt) {
  localStorage.setItem(TAG_PROMPT_KEY, prompt);
}

// Store API key in sessionStorage (cleared when tab closes)
export function setApiKey(key) {
  if (key && key.startsWith('sk-')) {
    setSecureItem(API_KEY_STORAGE_KEY, key);
    return true;
  }
  return false;
}

export function getApiKey() {
  return getSecureItem(API_KEY_STORAGE_KEY);
}

export function clearApiKey() {
  removeSecureItem(API_KEY_STORAGE_KEY);
}

export function hasApiKey() {
  return !!getApiKey();
}

// Validate API key by making a test request
export async function validateApiKey(key) {
  try {
    const response = await fetch(`${API_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      return { valid: true };
    } else {
      const error = await response.json();
      return { valid: false, error: error.error?.message || 'Invalid API key' };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Generate tags for a conversation using OpenAI
export async function generateTags(chat, existingTags = []) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured');
  }

  // Prepare conversation summary for the AI
  const conversationPreview = chat.messages
    ?.slice(0, 10) // First 10 messages for context
    .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
    .join('\n\n') || '';

  // Use custom prompt with variable substitution
  let prompt = getTagPrompt();
  prompt = prompt
    .replace('{{title}}', chat.title || 'Untitled')
    .replace('{{messages}}', conversationPreview)
    .replace('{{existingTags}}', existingTags.join(', '));

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates relevant tags for conversations. Always return only a comma-separated list of tags, no other text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse tags from response
    const tags = content
      .split(/[,\n]/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t && !existingTags.includes(t))
      .slice(0, 5); // Max 5 new tags

    return tags;
  } catch (error) {
    console.error('[AI] Tag generation failed:', error);
    throw error;
  }
}

// Generate summary for a conversation
export async function generateSummary(chat) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured');
  }

  // Limit conversation length to manage token cost
  const messages = chat.messages || [];
  const truncatedMessages = messages.length > 20 
    ? [...messages.slice(0, 10), ...messages.slice(-10)] // First 10 + last 10
    : messages;

  const conversationText = truncatedMessages
    .map(m => `${m.role}: ${m.content.substring(0, 300)}`)
    .join('\n\n');

  const prompt = `Summarize this conversation in 2-3 sentences.

Conversation:
${conversationText}

Summary:`;

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes conversations concisely.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'No summary generated';
  } catch (error) {
    console.error('[AI] Summary generation failed:', error);
    throw error;
  }
}

// Estimate cost before making request (rough estimate)
export function estimateTagCost(chat) {
  // GPT-3.5-turbo: $0.0015 per 1K input tokens, $0.002 per 1K output tokens
  // Rough estimate: 500 tokens input, 20 tokens output = ~$0.0008 per chat
  return {
    estimatedCost: 0.001,
    currency: 'USD',
    note: '~$0.001 per chat (very rough estimate)'
  };
}

// Get usage stats from OpenAI (if available)
export async function getUsageStats() {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    // Note: OpenAI usage API requires special permissions
    // This is a placeholder for future implementation
    return {
      available: false,
      message: 'Usage stats available at https://platform.openai.com/usage'
    };
  } catch (error) {
    return { error: error.message };
  }
}
