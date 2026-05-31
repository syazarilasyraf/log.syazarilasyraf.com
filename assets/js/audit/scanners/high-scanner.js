// high-scanner.js - Detects financial and identity documents

// Luhn algorithm validation for credit cards
function isValidLuhn(digits) {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function extractDigits(str) {
  return str.replace(/\D/g, '');
}

const RULES = [
  {
    name: 'Credit Card Number',
    pattern: /\b(?:4\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}|5[1-5]\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}|3[47]\d{2}[-\s]?\d{6}[-\s]?\d{5}|6(?:011|5\d{2})[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})\b/g,
    validate: (match) => {
      const digits = extractDigits(match);
      return digits.length >= 13 && digits.length <= 19 && isValidLuhn(digits);
    },
    redact: (match) => {
      const digits = extractDigits(match);
      return digits.slice(0, 4) + ' **** **** ' + digits.slice(-4);
    }
  },
  {
    name: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g,
    validate: (match) => {
      // Basic IBAN check: move first 4 chars to end, convert letters to numbers, mod 97
      const iban = match.replace(/\s/g, '').toUpperCase();
      if (iban.length < 15 || iban.length > 34) return false;
      const rearranged = iban.slice(4) + iban.slice(0, 4);
      const numeric = rearranged.split('').map(c => {
        const code = c.charCodeAt(0);
        return code >= 65 && code <= 90 ? (code - 55).toString() : c;
      }).join('');
      // Mod 97 check on big integer
      let remainder = '';
      for (let i = 0; i < numeric.length; i++) {
        remainder += numeric[i];
        if (remainder.length > 2) {
          remainder = String(parseInt(remainder, 10) % 97);
        }
      }
      return parseInt(remainder, 10) % 97 === 1;
    },
    redact: (match) => match.slice(0, 4) + ' **** **** ' + match.slice(-4)
  },
  {
    name: 'US Social Security Number',
    pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    validate: (match) => {
      const digits = extractDigits(match);
      // Avoid common fake SSNs
      const area = digits.slice(0, 3);
      const group = digits.slice(3, 5);
      const serial = digits.slice(5, 9);
      if (area === '000' || group === '00' || serial === '0000') return false;
      if (area === '666') return false;
      if (area.startsWith('9')) return false;
      return true;
    },
    redact: (match) => '***-**-' + extractDigits(match).slice(-4)
  },
  {
    name: 'Passport Number',
    pattern: /\b(?:passport|pp|travel document)\s*(?:#|no\.?|number)?\s*[:\-]?\s*([A-Z0-9]{6,9})\b/gi,
    validate: (match, groups) => {
      const value = groups ? groups[1] : extractDigits(match);
      return /^[A-Z0-9]{6,9}$/i.test(value);
    },
    redact: (match) => match.replace(/[A-Z0-9]{6,9}/i, '****')
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
      rule.pattern.lastIndex = 0;

      let match;
      while ((match = rule.pattern.exec(content)) !== null) {
        const rawValue = match[0];
        const start = match.index;
        const end = start + rawValue.length;

        // Run validator if present
        if (rule.validate && !rule.validate(rawValue, match)) {
          continue;
        }

        findings.push({
          type: rule.name,
          severity: 'high',
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
