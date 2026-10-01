import React, { useMemo, useState } from 'react';
import { useData } from '../services/socket';
import PageHeader from '../components/PageHeader';
import { SeverityBadge, GenericBadge } from '../components/StatusBadge';
import { WorkflowStrip } from '../components/WorkflowSteps';
import KPICard, { IcoClipboard, IcoAlert, IcoPeople, IcoSignal, IcoClock } from '../components/KPICard';
import { zoneById, formatDate, LOGISTICS_TEAMS } from '../services/donationSeed';
import { buildCaseQueue, estimateReach, inspectorWorkloadMap, PRIORITY_RANK } from '../services/workAllocation';
import { buildWorkAllocationKPIs } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import Drawer from '../components/Drawer';
import PageSummary from '../components/PageSummary';

const INSPECTION_STAGES = ['Inspection Assigned', 'Field Officer Visits Location', 'QR Code Scanned', 'Evidence Captured', 'Compliance Assessment', 'Corrective Action', 'Closure Verification'];
const COMPLAINT_STAGES = ['Complaint Received', 'Location Identified', 'Box Matched', 'Risk Assessment', 'Inspection Assigned', 'Resolution', 'Complaint Closed'];
const DISPLACEMENT_STAGES = ['Violation Confirmed', 'Removal Approved', 'Displacement Assigned', 'Transport Allocated', 'Box Collected', 'Transport to Facility', 'Inventory Registered'];

const KIND_LABEL = { inspection: 'Inspection', complaint: 'Complaint', displacement: 'Displacement' };
const KIND_TONE = { inspection: 'cyan', complaint: 'amber', displacement: 'slate' };
const KPI_ICONS = [IcoClipboard, IcoAlert, IcoPeople, IcoSignal, IcoClock];

