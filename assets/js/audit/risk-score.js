// risk-score.js - Calculate privacy risk score from findings

const SEVERITY_WEIGHTS = {
  critical: 25,
  high: 10,
  medium: 3
};

const BUCKETS = [
  { max: 20, label: 'Safe', color: '#4CAF50' },
  { max: 50, label: 'Review Recommended', color: '#FFC107' },
  { max: 80, label: 'High Risk', color: '#FF9800' },
  { max: 100, label: 'Critical', color: '#F44336' }
];

/**
 * Calculate risk score from findings.
 * @param {object[]} findings
 * @returns {{score: number, label: string, color: string}}
 */
export function calculateRiskScore(findings) {
  let score = 0;
  for (const finding of findings) {
    score += SEVERITY_WEIGHTS[finding.severity] || 0;
  }
  score = Math.min(100, score);

  const bucket = BUCKETS.find(b => score <= b.max) || BUCKETS[BUCKETS.length - 1];

  return { score, label: bucket.label, color: bucket.color };
}

/**
 * Summarize findings by severity.
 * @param {object[]} findings
 * @returns {{critical: number, high: number, medium: number}}
 */
export function summarizeBySeverity(findings) {
  return {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length
  };
}
