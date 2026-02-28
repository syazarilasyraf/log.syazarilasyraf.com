# Chat Uploader – Modular Refactor

This folder contains a refactored version of my `chat-uploader.js` file.

I’m working on breaking it into smaller, more manageable modules to make the code easier to read and maintain.

## Structure

/src
  /modules
    storage.jss → handles localStorage stuff
    selection.js → chat selection logic
    exporter.js → export chats to markdown
    chatList.js → builds and updates chat list
  chatUploader.js → old code (still in use for now)
  main.js → main entry point

## Notes

- Uses ES Modules (`type="module"` in HTML)
- Best run with a local server (`npx serve` or similar)
- Still a work in progress — not everything is fully wired up yet