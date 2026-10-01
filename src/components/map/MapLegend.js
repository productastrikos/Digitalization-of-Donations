import React from 'react';
import { BOX_STATUS_COLOR } from '../StatusBadge';

const ITEMS = [
  ['compliant', 'Compliant'],
  ['under-inspection', 'Under Inspection'],
  ['non-compliant', 'Non-Compliant'],
  ['pending-displacement', 'Pending Displacement'],
  ['safekeeping', 'Safekeeping'],
  ['unknown', 'Unverified'],
];

export default function MapLegend() {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-md)' }}>
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Box Status</div>
      <div className="space-y-1">
        {ITEMS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: BOX_STATUS_COLOR[key] }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
