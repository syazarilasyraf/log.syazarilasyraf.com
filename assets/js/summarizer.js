// summarizer.js - Flexible summarization for any duration and single chats
// Privacy-first: All processing client-side with user's API key

import { getStoredChats } from './storage.js';
import { hasApiKey, getApiKey } from './ai.js';

const SUMMARY_PROMPT_KEY = 'flexible_summary_prompt';
const SINGLE_CHAT_PROMPT_KEY = 'single_chat_summary_prompt';

// Default prompts (users can customize)
const DEFAULT_BATCH_PROMPT = `Summarize these ChatGPT conversations from {{duration}}.

CONVERSATIONS:
{{conversations}}

Create a summary with:
1. **Overview** - Brief summary of overall activity
2. **Main Topics** - Key subjects covered (bullet points)
3. **Key Insights** - Important learnings or decisions
4. **Action Items** - Tasks or follow-ups mentioned
5. **Notable Conversations** - Standout discussions

Statistics:
- Total conversations: {{chatCount}}
- Total messages: {{messageCount}}
- Date range: {{dateRange}}

Keep it concise but informative.`;

const DEFAULT_SINGLE_PROMPT = `Summarize this ChatGPT conversation.

Title: {{title}}
Date: {{date}}
Messages: {{messageCount}}

CONVERSATION:
{{messages}}

Provide:
1. **Summary** - 2-3 sentence overview
2. **Key Points** - Main takeaways (bullet points)
3. **Decisions/Actions** - Any conclusions or next steps

Be concise and informative.`;

// Get/set prompts
export function getBatchPrompt() {
  return localStorage.getItem(SUMMARY_PROMPT_KEY) || DEFAULT_BATCH_PROMPT;
}

export function setBatchPrompt(prompt) {
  localStorage.setItem(SUMMARY_PROMPT_KEY, prompt);
}

export function getSinglePrompt() {
  return localStorage.getItem(SINGLE_CHAT_PROMPT_KEY) || DEFAULT_SINGLE_PROMPT;
}

export function setSinglePrompt(prompt) {
  localStorage.setItem(SINGLE_CHAT_PROMPT_KEY, prompt);
}

// Duration presets
export const DURATION_PRESETS = {
  today: { label: 'Today', days: 1 },
  yesterday: { label: 'Yesterday', days: 1, offset: 1 },
  last7: { label: 'Last 7 Days', days: 7 },
  last30: { label: 'Last 30 Days', days: 30 },
  thisMonth: { label: 'This Month', days: 30 },
  lastMonth: { label: 'Last Month', days: 30, offset: 30 },
  all: { label: 'All Time', days: 36500 }
};

// Get conversations for a duration
export async function getConversationsForDuration(presetKey, customStartDate = null, customEndDate = null) {
  const chats = await getStoredChats();
  
  let startDate, endDate;
  
  if (presetKey === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999); // Include full end day
  } else {
    const preset = DURATION_PRESETS[presetKey] || DURATION_PRESETS.last7;
    const offset = preset.offset || 0;
    
    endDate = new Date();
    endDate.setDate(endDate.getDate() - offset);
    
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - preset.days);
  }
  
  const filtered = chats.filter(chat => {
    const chatDate = new Date(chat.createdAt || chat.updatedAt);
    return chatDate >= startDate && chatDate <= endDate;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return {
    conversations: filtered,
    startDate,
    endDate,
    preset: presetKey
  };
}

// Format conversations for prompt
function formatConversations(conversations, maxPreviewLength = 200) {
  return conversations.map((chat, index) => {
    const messages = (chat.messages || []).slice(0, 5); // First 5 messages
    const preview = messages.map(m => {
      const role = m.role === 'user' ? 'User' : 'AI';
      const content = m.content.substring(0, maxPreviewLength);
      return `${role}: ${content}${m.content.length > maxPreviewLength ? '...' : ''}`;
    }).join('\n');
    
    return `Conversation ${index + 1}: ${chat.title}
Date: ${new Date(chat.createdAt).toLocaleDateString()}
Messages: ${chat.messages?.length || 0}
Preview:
${preview}
---`;
  }).join('\n\n');
}

// Format single conversation
function formatSingleConversation(chat) {
  const messages = chat.messages || [];
  return messages.map((m, i) => {
    const role = m.role === 'user' ? 'User' : 'AI';
    const content = m.content.substring(0, 500);
    return `[${i + 1}] ${role}: ${content}${m.content.length > 500 ? '...' : ''}`;
  }).join('\n\n');
}

// Calculate stats
function calculateStats(conversations) {
  const chatCount = conversations.length;
  const messageCount = conversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
  
  // Find most active day
  const dayCounts = {};
  conversations.forEach(chat => {
    const date = new Date(chat.createdAt).toDateString();
    dayCounts[date] = (dayCounts[date] || 0) + 1;
  });
  
  const mostActiveDay = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  
  return { chatCount, messageCount, mostActiveDay };
}

// Generate batch summary (flexible duration)
export async function generateBatchSummary(presetKey, customStartDate = null, customEndDate = null) {
  if (!hasApiKey()) {
    throw new Error('OpenAI API key required');
  }
  
  const { conversations, startDate, endDate } = await getConversationsForDuration(
    presetKey, customStartDate, customEndDate
  );
  
  if (conversations.length === 0) {
    return {
      summary: '# Summary\n\nNo conversations found for the selected period.',
      conversations: [],
      stats: { chatCount: 0, messageCount: 0, mostActiveDay: 'N/A' },
      startDate,
      endDate
    };
  }
  
  const stats = calculateStats(conversations);
  const formattedConvs = formatConversations(conversations);
  
  const preset = DURATION_PRESETS[presetKey] || { label: 'Custom Period' };
  const durationLabel = presetKey === 'custom' 
    ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
    : preset.label;
  
  // Build prompt with variable substitution
  let prompt = getBatchPrompt();
  prompt = prompt
    .replace('{{duration}}', durationLabel)
    .replace('{{conversations}}', formattedConvs)
    .replace('{{chatCount}}', stats.chatCount)
    .replace('{{messageCount}}', stats.messageCount)
    .replace('{{dateRange}}', `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`)
    .replace('{{mostActiveDay}}', stats.mostActiveDay);
  
  const apiKey = getApiKey();
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a helpful assistant that summarizes ChatGPT conversations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.5
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    
    return {
      summary,
      conversations,
      stats,
      startDate,
      endDate,
      durationLabel,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Summarizer] Batch summary failed:', error);
    throw error;
  }
}

