// audit-ui.js - HTML generation for privacy audit dashboard

import { escapeHtml } from '../utils.js';
import { calculateRiskScore, summarizeBySeverity } from './risk-score.js';

const SEVERITY_ICONS = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡'
};

const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium'
};

/**
 * Generate HTML for the audit dashboard.
 * @param {object[]} findings
 * @returns {string}
 */
export function formatAuditHTML(findings) {
  if (findings.length === 0) {
    return `
      <div style="text-align: center; padding: 3rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🛡️</div>
        <h2>No Sensitive Data Found</h2>
        <p style="color: #888;">Your chats appear clean. No API keys, financial data, or personal identifiers were detected.</p>
        <button onclick="restoreViewState()" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
      </div>
    `;
  }

  const { score, label, color } = calculateRiskScore(findings);
  const counts = summarizeBySeverity(findings);

  // Group findings by severity
  const bySeverity = { critical: [], high: [], medium: [] };
  for (const f of findings) {
    bySeverity[f.severity].push(f);
  }

  let findingsHtml = '';
  for (const severity of ['critical', 'high', 'medium']) {
    const items = bySeverity[severity];
    if (items.length === 0) continue;

    findingsHtml += `
      <div style="margin-bottom: 2rem;">
        <h3 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
          ${SEVERITY_ICONS[severity]} ${SEVERITY_LABELS[severity]} (${items.length})
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${items.map(f => formatFindingCard(f)).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div style="max-width: 900px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2 style="margin: 0;">🔒 Privacy Audit</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="exportAuditResults()" class="export-btn" title="Export as JSON">📦 Export</button>
          <button onclick="clearAuditAndRescan()" class="delete-btn" title="Clear cache and rescan">🔄 Rescan</button>
          <button onclick="restoreViewState()" class="export-btn">← Back</button>
        </div>
      </div>

      <!-- Risk Score Card -->
      <div style="background: var(--bg-light); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; border-left: 4px solid ${color};">
        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
          <div style="text-align: center;">
            <div style="font-size: 3rem; font-weight: 700; color: ${color};">${score}</div>
            <div style="font-size: 0.85rem; color: #888;">Risk Score</div>
          </div>
          <div>
            <div style="font-size: 1.25rem; font-weight: 600; color: ${color};">${label}</div>
            <div style="color: #888; font-size: 0.9rem; margin-top: 0.25rem;">
              ${findings.length} finding${findings.length !== 1 ? 's' : ''} detected
            </div>
          </div>
          <div style="margin-left: auto; display: flex; gap: 1rem;">
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: #F44336;">${counts.critical}</div>
              <div style="font-size: 0.75rem; color: #888;">Critical</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: #FF9800;">${counts.high}</div>
              <div style="font-size: 0.75rem; color: #888;">High</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; font-weight: 700; color: #FFC107;">${counts.medium}</div>
              <div style="font-size: 0.75rem; color: #888;">Medium</div>
            </div>
          </div>
        </div>
      </div>

      ${findingsHtml}
    </div>
  `;
}

function formatFindingCard(finding) {
  const timestamp = finding.timestamp
    ? new Date(finding.timestamp).toLocaleString()
    : 'Unknown time';

  return `
    <div class="finding-card" style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; cursor: pointer; transition: background 0.2s;"
         onmouseenter="this.style.background='var(--bg-light)'" onmouseleave="this.style.background='var(--bg)'"
         onclick="showAuditFinding('${escapeHtml(finding.chatId)}', ${finding.messageIndex})">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <div>
          <span style="font-weight: 600;">${escapeHtml(finding.type)}</span>
          <span style="color: #888; font-size: 0.85em; margin-left: 0.5rem;">in ${escapeHtml(finding.chatTitle)}</span>
        </div>
        <span style="font-size: 0.75rem; color: #888;">${escapeHtml(timestamp)}</span>
      </div>
      <code style="display: block; background: var(--bg-light); padding: 0.5rem; border-radius: 4px; font-size: 0.85em; color: var(--fg); word-break: break-all;">
        ${escapeHtml(finding.snippet)}
      </code>
    </div>
  `;
}

/**
 * Generate JSON export of findings.
 * @param {object[]} findings
 * @returns {string}
 */
export function exportFindingsAsJSON(findings) {
  const { score, label } = calculateRiskScore(findings);
  const exportData = {
    exportedAt: new Date().toISOString(),
    riskScore: score,
    riskLabel: label,
    totalFindings: findings.length,
    summary: summarizeBySeverity(findings),
    findings: findings.map(f => ({
      type: f.type,
      severity: f.severity,
      chatTitle: f.chatTitle,
      messageIndex: f.messageIndex,
      snippet: f.snippet,
      timestamp: f.timestamp
    }))
  };
  return JSON.stringify(exportData, null, 2);
}

// ==================== AI CLASSIFICATION DASHBOARD ====================

const RECOMMENDATION_META = {
  delete_immediately: {
    label: 'Delete Immediately',
    color: '#F44336',
    bg: '#F443361A',
    icon: '🔴'
  },
  review: {
    label: 'Review',
    color: '#FF9800',
    bg: '#FF98001A',
    icon: '🟡'
  },
  keep: {
    label: 'Keep',
    color: '#4CAF50',
    bg: '#4CAF501A',
    icon: '🟢'
  },
  delete: {
    label: 'Delete',
    color: '#9E9E9E',
    bg: '#9E9E9E1A',
    icon: '⚪'
  }
};

const RECOMMENDATION_ORDER = ['delete_immediately', 'review', 'keep', 'delete'];

/**
 * Generate HTML for the AI classification dashboard.
 * @param {object[]} classifications
 * @returns {string}
 */
export function formatClassificationHTML(classifications) {
  if (!classifications || classifications.length === 0) {
    return `
      <div style="text-align: center; padding: 3rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🛡️</div>
        <h2>No Conversations to Audit</h2>
        <p style="color: #888;">Upload your ChatGPT export to run a privacy audit.</p>
        <button onclick="restoreViewState()" class="export-btn" style="margin-top: 2rem;">← Back to Chats</button>
      </div>
    `;
  }

  const counts = countByRecommendation(classifications);
  const total = classifications.length;

  // Group by recommendation
  const byRec = {};
  for (const c of classifications) {
    const rec = c.recommendation || 'delete';
    if (!byRec[rec]) byRec[rec] = [];
    byRec[rec].push(c);
  }

  // Sort each group by confidence descending, then risk score descending
  for (const rec of Object.keys(byRec)) {
    byRec[rec].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.privacy_risk_score - a.privacy_risk_score;
    });
  }

  const summaryCards = RECOMMENDATION_ORDER.map(rec => {
    const meta = RECOMMENDATION_META[rec];
    const count = counts[rec] || 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div style="flex: 1; min-width: 120px; background: ${meta.bg}; border: 1px solid ${meta.color}40; border-radius: 10px; padding: 1rem; text-align: center; cursor: pointer;"
           onclick="scrollToRecSection('${rec}')">
        <div style="font-size: 1.75rem; font-weight: 700; color: ${meta.color};">${count}</div>
        <div style="font-size: 0.8rem; color: #888;">${meta.icon} ${meta.label}</div>
        <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem;">${pct}%</div>
      </div>
    `;
  }).join('');

  let sectionsHtml = '';
  for (const rec of RECOMMENDATION_ORDER) {
    const items = byRec[rec];
    if (!items || items.length === 0) continue;

    const meta = RECOMMENDATION_META[rec];
    sectionsHtml += `
      <div id="rec-section-${rec}" style="margin-bottom: 2.5rem;">
        <h3 style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: ${meta.color};">
          ${meta.icon} ${meta.label} (${items.length})
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${items.map(c => formatClassificationCard(c)).join('')}
        </div>
      </div>
    `;
  }

  return `
    <div style="max-width: 900px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
        <h2 style="margin: 0;">🔒 Privacy Audit</h2>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="exportClassificationResults()" class="export-btn" title="Export classifications as JSON">📦 Export</button>
          <button onclick="clearAuditAndRescan()" class="delete-btn" title="Clear cache and rescan">🔄 Rescan</button>
          <button onclick="restoreViewState()" class="export-btn">← Back</button>
        </div>
      </div>

      <p style="color: #888; font-size: 0.9rem; margin-bottom: 1.5rem;">
        AI-assisted recommendations based on local analysis. You decide what to delete.
      </p>

      <!-- Summary counts -->
      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 2rem;">
        ${summaryCards}
      </div>

      ${sectionsHtml}
    </div>
  `;
}

function formatClassificationCard(c) {
  const meta = RECOMMENDATION_META[c.recommendation] || RECOMMENDATION_META.delete;
  const confidence = Math.min(100, Math.max(0, c.confidence || 0));
  const riskScore = Math.min(10, Math.max(0, c.privacy_risk_score || 0));
  const valueScore = Math.min(10, Math.max(0, c.value_score || 0));

  const categories = (c.detected_categories || [])
    .map(cat => `<span style="display: inline-block; background: var(--bg-light); border: 1px solid var(--border); border-radius: 12px; padding: 0.15rem 0.5rem; font-size: 0.75rem; color: #888;">${escapeHtml(cat)}</span>`)
    .join('');

  const sensitive = (c.sensitive_information || [])
    .slice(0, 3)
    .map(s => `<span style="display: inline-block; background: #F443361A; border: 1px solid #F4433640; border-radius: 12px; padding: 0.15rem 0.5rem; font-size: 0.75rem; color: #F44336;">${escapeHtml(s.type)}</span>`)
    .join('');

  const sensitiveList = (c.sensitive_information || [])
    .slice(0, 3)
    .map(s => `<code style="display: block; background: var(--bg-light); padding: 0.35rem 0.5rem; border-radius: 4px; font-size: 0.8em; color: var(--fg); word-break: break-all; margin-bottom: 0.35rem;">${escapeHtml(s.snippet)}</code>`)
    .join('');

  return `
    <div class="classification-card" style="background: var(--bg); border: 1px solid var(--border); border-left: 4px solid ${meta.color}; border-radius: 8px; padding: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
        <div style="min-width: 0;">
          <div style="font-weight: 600; font-size: 1.05rem; margin-bottom: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(c.title || 'Untitled Chat')}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
            <span style="display: inline-block; background: ${meta.bg}; color: ${meta.color}; border-radius: 12px; padding: 0.2rem 0.6rem; font-size: 0.75rem; font-weight: 600;">
              ${meta.icon} ${meta.label}
            </span>
            ${categories}
            ${sensitive}
          </div>
        </div>
        <button onclick="openClassifiedChat('${escapeHtml(c.conversation_id || '')}')" class="export-btn" style="white-space: nowrap; font-size: 0.8rem; padding: 0.4rem 0.75rem;">
          Open
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.75rem;">
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #888; margin-bottom: 0.25rem;">
            <span>Confidence</span>
            <span>${confidence}%</span>
          </div>
          <div style="height: 6px; background: var(--bg-light); border-radius: 3px; overflow: hidden;">
            <div style="width: ${confidence}%; height: 100%; background: ${meta.color}; border-radius: 3px;"></div>
          </div>
        </div>
        <div style="display: flex; gap: 1rem;">
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 0.75rem; color: #888;">Privacy Risk</div>
            <div style="font-weight: 700; color: ${riskScoreScoreColor(riskScore)};">${riskScore}/10</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 0.75rem; color: #888;">Value</div>
            <div style="font-weight: 700; color: ${valueScoreColor(valueScore)};">${valueScore}/10</div>
          </div>
        </div>
      </div>

      <p style="margin: 0 0 0.5rem 0; color: var(--fg); font-size: 0.9rem;">
        <strong>Reason:</strong> ${escapeHtml(c.reason || '')}
      </p>
      <p style="margin: 0 0 0.75rem 0; color: #888; font-size: 0.85rem;">
        ${escapeHtml(c.summary || '')}
      </p>

      ${sensitiveList ? `
        <div style="margin-top: 0.75rem;">
          <div style="font-size: 0.75rem; color: #F44336; margin-bottom: 0.35rem;">Sensitive snippets</div>
          ${sensitiveList}
        </div>
      ` : ''}
    </div>
  `;
}

function riskScoreScoreColor(score) {
  if (score >= 7) return '#F44336';
  if (score >= 4) return '#FF9800';
  return '#4CAF50';
}

function valueScoreColor(score) {
  if (score >= 7) return '#4CAF50';
  if (score >= 4) return '#FFC107';
  return '#9E9E9E';
}

function countByRecommendation(classifications) {
  const counts = { keep: 0, review: 0, delete: 0, delete_immediately: 0 };
  for (const c of classifications) {
    const rec = c.recommendation || 'delete';
    counts[rec] = (counts[rec] || 0) + 1;
  }
  return counts;
}

/**
 * Generate JSON export of classification results matching the requested schema.
 * @param {object[]} classifications
 * @returns {string}
 */
export function exportClassificationsAsJSON(classifications) {
  const counts = countByRecommendation(classifications);
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalConversations: classifications.length,
    summary: counts,
    classifications: classifications.map(c => ({
      conversation_id: c.conversation_id || null,
      title: c.title || 'Untitled Chat',
      recommendation: c.recommendation || 'delete',
      confidence: c.confidence || 0,
      privacy_risk_score: c.privacy_risk_score || 0,
      value_score: c.value_score || 0,
      reason: c.reason || '',
      summary: c.summary || '',
      detected_categories: c.detected_categories || [],
      sensitive_information: (c.sensitive_information || []).map(s => ({
        type: s.type,
        severity: s.severity,
        snippet: s.snippet
      }))
    }))
  };
  return JSON.stringify(exportData, null, 2);
}
