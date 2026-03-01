// mobile-nav.js - Mobile navigation and responsive behavior

import { getUserMode, MODES } from './user-mode.js';

// Check if mobile viewport
export function isMobile() {
  return window.innerWidth < 768;
}

// Check if touch device
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Mobile navigation state
let currentMobileTab = 'chat';

// Initialize mobile navigation
export function initMobileNav() {
  if (!isMobile()) return;
  
  createMobileNav();
  setupMobileGestures();
  optimizeForMobile();
  
  // Show chat view by default on mobile
  showChatView();
  currentMobileTab = 'chat';
  updateTabUI();
}

// Create bottom navigation bar
function createMobileNav() {
  if (document.getElementById('mobile-nav')) return;
  
  const nav = document.createElement('nav');
  nav.id = 'mobile-nav';
  nav.innerHTML = `
    <button class="mobile-tab" data-tab="browse">
      <span class="mobile-tab-icon">📚</span>
      <span class="mobile-tab-label">Browse</span>
    </button>
    <button class="mobile-tab" data-tab="search">
      <span class="mobile-tab-icon">🔍</span>
      <span class="mobile-tab-label">Search</span>
    </button>
    <button class="mobile-tab" data-tab="actions">
      <span class="mobile-tab-icon">⚡</span>
      <span class="mobile-tab-label">Actions</span>
    </button>
  `;
  
  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.mobile-tab');
    if (!tab) return;
    
    const tabName = tab.dataset.tab;
    switchMobileTab(tabName);
  });
  
  document.body.appendChild(nav);
}

// Update tab UI without changing view
function updateTabUI() {
  document.querySelectorAll('.mobile-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === currentMobileTab);
  });
}

// Switch mobile tabs
export function switchMobileTab(tab) {
  // Handle toggling: clicking same tab closes/opens appropriate view
  if (tab === 'browse' && currentMobileTab === 'browse') {
    // Toggle sidebar off and show chat
    showChatView();
    currentMobileTab = 'chat';
    updateTabUI();
    return;
  }
  
  currentMobileTab = tab;
  updateTabUI();
  
  // Handle tab content
  switch (tab) {
    case 'browse':
      showBrowseView();
      break;
    case 'search':
      showSearchView();
      break;
    case 'actions':
      showActionsView();
      break;
  }
}

// Show main chat view (default mobile view)
function showChatView() {
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('main');
  
  if (sidebar) {
    sidebar.classList.remove('open');
    // Delay hiding display to allow transition
    setTimeout(() => {
      if (!sidebar.classList.contains('open')) {
        sidebar.style.display = 'none';
      }
    }, 300);
  }
  
  if (main) {
    main.style.display = 'block';
  }
  
  // Hide other overlays
  hideSearchOverlay();
  hideActionsOverlay();
}

function showBrowseView() {
  // Show sidebar (as slide-over on mobile)
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('main');
  
  if (sidebar) {
    sidebar.style.display = 'flex';
    // Force reflow to ensure transition works
    sidebar.offsetHeight;
    sidebar.classList.add('open');
  }
  
  if (main) {
    main.style.display = 'none'; // Hide main content on mobile when browsing
  }
  
  // Hide other views
  hideSearchOverlay();
  hideActionsOverlay();
}

function showSearchView() {
  // Close sidebar and show main content first
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('main');
  
  if (sidebar) {
    sidebar.classList.remove('open');
    setTimeout(() => {
      if (!sidebar.classList.contains('open')) sidebar.style.display = 'none';
    }, 300);
  }
  if (main) main.style.display = 'block';
  
  // Show full-screen search
  let overlay = document.getElementById('mobile-search-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mobile-search-overlay';
    overlay.className = 'mobile-overlay';
    overlay.innerHTML = `
      <div class="mobile-overlay-header">
        <input type="text" id="mobile-search-input" placeholder="Search conversations..." autofocus>
        <button onclick="hideSearchOverlay()" class="mobile-close-btn">✕</button>
      </div>
      <div id="mobile-search-results" class="mobile-overlay-content"></div>
    `;
    document.body.appendChild(overlay);
    
    // Setup search input
    const input = overlay.querySelector('#mobile-search-input');
    input.addEventListener('input', debounce((e) => {
      performMobileSearch(e.target.value);
    }, 300));
  }
  
  overlay.style.display = 'block';
  overlay.querySelector('#mobile-search-input').focus();
}

