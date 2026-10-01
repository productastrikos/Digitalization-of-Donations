import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../services/socket';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DataTable from '../components/DataTable';
import Drawer, { DetailRow } from '../components/Drawer';
import { VerticalTimeline } from '../components/WorkflowSteps';
import { GenericBadge } from '../components/StatusBadge';
import KPICard, { IcoBox, IcoDollar, IcoHourglass, IcoSignal, IcoClock } from '../components/KPICard';
import { buildSafekeepingKPIs } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import DisposalWorkflow, { REQUEST_TONE } from '../components/DisposalWorkflow';
import { ValueLedgerSection, CashDiscrepancyWorkflow, DISCREPANCY_STATUS_TONE, CASE_STATUS_TONE } from '../components/CashDiscrepancy';
import { formatCurrency, formatDate, formatDateTime } from '../services/donationSeed';
import PageSummary from '../components/PageSummary';
import StageBoxesPanel from '../components/StageBoxesPanel';

const KPI_ICON_BY_ID = {
  'total-safekeeping': IcoBox, 'total-inventory-value': IcoDollar, 'awaiting-instruction': IcoHourglass,
  'storage-utilization': IcoSignal, 'avg-custody-duration': IcoClock,
};

// Each tab surfaces only the KPIs relevant to its own content, instead of
// repeating the same full 5-card grid regardless of which tab is active.
const TAB_KPI_IDS = {
  custody: ['awaiting-instruction', 'avg-custody-duration', 'total-safekeeping'],
  facilities: ['storage-utilization', 'total-inventory-value', 'total-safekeeping'],
  inventory: ['total-safekeeping', 'total-inventory-value', 'avg-custody-duration'],
  disposal: ['awaiting-instruction', 'total-safekeeping'],
};

const TABS = [
  { key: 'custody', label: 'Custody Management' },
  { key: 'facilities', label: 'Storage Facilities' },
  { key: 'inventory', label: 'Inventory Tracking' },
  { key: 'disposal', label: 'Disposal & Release' },
  { key: 'reconciliation', label: 'Cash Reconciliation' },
];
const CUSTODY_STAGES = ['Collected', 'Received at Facility', 'Inspected', 'Stored', 'Management Instruction Pending'];

