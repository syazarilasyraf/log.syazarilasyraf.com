// secure-storage.js - Store sensitive credentials in sessionStorage
// Falls back to localStorage for legacy migration, then clears legacy.
// Credentials are cleared when the browser/tab is closed.

/**
 * Get a sensitive value from secure storage.
 * Checks sessionStorage first, then localStorage for legacy migration.
 */
export function getSecureItem(key) {
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue !== null) {
    return sessionValue;
  }

  // Legacy migration: if in localStorage, move to sessionStorage
  const localValue = localStorage.getItem(key);
  if (localValue !== null) {
    sessionStorage.setItem(key, localValue);
    localStorage.removeItem(key);
    return localValue;
  }

  return null;
}

/**
 * Store a sensitive value in sessionStorage.
 */
export function setSecureItem(key, value) {
  // Clear any legacy localStorage copy
  localStorage.removeItem(key);
  sessionStorage.setItem(key, value);
}

/**
 * Remove a sensitive value from both storages.
 */
export function removeSecureItem(key) {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