function showActionsView() {
  // Close sidebar and show main content first
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('main');
  
  if (sidebar) {
    sidebar.classList.remove('open');
    setTimeout(() => {
      if (!sidebar.classList.contains('open')) sidebar.style.display = 'none';
    }, 300);
  }
  if (main) main.style.display = 'block';
  
  // Show actions sheet
  let sheet = document.getElementById('mobile-actions-sheet');
  
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'mobile-actions-sheet';
    sheet.className = 'mobile-sheet';
    sheet.innerHTML = `
      <div class="mobile-sheet-header">
        <div class="mobile-sheet-handle"></div>
      </div>
      <div class="mobile-sheet-content">
        <button class="mobile-action-btn" onclick="showAISettings(); hideActionsOverlay();">
          <span>🤖</span> AI Features
        </button>
        <button class="mobile-action-btn" onclick="showSyncSettings(); hideActionsOverlay();">
          <span>☁️</span> Cloud Sync
        </button>
        <button class="mobile-action-btn" onclick="showStats(); hideActionsOverlay();">
          <span>📊</span> Statistics
        </button>
        <button class="mobile-action-btn" onclick="exportAllData(); hideActionsOverlay();">
          <span>💾</span> Export Data
        </button>
        <div class="mobile-action-divider"></div>
        <button class="mobile-action-btn danger" onclick="clearAllChats(); hideActionsOverlay();">
          <span>🗑️</span> Delete All
        </button>
      </div>
    `;
    document.body.appendChild(sheet);
  }
  
  sheet.style.display = 'block';
  setTimeout(() => sheet.classList.add('visible'), 10);
}

// Hide overlays
window.hideSearchOverlay = function() {
  const overlay = document.getElementById('mobile-search-overlay');
  if (overlay) overlay.style.display = 'none';
};

window.hideActionsOverlay = function() {
  const sheet = document.getElementById('mobile-actions-sheet');
  if (sheet) {
    sheet.classList.remove('visible');
    setTimeout(() => sheet.style.display = 'none', 300);
  }
};

// Debounce helper
function debounce(fn, ms) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), ms);
  };
}

// Mobile search (simplified)
async function performMobileSearch(query) {
  // Import and use existing search with mobile-optimized results
  const resultsContainer = document.getElementById('mobile-search-results');
  if (!resultsContainer || !query.trim()) {
    if (resultsContainer) resultsContainer.innerHTML = '';
    return;
  }
  
  resultsContainer.innerHTML = '<p style="padding: 1rem; color: #888;">Searching...</p>';
  
  // Dispatch to existing search and render mobile-friendly results
  // This will be handled by the main app.js search functions
  const searchInput = document.getElementById('chatSearch');
  if (searchInput) {
    searchInput.value = query;
    searchInput.dispatchEvent(new Event('input'));
  }
}

// Setup mobile gestures
function setupMobileGestures() {
  let touchStartX = 0;
  let touchEndX = 0;
  
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  
  sidebar.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  
  sidebar.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });
  
  function handleSwipe() {
    const swipeThreshold = 100;
    const diff = touchStartX - touchEndX;
    
    // Swipe left to close sidebar and show chat
    if (diff > swipeThreshold && sidebar.classList.contains('open')) {
      showChatView();
      currentMobileTab = 'chat';
      updateTabUI();
    }
  }
}

// Optimize UI for mobile
function optimizeForMobile() {
  // Hide desktop-only elements
  document.querySelectorAll('.desktop-only').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show mobile-only elements
  document.querySelectorAll('.mobile-only').forEach(el => {
    el.style.display = 'block';
  });
  
  // Adjust main content padding for bottom nav
  const main = document.querySelector('main');
  if (main) {
    main.style.paddingBottom = '80px';
  }
  
  // Make cards more touch-friendly
  document.querySelectorAll('.conversation-card').forEach(card => {
    card.style.minHeight = '80px';
  });
}

// Handle resize
window.addEventListener('resize', () => {
  if (isMobile()) {
    initMobileNav();
  } else {
    // Remove mobile nav on desktop
    const nav = document.getElementById('mobile-nav');
    if (nav) nav.remove();
    
    // Show desktop elements
    document.querySelectorAll('.desktop-only').forEach(el => {
      el.style.display = '';
    });
  }
});

// Global close function for mobile sidebar
window.closeMobileSidebar = function() {
  showChatView();
  currentMobileTab = 'chat';
  updateTabUI();
};

// Export for use
export { currentMobileTab };
