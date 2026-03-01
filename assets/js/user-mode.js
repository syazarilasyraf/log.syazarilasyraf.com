// user-mode.js - Simple vs Advanced mode management

const USER_MODE_KEY = 'user_mode';
const HAS_SEEN_ADVANCED_PROMPT_KEY = 'has_seen_advanced_prompt';

export const MODES = {
  SIMPLE: 'simple',
  ADVANCED: 'advanced'
};

export function getUserMode() {
  return localStorage.getItem(USER_MODE_KEY) || MODES.SIMPLE;
}

export function setUserMode(mode) {
  localStorage.setItem(USER_MODE_KEY, mode);
  return mode;
}

export function toggleUserMode() {
  const current = getUserMode();
  const newMode = current === MODES.SIMPLE ? MODES.ADVANCED : MODES.SIMPLE;
  setUserMode(newMode);
  return newMode;
}

export function initializeUserMode() {
  const existing = localStorage.getItem(USER_MODE_KEY);
  if (!existing) {
    setUserMode(MODES.SIMPLE);
    localStorage.setItem('first_visit', new Date().toISOString());
  }
  return getUserMode();
}

export function shouldPromptAdvanced() {
  const mode = getUserMode();
  const hasSeenPrompt = localStorage.getItem(HAS_SEEN_ADVANCED_PROMPT_KEY);
  
  if (mode === MODES.ADVANCED || hasSeenPrompt) return false;
  
  const firstVisit = localStorage.getItem('first_visit');
  if (!firstVisit) return false;
  
  const daysSince = (new Date() - new Date(firstVisit)) / (1000 * 60 * 60 * 24);
  return daysSince >= 3;
}

export function markAdvancedPromptSeen() {
  localStorage.setItem(HAS_SEEN_ADVANCED_PROMPT_KEY, 'true');
}

export function isFeatureVisible(feature) {
  const mode = getUserMode();
  const simpleFeatures = ['search', 'time_filter', 'tags', 'auto_tag', 'summarize', 'export'];
  return mode === MODES.SIMPLE ? simpleFeatures.includes(feature) : true;
}
