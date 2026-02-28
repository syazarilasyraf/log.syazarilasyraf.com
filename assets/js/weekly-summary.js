// weekly-summary.js - Generate weekly summaries of ChatGPT usage
// Privacy-first: All processing happens client-side with user's API key

import { getStoredChats } from './storage.js';
import { hasApiKey, getApiKey } from './ai.js';

const SUMMARY_PROMPT_KEY = 'weekly_summary_prompt';
const SUMMARY_SETTINGS_KEY = 'weekly_summary_settings';

// Default summary prompt (users can customize)
const DEFAULT_SUMMARY_PROMPT = `You are a helpful assistant that summarizes a user's weekly ChatGPT conversations.

CONVERSATIONS FROM THIS WEEK:
{{conversations}}

TASK:
Create a concise weekly summary that includes:
1. **Main Topics** - What were the main subjects discussed?
2. **Key Insights** - Any important learnings or decisions made
3. **Action Items** - Tasks, follow-ups, or next steps mentioned
4. **Interesting Discoveries** - Cool findings or "aha" moments

Keep it concise but informative. Use bullet points and emojis for readability.

FORMAT:
# Weekly Chat Summary

## 📊 Overview
- Total conversations: {{chatCount}}
- Total messages: {{messageCount}}
- Most active day: {{mostActiveDay}}

## 🏷️ Main Topics
(List 3-5 main topics with brief descriptions)

## 💡 Key Insights
(List key learnings)

## ✅ Action Items
(List any tasks or follow-ups)

## 🔍 Notable Conversations
(List 2-3 interesting conversation titles with one-line summaries)
`;

// Get user's custom prompt or default
export function getSummaryPrompt() {
  return localStorage.getItem(SUMMARY_PROMPT_KEY) || DEFAULT_SUMMARY_PROMPT;
}

// Save custom prompt
export function setSummaryPrompt(prompt) {
  localStorage.setItem(SUMMARY_PROMPT_KEY, prompt);
}

// Get summary settings
export function getSummarySettings() {
  const defaults = {
    includeTitles: true,
    includeMessageCounts: true,
    maxConversationsToInclude: 20,
    maxMessagesPerConversation: 5,
    emailEnabled: false,
    emailAddress: ''
  };
  
  try {
    const saved = localStorage.getItem(SUMMARY_SETTINGS_KEY);
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
}

// Save summary settings
export function setSummarySettings(settings) {
  localStorage.setItem(SUMMARY_SETTINGS_KEY, JSON.stringify(settings));
}

// Get conversations from the past week
export async function getWeeklyConversations() {
  const chats = await getStoredChats();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  return chats.filter(chat => {
    const chatDate = new Date(chat.createdAt || chat.updatedAt);
    return chatDate >= oneWeekAgo;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Format conversations for the prompt
function formatConversationsForPrompt(conversations, settings) {
  return conversations.slice(0, settings.maxConversationsToInclude).map((chat, index) => {
    const messages = (chat.messages || []).slice(0, settings.maxMessagesPerConversation);
    const messagePreview = messages.map(m => {
      const role = m.role === 'user' ? 'User' : 'AI';
      const content = m.content.substring(0, 200);
      return `${role}: ${content}${m.content.length > 200 ? '...' : ''}`;
    }).join('\n');
    
    return `Conversation ${index + 1}: ${chat.title}
Messages: ${chat.messages?.length || 0}
Preview:
${messagePreview}
---`;
  }).join('\n\n');
}

// Calculate stats for the week
function calculateWeekStats(conversations) {
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

// Generate weekly summary using OpenAI
export async function generateWeeklySummary() {
  if (!hasApiKey()) {
    throw new Error('OpenAI API key required. Add it in AI settings.');
  }
  
  const conversations = await getWeeklyConversations();
  
  if (conversations.length === 0) {
    return {
      summary: '# Weekly Summary\n\nNo conversations found from the past week.',
      stats: { chatCount: 0, messageCount: 0, mostActiveDay: 'N/A' }
    };
  }
  
  const settings = getSummarySettings();
  const stats = calculateWeekStats(conversations);
  const formattedConversations = formatConversationsForPrompt(conversations, settings);
  
  // Build the prompt
  let prompt = getSummaryPrompt();
  prompt = prompt
    .replace('{{conversations}}', formattedConversations)
    .replace('{{chatCount}}', stats.chatCount)
    .replace('{{messageCount}}', stats.messageCount)
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
            content: 'You are a helpful assistant that creates weekly summaries of ChatGPT conversations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
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
      stats,
      conversations,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Weekly Summary] Generation failed:', error);
    throw error;
  }
}

// Export summary as markdown file
export function exportSummaryAsMarkdown(result) {
  const content = `# ChatLog Weekly Summary

Generated: ${new Date(result.generatedAt).toLocaleString()}

---

${result.summary}

---

## 📈 Statistics
- Conversations this week: ${result.stats.chatCount}
- Total messages: ${result.stats.messageCount}
- Most active day: ${result.stats.mostActiveDay}

## 💾 Conversations Included
${result.conversations.map(c => `- ${c.title} (${c.messages?.length || 0} messages)`).join('\n')}
`;

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `weekly-summary-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy summary to clipboard
export async function copySummaryToClipboard(result) {
  const text = `${result.summary}

---
Stats: ${result.stats.chatCount} chats, ${result.stats.messageCount} messages
Generated by ChatLog`;
  
  await navigator.clipboard.writeText(text);
}

// Generate mailto link with summary (for email clients)
export function generateEmailLink(result, emailAddress) {
  const subject = `ChatLog Weekly Summary - ${new Date().toLocaleDateString()}`;
  const body = `${result.summary}\n\n---\nGenerated by ChatLog (${window.location.origin})`;
  
  return `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Estimate cost for weekly summary
export function estimateWeeklySummaryCost(conversationCount) {
  // Rough estimate: 1000 tokens per conversation for context + 500 for output
  const inputTokens = conversationCount * 1000;
  const outputTokens = 500;
  
  // GPT-3.5-turbo pricing: $0.0015/1K input, $0.002/1K output
  const inputCost = (inputTokens / 1000) * 0.0015;
  const outputCost = (outputTokens / 1000) * 0.002;
  
  return {
    estimatedCost: inputCost + outputCost,
    inputTokens,
    outputTokens,
    currency: 'USD',
    note: `~$${(inputCost + outputCost).toFixed(4)} for ${conversationCount} conversations`
  };
}