export default function Safekeeping() {
  const { inventory, disposalRequests, cashDiscrepancies, lastSync, openKpiDrawer } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'custody';
  const [custodyFilter, setCustodyFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const current = selected ? inventory.find((i) => i.id === selected.id) || selected : null;
  const requestCounts = useMemo(() => ['pending', 'approved', 'rejected', 'executed'].map((k) => [k, disposalRequests.filter((r) => r.status === k).length]), [disposalRequests]);
  const discrepancyCounts = useMemo(() => ['flagged', 'verified', 'investigation', 'resolved', 'closed'].map((k) => [k, cashDiscrepancies.filter((c) => c.status === k).length]), [cashDiscrepancies]);
  const openDiscrepancies = useMemo(() => cashDiscrepancies.filter((c) => c.status !== 'closed'), [cashDiscrepancies]);
  const totalVarianceValue = useMemo(() => openDiscrepancies.reduce((s, c) => s + Math.abs(c.variance), 0), [openDiscrepancies]);

  const kpis = useMemo(() => buildSafekeepingKPIs(inventory), [inventory]);
  const visibleKpis = useMemo(() => {
    const ids = TAB_KPI_IDS[tab];
    return ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  }, [kpis, tab]);
  const awaitingInstruction = useMemo(() => inventory.filter((i) => i.custodyStatus === 'awaiting-instruction').sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived)), [inventory]);
  const filtered = useMemo(() => (custodyFilter === 'all' ? inventory : inventory.filter((i) => i.custodyStatus === custodyFilter)), [inventory, custodyFilter]);

  const facilitySummary = useMemo(() => {
    const map = {};
    inventory.forEach((i) => {
      if (!map[i.facility]) map[i.facility] = { facility: i.facility, count: 0, value: 0, good: 0, fair: 0, damaged: 0 };
      map[i.facility].count += 1;
      map[i.facility].value += i.value;
      if (i.condition === 'Good') map[i.facility].good += 1;
      else if (i.condition === 'Fair') map[i.facility].fair += 1;
      else map[i.facility].damaged += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [inventory]);

  const columns = [
    { key: 'id', header: 'Asset ID', render: (i) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{i.id}</span>, sortValue: (i) => i.id },
    { key: 'box', header: 'Box ID', render: (i) => <span className="font-mono" style={{ color: 'var(--app-text-muted)' }}>{i.boxId}</span> },
    { key: 'facility', header: 'Storage Facility', render: (i) => i.facility },
    { key: 'received', header: 'Date Received', render: (i) => formatDate(i.dateReceived), sortValue: (i) => i.dateReceived },
    { key: 'condition', header: 'Condition', render: (i) => <GenericBadge tone={i.condition === 'Good' ? 'green' : i.condition === 'Fair' ? 'amber' : 'red'}>{i.condition}</GenericBadge> },
    { key: 'classification', header: 'Classification', render: (i) => i.classification },
    { key: 'contentCategory', header: 'Content Category', render: (i) => i.contentCategory ? <GenericBadge tone="slate">{i.contentCategory}</GenericBadge> : '—', sortValue: (i) => i.contentCategory || '' },
    { key: 'custody', header: 'Custody Status', render: (i) => <span className="capitalize" style={{ color: 'var(--app-text-muted)' }}>{i.custodyStatus.replace('-', ' ')}</span>, sortValue: (i) => i.custodyStatus },
    { key: 'value', header: 'Inventory Value', render: (i) => <span className="font-mono">{formatCurrency(i.value)}</span>, sortValue: (i) => i.value },
    { key: 'discrepancy', header: 'Reconciliation', render: (i) => i.discrepancyStatus ? <GenericBadge tone={DISCREPANCY_STATUS_TONE[i.discrepancyStatus]}>{i.discrepancyStatus.replace('-', ' ')}</GenericBadge> : '—', sortValue: (i) => i.discrepancyStatus || '' },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Safekeeping & Inventory"
        subtitle="Custody management for displaced donation boxes held at DCD safekeeping facilities."
        lastUpdated={lastSync}
      />

      <Tabs tabs={TABS} active={tab} onChange={(k) => setParams({ tab: k })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleKpis.map((kpi) => {
          const Icon = KPI_ICON_BY_ID[kpi.id];
          return <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('safekeeping', kpi.id) })} />;
        })}
      </div>

      {tab === 'custody' && (
        <>
        <StageBoxesPanel stage="in-storage" title="Boxes In Storage" subtitle="Canonical lifecycle default for Safekeeping — every box currently held in a DCD custody facility." />
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Items Awaiting Management Instruction ({awaitingInstruction.length.toLocaleString()})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Custody decisions pending — click a record to review the full chain of custody</p>
          </div>
          <div className="p-4">
            <DataTable columns={columns} data={awaitingInstruction} keyExtractor={(i) => i.id} onRowClick={setSelected} pageSize={18} emptyLabel="No items currently awaiting a management instruction." />
          </div>
        </div>
        </>
      )}

      {tab === 'facilities' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Storage Facility Rollup</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Custody load and asset condition distribution per facility</p>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {facilitySummary.map((f) => (
              <div key={f.facility} className="rounded-md p-3" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--app-text)' }}>{f.facility}</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-3" style={{ color: 'var(--app-text-muted)' }}>
                  <div>Items: <span style={{ color: 'var(--app-text)', fontWeight: 600 }}>{f.count}</span></div>
                  <div>Value: <span style={{ color: 'var(--app-text)', fontWeight: 600 }}>{formatCurrency(f.value)}</span></div>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--app-surface-raised)' }}>
                  <div style={{ width: `${(f.good / f.count) * 100}%`, background: '#3d8560' }} title="Good" />
                  <div style={{ width: `${(f.fair / f.count) * 100}%`, background: '#b8893a' }} title="Fair" />
                  <div style={{ width: `${(f.damaged / f.count) * 100}%`, background: '#a63f3f' }} title="Damaged" />
                </div>
                <div className="flex justify-between text-[10px] mt-1.5" style={{ color: 'var(--app-text-faint)' }}>
                  <span>{f.good} good</span><span>{f.fair} fair</span><span>{f.damaged} damaged</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Inventory Records ({filtered.length.toLocaleString()})</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Click a record to review the full chain of custody</p>
            </div>
            <FilterSelect label="Custody Status" value={custodyFilter} onChange={setCustodyFilter} options={[
              { label: 'All', value: 'all' }, { label: 'Stored', value: 'stored' }, { label: 'Awaiting Instruction', value: 'awaiting-instruction' }, { label: 'Released', value: 'released' }, { label: 'Disposed', value: 'disposed' },
            ]} />
          </div>
          <div className="p-4">
            <DataTable columns={columns} data={filtered} keyExtractor={(i) => i.id} onRowClick={setSelected} pageSize={18} />
          </div>
        </div>
      )}

      {tab === 'disposal' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Disposal, demolition and release requests ({disposalRequests.length})</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Nothing is disposed of or released without an approved instruction. Open an item on the Custody tab to raise a request; click a row here to act on it. Requests already on file are simulated demonstration data.</p>
            </div>
            <div className="flex gap-1.5">
              {requestCounts.map(([k, n]) => <GenericBadge key={k} tone={REQUEST_TONE[k]}>{k} {n}</GenericBadge>)}
            </div>
          </div>
          <div className="p-4">
            <DataTable
              columns={[
                { key: 'id', header: 'Request', render: (r) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{r.id}</span>, sortValue: (r) => r.id },
                { key: 'box', header: 'Box', render: (r) => <span className="font-mono">{r.boxId}</span> },
                { key: 'type', header: 'Type', render: (r) => r.type },
                { key: 'criteria', header: 'Criteria', render: (r) => <span style={{ color: 'var(--app-text-faint)' }}>{r.criteria.join('; ')}</span> },
                { key: 'by', header: 'Requested By', render: (r) => `${r.requestedBy} · ${formatDateTime(r.requestedAt)}`, sortValue: (r) => r.requestedAt },
                { key: 'status', header: 'Status', render: (r) => <GenericBadge tone={REQUEST_TONE[r.status]}>{r.status}</GenericBadge>, sortValue: (r) => r.status },
                { key: 'approver', header: 'Approver', render: (r) => (r.approver ? `${r.approver}` : '—') },
                { key: 'executed', header: 'Executed', render: (r) => (r.executedAt ? formatDateTime(r.executedAt) : '—') },
              ]}
              data={disposalRequests} keyExtractor={(r) => r.id} pageSize={14}
              onRowClick={(r) => { const it = inventory.find((i) => i.id === r.inventoryId); if (it) setSelected(it); }}
              emptyLabel="No disposal requests yet."
            />
          </div>
        </div>
      )}

      {tab === 'reconciliation' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Cash Discrepancy Cases ({cashDiscrepancies.length})</h3>
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
                Auto-created whenever a Cash or Mixed Collection handoff's counted amount misses the previous count. {openDiscrepancies.length} open · total variance in dispute {formatCurrency(totalVarianceValue)}.
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {discrepancyCounts.map(([k, n]) => <GenericBadge key={k} tone={CASE_STATUS_TONE[k]}>{k} {n}</GenericBadge>)}
            </div>
          </div>
          <div className="p-4">
            <DataTable
              columns={[
                { key: 'id', header: 'Case', render: (c) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{c.id}</span>, sortValue: (c) => c.id },
                { key: 'box', header: 'Box', render: (c) => <span className="font-mono">{c.boxId}</span> },
                { key: 'item', header: 'Item', render: (c) => <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{c.inventoryId}</span> },
                { key: 'stage', header: 'Handoff Stage', render: (c) => c.ledgerStage },
                { key: 'expected', header: 'Expected', render: (c) => <span className="font-mono">{formatCurrency(c.expectedAmount)}</span>, sortValue: (c) => c.expectedAmount },
                { key: 'actual', header: 'Actual', render: (c) => <span className="font-mono">{formatCurrency(c.actualAmount)}</span>, sortValue: (c) => c.actualAmount },
                { key: 'variance', header: 'Variance', render: (c) => <span className="font-mono" style={{ color: 'var(--app-danger)' }}>{c.variance > 0 ? '+' : ''}{formatCurrency(c.variance)} ({c.variancePct > 0 ? '+' : ''}{c.variancePct}%)</span>, sortValue: (c) => Math.abs(c.variance) },
                { key: 'status', header: 'Status', render: (c) => <GenericBadge tone={CASE_STATUS_TONE[c.status]}>{c.status}</GenericBadge>, sortValue: (c) => c.status },
                { key: 'officer', header: 'Assigned Officer', render: (c) => c.assignedOfficer },
                { key: 'escalation', header: 'Escalation', render: (c) => c.requiresAdminSignoff ? <GenericBadge tone="red">Admin sign-off</GenericBadge> : '—' },
                { key: 'created', header: 'Flagged', render: (c) => formatDateTime(c.createdAt), sortValue: (c) => c.createdAt },
              ]}
              data={cashDiscrepancies} keyExtractor={(c) => c.id} pageSize={16}
              onRowClick={(c) => { const it = inventory.find((i) => i.id === c.inventoryId); if (it) setSelected(it); }}
              emptyLabel="No cash discrepancy cases on file."
            />
          </div>
        </div>
      )}

      <Drawer open={!!current} onClose={() => setSelected(null)} title={current?.id || ''} subtitle={current ? `Donation Box ${current.boxId}` : ''}>
        {current && (
          <>
            <div className="mb-4">
              <DetailRow label="Facility" value={current.facility} />
              <DetailRow label="Date Received" value={formatDate(current.dateReceived)} />
              <DetailRow label="Condition" value={current.condition} />
              <DetailRow label="Classification" value={current.classification} />
              <DetailRow label="Content Category" value={current.contentCategory || '—'} />
              {current.quantity != null && <DetailRow label="Quantity" value={current.quantity} />}
              <DetailRow label="Inventory Value" value={formatCurrency(current.value)} />
              <DetailRow label="Custody Status" value={<span className="capitalize">{current.custodyStatus.replace('-', ' ')}</span>} />
              {current.releaseInstruction && <DetailRow label="Release Instruction" value={current.releaseInstruction} />}
            </div>
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Chain of Custody</h4>
            <VerticalTimeline steps={CUSTODY_STAGES.map((stage) => {
              const event = current.chainOfCustody.find((c) => c.stage === stage);
              return { label: stage, done: !!event, date: event ? `${event.actor} · ${formatDateTime(event.timestamp)}` : null };
            })} />
            <ValueLedgerSection item={current} />
            <CashDiscrepancyWorkflow item={current} />
            <DisposalWorkflow item={current} />
          </>
        )}
      </Drawer>

      <PageSummary page={`safekeeping-${tab}`} />
    </div>
  );
}
