// search-filters.js - Advanced search filters for conversations

import { getStoredChats } from './storage.js';
import { getAllTags } from './tags.js';

// Filter presets
export const DATE_PRESETS = {
  all: { label: 'All Time', days: null },
  today: { label: 'Today', days: 1 },
  yesterday: { label: 'Yesterday', days: 1, offset: 1 },
  last7: { label: 'Last 7 Days', days: 7 },
  last30: { label: 'Last 30 Days', days: 30 },
  thisMonth: { label: 'This Month', days: 30 },
  lastMonth: { label: 'Last Month', days: 30, offset: 30 }
};

export const MESSAGE_COUNT_RANGES = {
  any: { label: 'Any', min: 0, max: Infinity },
  short: { label: 'Short (1-10)', min: 1, max: 10 },
  medium: { label: 'Medium (11-50)', min: 11, max: 50 },
  long: { label: 'Long (51+)', min: 51, max: Infinity }
};

// Default filter state
export const DEFAULT_FILTERS = {
  datePreset: 'all',
  customStartDate: null,
  customEndDate: null,
  messageRange: 'any',
  tags: [], // Empty = any tag
  tagMode: 'any', // 'any' or 'all'
  hasCode: false,
  hasLinks: false,
  hasImages: false,
  searchIn: ['title', 'content'] // 'title', 'content', or both
};

// Get current filter state from localStorage
export function getFilterState() {
  try {
    const saved = localStorage.getItem('search_filters');
    return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : { ...DEFAULT_FILTERS };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

// Save filter state
export function saveFilterState(filters) {
  localStorage.setItem('search_filters', JSON.stringify(filters));
}

// Reset filters to default
export function resetFilters() {
  localStorage.removeItem('search_filters');
  return { ...DEFAULT_FILTERS };
}

// Apply filters to chats
export async function applyFilters(chats, filters, textQuery = '') {
  let results = [...chats];
  const activeFilters = [];
  
  // Date filter
  if (filters.datePreset !== 'all') {
    const preset = DATE_PRESETS[filters.datePreset];
    if (preset) {
      const now = new Date();
      const offset = preset.offset || 0;
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() - offset);
      
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - preset.days);
      
      results = results.filter(chat => {
        const chatDate = new Date(chat.createdAt || chat.updatedAt);
        return chatDate >= startDate && chatDate <= endDate;
      });
      
      activeFilters.push(`Date: ${preset.label}`);
    }
  } else if (filters.customStartDate && filters.customEndDate) {
    const start = new Date(filters.customStartDate);
    const end = new Date(filters.customEndDate);
    end.setHours(23, 59, 59, 999);
    
    results = results.filter(chat => {
      const chatDate = new Date(chat.createdAt || chat.updatedAt);
      return chatDate >= start && chatDate <= end;
    });
    
    activeFilters.push(`Date: Custom range`);
  }
  
  // Message count filter
  if (filters.messageRange !== 'any') {
    const range = MESSAGE_COUNT_RANGES[filters.messageRange];
    if (range) {
      results = results.filter(chat => {
        const count = chat.messages?.length || 0;
        return count >= range.min && count <= range.max;
      });
      activeFilters.push(`Messages: ${range.label}`);
    }
  }
  
  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    const allTags = await getAllTags();
    
    results = results.filter((chat, index) => {
      const chatTags = allTags[index] || [];
      
      if (filters.tagMode === 'all') {
        // Must have ALL selected tags
        return filters.tags.every(tag => chatTags.includes(tag));
      } else {
        // Must have ANY of the selected tags
        return filters.tags.some(tag => chatTags.includes(tag));
      }
    });
    
    activeFilters.push(`Tags: ${filters.tags.join(filters.tagMode === 'all' ? ' + ' : ' | ')}`);
  }
  
  // Content type filters
  if (filters.hasCode) {
    results = results.filter(chat => {
      return chat.messages?.some(m => 
        m.content?.includes('```') || 
        m.content?.includes('`')
      );
    });
    activeFilters.push('Has code blocks');
  }
  
  if (filters.hasLinks) {
    const urlRegex = /https?:\/\/[^\s]+/;
    results = results.filter(chat => {
      return chat.messages?.some(m => urlRegex.test(m.content));
    });
    activeFilters.push('Has links');
  }
  
  if (filters.hasImages) {
    results = results.filter(chat => {
      return chat.messages?.some(m => 
        m.content?.includes('![') || 
        /\.(jpg|jpeg|png|gif|webp)\b/i.test(m.content)
      );
    });
    activeFilters.push('Has images');
  }
  
  // Text search
  if (textQuery && textQuery.trim()) {
    const query = textQuery.toLowerCase().trim();
    const searchInTitle = filters.searchIn.includes('title');
    const searchInContent = filters.searchIn.includes('content');
    
    results = results.filter(chat => {
      let matches = false;
      
      if (searchInTitle && chat.title?.toLowerCase().includes(query)) {
        matches = true;
      }
      
      if (searchInContent && !matches) {
        matches = chat.messages?.some(m => 
          m.content?.toLowerCase().includes(query)
        );
      }
      
      return matches;
    });
    
    activeFilters.push(`Text: "${textQuery}"`);
  }
  
  return {
    results,
    totalCount: chats.length,
    filteredCount: results.length,
    activeFilters
  };
}

// Get all unique tags for filter UI
export async function getAvailableTags() {
  return await getUniqueTags();
}

// Import getUniqueTags from tags.js
import { getUniqueTags } from './tags.js';

// Quick filter functions for common use cases
export async function filterByDateRange(startDate, endDate) {
  const chats = await getStoredChats();
  const filters = {
    ...DEFAULT_FILTERS,
    datePreset: 'custom',
    customStartDate: startDate,
    customEndDate: endDate
  };
  return applyFilters(chats, filters);
}

export async function filterByTag(tag) {
  const chats = await getStoredChats();
  const filters = {
    ...DEFAULT_FILTERS,
    tags: [tag]
  };
  return applyFilters(chats, filters);
}

export async function filterByMessageCount(min, max) {
  const chats = await getStoredChats();
  const filters = {
    ...DEFAULT_FILTERS,
    messageRange: 'custom',
    customMessageMin: min,
    customMessageMax: max
  };
  return applyFilters(chats, filters);
}

// Get filter description for display
export function getFilterDescription(filters) {
  const parts = [];
  
  if (filters.datePreset !== 'all') {
    parts.push(DATE_PRESETS[filters.datePreset]?.label || 'Custom date');
  }
  
  if (filters.messageRange !== 'any') {
    parts.push(MESSAGE_COUNT_RANGES[filters.messageRange]?.label || 'Custom messages');
  }
  
  if (filters.tags.length > 0) {
    parts.push(`${filters.tags.length} tag${filters.tags.length > 1 ? 's' : ''}`);
  }
  
  if (filters.hasCode) parts.push('with code');
  if (filters.hasLinks) parts.push('with links');
  if (filters.hasImages) parts.push('with images');
  
  return parts.length > 0 ? parts.join(', ') : 'No filters active';
}
