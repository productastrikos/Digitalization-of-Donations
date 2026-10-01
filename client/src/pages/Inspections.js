import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../services/socket';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DataTable from '../components/DataTable';
import { InspectionStatusBadge, GenericBadge } from '../components/StatusBadge';
import { WorkflowStrip } from '../components/WorkflowSteps';
import KPICard, { IcoClipboard, IcoCheck, IcoClock, IcoAlert, IcoHourglass, IcoShield, IcoPeople } from '../components/KPICard';
import { buildInspectionKPIs } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import InspectionDetailDrawer from '../components/InspectionDetailDrawer';
import { zoneById, formatDate } from '../services/donationSeed';
import PageSummary from '../components/PageSummary';
import StageBoxesPanel from '../components/StageBoxesPanel';
import TeamWorkloadTable from '../components/TeamWorkloadTable';

const KPI_ICON_BY_ID = {
  'total-inspections': IcoClipboard, 'completed-today': IcoCheck, 'pending-inspections': IcoClock,
  'overdue-inspections': IcoAlert, 'avg-resolution': IcoHourglass, 'inspection-compliance-rate': IcoShield,
  'field-utilization': IcoPeople,
};

// Each tab surfaces only the KPIs tied to what it actually shows, instead of
// repeating the same full 7-card grid regardless of which tab is active.
const TAB_KPI_IDS = {
  planning: ['pending-inspections', 'overdue-inspections', 'avg-resolution'],
  teams: ['field-utilization', 'total-inspections', 'avg-resolution'],
  history: ['completed-today', 'inspection-compliance-rate', 'total-inspections'],
};

const TABS = [
  { key: 'planning', label: 'Inspection Planning' },
  { key: 'teams', label: 'Field Teams' },
  { key: 'history', label: 'Inspection History' },
];

