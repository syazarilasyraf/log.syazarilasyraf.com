// audit/classifier.js - Local heuristic privacy auditor
// Classifies each conversation as keep / review / delete / delete_immediately
// using pattern matching and scoring rules that mirror the provided prompt.

const CRITICAL_PATTERNS = [
  { type: 'API key', regex: /\b(sk|pk|ak)-[a-zA-Z0-9]{16,}\b/i },
  { type: 'OpenAI API key', regex: /\bsk-[a-zA-Z0-9]{32,}\b/ },
  { type: 'Bearer token', regex: /\bBearer\s+[a-zA-Z0-9_\-\.]{20,}\b/i },
  { type: 'Access token', regex: /\baccess[_\-]?token["']?\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]{20,}\b/i },
  { type: 'Refresh token', regex: /\brefresh[_\-]?token["']?\s*[:=]\s*["']?[a-zA-Z0-9_\-\.]{20,}\b/i },
  { type: 'Private key', regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/i },
  { type: 'Password', regex: /\b(password|passwd|pwd)\s*[:=]\s*\S{4,}/i },
  { type: 'AWS key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { type: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/ },
  { type: 'Slack token', regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}(-[a-zA-Z0-9]{24})?\b/ },
  { type: 'Credit card', regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/ },
  { type: 'Bank account / IBAN', regex: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]?){0,16}\b/ },
  { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  { type: 'Passport number', regex: /\b(?:passport|pp)\s*(?:#|no|number)?[:=]?\s*[A-Z0-9]{6,12}\b/i },
  { type: 'Recovery code', regex: /\brecovery[_\-]?(code|key)s?\s*[:=]\s*\S{4,}/i },
  { type: 'Secret', regex: /\b(client[_\-]?secret|api[_\-]?secret|auth[_\-]?secret|app[_\-]?secret)\s*[:=]\s*\S{8,}/i }
];

const REVIEW_PATTERNS = [
  { type: 'Email address', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { type: 'Phone number', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ },
  { type: 'Home address', regex: /\b\d+\s+[A-Za-z0-9\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|place|pl)\b/i },
  { type: 'Salary', regex: /\b(?:salary|compensation|income|earnings)\b/i },
  { type: 'Financial planning', regex: /\b(?:investment portfolio|retirement account|401k|ira|savings? account|checking account|mortgage|loan)\b/i },
  { type: 'Tax information', regex: /\b(?:tax return|tax filing|w-2|1099|income tax)\b/i },
  { type: 'Medical information', regex: /\b(?:diagnosis|prescription|medical record|doctor|hospital|symptom|treatment|medication|therapy)\b/i },
  { type: 'Legal document', regex: /\b(?:contract|agreement|nda|terms of service|privacy policy|lawsuit|attorney|legal)\b/i },
  { type: 'Employment information', regex: /\b(?:employer|employee|hr|hiring|resignation|performance review|job offer)\b/i },
  { type: 'Travel plans', regex: /\b(?:flight|hotel|reservation|booking|itinerary|passport|visa|travel)\b/i },
  { type: 'Family discussion', regex: /\b(?:family|parents?|mother|father|sister|brother|daughter|son|wife|husband|partner)\b/i },
  { type: 'Personal life event', regex: /\b(?:wedding|divorce|birthday|anniversary|move|moving|relationship|dating)\b/i }
];

const KEEP_SIGNALS = [
  { category: 'Programming', regex: /\b(javascript|python|typescript|java|go|rust|ruby|php|c\+\+|c#|html|css|react|node\.?js|django|flask|docker|kubernetes|api|database|sql|git|github|debugging|error|code|function|component|algorithm)\b/i },
  { category: 'Project', regex: /\b(project|roadmap|milestone|deadline|sprint|backlog|feature|release|deploy|production|prototype|mvp)\b/i },
  { category: 'Research', regex: /\b(research|paper|study|analysis|data|survey|experiment|hypothesis|literature review)\b/i },
  { category: 'Learning', regex: /\b(learn|tutorial|course|lesson|explain|understand|concept|guide|how to|best practice|documentation)\b/i },
  { category: 'Creative', regex: /\b(story|novel|poem|script|character|plot|creative writing|song|lyrics| brainstorm)\b/i },
  { category: 'Business', regex: /\b(business idea|startup|strategy|marketing|sales|revenue|customer|product|pitch|competitor|market)\b/i },
  { category: 'Design', regex: /\b(design|ui|ux|wireframe|mockup|figma|prototype|user experience|interface|branding)\b/i },
  { category: 'Career', regex: /\b(career|resume|interview|job search|promotion|skill|professional|networking|linkedin)\b/i },
  { category: 'Decision', regex: /\b(decision|plan|goal|objective|priority|trade-off|evaluate|choose between)\b/i }
];

const DELETE_SIGNALS = [
  { reason: 'Temporary troubleshooting', regex: /\b(fix|bug|issue|error|not working|help me|troubleshoot|broken|stuck)\b/i },
  { reason: 'Simple factual question', regex: /\b(what is|who is|when is|where is|how many|define|meaning of|translate)\b/i },
  { reason: 'AI testing', regex: /\b(test|testing the ai|test prompt|hello|hi there|can you hear me|ignore previous|pretend to be)\b/i },
  { reason: 'Prompt experiment', regex: /\b(prompt engineering|try this prompt|act as|roleplay|imagine you are|simulate)\b/i }
];

const CATEGORY_KEYWORDS = {
  'Programming': /\b(coding|programming|software|development|javascript|python|typescript|react|node|api|database|debugging)\b/i,
  'Project': /\b(project|roadmap|feature|deploy|sprint|release|milestone)\b/i,
  'Research': /\b(research|study|analysis|paper|data|hypothesis)\b/i,
  'Learning': /\b(learning|tutorial|course|explain|understand|concept)\b/i,
  'Creative Writing': /\b(story|novel|poem|script|creative writing|song)\b/i,
  'Business': /\b(business|startup|strategy|marketing|sales|revenue)\b/i,
  'Design': /\b(design|ui|ux|figma|mockup|prototype)\b/i,
  'Career': /\b(career|resume|interview|job|promotion)\b/i,
  'Personal': /\b(personal|family|life|relationship|health|travel)\b/i,
  'Finance': /\b(finance|salary|tax|investment|budget|expense)\b/i,
  'Medical': /\b(medical|health|doctor|symptom|diagnosis|treatment)\b/i,
  'Legal': /\b(legal|contract|law|attorney|agreement)\b/i,
  'Temporary': /\b(temporary|quick|one-time|just checking|random)\b/i
};

/**
 * Extract sensitive information snippets from text.
 * Returns up to 3 matches per type to avoid huge lists.
 */
function extractSensitiveInfo(text) {
  const found = [];
  const seen = new Set();

  function scan(patterns, severity) {
    for (const { type, regex } of patterns) {
      const matches = text.match(regex);
      if (!matches) continue;
      for (const match of matches.slice(0, 3)) {
        const key = `${type}:${match}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ type, severity, snippet: match.slice(0, 80) });
      }
    }
  }

  scan(CRITICAL_PATTERNS, 'critical');
  scan(REVIEW_PATTERNS, 'review');
  return found;
}

/**
 * Compute a simple word count for a chat.
 */
function wordCount(chat) {
  const text = buildAuditText(chat);
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Build the text representation used for classification.
 */
function buildAuditText(chat) {
  const title = chat.title || '';
  const messages = (chat.messages || [])
    .map(m => `${m.role}: ${m.content || ''}`)
    .join('\n');
  return `${title}\n${messages}`;
}

/**
 * Detect duplicate-ish conversations by comparing titles.
 * Very simple heuristic.
 */
function isLikelyDuplicate(chat, allChats) {
  if (!chat.title) return false;
  const title = chat.title.toLowerCase().trim();
  let count = 0;
  for (const other of allChats) {
    if (other.id === chat.id) continue;
    const otherTitle = (other.title || '').toLowerCase().trim();
    if (otherTitle && (otherTitle === title || title.includes(otherTitle) || otherTitle.includes(title))) {
      count++;
    }
  }
  return count >= 2;
}

/**
 * Infer categories from conversation text.
 */
function inferCategories(text) {
  const categories = [];
  for (const [category, regex] of Object.entries(CATEGORY_KEYWORDS)) {
    if (regex.test(text)) categories.push(category);
  }
  if (categories.length === 0) categories.push('General');
  return categories.slice(0, 3);
}

/**
 * Classify a single conversation.
 * @param {object} chat - The conversation object
 * @param {object[]} allChats - All conversations for duplicate detection
 * @returns {object} Classification result matching the requested schema
 */
export function classifyChat(chat, allChats = []) {
  const text = buildAuditText(chat);
  const lower = text.toLowerCase();
  const wc = wordCount(chat);
  const msgCount = chat.messages?.length || 0;

  const sensitiveInfo = extractSensitiveInfo(text);
  const criticalMatches = sensitiveInfo.filter(s => s.severity === 'critical');
  const reviewMatches = sensitiveInfo.filter(s => s.severity === 'review');

  const keepSignals = KEEP_SIGNALS.filter(s => s.regex.test(text)).map(s => s.category);
  const deleteSignals = DELETE_SIGNALS.filter(s => s.regex.test(lower)).map(s => s.reason);

  // Base privacy risk score from detected sensitive data
  let privacyRiskScore = 0;
  privacyRiskScore += Math.min(10, criticalMatches.length * 5);
  privacyRiskScore += Math.min(6, reviewMatches.length * 2);
  privacyRiskScore = Math.min(10, privacyRiskScore);

  // Base long-term value score from keep signals and message richness
  let longTermValueScore = 2;
  longTermValueScore += Math.min(4, keepSignals.length * 2);
  if (wc > 200) longTermValueScore += 1;
  if (wc > 800) longTermValueScore += 1;
  if (msgCount >= 5) longTermValueScore += 1;
  longTermValueScore = Math.min(10, longTermValueScore);

  // Determine recommendation
  let recommendation;
  let confidence;
  let reason;

  if (criticalMatches.length > 0) {
    recommendation = 'delete_immediately';
    confidence = Math.min(100, 70 + criticalMatches.length * 10);
    const types = [...new Set(criticalMatches.map(m => m.type))].join(', ');
    reason = `Contains highly sensitive data: ${types}. Should be removed immediately.`;
  } else if (reviewMatches.length > 0) {
    recommendation = 'review';
    confidence = Math.min(100, 60 + reviewMatches.length * 8);
    const types = [...new Set(reviewMatches.map(m => m.type))].join(', ');
    reason = `Contains personal information (${types}) that should be reviewed before keeping.`;
  } else if (
    wc < 80 ||
    msgCount < 3 ||
    deleteSignals.length > 0 ||
    isLikelyDuplicate(chat, allChats) ||
    /^(test|untitled|new chat|chat)$/i.test(chat.title || '')
  ) {
    recommendation = 'delete';
    confidence = Math.min(100, 50 + (deleteSignals.length * 10) + (wc < 80 ? 20 : 0));
    if (isLikelyDuplicate(chat, allChats)) {
      reason = 'Appears to be a duplicate or very similar to other conversations with little unique value.';
    } else if (wc < 80) {
      reason = 'Very short conversation with little content or long-term value.';
    } else if (deleteSignals.length > 0) {
      reason = `Looks like ${deleteSignals[0].toLowerCase()} with limited future value.`;
    } else {
      reason = 'Disposable or low-value conversation with limited future use.';
    }
  } else if (keepSignals.length > 0) {
    recommendation = 'keep';
    confidence = Math.min(100, 60 + keepSignals.length * 8 + (wc > 300 ? 10 : 0));
    reason = `Contains valuable ${keepSignals.slice(0, 2).join('/')} content worth preserving.`;
  } else {
    // Default: generic conversations that are not sensitive but not obviously valuable
    recommendation = 'delete';
    confidence = 55;
    reason = 'General conversation with no clear long-term value or sensitive content.';
  }

  // Generate a concise summary
  const categories = inferCategories(text);
  const summary = generateSummary(chat, recommendation, categories);

  return {
    conversation_id: chat.id || null,
    title: chat.title || 'Untitled Chat',
    recommendation,
    confidence,
    privacy_risk_score: privacyRiskScore,
    value_score: longTermValueScore,
    reason,
    summary,
    detected_categories: categories,
    sensitive_information: sensitiveInfo
  };
}

function generateSummary(chat, recommendation, categories) {
  const msgCount = chat.messages?.length || 0;
  const title = chat.title || 'Untitled';
  const catStr = categories.join(', ');

  switch (recommendation) {
    case 'delete_immediately':
      return `${title}: ${msgCount} messages containing sensitive credentials.`;
    case 'review':
      return `${title}: ${msgCount} messages with personal data to review.`;
    case 'delete':
      return `${title}: short or disposable ${catStr.toLowerCase()} conversation.`;
    case 'keep':
    default:
      return `${title}: ${msgCount}-message ${catStr.toLowerCase()} conversation.`;
  }
}

/**
 * Classify all conversations.
 * @param {object[]} chats
 * @returns {object[]}
 */
export function classifyAllChats(chats) {
  return chats.map(chat => classifyChat(chat, chats));
}
