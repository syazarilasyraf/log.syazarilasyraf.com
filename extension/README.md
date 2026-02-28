# ChatLog Browser Extension

Auto-save your ChatGPT conversations without manual exports.

## What It Does

- **Auto-detects** when you're chatting on ChatGPT
- **Automatically saves** conversations as they happen
- **One-click export** to the main ChatLog app
- **Works offline** - stores locally in your browser

## Installation

### Option 1: Chrome Web Store (Coming Soon)

Search for "ChatLog - Auto Save for ChatGPT" in the Chrome Web Store.

### Option 2: Developer Mode (Now)

1. Download this `extension` folder
2. Open Chrome → Extensions → Enable "Developer mode"
3. Click "Load unpacked" → Select this folder
4. Pin the extension to your toolbar

## Usage

1. **Start ChatGPT-ing** - The extension automatically detects and saves conversations
2. **Click the extension icon** 📒 to see stats and export
3. **Export** when ready - Downloads a JSON file
4. **Import to ChatLog** - Upload the JSON to https://log.syazarilasyraf.com

## How It Works

- Uses Chrome's `storage.local` API (5MB limit)
- Watches for DOM changes on chat.openai.com
- Debounced saves (waits 2 seconds after you stop typing)
- Stores: conversation ID, title, messages, timestamps

## Privacy

- **100% local** - Data never leaves your browser
- No analytics, no tracking
- No server communication except to ChatGPT itself

## Limitations

- Chrome/Edge only (Manifest V3)
- 5MB storage limit (~100-200 conversations)
- Requires ChatGPT tab to be open

## Development

```bash
cd extension
# Load as unpacked extension in Chrome
# Make changes → Click refresh icon in chrome://extensions
```

## Troubleshooting

**Not saving?**
- Make sure you're on chat.openai.com or chatgpt.com
- Check that the conversation has at least 2 messages
- Try refreshing the ChatGPT page

**Storage full?**
- Export and clear data periodically
- Only recent 100 conversations are kept when near limit

**Export not working?**
- Check popup for error messages
- Try manual export from content script console
