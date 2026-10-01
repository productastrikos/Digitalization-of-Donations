import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { useData } from '../services/socket';
import { chartTooltip, chartScales } from '../components/chartUtils';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DataTable from '../components/DataTable';
import { GenericBadge } from '../components/StatusBadge';
import { WorkflowStrip } from '../components/WorkflowSteps';
import KPICard, { IcoTruck, IcoSignal, IcoCheck, IcoClock, IcoFuel, IcoWrench } from '../components/KPICard';
import { buildDisplacementKPIs } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import { displacementTrendSeries, formatDate } from '../services/donationSeed';
import { SEM } from '../services/palette';
import PageSummary from '../components/PageSummary';
import StageBoxesPanel from '../components/StageBoxesPanel';

const KPI_ICON_BY_ID = {
  'pending-displacement-ops': IcoTruck, 'in-transit': IcoSignal, 'completed-removals': IcoCheck,
  'avg-removal-time': IcoClock, 'logistics-capacity': IcoFuel, 'active-vehicles': IcoWrench,
};

// Each tab surfaces only the KPIs relevant to its own content, instead of
// repeating the same full 6-card grid regardless of which tab is active.
const TAB_KPI_IDS = {
  removal: ['pending-displacement-ops', 'completed-removals', 'avg-removal-time'],
  transport: ['in-transit', 'avg-removal-time', 'logistics-capacity'],
  assignments: ['logistics-capacity', 'active-vehicles', 'pending-displacement-ops'],
};

const TABS = [
  { key: 'removal', label: 'Removal Operations' },
  { key: 'transport', label: 'Transport Tracking' },
  { key: 'assignments', label: 'Logistics Assignments' },
];

const STAGE_PCT = { pending: 10, assigned: 35, 'in-transit': 70, completed: 100 };