// Generate single chat summary
export async function generateSingleSummary(chat) {
  if (!hasApiKey()) {
    throw new Error('OpenAI API key required');
  }
  
  if (!chat || !chat.messages || chat.messages.length === 0) {
    throw new Error('No messages to summarize');
  }
  
  const formattedMessages = formatSingleConversation(chat);
  
  let prompt = getSinglePrompt();
  prompt = prompt
    .replace('{{title}}', chat.title || 'Untitled')
    .replace('{{date}}', new Date(chat.createdAt).toLocaleString())
    .replace('{{messageCount}}', chat.messages.length)
    .replace('{{messages}}', formattedMessages);
  
  const apiKey = getApiKey();
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a helpful assistant that summarizes individual conversations concisely.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.4
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    
    return {
      summary,
      chat,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Summarizer] Single summary failed:', error);
    throw error;
  }
}

// Export summary as markdown
export function exportSummaryAsMarkdown(result, type = 'batch') {
  let content;
  
  if (type === 'single') {
    content = `# Conversation Summary: ${result.chat.title}

Generated: ${new Date(result.generatedAt).toLocaleString()}
Original Date: ${new Date(result.chat.createdAt).toLocaleString()}
Messages: ${result.chat.messages?.length || 0}

---

${result.summary}
`;
  } else {
    content = `# Chat Summary - ${result.durationLabel}

Generated: ${new Date(result.generatedAt).toLocaleString()}
Period: ${result.startDate.toLocaleDateString()} - ${result.endDate.toLocaleDateString()}

---

${result.summary}

---

## Statistics
- Conversations: ${result.stats.chatCount}
- Messages: ${result.stats.messageCount}
- Most Active Day: ${result.stats.mostActiveDay}

## Conversations Included
${result.conversations.map(c => `- ${c.title} (${c.messages?.length || 0} messages) - ${new Date(c.createdAt).toLocaleDateString()}`).join('\n')}
`;
  }
  
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summary-${type}-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy to clipboard
export async function copySummaryToClipboard(result, type = 'batch') {
  let text;
  
  if (type === 'single') {
    text = `${result.summary}\n\n---\n${result.chat.title} - ${new Date(result.chat.createdAt).toLocaleDateString()}`;
  } else {
    text = `${result.summary}\n\n---\n${result.durationLabel} - ${result.stats.chatCount} chats, ${result.stats.messageCount} messages`;
  }
  
  await navigator.clipboard.writeText(text);
}

// Estimate cost
export function estimateCost(count, type = 'batch') {
  if (type === 'single') {
    // Single chat: ~2000 tokens input, ~300 output
    return {
      estimatedCost: 0.003,
      note: '~$0.003 per conversation'
    };
  }
  
  // Batch: varies by conversation count
  const inputTokens = count * 800;
  const outputTokens = 500;
  const cost = (inputTokens / 1000) * 0.0015 + (outputTokens / 1000) * 0.002;
  
  return {
    estimatedCost: cost,
    note: `~$${cost.toFixed(3)} for ${count} conversations`
  };
}
