// One semantic colour system for every chart, map marker and status swatch.
//   Red     — critical ONLY (never used for merely "bad" or "open")
//   Green   — normal / healthy / completed
//   Orange  — operational issue: warning, overdue, backlog, needs attention
//   Blue    — informational / active process: in progress, assigned, under monitoring
//   Grey    — inactive / neutral / historical: archived, not started, no current action
//   Purple  — special analytical or system state: targets, forecasts, custody/system holds
export const SEM = {
  critical: '#ef4444',
  normal: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
  infoLight: '#60a5fa', // second blue shade where two "active" series share a chart
  neutral: '#94a3b8',
  analytic: '#8b5cf6',
};

export const SEM_SOFT = {
  critical: 'rgba(239,68,68,0.18)',
  normal: 'rgba(34,197,94,0.14)',
  warning: 'rgba(245,158,11,0.20)',
  info: 'rgba(59,130,246,0.15)',
  neutral: 'rgba(148,163,184,0.15)',
  analytic: 'rgba(139,92,246,0.15)',
};

// Severity scale used by violation charts: only "critical" is red.
export const SEVERITY_COLOR = { critical: SEM.critical, high: SEM.warning, medium: SEM.info, low: SEM.neutral };

// Zone risk categories (Location Intelligence bubble chart).
export const RISK_CATEGORY_COLOR = { Normal: SEM.normal, Moderate: SEM.info, High: SEM.warning, Critical: SEM.critical };

// green / orange / red bands for score-style metrics.
export const bandColor = (value, greenAt, orangeAt) => (value >= greenAt ? SEM.normal : value >= orangeAt ? SEM.warning : SEM.critical);