function renderCaseRow(c, selected, onSelect, padded = false) {
  const isActive = selected?.key === c.key;
  return (
    <button
      key={c.key}
      onClick={() => onSelect(c.key)}
      className="w-full text-left transition-colors"
      style={{
        padding: padded ? '12px 20px' : '12px 16px',
        background: isActive ? 'var(--app-accent-bg)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--app-accent)' : '3px solid transparent',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <GenericBadge tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</GenericBadge>
        <SeverityBadge severity={PRIORITY_RANK[c.priority] === 0 ? 'critical' : PRIORITY_RANK[c.priority] === 1 ? 'high' : 'medium'} />
      </div>
      <div className="text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>{c.title}</div>
      <div className="text-[10.5px] mt-1" style={{ color: 'var(--app-text-faint)' }}>
        {zoneById(c.zoneId)?.name || 'Unknown Zone'} · {c.currentAssignee}
      </div>
    </button>
  );
}

function stageInfo(item) {
  if (item.kind === 'inspection') {
    const idx = item.raw.status === 'escalated' ? 4 : 0;
    return { steps: INSPECTION_STAGES, activeIndex: idx };
  }
  if (item.kind === 'complaint') {
    const idx = item.raw.status === 'assigned' ? 4 : 0;
    return { steps: COMPLAINT_STAGES, activeIndex: idx };
  }
  const idx = item.raw.status === 'assigned' ? 2 : item.raw.status === 'in-transit' ? 4 : 1;
  return { steps: DISPLACEMENT_STAGES, activeIndex: idx };
}

export default function WorkAllocation() {
  const ctx = useData();
  const {
    inspections, complaints, displacements, boxes, inspectors, lastSync,
    reassignInspection, reassignComplaint, reassignDisplacement, openKpiDrawer,
  } = ctx;

  const [selectedKey, setSelectedKey] = useState(null);
  const [showAllCases, setShowAllCases] = useState(false);

  const cases = useMemo(
    () => buildCaseQueue({ inspections, complaints, displacements, boxes, inspectors }),
    [inspections, complaints, displacements, boxes, inspectors],
  );

  const kpis = useMemo(() => buildWorkAllocationKPIs(ctx), [ctx]);

  const selected = cases.find((c) => c.key === selectedKey) || cases[0] || null;

  const inspectorWorkload = useMemo(() => inspectorWorkloadMap(inspections), [inspections]);

  const inspectorTeamWorkload = useMemo(() => {
    const map = {};
    complaints.forEach((c) => { if (c.status !== 'resolved') map[c.assignedTeam] = (map[c.assignedTeam] || 0) + 1; });
    return map;
  }, [complaints]);

  const logisticsTeamWorkload = useMemo(() => {
    const map = {};
    displacements.forEach((d) => { if (d.status !== 'completed') map[d.assignedTeam] = (map[d.assignedTeam] || 0) + 1; });
    return map;
  }, [displacements]);

  function renderPersonnelTable() {
    if (!selected) return null;
    const zoneName = zoneById(selected.zoneId)?.name;

    if (selected.kind === 'inspection') {
      const rows = [...inspectors].sort((a, b) => {
        const am = a.assignedZone === zoneName ? 0 : 1;
        const bm = b.assignedZone === zoneName ? 0 : 1;
        return am - bm || (a.availability === 'On Field' ? 0 : 1) - (b.availability === 'On Field' ? 0 : 1);
      });
      return (
        <PersonnelTable
          columns={['Name', 'Team', 'Zone Match', 'Availability', 'Distance', 'ETA', 'Workload', 'Action']}
          rows={rows.map((ins) => {
            const match = ins.assignedZone === zoneName;
            const reach = estimateReach(ins.id + selected.id, match);
            return {
              key: ins.id,
              cells: [
                ins.name, ins.team,
                <GenericBadge tone={match ? 'green' : 'slate'}>{match ? 'HIGH' : 'LOW'}</GenericBadge>,
                <GenericBadge tone={ins.availability === 'On Field' ? 'cyan' : ins.availability === 'Available' ? 'green' : 'slate'}>{ins.availability}</GenericBadge>,
                `${reach.km} km`, `${reach.min} min`, `${inspectorWorkload[ins.id] || 0} active`,
              ],
              disabled: ins.availability === 'Off Duty',
              current: ins.id === selected.raw.inspectorId,
              onAssign: () => reassignInspection(selected.id, ins.id),
            };
          })}
        />
      );
    }

    if (selected.kind === 'complaint') {
      const teams = Array.from(new Set(inspectors.map((i) => i.team)));
      return (
        <PersonnelTable
          columns={['Team', 'Coverage Zone', 'Active Cases', 'Action']}
          rows={teams.map((team) => {
            const rep = inspectors.find((i) => i.team === team);
            return {
              key: team,
              cells: [team, rep?.assignedZone || '—', `${inspectorTeamWorkload[team] || 0} active`],
              current: team === selected.raw.assignedTeam,
              onAssign: () => reassignComplaint(selected.id, team),
            };
          })}
        />
      );
    }

    return (
      <PersonnelTable
        columns={['Logistics Team', 'Active Jobs', 'Action']}
        rows={LOGISTICS_TEAMS.map((team) => ({
          key: team,
          cells: [team, `${logisticsTeamWorkload[team] || 0} active`],
          current: team === selected.raw.assignedTeam,
          onAssign: () => reassignDisplacement(selected.id, team),
        }))}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Work Allocation"
        subtitle="Assign field inspectors and logistics teams to open inspection, complaint, and displacement cases across Abu Dhabi."
        lastUpdated={lastSync}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {kpis.map((kpi, idx) => {
          const Icon = KPI_ICONS[idx];
          return <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('work-allocation', kpi.id) })} />;
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3" style={{ alignItems: 'start' }}>
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden xl:col-span-1">
          <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Open Cases</h3>
            <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{cases.length} pending</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--app-border-soft)' }}>
            {cases.length === 0 && (
              <div className="text-[11px] text-center py-10" style={{ color: 'var(--app-text-faint)' }}>No open cases requiring allocation.</div>
            )}
            {cases.slice(0, 5).map((c) => renderCaseRow(c, selected, setSelectedKey))}
          </div>
          {cases.length > 5 && (
            <button
              onClick={() => setShowAllCases(true)}
              className="w-full text-center px-4 py-2.5 text-[11px] font-semibold"
              style={{ color: 'var(--app-accent)', borderTop: '1px solid var(--app-border-soft)' }}
            >
              View all {cases.length} →
            </button>
          )}
        </div>

        <Drawer open={showAllCases} onClose={() => setShowAllCases(false)} title="Open Cases" subtitle={`${cases.length} cases pending allocation`} width={480}>
          <div className="divide-y -mx-5" style={{ borderColor: 'var(--app-border-soft)' }}>
            {cases.map((c) => renderCaseRow(c, selected, (key) => { setSelectedKey(key); setShowAllCases(false); }, true))}
          </div>
        </Drawer>

        <div className="xl:col-span-2 space-y-3">
          {!selected ? (
            <div className="bg-app-panel border border-app-border rounded-xl p-10 text-center text-[12px]" style={{ color: 'var(--app-text-faint)' }}>
              Select a case from the queue to view allocation details.
            </div>
          ) : (
            <>
              <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <GenericBadge tone={KIND_TONE[selected.kind]}>{KIND_LABEL[selected.kind]}</GenericBadge>
                      <span className="font-mono text-[11px]" style={{ color: 'var(--app-text-faint)' }}>{selected.id}</span>
                    </div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{selected.title}</h3>
                  </div>
                  <SeverityBadge severity={PRIORITY_RANK[selected.priority] === 0 ? 'critical' : PRIORITY_RANK[selected.priority] === 1 ? 'high' : 'medium'} />
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11.5px]">
                  <Field label="Zone" value={zoneById(selected.zoneId)?.name || '—'} />
                  <Field label="Status" value={<span className="capitalize">{selected.status.replace('-', ' ')}</span>} />
                  <Field label="Logged" value={formatDate(selected.scheduledDate)} />
                  <Field label="Currently Assigned" value={selected.currentAssignee} />
                </div>
                <div className="px-4 pb-4">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--app-text-faint)' }}>Case Progress</div>
                  <WorkflowStrip {...stageInfo(selected)} />
                </div>
              </div>

              <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-app-border">
                  <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Available Personnel</h3>
                  <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Ranked by zone match and availability — select Assign to reallocate this case</p>
                </div>
                <div className="p-4">
                  {renderPersonnelTable()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <PageSummary page="allocation" />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--app-text-faint)' }}>{label}</div>
      <div style={{ color: 'var(--app-text)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function PersonnelTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--app-border)' }}>
      <table className="w-full border-collapse text-left" style={{ fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-soft)' }}>
            {columns.map((c) => (
              <th key={c} style={{ padding: '8px 12px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--app-text-faint)', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: '1px solid var(--app-border-soft)' }}>
              {row.cells.map((cell, i) => (
                <td key={i} style={{ padding: '8px 12px', color: 'var(--app-text-muted)', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
              <td style={{ padding: '8px 12px' }}>
                {row.current ? (
                  <GenericBadge tone="cyan">Assigned</GenericBadge>
                ) : (
                  <button
                    onClick={row.onAssign}
                    disabled={row.disabled}
                    className="app-control-btn px-2.5 py-1 text-[10.5px] font-semibold"
                    style={{ opacity: row.disabled ? 0.4 : 1, cursor: row.disabled ? 'not-allowed' : 'pointer' }}
                  >
                    Assign
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
