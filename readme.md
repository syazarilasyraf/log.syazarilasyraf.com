# ChatLog

> The missing conversation manager for ChatGPT and AI assistants.

[![Live Demo](https://img.shields.io/badge/demo-live-green?style=flat-square)](https://log.syazarilasyraf.com)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

ChatLog is a privacy-first, client-side application for organizing, analyzing, and extracting insights from AI conversations. No servers, no tracking, no data leaves your browser unless you explicitly configure it.

## Why ChatLog?

ChatGPT and other AI platforms provide exports, but offer no tools to:
- **Search** across months of conversations
- **Organize** with tags and categories
- **Analyze** usage patterns and insights
- **Summarize** long conversations automatically
- **Preserve** conversations privately

ChatLog fills this gap with a zero-compromise approach to privacy and user control.

## Features

### Core
- 📁 **Universal Import** — Supports ChatGPT exports, browser extension saves, and backup files
- 🔍 **Fuzzy Search** — Typo-tolerant full-text search with highlighted matches
- 🔎 **Advanced Filters** — Filter by date range, message count, tags, content type (code, links, images)
- 🏷️ **Tagging System** — Organize conversations with custom tags
- 📊 **Analytics Dashboard** — Insights on usage patterns, peak activity, top topics
- 💾 **Local-First Storage** — 50MB+ IndexedDB storage (no 5MB limit)
- 📱 **PWA** — Install as app, works offline

### AI-Powered (BYOK)
All AI features use **Bring Your Own Key** — your OpenAI API key stays in your browser, you pay only for what you use.

- 🤖 **Auto-Tagging** — AI suggests relevant tags (~$0.001/chat)
- 📝 **Smart Summaries** — Summarize any conversation or time period (~$0.003-0.05)
- 📅 **Flexible Reports** — Generate summaries for today, week, month, or custom ranges
- 🎨 **Custom Prompts** — Fully customizable AI prompts with variable substitution

### Browser Extension
🔌 **Auto-Save for ChatGPT** — Automatically captures conversations as they happen
- Zero manual exports
- One-click sync to web app
- Chrome/Edge compatible

### Cloud Sync (Optional)
☁️ **Cross-Device Sync** — Self-hosted cloud backup via Supabase
- End-to-end encryption by default
- User controls all data
- Optional feature — works 100% offline without it

## Quick Start

### Web App (Recommended)
1. Visit **[log.syazarilasyraf.com](https://log.syazarilasyraf.com)**
2. Upload your `conversations.json` from ChatGPT (Settings → Data controls → Export)
3. Or install the extension for auto-save

### Browser Extension
1. Download this repository
2. Open Chrome → `chrome://extensions` → Enable "Developer mode"
3. Click "Load unpacked" → Select the `extension/` folder
4. Pin to toolbar and chat — conversations auto-save

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER (Client-Side Only)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   IndexedDB  │  │    Fuse.js   │  │  OpenAI API  │  │
│  │   Storage    │  │    Search    │  │   (BYOK)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                  ↓                  ↓         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              ChatLog Application                  │   │
│  │  • Import/Export  • Tagging  • Analytics         │   │
│  │  • AI Summaries   • Search   • PWA               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            ↓ (optional)
                    ┌───────────────┐
                    │   Supabase    │
                    │  Cloud Sync   │
                    └───────────────┘
```

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Vanilla ES6+ (zero framework dependencies) |
| Storage | IndexedDB with custom storage layer |
| Search | Fuse.js (fuzzy) + Custom filter engine |
| AI | OpenAI API (user-provided keys) |
| Extension | Chrome Manifest V3 |
| PWA | Service Worker, offline-capable |

## Privacy & Security

- **No tracking** — No Google Analytics, no cookies, no telemetry
- **No servers** — Everything runs in your browser
- **Local-first** — Data stays in IndexedDB unless you explicitly export
- **BYOK for AI** — Your OpenAI key, your API calls, your billing
- **Optional cloud** — Self-configured Supabase only if you want sync
- **Open source** — Fully auditable codebase

## Feature Deep Dive

### Flexible Summarization
Generate AI summaries for any time period:
- **Today** — Daily standup recap
- **Last 7 days** — Weekly review
- **Custom range** — Project retrospectives
- **Single chat** — Long conversation TL;DR

All with customizable prompts and cost estimates before generating.

### Smart Organization
- **Time-based grouping** — Today, Yesterday, Last 7/30 Days, Months, Years
- **Folder view** — VS Code-style collapsible folders
- **Pinning** — Keep important chats at top
- **Bulk operations** — Select, delete, export multiple chats
- **Virtual scrolling** — Smooth performance with 1000+ message chats

### Advanced Search Filters
Find exactly what you need with powerful filtering:

**Date Ranges**
- Today, Yesterday, Last 7/30 Days
- This Month, Last Month
- Custom date ranges

**Message Count**
- Short (1-10 messages)
- Medium (11-50 messages)
- Long (51+ messages)

**Content Type**
- Has code blocks
- Has links
- Has images

**Tag Filtering**
- Multi-select tags
- Match ANY or ALL selected tags

**Search Scope**
- Search in titles only
- Search in content only
- Search both

Combine filters with fuzzy text search for precise results.

### Analytics
Understand your AI usage:
- Message distribution (You vs AI)
- Word count analysis
- Peak activity hours
- Most active days/months
- Tag usage statistics
- Longest and most active conversations

## Configuration

### AI Features Setup
1. Get API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. In ChatLog → 🤖 AI Settings → Paste key
3. Key is stored locally in your browser only

### Cloud Sync Setup (Advanced)
1. Create free project at [supabase.com](https://supabase.com)
2. Run SQL setup from `assets/js/sync.js` comments
3. Copy Project URL and anon key to ChatLog settings

## Roadmap

### Current
- [x] IndexedDB storage with 50MB+ capacity
- [x] Fuzzy search with Fuse.js
- [x] Advanced search filters
- [x] Virtual scrolling for large conversations
- [x] PWA with offline support
- [x] Tagging system
- [x] Analytics dashboard
- [x] Browser extension (auto-save)
- [x] AI auto-tagging (BYOK)
- [x] Flexible summarization
- [x] Cloud sync (optional Supabase)

### Planned
- [ ] Chrome Web Store publication
- [ ] Claude, Gemini, Perplexity import support
- [ ] Chat sharing (public links)
- [ ] Advanced search filters (date range, has code, etc.)
- [ ] Mobile apps (Capacitor)

## Development

```bash
# Clone
git clone https://github.com/syazarilasyraf/log.syazarilasyraf.com.git
cd log.syazarilasyraf.com

# Local development
python -m http.server 8000
# Or use any static file server

# Extension development
# Load extension/ folder as unpacked in chrome://extensions

# Deploy
# Pushes to GitHub → Auto-deploys to Netlify via Git integration
git push origin main
```

## Browser Support

| Browser | Web App | Extension |
|---------|---------|-----------|
| Chrome | ✅ | ✅ |
| Firefox | ✅ | ⏳ (Manifest V3 pending) |
| Safari | ✅ | ❌ |
| Edge | ✅ | ✅ |

## Contributing

Contributions welcome! Areas of interest:
- Additional AI platform imports (Claude, Gemini)
- Localization/i18n
- Accessibility improvements
- Performance optimizations

Please open an issue to discuss before major changes.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Fuse.js](https://fusejs.io/) for fuzzy search
- [marked](https://marked.js.org/) for Markdown rendering
- [Supabase](https://supabase.com/) for optional cloud infrastructure

---

<p align="center">
  Built with privacy in mind. Your data, your control.
</p>
