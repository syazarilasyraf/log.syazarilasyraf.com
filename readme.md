# logs - ChatGPT

A personal tool to view and organize your ChatGPT conversations. It turns exported `.json` files into clean, collapsible chat views right in the browser — fully client-side, private, and mobile-friendly.

**🚀 Latest:** Now uses IndexedDB for 50MB+ storage (was 5MB localStorage limit).

---

## What is this?

This is a browser-based interface for browsing your ChatGPT history. It supports:

- ✅ Uploading your `conversations.json` file from ChatGPT
- ✅ **Multiple file imports** — merge several exports together
- ✅ **Backup & restore** — export your entire database as JSON
- ✅ Browsing parsed chats instantly in your browser
- ✅ **Full-text search** with debounced input
- ✅ **Folder view** — organize chats by date groups
- ✅ **Pinning** — keep important chats at the top
- ✅ Bulk delete and export to Markdown
- ✅ Mobile-friendly design with dark mode

---

## How it works

### Storage

The app uses **IndexedDB** (not localStorage) to store your chats locally in your browser. This means:

- **~50MB+ capacity** (varies by browser)
- **Persistent storage** — survives browser restarts
- **Structured data** — faster queries and better organization

### Migration

If you have data from the old localStorage version, it will be **automatically migrated** to IndexedDB on first load. The old data is then cleared from localStorage.

---

## File Structure

```
assets/
  js/
    app.js        # Main application (UI, event handling)
    storage.js    # IndexedDB operations + migration
    parser.js     # ChatGPT JSON parsing
  style.css       # Styles

_layouts/
  default.html    # Main app layout

_archive/         # Old code (Ruby scripts, old JS)
```

---

## Development

### Local testing

```bash
# Simple HTTP server (Python 3)
python -m http.server 8000

# Or use VS Code Live Server extension
```

### Deployment

The site is automatically deployed to Netlify on push to `main`.

---

## Upcoming Features

- [ ] Keyboard shortcuts (⌘K search)
- [ ] Fuzzy search (Fuse.js)
- [ ] Tagging system
- [ ] Chat statistics dashboard
- [ ] Virtual scrolling for long chats
- [ ] PWA support

---

## Privacy

- **Zero data leaves your browser.** 
- No analytics, no tracking, no server.
- Your ChatGPT data stays on your device.

---

## License

MIT
