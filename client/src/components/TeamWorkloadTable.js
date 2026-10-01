import React, { useMemo, useState } from 'react';
import { useData } from '../services/socket';
import Drawer, { DetailRow, DrawerSection } from './Drawer';
import { GenericBadge, InspectionStatusBadge } from './StatusBadge';
import { SEM } from '../services/palette';
import { zoneName, formatDate } from '../services/donationSeed';

// Active-assignment capacity per inspector. ≥85% of it is "high workload",
// above 100% is "capacity exceeded". Demonstration threshold.
const CAPACITY = 26;
const AVAIL_TONE = { Available: 'green', 'On Field': 'cyan', 'Off Duty': 'slate' };
const LEVEL = {
  normal: { color: SEM.normal, label: 'Normal' },
  high: { color: SEM.warning, label: 'High workload' },
  exceeded: { color: SEM.critical, label: 'Capacity exceeded' },
};
const OPEN = ['pending', 'overdue', 'escalated'];
const RANK = { escalated: 0, overdue: 1, pending: 2 };

function levelOf(active) {
  const u = active / CAPACITY;
  return u > 1 ? 'exceeded' : u >= 0.85 ? 'high' : 'normal';
}

/**
 * TeamWorkloadTable — dense operational view of every inspector's caseload
 * (replaces the large horizontal-bar chart). View / Assign / Reassign all act
 * on the shared inspection records, so the numbers here, the Field Inspection
 * Units above and the Work Allocation console always agree.
 */
