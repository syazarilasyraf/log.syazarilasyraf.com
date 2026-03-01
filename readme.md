# ChatLog

> Privacy-first conversation manager for ChatGPT.

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://log.syazarilasyraf.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Organize, search, and analyze your AI conversations — all in your browser. No servers, no tracking, your data stays private.

## Features

- **🔒 Privacy First** — Everything stays in your browser (IndexedDB)
- **🔍 Smart Search** — Fuzzy search across all conversations
- **🏷️ Auto Tagging** — AI suggests tags (optional, your OpenAI key)
- **📱 Mobile Ready** — Works on all devices, offline capable
- **🤖 AI Summary** — Summarize conversations or time periods (optional)
- **☁️ Optional Sync** — Self-hosted cloud backup via Supabase

## Quick Start

### Web App
1. Visit [log.syazarilasyraf.com](https://log.syazarilasyraf.com)
2. Export from ChatGPT → Upload `conversations.json`

### Browser Extension (Auto-Save)
1. Download this repo
2. Chrome → `chrome://extensions` → Enable "Developer mode"
3. "Load unpacked" → Select `extension/` folder
4. Conversations save automatically as you chat

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla ES6+, Jekyll |
| Storage | IndexedDB |
| Search | Fuse.js |
| AI | OpenAI API (BYOK) |
| Extension | Chrome Manifest V3 |
| Hosting | Netlify |

## Development

```bash
# Local server
bundle exec jekyll serve

# Or simple Python server
python -m http.server 8000

# Deploy
bundle exec jekyll build
git push origin main  # Auto-deploys to Netlify
```

## Privacy

- No tracking, no cookies, no telemetry
- Local-first: data stays in your browser
- Optional AI: uses your OpenAI key, stored locally
- Optional cloud: self-configured Supabase only

## License

MIT License — see [LICENSE](LICENSE)
