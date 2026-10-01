import React from 'react';
import { BOX_STATUS_COLOR } from '../StatusBadge';
import { SEM } from '../../services/palette';

const ITEMS = [
  ['compliant', 'Verified registered donation box'],
  ['non-compliant', 'Non-compliant donation box'],
  ['under-inspection', 'Pending inspection'],
  ['unknown', 'Unmapped or unknown location'],
  ['pending-displacement', 'Awaiting removal'],
  ['safekeeping', 'In storage'],
];

export default function CoverageMapLegend() {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-md)' }}>
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Marker Legend</div>
      <div className="space-y-1">
        {ITEMS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BOX_STATUS_COLOR[key] }} />
            {label}
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid var(--app-border)' }}>
        <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Zone Survey Status</div>
        {[[SEM.normal, 'Complete'], [SEM.warning, 'Partial'], [SEM.neutral, 'Pending']].map(([color, label]) => (
          <div key={label} className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
            <span className="shrink-0" style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${color}`, background: `${color}22` }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