export default function Displacement() {
  const { displacements, lastSync, openKpiDrawer } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'removal';
  const [status, setStatus] = React.useState('all');

  const kpis = useMemo(() => buildDisplacementKPIs(displacements), [displacements]);
  const visibleKpis = useMemo(() => {
    const ids = TAB_KPI_IDS[tab];
    return ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  }, [kpis, tab]);
  const trendSeries = useMemo(() => displacementTrendSeries(), []);

  const filtered = useMemo(() => (status === 'all' ? displacements : displacements.filter((d) => d.status === status)), [displacements, status]);
  const active = useMemo(() => displacements.filter((d) => d.status === 'in-transit' || d.status === 'assigned').sort((a, b) => STAGE_PCT[b.status] - STAGE_PCT[a.status]), [displacements]);

  const teamSummary = useMemo(() => {
    const map = {};
    displacements.forEach((d) => {
      if (!map[d.assignedTeam]) map[d.assignedTeam] = { team: d.assignedTeam, active: 0, completed: 0 };
      if (d.status === 'completed') map[d.assignedTeam].completed += 1; else map[d.assignedTeam].active += 1;
    });
    return Object.values(map).sort((a, b) => b.active - a.active);
  }, [displacements]);

  const vehicleSummary = useMemo(() => {
    const map = {};
    displacements.filter((d) => d.status !== 'completed').forEach((d) => {
      map[d.vehicle] = (map[d.vehicle] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [displacements]);

  const columns = [
    { key: 'id', header: 'Displacement ID', render: (d) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{d.id}</span>, sortValue: (d) => d.id },
    { key: 'box', header: 'Box ID', render: (d) => <span className="font-mono" style={{ color: 'var(--app-text-muted)' }}>{d.boxId}</span> },
    { key: 'pickup', header: 'Pickup Location', render: (d) => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.pickupLocation}</span> },
    { key: 'destination', header: 'Destination Facility', render: (d) => d.destinationFacility },
    { key: 'team', header: 'Assigned Team', render: (d) => d.assignedTeam },
    { key: 'vehicle', header: 'Vehicle', render: (d) => d.vehicle },
    { key: 'status', header: 'Status', render: (d) => <GenericBadge tone={d.status === 'completed' ? 'green' : d.status === 'in-transit' || d.status === 'assigned' ? 'cyan' : 'amber'}>{d.status.replace('-', ' ')}</GenericBadge>, sortValue: (d) => d.status },
    { key: 'scheduled', header: 'Scheduled Date', render: (d) => formatDate(d.scheduledDate), sortValue: (d) => d.scheduledDate },
    { key: 'priority', header: 'Priority', render: (d) => <span className="capitalize">{d.priority}</span> },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Displacement & Logistics"
        subtitle="End-to-end operational tracking of donation box removal, transport, and facility intake."
        lastUpdated={lastSync}
      />

      <Tabs tabs={TABS} active={tab} onChange={(k) => setParams({ tab: k })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleKpis.map((kpi) => {
          const Icon = KPI_ICON_BY_ID[kpi.id];
          return <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('displacement', kpi.id) })} />;
        })}
      </div>

      {tab === 'removal' && (
        <>
          <StageBoxesPanel stage="displaced" title="Displaced Boxes" subtitle="Canonical lifecycle default for Logistics — every box currently removed and in transit to a facility." />
          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Displacement Workflow</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Standard operational lifecycle for removal and transport</p>
            </div>
            <div className="p-4">
              <WorkflowStrip steps={['Violation Confirmed', 'Removal Approved', 'Displacement Assigned', 'Transport Allocated', 'Box Collected', 'Transport to Facility', 'Inventory Registered']} />
            </div>
          </div>

          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Displacement Operations Trend</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Weekly logistics throughput by operational stage</p>
            </div>
            <div className="p-4" style={{ height: 200 }}>
              <Bar data={{
                labels: trendSeries.map((d) => d.label),
                datasets: [
                  { label: 'Assigned', data: trendSeries.map((d) => d.assigned), backgroundColor: SEM.infoLight, stack: 's' },
                  { label: 'In Transit', data: trendSeries.map((d) => d.inTransit), backgroundColor: SEM.info, stack: 's' },
                  { label: 'Completed', data: trendSeries.map((d) => d.completed), backgroundColor: SEM.normal, stack: 's' },
                ],
              }} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', boxWidth: 8, usePointStyle: true, font: { size: 10 } } }, tooltip: chartTooltip() },
                scales: chartScales({
                  x: { stacked: true, title: { display: true, text: 'Date', color: '#94a3b8', font: { size: 10 } } },
                  y: { stacked: true, title: { display: true, text: 'Number of Boxes', color: '#94a3b8', font: { size: 10 } } },
                }),
              }} />
            </div>
          </div>

          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Displacement Records ({filtered.length.toLocaleString()})</h3>
                <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Active and historical removal operations</p>
              </div>
              <FilterSelect label="Status" value={status} onChange={setStatus} options={[
                { label: 'All', value: 'all' }, { label: 'Pending', value: 'pending' }, { label: 'Assigned', value: 'assigned' }, { label: 'In Transit', value: 'in-transit' }, { label: 'Completed', value: 'completed' },
              ]} />
            </div>
            <div className="p-4">
              <DataTable columns={columns} data={filtered} keyExtractor={(d) => d.id} pageSize={18} />
            </div>
          </div>
        </>
      )}

      {tab === 'transport' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Transport Tracking ({active.length.toLocaleString()})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Shipments currently assigned or in transit, with progress toward facility intake</p>
          </div>
          <div className="p-4 space-y-2">
            {active.length === 0 && <p className="text-[11px] text-center py-8" style={{ color: 'var(--app-text-faint)' }}>No active transport operations.</p>}
            {active.map((d) => (
              <div key={d.id} className="rounded-md p-3" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>{d.id}</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--app-text-faint)' }}>{d.boxId}</span>
                  </div>
                  <GenericBadge tone={d.status === 'in-transit' ? 'cyan' : 'amber'}>{d.status.replace('-', ' ')}</GenericBadge>
                </div>
                <div className="text-[11px] mb-2" style={{ color: 'var(--app-text-muted)' }}>
                  {d.pickupLocation} → {d.destinationFacility} · {d.assignedTeam} · {d.vehicle}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--app-surface-raised)' }}>
                  <div className="h-full" style={{ width: `${STAGE_PCT[d.status]}%`, background: d.status === 'in-transit' ? SEM.info : SEM.infoLight }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Logistics Team Workload</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Active assignments vs. completed jobs per team</p>
            </div>
            <div className="p-4 space-y-2">
              {teamSummary.map(({ team, active: a, completed }) => {
                const total = a + completed || 1;
                return (
                  <div key={team} className="flex items-center gap-3 text-[11.5px]">
                    <span style={{ width: 160, flexShrink: 0, color: 'var(--app-text-muted)' }}>{team}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--app-surface-raised)' }}>
                      <div style={{ width: `${(a / total) * 100}%`, background: SEM.info }} />
                      <div style={{ width: `${(completed / total) * 100}%`, background: SEM.normal }} />
                    </div>
                    <span className="font-mono w-24 text-right" style={{ color: 'var(--app-text-faint)' }}>{a} active · {completed} done</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Vehicle Assignments</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Current active job count per transport vehicle</p>
            </div>
            <div className="p-4 space-y-1.5">
              {vehicleSummary.map(([vehicle, count]) => (
                <div key={vehicle} className="flex items-center justify-between rounded-md px-3 py-2 text-[11.5px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                  <span style={{ color: 'var(--app-text-muted)' }}>{vehicle}</span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--app-text)' }}>{count} job{count === 1 ? '' : 's'}</span>
                </div>
              ))}
              {vehicleSummary.length === 0 && <p className="text-[11px] text-center py-6" style={{ color: 'var(--app-text-faint)' }}>No vehicles currently assigned.</p>}
            </div>
          </div>
        </div>
      )}

      <PageSummary page={`displacement-${tab}`} />
    </div>
  );
}
