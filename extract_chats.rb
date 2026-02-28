require 'json'
require 'fileutils'
require 'time'

# -----------------------------
# Config
# -----------------------------
JSON_PATH  = "conversations.json"
OUTPUT_DIR = "_chats"

FileUtils.mkdir_p(OUTPUT_DIR)

# -----------------------------
# Load + sort conversations
# -----------------------------
data = JSON.parse(File.read(JSON_PATH))

# Sort chats from OLD → NEW
data.sort_by! { |conv| conv["create_time"] || 0 }

# -----------------------------
# Helpers
# -----------------------------
def safe_slug(text)
  text
    .downcase
    .strip
    .gsub(/[^\w\s\-]/, '')
    .gsub(/\s+/, '-')
    .gsub(/-+/, '-')
end

def extract_messages(conv)
  conv
    .fetch("mapping", {})
    .values
    .map { |m| m["message"] }
    .compact
end

def extract_title(conv, messages, index)
  return conv["title"].strip if conv["title"] && !conv["title"].strip.empty?

  first_user_msg =
    messages.find { |m| m.dig("author", "role") == "user" }
      &.dig("content", "parts", 0)

  first_user_msg ? first_user_msg.slice(0, 50) : "chat-#{index}"
end

# -----------------------------
# Main export loop
# -----------------------------
data.each_with_index do |conv, index|
  messages = extract_messages(conv)
  next if messages.empty?

  title = extract_title(conv, messages, index)
  timestamp =
    if conv["create_time"]
      Time.at(conv["create_time"]).iso8601
    else
      Time.now.iso8601
    end

  slug     = safe_slug(title)
  date_tag = timestamp[0..9] # YYYY-MM-DD
  filename = "#{OUTPUT_DIR}/#{date_tag}-#{slug}.md"

  chat_html = messages.map do |msg|
    role = msg.dig("author", "role")
    parts = msg.dig("content", "parts")
    next unless role && parts

    label = role == "user" ? "you" : role
    content = parts.join("\n").gsub('~~~', '') # prevent nested code blocks

    <<~HTML
      <div class="chat-msg" data-role="#{label}">
      #{content.strip}
      </div>
    HTML
  end.compact.join("\n\n")

  File.write(filename, <<~MARKDOWN)
    ---
    title: "#{title.gsub('"', "'")}"
    date: #{timestamp}
    layout: chat
    ---

    {% raw %}
    #{chat_html}
    {% endraw %}
  MARKDOWN

  puts "✅ Created #{filename}"
end

puts "\n🎉 Export complete. Chats written to #{OUTPUT_DIR}/"