export default function Inspections() {
  const { inspections, inspectors, lastSync, openKpiDrawer } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'planning';
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [openInspectionId, setOpenInspectionId] = React.useState(null);

  const kpis = useMemo(() => buildInspectionKPIs(inspections), [inspections]);
  const visibleKpis = useMemo(() => {
    const ids = TAB_KPI_IDS[tab];
    return ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  }, [kpis, tab]);

  const planningQueue = useMemo(() => {
    const queue = inspections.filter((i) => i.status === 'pending' || i.status === 'overdue' || i.status === 'escalated');
    const filteredQueue = statusFilter === 'all' ? queue : queue.filter((i) => i.status === statusFilter);
    return [...filteredQueue].sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
  }, [inspections, statusFilter]);

  const history = useMemo(() => inspections.filter((i) => i.status === 'completed').sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate)), [inspections]);

  const activeByInspector = useMemo(() => {
    const m = {};
    inspections.forEach((i) => { if (i.status !== 'completed') m[i.inspectorId] = (m[i.inspectorId] || 0) + 1; });
    return m;
  }, [inspections]);

  const columns = (showResult) => [
    { key: 'id', header: 'Inspection ID', render: (i) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{i.id}</span>, sortValue: (i) => i.id },
    { key: 'box', header: 'Box ID', render: (i) => <span className="font-mono" style={{ color: 'var(--app-text-muted)' }}>{i.boxId}</span> },
    { key: 'zone', header: 'Location', render: (i) => zoneById(i.zoneId)?.name || i.zoneId },
    { key: 'inspector', header: 'Assigned Inspector', render: (i) => inspectors.find((ins) => ins.id === i.inspectorId)?.name || '—' },
    { key: 'type', header: 'Inspection Type', render: (i) => i.inspectionType },
    { key: 'scheduled', header: 'Scheduled Date', render: (i) => formatDate(i.scheduledDate), sortValue: (i) => i.scheduledDate },
    { key: 'status', header: 'Status', render: (i) => <InspectionStatusBadge status={i.status} />, sortValue: (i) => i.status },
    ...(showResult ? [{ key: 'result', header: 'Compliance Result', render: (i) => <GenericBadge tone={i.complianceResult === 'pass' ? 'green' : i.complianceResult === 'fail' ? 'red' : 'slate'}>{i.complianceResult}</GenericBadge> }] : []),
    {
      key: 'evidence', header: 'Evidence',
      render: (i) => {
        const items = i.evidence || [];
        if (items.length === 0) return <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>0</span>;
        const thumb = items[0];
        return (
          <div className="flex items-center gap-1.5">
            <div className="rounded overflow-hidden shrink-0 flex items-center justify-center" style={{ width: 22, height: 22, background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)' }}>
              {thumb.image ? (
                <img src={thumb.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg className="w-3 h-3" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 9a2 2 0 012-2h1.5l1-2h9l1 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm9 8a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" /></svg>
              )}
            </div>
            <span className="font-mono" style={{ color: 'var(--app-text)' }}>{items.length}</span>
          </div>
        );
      },
      sortValue: (i) => (i.evidence || []).length,
    },
    { key: 'priority', header: 'Priority', render: (i) => <span className="capitalize">{i.priority}</span> },
    { key: 'next', header: 'Next Action', render: (i) => <span style={{ color: 'var(--app-text-faint)' }}>{i.nextAction}</span> },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Inspections & Field Operations"
        subtitle="Operational management of field inspection scheduling, execution, and outcomes across Abu Dhabi."
        lastUpdated={lastSync}
      />

      <Tabs tabs={TABS} active={tab} onChange={(k) => setParams({ tab: k })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleKpis.map((kpi) => {
          const Icon = KPI_ICON_BY_ID[kpi.id];
          return <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('inspections', kpi.id) })} />;
        })}
      </div>

      {tab === 'planning' && (
        <>
          <StageBoxesPanel stage="identified" title="Boxes Awaiting First Inspection" subtitle="Canonical lifecycle default for Inspections — every registered box not yet inspected." />
          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Inspection Workflow</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Standard field verification lifecycle</p>
            </div>
            <div className="p-4">
              <WorkflowStrip glow steps={['Inspection Assigned', 'Field Officer Visits Location', 'QR Code Scanned', 'Evidence Captured', 'Compliance Assessment', 'Corrective Action', 'Closure Verification']} />
            </div>
          </div>

          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Planning Queue ({planningQueue.length.toLocaleString()})</h3>
                <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Pending, overdue, and escalated cases sorted by scheduled date</p>
              </div>
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[
                { label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Overdue', value: 'overdue' }, { label: 'Escalated', value: 'escalated' },
              ]} />
            </div>
            <div className="p-4">
              <DataTable columns={columns(false)} data={planningQueue} keyExtractor={(i) => i.id} onRowClick={(i) => setOpenInspectionId(i.id)} pageSize={18} />
            </div>
          </div>
        </>
      )}

      {tab === 'teams' && (
        <>
          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
                Field Inspection Units
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--app-text-faint)' }}><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success)' }} />Live</span>
              </h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Current inspector deployment and availability</p>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {inspectors.map((ins) => (
                <div key={ins.id} className="rounded-md p-3" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                  <div className="text-[11.5px] font-semibold" style={{ color: 'var(--app-text)' }}>{ins.name}</div>
                  <div className="mt-1 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>{ins.team}</div>
                  <div className="mt-2 space-y-1 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                    <div>Zone: <span style={{ color: 'var(--app-text)' }}>{ins.assignedZone}</span></div>
                    <div>Active cases: <span className="font-mono" style={{ color: 'var(--app-text)' }}>{activeByInspector[ins.id] || 0}</span></div>
                    <div className="flex items-center justify-between">
                      <span>Availability</span>
                      <GenericBadge tone={ins.availability === 'On Field' ? 'cyan' : ins.availability === 'Available' ? 'green' : 'slate'}>{ins.availability}</GenericBadge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <TeamWorkloadTable />
        </>
      )}

      {tab === 'history' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Inspection History ({history.length.toLocaleString()})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Completed inspection records with compliance outcome</p>
          </div>
          <div className="p-4">
            <DataTable columns={columns(true)} data={history} keyExtractor={(i) => i.id} onRowClick={(i) => setOpenInspectionId(i.id)} pageSize={18} />
          </div>
        </div>
      )}
      <InspectionDetailDrawer inspectionId={openInspectionId} onClose={() => setOpenInspectionId(null)} />

      <PageSummary page={`inspections-${tab}`} />
    </div>
  );
}
