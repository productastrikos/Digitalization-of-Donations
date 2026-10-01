import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltipPlugin } from 'chart.js';
import { useData } from '../services/socket';
import { chartTooltip, chartScales, axisTitle, gridLine, themeColor, HBAR_INTERACTION } from '../components/chartUtils';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DataTable from '../components/DataTable';
import { SeverityBadge, GenericBadge } from '../components/StatusBadge';
import KPICard, { IcoAlert, IcoShield, IcoClock, IcoWrench, IcoTrendUp, IcoCheck } from '../components/KPICard';
import { buildComplianceKPIs } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import { zoneById, ZONES, formatDate } from '../services/donationSeed';
import { SEM, SEVERITY_COLOR, bandColor } from '../services/palette';
import PageSummary from '../components/PageSummary';
import StageBoxesPanel from '../components/StageBoxesPanel';

ChartJS.register(ArcElement, ChartTooltipPlugin);

const GAUGE_TRACK_COLOR = 'rgba(148, 163, 184, 0.16)';

/** Draws a thin radial tick marking the target value on the gauge arc. */
const gaugeTargetTick = {
  id: 'gaugeTargetTick',
  afterDraw(chart) {
    const target = chart.options.plugins?.gaugeTarget?.target;
    if (target == null) return;
    const meta = chart.getDatasetMeta(0);
    const arc = meta.data[0];
    if (!arc) return;
    const { x, y, innerRadius, outerRadius } = arc.getProps(['x', 'y', 'innerRadius', 'outerRadius'], true);
    const rotationDeg = chart.options.rotation ?? -90;
    const circumferenceDeg = chart.options.circumference ?? 180;
    // Chart.js's rotation/circumference are measured with 0deg = top, clockwise —
    // convert to the canvas's own 0deg = east convention before using cos/sin.
    const angle = (rotationDeg - 90 + circumferenceDeg * (target / 100)) * (Math.PI / 180);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = '#e6ecf5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + (innerRadius - 5) * Math.cos(angle), y + (innerRadius - 5) * Math.sin(angle));
    ctx.lineTo(x + (outerRadius + 5) * Math.cos(angle), y + (outerRadius + 5) * Math.sin(angle));
    ctx.stroke();
    ctx.restore();
  },
};

