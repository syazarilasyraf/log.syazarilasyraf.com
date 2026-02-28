# ChatLog - ChatGPT Conversation Manager

A powerful, privacy-focused tool to view, organize, and analyze your ChatGPT conversations. Fully client-side with optional cloud sync and browser extension.

**🚀 Live:** https://log.syazarilasyraf.com

---

## Features

### Core
- 📁 **Import** - Upload `conversations.json` from ChatGPT export
- 🔍 **Fuzzy Search** - Typo-tolerant search with highlighted matches
- 🏷️ **Tagging** - Organize chats with custom tags
- 📊 **Statistics** - Insights on your AI usage patterns
- 💾 **50MB+ Storage** - IndexedDB (not limited 5MB localStorage)
- 📱 **PWA** - Install as app, works offline

### Advanced
- 🌐 **Cloud Sync** - Cross-device backup via Supabase
- 🖥️ **Virtual Scrolling** - Smooth performance with 1000+ message chats
- 🔌 **Browser Extension** - Auto-save as you chat (see below)
- 📤 **Multi-format Import** - Supports ChatGPT exports, extension exports, backups

---

## Browser Extension (Auto-Save) ✨ NEW

**Never manually export again.** The ChatLog extension automatically saves conversations as you chat.

### Installation

**Developer Mode (Available Now):**
1. Clone this repo: `git clone https://github.com/syazarilasyraf/log.syazarilasyraf.com.git`
2. Open Chrome → `chrome://extensions` → Enable "Developer mode"
3. Click "Load unpacked" → Select the `extension/` folder
4. Pin 📒 to your toolbar

**Chrome Web Store** (Coming Soon - Submitting for review)

### How It Works
1. Navigate to ChatGPT (chat.openai.com or chatgpt.com)
2. Start chatting — extension auto-detects and saves
3. Click the 📒 icon to see stats and export
4. Export downloads JSON → upload to ChatLog web app

### Extension Features
- ✅ Auto-detects conversations in real-time
- ✅ Saves as you type (debounced, 2 second delay)
- ✅ Shows conversation/message count
- ✅ One-click export to ChatLog app
- ✅ Local storage (privacy-first, no server)
- ✅ Auto-cleanup when storage fills

See [extension/README.md](extension/README.md) for details.

---

## Quick Start

### Web App
1. Go to https://log.syazarilasyraf.com
2. Upload your `conversations.json` (from ChatGPT → Settings → Data controls → Export)
3. Or use the browser extension for auto-save

### Supported Import Formats
| Format | Source | Behavior |
|--------|--------|----------|
| `conversations.json` | ChatGPT Export | Merges with existing |
| Extension Export | ChatLog Extension | Merges with existing |
| Backup File | ChatLog Backup | Restores (replaces) |

### Cloud Sync Setup (Optional)
1. Create free account at [supabase.com](https://supabase.com)
2. New project → SQL Editor → Run the SQL from `assets/js/sync.js` comments
3. Copy Project URL and anon key
4. Click ☁️ Sync in app → Paste credentials → Connect

---

## Architecture

| Feature | Implementation |
|---------|---------------|
| Storage | IndexedDB (~50MB) |
| Search | Fuse.js (fuzzy, typo-tolerant) |
| Virtual Scroll | Custom implementation |
| Cloud | Supabase (optional) |
| Extension | Manifest V3, content script |
| PWA | Service Worker, offline-first |

---

## Development

```bash
# Clone
git clone https://github.com/syazarilasyraf/log.syazarilasyraf.com.git
cd log.syazarilasyraf.com

# Local testing
python -m http.server 8000

# Extension development
# Load extension/ folder as unpacked in chrome://extensions

# Deploy
git push origin main  # Auto-deploys to Netlify
```

---

## Privacy

- **Zero tracking** — No Google Analytics, no cookies
- **Local-first** — Data stays in your browser by default
- **Optional cloud** — Only if you configure Supabase yourself
- **Open source** — Audit every line

---

## Roadmap

### Completed ✅
- [x] IndexedDB storage (50MB+)
- [x] Fuzzy search (Fuse.js)
- [x] Virtual scrolling
- [x] PWA support
- [x] Tagging system
- [x] Statistics dashboard
- [x] Cloud sync (Supabase)
- [x] Browser extension (auto-save)

### Next Up 🔥
- [ ] **Chrome Web Store** — Publish extension (reach 1000s of users)
- [ ] **AI Auto-Tagging** — Auto-categorize with OpenAI API
- [ ] **Import from Claude/Gemini** — Universal AI manager
- [ ] **Chat Sharing** — Generate public links for specific chats
- [ ] **Search Filters** — Date range, message count, has code, etc.

---

## License

MIT © [syazarilasyraf](https://github.com/syazarilasyraf)

---

## Worthy Next Features (Ranked)

Want to keep building? Here's what has highest ROI:

### 1. Chrome Web Store Publish 🏆
**Effort:** 1 day | **Impact:** Massive
- Package extension for Chrome Web Store
- Get real users, feedback, potential monetization
- This transforms it from "personal tool" to "product"

### 2. AI Auto-Tagging 🤖
**Effort:** 1 day | **Impact:** High
- Use OpenAI API to auto-suggest tags
- Summarize conversations automatically
- Cost: ~$0.01 per chat

### 3. Claude/Gemini/Perplexity Import
**Effort:** 1 day each | **Impact:** Medium
- Parse other AI platform exports
- Become the "universal AI conversation manager"

### 4. Search Filters
**Effort:** 1 day | **Impact:** Medium
- Filter by date range, message count, has code blocks, has images
- Power user feature

### 5. Chat Sharing (Public Links)
**Effort:** 2 days | **Impact:** High (viral)
- Generate read-only links for specific conversations
- Requires small backend for link storage

**My recommendation:** Do #1 (Chrome Web Store) → Get users → Then decide based on feedback.

---

<p align="center">
  Built with ❤️ by <a href="https://syazarilasyraf.com">syazarilasyraf</a>
</p>
