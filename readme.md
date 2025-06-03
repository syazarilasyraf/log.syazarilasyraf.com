## log.syazarilasyraf.com

A simple tool to extract ChatGPT conversations from a JSON export or manually uploaded markdown files, and render them as browsable HTML pages with a clean Q&A-style UI.


🚧 Status: In Development — The tool is functional but still evolving. Features may change, and improvements are ongoing.

---

## What is this?

This project takes:

- A JSON export (`conversations.json`) from ChatGPT **or**
- Markdown files exported using the **Export ChatGPT** Chrome extension

…and turns them into nicely formatted chat pages using a custom `chat.html` layout, browsable via a static site.

---

## How it works

### 1. Extracting from JSON (`extract_chats.rb`)

- Reads the exported `conversations.json`
- For each conversation:
  - Finds the user’s first message to generate a title/slug
  - Extracts all messages, labeling each by author (`user` or `assistant`)
  - Converts message content into HTML `<div>` blocks with `data-role`
  - Writes a Markdown file (`_chats/<slug>.md`) with front matter (title, date, layout) and HTML inside `{% raw %}...{% endraw %}`

### 2. Processing uploaded markdown files (`process_uploads.rb`)

- Designed for markdown files exported with the [Export ChatGPT extension](https://chrome.google.com/webstore/detail/export-chatgpt-conversati/jbcjblbmpogicdngjgfcnflicjacbkeh)
- Reads `.md` files in the `upload/` folder
- Parses each message section based on roles (`**You:**` / `**ChatGPT:**`)
- Converts them to structured HTML `<div class="chat-msg" data-role="...">`
- Wraps the content in `{% raw %}...{% endraw %}` and writes output to `_chats/` with appropriate front matter

### 3. Rendering chats (`chat.html`)

- Uses the `chat` layout for all chat pages
- Sidebar lists all chats sorted by date (Today, Yesterday, Last 7 days, etc.)
- Main panel shows conversation grouped into collapsible Q&A pairs

### 4. Styling

- Dark theme using CSS variables
- Flex layout for sidebar and main content
- Scrollable panels with full viewport height
- Collapsible Q&A boxes with message previews

---

## How to use

1. **Option A** – Export your ChatGPT conversations:
   - Download `conversations.json` and put it into the root of the project
   - Run:

     ```bash
     ruby extract_chats.rb conversations.json
     ```

2. **Option B** – Export individual chats from Chrome:
   - Use the Export ChatGPT extension to save `.md` files
   - Place files inside the `upload/` directory
   - Run:

     ```bash
     ruby process_uploads.rb
     ```

Both scripts will generate Markdown files under `_chats/`, ready for display.

Run the Jekyll site locally:

1. Install dependencies:

   ```bash
   bundle install --path vendor/bundle
   ```
2. Build and serve the site:

     ```bash
     bundle exec jekyll build
     ```

     ```bash
     bundle exec jekyll serve
     ```
     
Visit http://localhost:4000 in your browser to explore your chats.

---

## Notes / Tips

- Message titles are slugified and sanitized for file safety.
- Each message is assumed to alternate between roles — unexpected patterns may break the layout.
- Sidebar grouping is handled client-side with JavaScript.
- Customize `chat.html` or CSS for your own theme or responsiveness.

---

## Future Ideas

- Support richer message types (images, code blocks, embeds) with custom renderers  
- Improve grouping logic for uneven or multi-turn replies  
- Add full-text search or chat filtering  
- Allow users to upload their own `conversations.json` or markdown files directly on the homepage — processing done entirely in-browser with no server
