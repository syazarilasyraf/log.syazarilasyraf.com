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