export default function TeamWorkloadTable() {
  const { inspections, inspectors, reassignInspection } = useData();
  const [showAll, setShowAll] = useState(false);
  const [panel, setPanel] = useState(null); // { id, mode: 'view' | 'assign' | 'reassign' }
  const [targets, setTargets] = useState({});

  const rows = useMemo(() => {
    const map = {};
    inspectors.forEach((ins) => { map[ins.id] = { inspector: ins, active: 0, completed: 0 }; });
    inspections.forEach((i) => {
      const r = map[i.inspectorId];
      if (!r) return;
      if (i.status === 'completed') r.completed += 1; else r.active += 1;
    });
    return Object.values(map)
      .map((r) => ({ ...r, util: Math.round((r.active / CAPACITY) * 100), level: levelOf(r.active) }))
      .sort((a, b) => b.active - a.active);
  }, [inspections, inspectors]);

  const totals = useMemo(() => ({
    inspectors: rows.length,
    active: rows.reduce((s, r) => s + r.active, 0),
    completed: rows.reduce((s, r) => s + r.completed, 0),
    available: rows.filter((r) => r.inspector.availability === 'Available').length,
    alerts: rows.filter((r) => r.level !== 'normal').length,
    exceeded: rows.filter((r) => r.level === 'exceeded').length,
  }), [rows]);

  const visible = showAll ? rows : rows.slice(0, 6);
  const current = panel ? rows.find((r) => r.inspector.id === panel.id) : null;

  const caseload = useMemo(
    () => (current ? inspections.filter((i) => i.inspectorId === current.inspector.id && i.status !== 'completed').sort((a, b) => RANK[a.status] - RANK[b.status] || new Date(a.scheduledDate) - new Date(b.scheduledDate)) : []),
    [current, inspections],
  );
  const candidates = useMemo(() => {
    if (!current) return [];
    const zone = current.inspector.assignedZone;
    return inspections
      .filter((i) => i.inspectorId !== current.inspector.id && OPEN.includes(i.status))
      .sort((a, b) => RANK[a.status] - RANK[b.status] || (zoneName(b.zoneId) === zone) - (zoneName(a.zoneId) === zone) || new Date(a.scheduledDate) - new Date(b.scheduledDate))
      .slice(0, 12);
  }, [current, inspections]);
  const bestTarget = (excludeId) => rows.filter((r) => r.inspector.id !== excludeId && r.inspector.availability !== 'Off Duty').sort((a, b) => a.active - b.active)[0]?.inspector.id;

  const th = { padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--app-text-faint)', textAlign: 'start', whiteSpace: 'nowrap' };
  const td = { padding: '5px 10px', whiteSpace: 'nowrap' };
  const btn = 'app-control-btn px-2 py-0.5 text-[10px] font-semibold';

  return (
    <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Team Workload</h3>
          <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Active caseload vs. completed inspections per inspector · capacity {CAPACITY} active cases</p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--app-text-faint)' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success)' }} /> Live
        </span>
      </div>

      {/* summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px" style={{ background: 'var(--app-border)' }}>
        {[
          ['Total inspectors', totals.inspectors, 'var(--app-text)'],
          ['Active assignments', totals.active, SEM.info],
          ['Completed inspections', totals.completed, 'var(--app-text)'],
          ['Available inspectors', totals.available, SEM.normal],
          ['Capacity alerts', totals.alerts, totals.exceeded ? SEM.critical : totals.alerts ? SEM.warning : SEM.normal],
        ].map(([label, value, color]) => (
          <div key={label} className="px-3 py-1.5" style={{ background: 'var(--app-panel)' }}>
            <div className="text-[9.5px] uppercase font-semibold" style={{ color: 'var(--app-text-faint)', letterSpacing: '0.04em' }}>{label}</div>
            <div className="font-mono font-bold text-[15px] leading-tight" style={{ color }}>
              {value}{label === 'Capacity alerts' && totals.exceeded > 0 && <span className="text-[10px] font-semibold ml-1.5" style={{ color: SEM.critical }}>{totals.exceeded} exceeded</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: 'var(--app-surface-soft)', borderBottom: '1px solid var(--app-border)' }}>
              {['Inspector', 'Active', 'Completed', 'Status', 'Workload', 'Actions'].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.inspector.id} style={{ borderBottom: '1px solid var(--app-border-soft)' }}>
                <td style={td}>
                  <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{r.inspector.name}</span>
                  <span className="ml-2 text-[10px]" style={{ color: 'var(--app-text-faint)' }}>{r.inspector.team}</span>
                </td>
                <td style={td} className="font-mono">{r.active}</td>
                <td style={td} className="font-mono">{r.completed}</td>
                <td style={td}><GenericBadge tone={AVAIL_TONE[r.inspector.availability]}>{r.inspector.availability}</GenericBadge></td>
                <td style={td}>
                  <span className="inline-flex items-center gap-2">
                    <span style={{ width: 72, height: 4, borderRadius: 2, background: 'var(--app-surface-raised)', display: 'inline-block', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, r.util)}%`, background: LEVEL[r.level].color, transition: 'width 500ms ease' }} />
                    </span>
                    <span className="font-mono text-[10.5px]" style={{ color: LEVEL[r.level].color, fontWeight: 600 }}>{r.util}%</span>
                    {r.level !== 'normal' && <span className="text-[10px]" style={{ color: LEVEL[r.level].color }}>{LEVEL[r.level].label}</span>}
                  </span>
                </td>
                <td style={td}>
                  <span className="inline-flex gap-1">
                    <button className={btn} onClick={() => setPanel({ id: r.inspector.id, mode: 'view' })}>View</button>
                    <button className={btn} onClick={() => setPanel({ id: r.inspector.id, mode: 'assign' })}>Assign</button>
                    <button className={btn} onClick={() => setPanel({ id: r.inspector.id, mode: 'reassign' })}>Reassign</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 6 && (
        <div className="px-4 py-1.5 border-t border-app-border">
          <button onClick={() => setShowAll((v) => !v)} className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
            {showAll ? 'Show fewer' : `View all ${rows.length} →`}
          </button>
        </div>
      )}

      <Drawer open={!!current} onClose={() => setPanel(null)} title={current?.inspector.name || ''} subtitle={current ? `${current.inspector.team} · ${current.inspector.assignedZone}` : ''} width={520}>
        {current && (
          <>
            <div className="flex gap-1.5 mb-4">
              {[['view', 'View'], ['assign', 'Assign'], ['reassign', 'Reassign']].map(([m, l]) => (
                <button
                  key={m} onClick={() => setPanel({ id: current.inspector.id, mode: m })}
                  className="px-3 py-1.5 rounded-md text-[11px] font-semibold border"
                  style={panel.mode === m ? { background: 'var(--app-accent-bg)', borderColor: 'var(--app-accent-border)', color: 'var(--app-accent)' } : { background: 'var(--app-surface-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text-faint)' }}
                >
                  {l}
                </button>
              ))}
            </div>

            <DrawerSection title="Workload">
              <DetailRow label="Availability" value={<GenericBadge tone={AVAIL_TONE[current.inspector.availability]}>{current.inspector.availability}</GenericBadge>} />
              <DetailRow label="Active assignments" value={`${current.active} of ${CAPACITY} (${current.util}%)`} />
              <DetailRow label="Completed inspections" value={current.completed} />
              <DetailRow label="Status" value={<span style={{ color: LEVEL[current.level].color, fontWeight: 600 }}>{LEVEL[current.level].label}</span>} />
            </DrawerSection>

            {panel.mode === 'view' && (
              <DrawerSection title={`Active caseload (${caseload.length})`}>
                <div className="space-y-1.5">
                  {caseload.slice(0, 12).map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                      <span><span className="font-mono" style={{ color: 'var(--app-text)' }}>{i.id}</span> <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{i.boxId}</span></span>
                      <span className="flex items-center gap-2"><span style={{ color: 'var(--app-text-faint)' }}>{formatDate(i.scheduledDate)}</span><InspectionStatusBadge status={i.status} /></span>
                    </div>
                  ))}
                  {caseload.length === 0 && <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>No active assignments.</p>}
                  {caseload.length > 12 && <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Showing the 12 most urgent of {caseload.length}.</p>}
                </div>
              </DrawerSection>
            )}

            {panel.mode === 'assign' && (
              <DrawerSection title="Assign an open case to this inspector">
                <p className="text-[10.5px] mb-2" style={{ color: 'var(--app-text-faint)' }}>Most urgent first, cases in this inspector's zone ranked ahead. Assigning moves the case from its current inspector.</p>
                <div className="space-y-1.5">
                  {candidates.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                      <span className="min-w-0">
                        <span className="font-mono" style={{ color: 'var(--app-text)' }}>{i.id}</span> <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{i.boxId}</span>
                        <span className="block truncate" style={{ color: 'var(--app-text-faint)' }}>{zoneName(i.zoneId)} · now {inspectors.find((x) => x.id === i.inspectorId)?.name || '—'}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0"><InspectionStatusBadge status={i.status} /><button className={btn} onClick={() => reassignInspection(i.id, current.inspector.id)}>Assign here</button></span>
                    </div>
                  ))}
                  {candidates.length === 0 && <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>No open cases to assign.</p>}
                </div>
              </DrawerSection>
            )}

            {panel.mode === 'reassign' && (
              <DrawerSection title="Move one of this inspector's cases to someone else">
                <div className="space-y-1.5">
                  {caseload.slice(0, 12).map((i) => {
                    const target = targets[i.id] || bestTarget(current.inspector.id);
                    return (
                      <div key={i.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                        <span className="min-w-0">
                          <span className="font-mono" style={{ color: 'var(--app-text)' }}>{i.id}</span> <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{i.boxId}</span>
                          <span className="block"><InspectionStatusBadge status={i.status} /></span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <select value={target} onChange={(e) => setTargets((prev) => ({ ...prev, [i.id]: e.target.value }))} className="rounded-md px-1.5 py-1 text-[10.5px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)', maxWidth: 150 }}>
                            {rows.filter((r) => r.inspector.id !== current.inspector.id).map((r) => <option key={r.inspector.id} value={r.inspector.id}>{r.inspector.name} ({r.active})</option>)}
                          </select>
                          <button className={btn} onClick={() => reassignInspection(i.id, target)}>Move</button>
                        </span>
                      </div>
                    );
                  })}
                  {caseload.length === 0 && <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>No active assignments to move.</p>}
                </div>
              </DrawerSection>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
