// critical-scanner.js - Detects API keys, tokens, and cryptographic secrets

const RULES = [
  {
    name: 'OpenAI API Key',
    pattern: /\b(sk-[a-zA-Z0-9_\-]{20,}|sk-proj-[a-zA-Z0-9_\-]{20,}|sk-ant-[a-zA-Z0-9_\-]{20,})\b/g,
    redact: (match) => match.slice(0, 7) + '****' + match.slice(-4)
  },
  {
    name: 'Anthropic API Key',
    pattern: /\b(sk-ant-api03-[a-zA-Z0-9_\-]{20,})\b/g,
    redact: (match) => match.slice(0, 7) + '****' + match.slice(-4)
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /\b(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{22,})\b/g,
    redact: (match) => match.slice(0, 8) + '****' + match.slice(-4)
  },
  {
    name: 'JWT Token',
    pattern: /\b(eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)\b/g,
    redact: (match) => 'eyJ****.' + match.split('.').pop().slice(-4)
  },
  {
    name: 'SSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----/g,
    redact: () => '-----BEGIN OPENSSH PRIVATE KEY-----\n****\n-----END OPENSSH PRIVATE KEY-----'
  },
  {
    name: 'RSA Private Key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g,
    redact: () => '-----BEGIN RSA PRIVATE KEY-----\n****\n-----END RSA PRIVATE KEY-----'
  },
  {
    name: 'EC Private Key',
    pattern: /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/g,
    redact: () => '-----BEGIN EC PRIVATE KEY-----\n****\n-----END EC PRIVATE KEY-----'
  },
  {
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----/g,
    redact: () => '-----BEGIN PGP PRIVATE KEY BLOCK-----\n****\n-----END PGP PRIVATE KEY BLOCK-----'
  },
  {
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16})\b/g,
    redact: (match) => match.slice(0, 4) + '****' + match.slice(-4)
  },
  {
    name: 'Google Service Account',
    pattern: /"type"\s*:\s*"service_account"|"client_email"\s*:\s*"[^"]*@([^"]+\.)?iam\.gserviceaccount\.com"/gi,
    redact: () => '"type": "service_account" /* REDACTED */'
  },
  {
    name: 'Slack Token',
    pattern: /\b(xox[baprs]-[a-zA-Z0-9\-]+)\b/g,
    redact: (match) => match.slice(0, 6) + '****' + match.slice(-4)
  },
  {
    name: 'Stripe Secret Key',
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/g,
    redact: (match) => match.slice(0, 8) + '****' + match.slice(-4)
  },
  {
    name: 'Generic API Key',
    pattern: /\b(api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?)\b/gi,
    redact: (match) => match.replace(/[a-zA-Z0-9_\-]{16,}/, '****')
  }
];

function makeSnippet(text, matchStart, matchEnd, context = 30) {
  const start = Math.max(0, matchStart - context);
  const end = Math.min(text.length, matchEnd + context);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

export function scan(chat) {
  const findings = [];
  const messages = chat.messages || [];

  for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
    const msg = messages[msgIndex];
    const content = msg?.content || '';

    for (const rule of RULES) {
      // Reset regex lastIndex for each message
      rule.pattern.lastIndex = 0;

      let match;
      while ((match = rule.pattern.exec(content)) !== null) {
        const rawValue = match[0];
        const start = match.index;
        const end = start + rawValue.length;

        findings.push({
          type: rule.name,
          severity: 'critical',
          chatId: chat.id,
          chatTitle: chat.title || 'Untitled Chat',
          messageIndex: msgIndex,
          position: { start, end },
          snippet: makeSnippet(content, start, end).replace(rawValue, rule.redact(rawValue)),
          rawValue,
          timestamp: msg?.createdAt || chat.createdAt || null
        });
      }
    }
  }

  return findings;
}
