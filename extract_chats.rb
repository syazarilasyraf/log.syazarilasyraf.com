require 'json'
require 'fileutils'
require 'time'

json_path = "conversations.json"
output_dir = "_chats"
FileUtils.mkdir_p(output_dir)

data = JSON.parse(File.read(json_path))

data.each_with_index do |conv, index|
  messages = conv["mapping"].values.map { |m| m["message"] }.compact

  title_msg = messages.find { |m| m["author"]["role"] == "user" }
  next unless title_msg

  title = title_msg["content"]["parts"]&.first&.slice(0, 50)&.gsub(/[^\w\s\-]/, '')&.strip || "chat-#{index}"
  slug = title.downcase.gsub(/\s+/, '-').gsub(/[^a-z0-9\-]/, '')
  filename = "#{output_dir}/#{slug}.md"
  timestamp = Time.at(conv["create_time"]).iso8601 rescue Time.now.iso8601

  chat_html = messages.map do |msg|
    next unless msg["author"] && msg["content"] && msg["content"]["parts"]
    role = msg["author"]["role"]
    label = role == "user" ? "you" : role
    content = msg["content"]["parts"].join("\n").gsub('~~~', '') # prevent nested codeblocks
    "<div class=\"chat-msg\" data-role=\"#{label}\">\n#{content.strip}\n</div>"
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
