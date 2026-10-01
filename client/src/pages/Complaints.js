import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../services/socket';
import PageHeader from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DataTable from '../components/DataTable';
import Drawer, { DetailRow, DrawerSection } from '../components/Drawer';
import { SeverityBadge, GenericBadge } from '../components/StatusBadge';
import { WorkflowStrip } from '../components/WorkflowSteps';
import KPICard, { IcoAlert, IcoBolt, IcoClock, IcoCheck, IcoShield } from '../components/KPICard';
import { buildComplaintsKPIs } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import { formatDate, formatDateTime } from '../services/donationSeed';
import PageSummary from '../components/PageSummary';

const KPI_ICON_BY_ID = {
  'open-complaints-mod': IcoAlert, 'critical-alerts': IcoBolt, 'avg-response-time': IcoClock,
  'resolved-today': IcoCheck, 'sla-compliance': IcoShield,
};

// Each tab surfaces only the KPIs relevant to its own content, instead of
// repeating the same full 5-card grid regardless of which tab is active.
const TAB_KPI_IDS = {
  public: ['open-complaints-mod', 'avg-response-time', 'sla-compliance'],
  dmt: ['critical-alerts', 'avg-response-time', 'open-complaints-mod'],
  escalations: ['critical-alerts', 'sla-compliance', 'avg-response-time'],
};

const TABS = [
  { key: 'public', label: 'Public Complaints' },
  { key: 'dmt', label: 'DMT Alerts' },
  { key: 'escalations', label: 'Escalations' },
];

function daysSince(iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }

