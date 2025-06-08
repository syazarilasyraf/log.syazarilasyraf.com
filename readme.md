log.syazarilasyraf.com
----------------------

A personal tool to view and organize your ChatGPT conversations. It turns exported `.json` files into clean, collapsible chat views right in the browser — fully client-side, private, and mobile-friendly.

🚧 **Status**: Actively maintained — Core features are stable, and new improvements are ongoing.

* * *

What is this?
-------------

This is a browser-based interface for browsing your ChatGPT history. It currently supports:

*   Uploading your `conversations.json` file from ChatGPT
    
*   Browsing parsed chats instantly in your browser
    
*   Deleting, exporting, and managing chats via bulk-edit mode
    

Optionally, you can also use Ruby scripts to generate static `.md` files for long-term archiving, although these are more basic in functionality.

* * *

How it works
------------

### A. **Frontend (deployed site)**

The main deployed version at [log.syazarilasyraf.com](https://log.syazarilasyraf.com):

*   Accepts `conversations.json` uploads only
    
*   Parses the file entirely in-browser using JavaScript
    
*   Stores parsed chats in `localStorage`
    
*   Displays chats in a collapsible Q&A layout with:
    
    *   Sidebar grouping by date (Today, Yesterday, Last 7 Days, etc.)
        
    *   Bulk editing tools: select, delete, export
        
    *   Markdown export with YAML front matter
        

* * *

### B. **Backend (manual scripts)**

If you'd rather process things manually or archive chat logs as Markdown:

#### 1\. `extract_chats.rb`

*   Place your `conversations.json` file in the **project root**
    
*   Run:
    
    ```bash
    ruby extract_chats.rb conversations.json
    ```
    
*   This will generate structured `.md` files under `_chats/`
    

#### 2\. `process_uploads.rb`

*   Export `.md` files using the [ExportGPT Chrome extension](https://chromewebstore.google.com/detail/exportgpt-export-chatgpt/jamcijfplmgbngnppdhmbbogjebgfimn)
    
*   Move them to the `/upload/` directory
    
*   Run:
    
    ```bash
    ruby process_uploads.rb
    ```
    

These `.md` files are rendered with a simpler layout and don’t include features like bulk editing or client-side export — just basic collapsible chats using Jekyll’s `chat.html` layout.

* * *

How to run the static version
-----------------------------

If you’re using Jekyll to view `.md` files:

1.  Install dependencies:
    
    ```bash
    bundle install --path vendor/bundle
    ```
    
2.  Build and serve locally:
    
    ```bash
    bundle exec jekyll build
    bundle exec jekyll serve
    ```
    
3.  Visit [http://localhost:4000](http://localhost:4000)
    

* * *

Features (Deployed Version)
---------------------------

*   ✅ Upload `conversations.json` file
    
*   ✅ Parses in-browser, no server needed
    
*   ✅ Bulk delete and export features
    
*   ✅ Markdown export with YAML front matter
    
*   ✅ Sidebar with dynamic time-grouped navigation
    
*   ✅ Mobile-friendly design and dark mode
    

* * *

Future ideas
------------

*   🔍 Add full-text search
    
*   🧠 Smart summaries for each chat
    
*   📅 Calendar view or tag-based sorting
    
*   🔄 Backup & restore localStorage as file
    
*   ☁️ Optional encrypted sync across devices