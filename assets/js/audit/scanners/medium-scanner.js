// medium-scanner.js - Detects emails, phone numbers, and addresses

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

const PHONE_PATTERN = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g;

// Address heuristic: number + street keyword
const ADDRESS_PATTERN = /\b\d+\s+(?:[A-Za-z0-9\-]+\s+){1,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|terrace|circle|cir|highway|hwy|suite|ste|apartment|apt|unit|floor|fl)\b\.?/gi;

// Personal identifier patterns
const IDENTIFIER_PATTERNS = [
  { name: 'Date of Birth', pattern: /\b(?:born|dob|birthdate|birth date)[:\s]+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/gi },
  { name: 'Driver License', pattern: /\b(?:driver'?s? license|dl|d\.l\.)[:\s#]*([A-Z0-9]{6,12})\b/gi }
];

function looksLikePhone(str) {
  const digits = str.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function makeSnippet(text, matchStart, matchEnd, context = 30) {
  const start = Math.max(0, matchStart - context);
  const end = Math.min(text.length, matchEnd + context);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

function redactEmail(email) {
  const [user, domain] = email.split('@');
  return user.slice(0, 2) + '****@' + domain;
}

function redactPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 7) {
    return phone.replace(digits, digits.slice(0, 3) + '****' + digits.slice(-2));
  }
  return phone.slice(0, 3) + '****';
}

function redactAddress(address) {
  // Keep street type, redact number and name
  const match = address.match(/(\d+)\s+(.+?)(\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|terrace|circle|cir|highway|hwy|suite|ste|apartment|apt|unit|floor|fl))\.?/i);
  if (match) {
    return '**** ' + match[3].trim();
  }
  return '****';
}

export function scan(chat) {
  const findings = [];
  const messages = chat.messages || [];

  for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
    const msg = messages[msgIndex];
    const content = msg?.content || '';

    // Emails
    EMAIL_PATTERN.lastIndex = 0;
    let match;
    while ((match = EMAIL_PATTERN.exec(content)) !== null) {
      const rawValue = match[0];
      const start = match.index;
      findings.push({
        type: 'Email Address',
        severity: 'medium',
        chatId: chat.id,
        chatTitle: chat.title || 'Untitled Chat',
        messageIndex: msgIndex,
        position: { start, end: start + rawValue.length },
        snippet: makeSnippet(content, start, start + rawValue.length).replace(rawValue, redactEmail(rawValue)),
        rawValue,
        timestamp: msg?.createdAt || chat.createdAt || null
      });
    }

    // Phone numbers
    PHONE_PATTERN.lastIndex = 0;
    while ((match = PHONE_PATTERN.exec(content)) !== null) {
      const rawValue = match[0];
      if (!looksLikePhone(rawValue)) continue;
      const start = match.index;
      findings.push({
        type: 'Phone Number',
        severity: 'medium',
        chatId: chat.id,
        chatTitle: chat.title || 'Untitled Chat',
        messageIndex: msgIndex,
        position: { start, end: start + rawValue.length },
        snippet: makeSnippet(content, start, start + rawValue.length).replace(rawValue, redactPhone(rawValue)),
        rawValue,
        timestamp: msg?.createdAt || chat.createdAt || null
      });
    }

    // Addresses
    ADDRESS_PATTERN.lastIndex = 0;
    while ((match = ADDRESS_PATTERN.exec(content)) !== null) {
      const rawValue = match[0];
      const start = match.index;
      findings.push({
        type: 'Physical Address',
        severity: 'medium',
        chatId: chat.id,
        chatTitle: chat.title || 'Untitled Chat',
        messageIndex: msgIndex,
        position: { start, end: start + rawValue.length },
        snippet: makeSnippet(content, start, start + rawValue.length).replace(rawValue, redactAddress(rawValue)),
        rawValue,
        timestamp: msg?.createdAt || chat.createdAt || null
      });
    }

    // Personal identifiers
    for (const idRule of IDENTIFIER_PATTERNS) {
      idRule.pattern.lastIndex = 0;
      while ((match = idRule.pattern.exec(content)) !== null) {
        const rawValue = match[0];
        const start = match.index;
        findings.push({
          type: idRule.name,
          severity: 'medium',
          chatId: chat.id,
          chatTitle: chat.title || 'Untitled Chat',
          messageIndex: msgIndex,
          position: { start, end: start + rawValue.length },
          snippet: makeSnippet(content, start, start + rawValue.length).replace(rawValue, '****'),
          rawValue,
          timestamp: msg?.createdAt || chat.createdAt || null
        });
      }
    }
  }

  return findings;
}