export default function Complaints() {
  const { complaints, lastSync, openKpiDrawer, createInspectionFromAlert, createViolationFromAlert } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'public';
  const [viewingAlert, setViewingAlert] = useState(null);

  const kpis = useMemo(() => buildComplaintsKPIs(complaints), [complaints]);
  const visibleKpis = useMemo(() => {
    const ids = TAB_KPI_IDS[tab];
    return ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  }, [kpis, tab]);

  const publicComplaints = useMemo(() => complaints.filter((c) => c.source === 'Public Complaint').sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived)), [complaints]);
  const dmtAlerts = useMemo(() => complaints.filter((c) => c.source === 'DMT Alert').sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived)), [complaints]);
  const escalations = useMemo(() => {
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
    return complaints.filter((c) => (c.severity === 'critical' || c.severity === 'high') && c.status !== 'resolved')
      .sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || (new Date(a.dateReceived) - new Date(b.dateReceived)));
  }, [complaints]);

  const baseColumns = [
    { key: 'id', header: 'Alert ID', render: (c) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{c.id}</span>, sortValue: (c) => c.id },
    { key: 'source', header: 'Source', render: (c) => c.source, sortValue: (c) => c.source },
    { key: 'location', header: 'Location', render: (c) => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.location}</span> },
    { key: 'box', header: 'Related Box', render: (c) => <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{c.boxId || '—'}</span> },
    { key: 'severity', header: 'Severity', render: (c) => <SeverityBadge severity={c.severity} />, sortValue: (c) => c.severity },
    { key: 'date', header: 'Date Received', render: (c) => formatDate(c.dateReceived), sortValue: (c) => c.dateReceived },
    { key: 'team', header: 'Assigned Team', render: (c) => c.assignedTeam },
    { key: 'status', header: 'Status', render: (c) => <GenericBadge tone={c.status === 'resolved' ? 'green' : c.status === 'assigned' ? 'cyan' : 'amber'}>{c.status}</GenericBadge>, sortValue: (c) => c.status },
    { key: 'resolution', header: 'Resolution', render: (c) => <span style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--app-text-faint)' }}>{c.resolution || 'Pending'}</span> },
  ];

  const escalationColumns = [
    ...baseColumns.slice(0, 6),
    { key: 'age', header: 'Days Open', render: (c) => <span className="font-mono" style={{ color: daysSince(c.dateReceived) > 3 ? 'var(--app-danger)' : 'var(--app-text-muted)' }}>{daysSince(c.dateReceived)}</span>, sortValue: (c) => daysSince(c.dateReceived) },
    { key: 'team', header: 'Assigned Team', render: (c) => c.assignedTeam },
    { key: 'status', header: 'Status', render: (c) => <GenericBadge tone={c.status === 'assigned' ? 'cyan' : 'amber'}>{c.status}</GenericBadge> },
  ];

  const dmtColumns = [
    ...baseColumns,
    {
      key: 'actions', header: 'Actions', render: (c) => (
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); setViewingAlert(c); }} className="app-control-btn px-2 py-1 text-[10px] font-semibold">View Alert</button>
          {c.linkedInspectionId
            ? <span className="font-mono text-[10px]" style={{ color: 'var(--app-text-faint)' }}>{c.linkedInspectionId}</span>
            : <button onClick={(e) => { e.stopPropagation(); createInspectionFromAlert(c); }} disabled={!c.boxId} className="app-control-btn px-2 py-1 text-[10px] font-semibold" style={!c.boxId ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Create Inspection</button>}
          {c.linkedViolationId
            ? <span className="font-mono text-[10px]" style={{ color: 'var(--app-text-faint)' }}>{c.linkedViolationId}</span>
            : <button onClick={(e) => { e.stopPropagation(); createViolationFromAlert(c); }} disabled={!c.boxId} className="app-control-btn px-2 py-1 text-[10px] font-semibold" style={!c.boxId ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>Create Violation</button>}
        </div>
      ),
    },
  ];

  const view = tab === 'dmt' ? { data: dmtAlerts, columns: dmtColumns, title: 'DMT Alert Records', empty: 'No DMT alerts on file.' }
    : tab === 'escalations' ? { data: escalations, columns: escalationColumns, title: 'Escalation Queue', empty: 'No critical or high-severity cases currently open.' }
      : { data: publicComplaints, columns: baseColumns, title: 'Public Complaint Records', empty: 'No public complaints on file.' };

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Complaints & Alerts"
        subtitle="Integrated intake center for public complaints, DMT alerts, and field-reported irregularities."
        lastUpdated={lastSync}
      />

      <Tabs tabs={TABS} active={tab} onChange={(k) => setParams({ tab: k })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleKpis.map((kpi) => {
          const Icon = KPI_ICON_BY_ID[kpi.id];
          return <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('complaints', kpi.id) })} />;
        })}
      </div>

      {tab === 'public' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Complaint Resolution Workflow</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Standard lifecycle from intake to closure</p>
          </div>
          <div className="p-4">
            <WorkflowStrip glow steps={['Complaint Received', 'Location Identified', 'Box Matched', 'Risk Assessment', 'Inspection Assigned', 'Resolution', 'Complaint Closed']} />
          </div>
        </div>
      )}

      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{view.title} ({view.data.length.toLocaleString()})</h3>
          <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            {tab === 'escalations' ? 'Critical and high-severity cases requiring immediate attention' : 'All records for this intake channel'}
          </p>
        </div>
        <div className="p-4">
          <DataTable columns={view.columns} data={view.data} keyExtractor={(c) => c.id} pageSize={18} emptyLabel={view.empty} onRowClick={tab === 'dmt' ? setViewingAlert : undefined} />
        </div>
      </div>

      <Drawer open={!!viewingAlert} onClose={() => setViewingAlert(null)} title={viewingAlert?.id || ''} subtitle="DMT / external alert" width={440}>
        {viewingAlert && (
          <>
            {viewingAlert.source === 'DMT Alert' && (
              <div className="mb-3 rounded-md px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ background: 'var(--app-warning-bg)', border: '1px solid var(--app-warning-border)', color: 'var(--app-warning)', letterSpacing: '0.05em' }}>
                Demonstration / Simulated External Alert — not a live DMT integration
              </div>
            )}
            <DrawerSection title="Alert">
              <DetailRow label="Alert" value={viewingAlert.source === 'DMT Alert' ? 'Unauthorized donation box reported' : viewingAlert.source} />
              <DetailRow label="Location" value={viewingAlert.location} />
              <DetailRow label="Time" value={formatDateTime(viewingAlert.dateReceived)} />
              <DetailRow label="Severity" value={<SeverityBadge severity={viewingAlert.severity} />} />
              <DetailRow label="Related Box" value={viewingAlert.boxId || '—'} />
              <DetailRow label="Status" value={<GenericBadge tone={viewingAlert.status === 'resolved' ? 'green' : viewingAlert.status === 'assigned' ? 'cyan' : 'amber'}>{viewingAlert.status}</GenericBadge>} />
            </DrawerSection>
            <DrawerSection title="Resulting Operational Records">
              <DetailRow label="Linked Inspection" value={viewingAlert.linkedInspectionId || 'None yet'} />
              <DetailRow label="Linked Violation" value={viewingAlert.linkedViolationId || 'None yet'} />
            </DrawerSection>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { createInspectionFromAlert(viewingAlert); setViewingAlert(null); }}
                disabled={!viewingAlert.boxId || !!viewingAlert.linkedInspectionId}
                className="app-control-btn py-2 text-[11px] font-semibold"
                style={!viewingAlert.boxId || viewingAlert.linkedInspectionId ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                Create Inspection
              </button>
              <button
                onClick={() => { createViolationFromAlert(viewingAlert); setViewingAlert(null); }}
                disabled={!viewingAlert.boxId || !!viewingAlert.linkedViolationId}
                className="app-control-btn py-2 text-[11px] font-semibold"
                style={!viewingAlert.boxId || viewingAlert.linkedViolationId ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                Create Violation
              </button>
            </div>
          </>
        )}
      </Drawer>

      <PageSummary page={`complaints-${tab}`} />
    </div>
  );
}
