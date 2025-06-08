require 'fileutils'
require 'time'

UPLOAD_DIR = 'upload'
CHAT_DIR = '_chats'

Dir.mkdir(CHAT_DIR) unless Dir.exist?(CHAT_DIR)

Dir.glob("#{UPLOAD_DIR}/*.md") do |file_path|
  original_filename = File.basename(file_path, '.md')
  slug = original_filename.strip.downcase.gsub(/[^a-z0-9\s]/, '').gsub(/\s+/, '-')
  output_path = File.join(CHAT_DIR, "#{slug}.md")
  next if File.exist?(output_path)

  content = File.read(file_path)

  # Break into sections based on "**You:**" or "**ChatGPT:**"
  chat_blocks = content.split(/\*\*\s*(You|ChatGPT)\s*:\s*\*\*/i)

  chat_html = []
  current_role = nil

  chat_blocks.each_with_index do |block, i|
    if i.odd?
      current_role = block.strip.downcase == "you" ? "you" : "assistant"
    else
      next if block.strip.empty?
      role_label = current_role || "unknown"
      message = block.strip.gsub('~~~', '') # strip nested code markers
      chat_html << "<div class=\"chat-msg\" data-role=\"#{role_label}\">\n#{message}\n</div>"
    end
  end

  # Build front matter
  front_matter = <<~FRONT
    ---
    title: "#{slug.gsub('-', ' ').split.map(&:capitalize).join(' ')}"
    date: #{Time.now.iso8601}
    layout: chat
    ---
  FRONT

  # Final file content
  final_content = front_matter + "\n{% raw %}\n" + chat_html.join("\n\n") + "\n{% endraw %}\n"

  File.write(output_path, final_content)
  puts "✅ Processed #{original_filename} → #{slug}.md"
end
