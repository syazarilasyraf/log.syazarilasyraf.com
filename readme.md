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

### Advanced
- 🌐 **Cloud Sync** - Cross-device backup via Supabase
- 🖥️ **Virtual Scrolling** - Smooth performance with 1000+ message chats
- 📱 **PWA** - Install as app, works offline
- 🔌 **Browser Extension** - Auto-save as you chat (see below)

---

## Browser Extension (Auto-Save)

**Never manually export again.** The ChatLog extension automatically saves conversations as you chat.

### Installation

**Option 1: Developer Mode (Available Now)**
1. Download/clone this repo
2. Open Chrome → `chrome://extensions` → Enable "Developer mode"
3. Click "Load unpacked" → Select the `extension/` folder
4. Pin 📒 to your toolbar

**Option 2: Chrome Web Store (Coming Soon)**

### How It Works
- Automatically detects ChatGPT conversations
- Saves in real-time as you chat
- One-click export to ChatLog app
- Stores locally in your browser (privacy-first)

See [extension/README.md](extension/README.md) for details.

---

## Quick Start

### Web App
1. Go to https://log.syazarilasyraf.com
2. Upload your `conversations.json` (from ChatGPT settings → Data controls → Export)
3. Or use the browser extension for auto-save

### Cloud Sync Setup
1. Create free account at [supabase.com](https://supabase.com)
2. New project → SQL Editor → Run the SQL from `assets/js/sync.js` comments
3. Copy Project URL and anon key
4. Click ☁️ Sync in app → Paste credentials → Connect

---

## File Structure

```
assets/
  js/
    app.js           # Main UI
    storage.js       # IndexedDB layer
    parser.js        # ChatGPT JSON parsing
    virtual-list.js  # Performance for large chats
    tags.js          # Tagging system
    stats.js         # Analytics
    sync.js          # Supabase cloud sync
  style.css          # Styles

extension/           # Browser extension
  manifest.json
  content.js         # ChatGPT page scraper
  background.js      # Extension service worker
  popup.html/js      # Extension UI
  README.md

_layouts/
  default.html       # Main app layout
```

---

## Architecture Highlights

| Feature | Implementation |
|---------|---------------|
| Storage | IndexedDB (~50MB) |
| Search | Fuse.js (fuzzy) |
| Cloud | Supabase (optional) |
| Extension | Manifest V3, content script |
| PWA | Service Worker, offline-first |

---

## Privacy

- **Zero tracking** - No Google Analytics, no cookies
- **Local-first** - Data stays in your browser by default
- **Optional cloud** - Only if you configure Supabase yourself
- **Open source** - You can audit every line

---

## Development

```bash
# Local testing
python -m http.server 8000

# Extension development
# Load extension/ folder as unpacked in Chrome

# Deploy
# Pushes to GitHub → Auto-deploys to Netlify
git push origin main
```

---

## Roadmap

- [x] IndexedDB storage
- [x] Fuzzy search
- [x] Virtual scrolling
- [x] PWA support
- [x] Tagging system
- [x] Statistics dashboard
- [x] Cloud sync (Supabase)
- [x] Browser extension
- [ ] AI auto-tagging (OpenAI API)
- [ ] Claude/Gemini/Perplexity import
- [ ] Chat sharing (public links)
- [ ] Mobile apps (Capacitor)

---

## License

MIT © [syazarilasyraf](https://github.com/syazarilasyraf)