function ComplianceGauge({ value, target = 95 }) {
  const color = bandColor(value, 90, 75);
  const ragLabel = value >= 90 ? 'NORMAL' : value >= 75 ? 'WARNING' : 'CRITICAL';
  const gap = Math.round((value - target) * 10) / 10;

  const data = {
    datasets: [{
      data: [value, Math.max(0, 100 - value)],
      backgroundColor: [color, GAUGE_TRACK_COLOR],
      borderWidth: 0,
      borderRadius: 6,
    }],
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    rotation: -90, circumference: 180, cutout: '78%',
    plugins: { legend: { display: false }, tooltip: { enabled: false }, gaugeTarget: { target } },
  };

  return (
    <div className="flex flex-col items-center">
      <div style={{ position: 'relative', width: '100%', maxWidth: 280, height: 160 }}>
        <Doughnut data={data} options={options} plugins={[gaugeTargetTick]} />
        <div style={{ position: 'absolute', inset: 0, top: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4 }}>
          <span className="font-bold" style={{ fontSize: '2rem', lineHeight: 1, color: 'var(--app-text)' }}>{value}%</span>
          <span className="font-semibold" style={{ fontSize: '10px', letterSpacing: '0.06em', color, marginTop: 4 }}>{ragLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
        <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#e6ecf5' }} /> Target {target}%</span>
        <span style={{ color: gap >= 0 ? SEM.normal : SEM.warning, fontWeight: 600 }}>{gap >= 0 ? '+' : ''}{gap}% vs. target</span>
      </div>
    </div>
  );
}

const KPI_ICON_BY_ID = {
  'open-violations': IcoAlert,
  'critical-violations': IcoShield,
  'avg-resolution-violations': IcoClock,
  'repeat-offenders': IcoWrench,
  'compliance-improvement': IcoTrendUp,
  'resolved-violations': IcoCheck,
};

// Each tab surfaces only the KPIs relevant to what it actually shows —
// Monitoring keeps the full compliance picture, while Violations and
// Corrective Actions narrow to the metrics tied to their own content.
const TAB_KPI_IDS = {
  monitoring: null,
  violations: ['open-violations', 'critical-violations', 'repeat-offenders'],
  actions: ['avg-resolution-violations', 'resolved-violations', 'open-violations'],
};

const TABS = [
  { key: 'monitoring', label: 'Compliance Monitoring' },
  { key: 'violations', label: 'Violations' },
  { key: 'actions', label: 'Corrective Actions' },
];

function daysSince(iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }

export default function Compliance() {
  const { boxes, violations, organizations, lastSync, openKpiDrawer } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'monitoring';

  const [severityFilter, setSeverityFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');

  const kpis = useMemo(() => buildComplianceKPIs(boxes, violations), [boxes, violations]);
  const visibleKpis = useMemo(() => {
    const ids = TAB_KPI_IDS[tab];
    return ids ? kpis.filter((k) => ids.includes(k.id)) : kpis;
  }, [kpis, tab]);
  const complianceRate = Math.round((boxes.filter((b) => b.status === 'compliant').length / boxes.length) * 1000) / 10;

  const filtered = useMemo(() => violations.filter((v) => {
    if (severityFilter !== 'all' && v.severity !== severityFilter) return false;
    if (zoneFilter !== 'all' && v.zoneId !== zoneFilter) return false;
    return true;
  }), [violations, severityFilter, zoneFilter]);

  const categoryData = useMemo(() => {
    const open = violations.filter((v) => v.status !== 'resolved');
    const counts = {};
    open.forEach((v) => { counts[v.category] = (counts[v.category] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { labels: entries.map(([k]) => k), datasets: [{ label: 'Violations', data: entries.map(([, v]) => v), backgroundColor: SEM.warning, borderRadius: 4, maxBarThickness: 18 }] };
  }, [violations]);

  const severityData = useMemo(() => {
    const sevs = ['critical', 'high', 'medium', 'low'].map((k) => [k, SEVERITY_COLOR[k]]);
    return { labels: sevs.map(([k]) => k.toUpperCase()), datasets: [{ data: sevs.map(([k]) => violations.filter((v) => v.severity === k).length), backgroundColor: sevs.map(([, c]) => c), borderRadius: 4, maxBarThickness: 40 }] };
  }, [violations]);

  const zoneData = useMemo(() => ZONES.map((z) => ({ zone: z.name, count: violations.filter((v) => v.zoneId === z.id).length })).sort((a, b) => b.count - a.count).slice(0, 8), [violations]);

  const orgName = (id) => organizations.find((o) => o.id === id)?.name || 'Unknown';

  const actionQueue = useMemo(() => {
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
    return violations.filter((v) => v.status !== 'resolved')
      .sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || (new Date(a.dateIdentified) - new Date(b.dateIdentified)));
  }, [violations]);

  const violationColumns = [
    { key: 'id', header: 'Violation ID', render: (v) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{v.id}</span>, sortValue: (v) => v.id },
    { key: 'box', header: 'Box ID', render: (v) => <span className="font-mono" style={{ color: 'var(--app-text-muted)' }}>{v.boxId}</span> },
    { key: 'org', header: 'Organization', render: (v) => <span style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{orgName(v.organizationId)}</span> },
    { key: 'zone', header: 'Zone', render: (v) => zoneById(v.zoneId)?.name || v.zoneId },
    { key: 'category', header: 'Category', render: (v) => v.category },
    { key: 'severity', header: 'Severity', render: (v) => <SeverityBadge severity={v.severity} />, sortValue: (v) => v.severity },
    { key: 'status', header: 'Status', render: (v) => <GenericBadge tone={v.status === 'resolved' ? 'green' : v.status === 'under-review' ? 'amber' : 'red'}>{v.status.replace('-', ' ')}</GenericBadge>, sortValue: (v) => v.status },
    { key: 'date', header: 'Date Identified', render: (v) => formatDate(v.dateIdentified), sortValue: (v) => v.dateIdentified },
  ];

  const actionColumns = [
    { key: 'id', header: 'Violation ID', render: (v) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{v.id}</span> },
    { key: 'box', header: 'Box ID', render: (v) => <span className="font-mono" style={{ color: 'var(--app-text-muted)' }}>{v.boxId}</span> },
    { key: 'org', header: 'Organization', render: (v) => <span style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{orgName(v.organizationId)}</span> },
    { key: 'category', header: 'Required Action', render: (v) => v.category },
    { key: 'severity', header: 'Severity', render: (v) => <SeverityBadge severity={v.severity} />, sortValue: (v) => v.severity },
    { key: 'age', header: 'Days Open', render: (v) => <span className="font-mono" style={{ color: daysSince(v.dateIdentified) > 14 ? 'var(--app-danger)' : 'var(--app-text-muted)' }}>{daysSince(v.dateIdentified)}</span>, sortValue: (v) => daysSince(v.dateIdentified) },
    { key: 'status', header: 'Status', render: (v) => <GenericBadge tone={v.status === 'under-review' ? 'amber' : 'red'}>{v.status.replace('-', ' ')}</GenericBadge> },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Compliance & Enforcement"
        subtitle="Enforcement command center tracking violation categories, severity, and regulatory resolution performance."
        lastUpdated={lastSync}
      />

      <Tabs tabs={TABS} active={tab} onChange={(k) => setParams({ tab: k })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleKpis.map((kpi) => {
          const Icon = KPI_ICON_BY_ID[kpi.id];
          return <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('compliance', kpi.id) })} />;
        })}
      </div>

      {tab === 'monitoring' && (
        <>
        <StageBoxesPanel stage="violation" title="Boxes In Violation" subtitle="Canonical lifecycle default for Enforcement — every non-compliant box awaiting removal." />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <ChartPanel title="Resolution Trend" subtitle="Current compliance rate against the regulatory target">
            <div className="flex items-center justify-center" style={{ height: 200 }}>
              <ComplianceGauge value={complianceRate} target={95} />
            </div>
          </ChartPanel>

          <ChartPanel title="Severity Distribution" subtitle="Share of all recorded violations by severity level">
            <div style={{ height: 200 }}>
              <Bar data={severityData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: chartTooltip() },
                scales: chartScales({
                  x: { title: axisTitle('Severity'), ticks: { color: themeColor('--app-text'), font: { size: 10.5, weight: '600' } } },
                  y: { title: axisTitle('Number of Violations'), grid: gridLine(), ticks: { color: themeColor('--app-text'), font: { size: 9.5 } } },
                }),
              }} />
            </div>
          </ChartPanel>

          <ChartPanel title="Violations by Geographic Zone" subtitle="Top zones by recorded violation volume" className="xl:col-span-2">
            <div className="space-y-2">
              {zoneData.map((z) => (
                <div key={z.zone} className="flex items-center gap-3 text-[11.5px]">
                  <span style={{ width: 180, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--app-text-muted)' }}>{z.zone}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--app-surface-raised)' }}>
                    <div className="h-full" style={{ width: `${(z.count / (zoneData[0]?.count || 1)) * 100}%`, background: '#a63f3f' }} />
                  </div>
                  <span className="font-mono w-8 text-right" style={{ color: 'var(--app-text-faint)' }}>{z.count}</span>
                </div>
              ))}
            </div>
          </ChartPanel>
        </div>
        </>
      )}

      {tab === 'violations' && (
        <>
          <ChartPanel title="Violations by Category" subtitle="Open violation caseload across all defined categories">
            <div style={{ height: 200 }}>
              <Bar data={categoryData} options={{
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                interaction: HBAR_INTERACTION,
                plugins: { legend: { display: false }, tooltip: chartTooltip() },
                scales: {
                  x: { grid: gridLine(), ticks: { color: themeColor('--app-text'), font: { size: 10 } }, title: axisTitle('Number of Violations') },
                  y: { grid: { display: false }, ticks: { color: themeColor('--app-text'), font: { size: 10, weight: '500' } } },
                },
              }} />
            </div>
          </ChartPanel>

          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Violation Cases ({filtered.length.toLocaleString()})</h3>
                <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Complete violation register with severity and resolution status</p>
              </div>
              <div className="flex items-center gap-2">
                <FilterSelect label="Severity" value={severityFilter} onChange={setSeverityFilter} options={[
                  { label: 'All', value: 'all' }, { label: 'Critical', value: 'critical' }, { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' },
                ]} />
                <FilterSelect label="Zone" value={zoneFilter} onChange={setZoneFilter} options={[{ label: 'All Zones', value: 'all' }, ...ZONES.map((z) => ({ label: z.name, value: z.id }))]} />
              </div>
            </div>
            <div className="p-4">
              <DataTable columns={violationColumns} data={filtered} keyExtractor={(v) => v.id} pageSize={18} />
            </div>
          </div>
        </>
      )}

      {tab === 'actions' && (
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Corrective Actions Worklist ({actionQueue.length.toLocaleString()})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Unresolved violations requiring corrective action, prioritized by severity then age</p>
          </div>
          <div className="p-4">
            <DataTable columns={actionColumns} data={actionQueue} keyExtractor={(v) => v.id} pageSize={18} />
          </div>
        </div>
      )}

      <PageSummary page={`compliance-${tab}`} />
    </div>
  );
}

function ChartPanel({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-app-panel border border-app-border rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-app-border">
        <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{title}</h3>
        <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
