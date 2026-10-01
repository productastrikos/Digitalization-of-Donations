import React from 'react';
import { SEM } from '../services/palette';

export const BOX_STATUS_COLOR = {
  compliant: SEM.normal,
  'non-compliant': SEM.critical,
  'under-inspection': SEM.info,
  'pending-displacement': SEM.warning,
  safekeeping: SEM.analytic,
  unknown: SEM.neutral,
};

const BOX_STATUS_LABEL = {
  compliant: 'Compliant',
  'non-compliant': 'Non-Compliant',
  'under-inspection': 'Under Inspection',
  // Not shown bare — see removalQualifier below. 'pending-displacement' is a
  // legitimate real sub-state (non-compliant, removal approved, not yet
  // physically moved), not a duplicate of the canonical lifecycle field; it
  // just isn't a self-explanatory word on its own the way the others are.
  'pending-displacement': 'Non-Compliant',
  safekeeping: 'Safekeeping',
  unknown: 'Unverified',
};

const BOX_STATUS_CHIP = {
  compliant: 'status-chip-success',
  'non-compliant': 'status-chip-danger',
  'under-inspection': 'status-chip-warning',
  'pending-displacement': 'status-chip-warning',
  safekeeping: 'status-chip-info',
  unknown: 'status-chip-accent',
};

// The removal-request's own status qualifies "pending-displacement" into a
// label that says what's actually true: still non-compliant, plus how far
// the approved removal has gotten. Never a standalone status string.
function removalQualifier(removal) {
  if (!removal) return 'Removal Pending';
  if (removal.status === 'in-transit') return 'Removal In Transit';
  if (removal.status === 'assigned') return 'Removal Approved';
  return 'Removal Pending';
}

/** removal: this box's own open displacement record, if any (optional — omit where not readily available). */
export function BoxStatusBadge({ status, removal }) {
  const label = status === 'pending-displacement' ? `${BOX_STATUS_LABEL[status]} — ${removalQualifier(removal)}` : (BOX_STATUS_LABEL[status] || status);
  return (
    <span className={`status-chip ${BOX_STATUS_CHIP[status] || 'status-chip-accent'}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: BOX_STATUS_COLOR[status] || '#94a3b8' }} />
      {label}
    </span>
  );
}

const SEVERITY_CHIP = { critical: 'status-chip-danger', high: 'status-chip-warning', medium: 'status-chip-warning', low: 'status-chip-accent' };
export function SeverityBadge({ severity }) {
  return <span className={`status-chip ${SEVERITY_CHIP[severity] || 'status-chip-accent'}`}>{severity}</span>;
}

const INSPECTION_STATUS_CHIP = { completed: 'status-chip-success', pending: 'status-chip-info', overdue: 'status-chip-danger', escalated: 'status-chip-warning' };
export function InspectionStatusBadge({ status }) {
  return <span className={`status-chip ${INSPECTION_STATUS_CHIP[status] || 'status-chip-accent'}`}>{status}</span>;
}

const GENERIC_CHIP = { green: 'status-chip-success', red: 'status-chip-danger', amber: 'status-chip-warning', cyan: 'status-chip-info', slate: 'status-chip-accent' };
export function GenericBadge({ tone, children, className = '' }) {
  return <span className={`status-chip ${GENERIC_CHIP[tone] || 'status-chip-accent'} ${className}`.trim()}>{children}</span>;
}
