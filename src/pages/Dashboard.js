import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { useData } from '../services/socket';
import { chartTooltip, chartScales, axisTitle, gridLine, themeColor, HBAR_INTERACTION } from '../components/chartUtils';
import KPICard, { IcoBox, IcoShield, IcoAlert, IcoClipboard, IcoTruck, IcoPhone, IcoClock, IcoBolt, IcoDollar } from '../components/KPICard';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import AttentionBanner from '../components/AttentionBanner';
import LifecycleSummary from '../components/LifecycleSummary';
import { useI18n } from '../services/i18n';
import DonationMap from '../components/map/DonationMap';
import BoxDetailDrawer from '../components/BoxDetailDrawer';
import KPIRecordsDrawer from '../components/KPIRecordsDrawer';
import { buildExecutiveKPIs, buildExecutiveExceptionKPIs, LOWER_IS_BETTER } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import { complianceTrend, displacementTrendSeries, ZONES, formatCurrency } from '../services/donationSeed';
import { BOX_STATUS_COLOR } from '../components/StatusBadge';
import { SEM } from '../services/palette';
import PageSummary from '../components/PageSummary';
import InsightsCallout from '../components/InsightsCallout';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

// Status color system reused across every chart on this page:
// teal = good/completed, blue = pending/neutral, red = overdue/critical, amber = escalated/warning.
const COLOR_TEAL = SEM.normal;
const COLOR_BLUE = SEM.info;
const COLOR_AMBER = SEM.warning;

/** Draws the running total at the end of each stacked horizontal bar. */
const totalLabelPlugin = {
  id: 'totalLabel',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart;
    if (!data.datasets.length) return;
    const lastDatasetIndex = data.datasets.length - 1;
    const meta = chart.getDatasetMeta(lastDatasetIndex);
    ctx.save();
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    meta.data.forEach((el, i) => {
      const total = data.datasets.reduce((s, ds) => s + (ds.data[i] || 0), 0);
      ctx.fillText(String(total), el.x + 6, el.y);
    });
    ctx.restore();
  },
};

export default function Dashboard() {
  const { boxes, inspections, violations, displacements, inventory, complaints, cashDiscrepancies, lastSync, organizations, openKpiDrawer } = useData();
  const navigate = useNavigate();

  const [zoneFilter, setZoneFilter] = useState('all');
  const [selectedBox, setSelectedBox] = useState(null);
  const [activeStripKpi, setActiveStripKpi] = useState(null);

  const filteredBoxes = useMemo(() => (zoneFilter === 'all' ? boxes : boxes.filter((b) => b.zoneId === zoneFilter)), [boxes, zoneFilter]);
  // Every other record carries the box as its canonical foreign key (not all
  // of them store their own zoneId), so scoping by zone means scoping by
  // membership in the zone-filtered box set, not a raw field-by-field match —
  // otherwise a zone selection would only ever narrow box-derived KPIs and
  // leave inspection/violation/displacement/inventory/complaint counts
  // showing the whole-Emirate total no matter which zone was picked.
  const zoneBoxIds = useMemo(() => (zoneFilter === 'all' ? null : new Set(filteredBoxes.map((b) => b.id))), [zoneFilter, filteredBoxes]);
  const scopeByZone = React.useCallback((records) => (zoneBoxIds ? records.filter((r) => zoneBoxIds.has(r.boxId)) : records), [zoneBoxIds]);
  const filteredInspections = useMemo(() => scopeByZone(inspections), [scopeByZone, inspections]);
  const filteredViolations = useMemo(() => scopeByZone(violations), [scopeByZone, violations]);
  const filteredDisplacements = useMemo(() => scopeByZone(displacements), [scopeByZone, displacements]);
  const filteredInventory = useMemo(() => scopeByZone(inventory), [scopeByZone, inventory]);
  const filteredComplaints = useMemo(() => scopeByZone(complaints), [scopeByZone, complaints]);

  const kpis = useMemo(() => buildExecutiveKPIs(filteredBoxes, filteredInspections, filteredViolations, filteredDisplacements, filteredInventory, filteredComplaints),
    [filteredBoxes, filteredInspections, filteredViolations, filteredDisplacements, filteredInventory, filteredComplaints]);

  const complianceRate = kpis[1].value;
  const complianceTarget = 95;
  const complianceGap = Math.round((complianceRate - complianceTarget) * 10) / 10;
  const complianceSeries = useMemo(() => complianceTrend(complianceRate), [complianceRate]);
  const displacementSeries = useMemo(() => displacementTrendSeries(), []);

  const complianceChartData = useMemo(() => ({
    labels: complianceSeries.map((p) => p.label),
    datasets: [
      {
        label: 'Compliance Rate', data: complianceSeries.map((p) => p.value),
        borderWidth: 2, pointRadius: 3, tension: 0.35,
        segment: {
          borderColor: (ctx) => (((ctx.p0.parsed.y + ctx.p1.parsed.y) / 2) < complianceTarget ? COLOR_AMBER : COLOR_TEAL),
        },
        pointBackgroundColor: (ctx) => (ctx.parsed?.y < complianceTarget ? COLOR_AMBER : COLOR_TEAL),
        fill: { target: 1, above: 'rgba(34,197,94,0.14)', below: 'rgba(245,158,11,0.10)' },
      },
      { label: 'Target', data: complianceSeries.map(() => complianceTarget), borderColor: SEM.analytic, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5, fill: false },
    ],
  }), [complianceSeries]);

  // ── Compact KPI summary strip ──────────────────────────────────────────
  // One unified row of real kpi() objects (description, target/baseline,
  // threshold) rendered through the same KPICard used everywhere else in
  // the app, rather than a bare number. Each card opens the matching
  // drill-down — the full trend drawer for executive-domain metrics, or the
  // record-level drawer for the operational-exception metrics that have one.
  const exceptionKpis = useMemo(() => buildExecutiveExceptionKPIs(filteredViolations, filteredInspections), [filteredViolations, filteredInspections]);
  const kpiById = useMemo(() => {
    const map = new Map();
    kpis.forEach((k) => map.set(k.id, k));
    exceptionKpis.forEach((k) => map.set(k.id, k));
    return map;
  }, [kpis, exceptionKpis]);

  const STRIP_ICON_BY_ID = {
    'total-registered': IcoBox, 'compliance-rate': IcoShield, 'strip-open-violations': IcoAlert,
    'open-complaints': IcoPhone, 'pending-displacement': IcoTruck, 'strip-inspections-due-today': IcoClock,
    'strip-escalated-cases': IcoBolt, 'strip-pending-reviews': IcoClipboard,
  };
  const STRIP_DOMAIN_BY_ID = { 'total-registered': 'executive', 'compliance-rate': 'executive', 'open-complaints': 'executive', 'pending-displacement': 'executive' };

  const kpiStrip = useMemo(() => (
    ['total-registered', 'compliance-rate', 'strip-open-violations', 'open-complaints', 'pending-displacement', 'strip-inspections-due-today', 'strip-escalated-cases', 'strip-pending-reviews']
      .map((id) => kpiById.get(id))
      .filter(Boolean)
  ), [kpiById]);

  // Cash Discrepancies isn't part of buildExecutiveKPIs' generic set — it
  // opens straight to the Reconciliation tab (real cases you can act on)
  // rather than a generic records drawer.
  const filteredCashDiscrepancies = useMemo(() => scopeByZone(cashDiscrepancies), [scopeByZone, cashDiscrepancies]);
  const cashDiscrepancyKpi = useMemo(() => {
    const open = filteredCashDiscrepancies.filter((c) => c.status !== 'closed');
    const totalVariance = open.reduce((s, c) => s + Math.abs(c.variance), 0);
    return {
      id: 'cash-discrepancies', name: 'Cash Discrepancies', value: open.length, target: 5, unit: 'Cases', format: 'number', trend: 0,
      status: open.length === 0 ? 'healthy' : open.length <= 5 ? 'on-track' : open.length <= 12 ? 'attention' : 'critical',
      sourceEntity: 'Safekeeping & Inventory', threshold: 'Green ≤ 5 · Amber 6–12 · Red > 12',
      context: `Open cash/mixed-collection reconciliation cases. Total variance in dispute: ${formatCurrency(totalVariance)}.`,
    };
  }, [filteredCashDiscrepancies]);

  const { t } = useI18n();
  const insights = useMemo(() => {
    const pick = (id, name) => {
      const k = kpiById.get(id);
      if (!k) return null;
      const trend = k.trend || 0;
      const lower = LOWER_IS_BETTER.has(id);
      const worse = trend === 0 ? null : lower ? trend > 0 : trend < 0;
      return {
        id, text: `${t(name)} ${trend === 0 ? t('held steady') : `${t(trend > 0 ? 'increased by' : 'decreased by')} ${Math.abs(trend).toFixed(1)}%`}.`,
        tone: worse === null ? 'slate' : worse ? 'red' : 'cyan',
        delta: Math.abs(trend),
        arrow: trend === 0 ? '—' : trend > 0 ? '▲' : '▼',
      };
    };
    return [
      pick('compliance-rate', 'Overall compliance'),
      pick('strip-open-violations', 'Open violations'),
      pick('pending-displacement', 'Pending displacement'),
      pick('strip-escalated-cases', 'Escalated cases'),
    ].filter(Boolean);
  }, [kpiById, t]);

  const statusBarData = useMemo(() => {
    const statuses = [
      ['compliant', 'Compliant'], ['non-compliant', 'Non-Compliant'],
      ['under-inspection', 'Under Inspection'], ['pending-displacement', 'Pending Displacement'],
    ];
    return {
      labels: statuses.map(([, l]) => l),
      datasets: [{
        label: 'Boxes', data: statuses.map(([k]) => filteredBoxes.filter((b) => b.status === k).length),
        backgroundColor: statuses.map(([k]) => BOX_STATUS_COLOR[k]), borderRadius: 4, maxBarThickness: 54,
      }],
    };
  }, [filteredBoxes]);

  const inspectionDonut = useMemo(() => {
    const cats = [['completed', 'Completed', SEM.normal], ['pending', 'Pending', SEM.info], ['overdue', 'Overdue', SEM.warning], ['escalated', 'Escalated', SEM.critical]];
    return {
      labels: cats.map(([, l]) => l),
      datasets: [{ data: cats.map(([k]) => filteredInspections.filter((i) => i.status === k).length), backgroundColor: cats.map(([, , c]) => c), borderWidth: 0 }],
    };
  }, [filteredInspections]);

  const displacementChartData = useMemo(() => ({
    labels: displacementSeries.map((d) => d.label),
    datasets: [
      { label: 'Assigned', data: displacementSeries.map((d) => d.assigned), backgroundColor: SEM.infoLight, stack: 's' },
      { label: 'In Transit', data: displacementSeries.map((d) => d.inTransit), backgroundColor: COLOR_BLUE, stack: 's' },
      { label: 'Completed', data: displacementSeries.map((d) => d.completed), backgroundColor: COLOR_TEAL, stack: 's', borderRadius: { topLeft: 4, topRight: 4 } },
    ],
  }), [displacementSeries]);

  const violationCategoryData = useMemo(() => {
    const byCategory = {};
    filteredViolations.forEach((v) => {
      if (!byCategory[v.category]) byCategory[v.category] = { open: 0, 'under-review': 0, resolved: 0 };
      byCategory[v.category][v.status] += 1;
    });
    const entries = Object.entries(byCategory)
      .map(([category, counts]) => ({ category, ...counts, total: counts.open + counts['under-review'] + counts.resolved }))
      .sort((a, b) => b.total - a.total);
    return {
      labels: entries.map((e) => e.category),
      datasets: [
        { label: 'Open', data: entries.map((e) => e.open), backgroundColor: SEM.warning, stack: 's', maxBarThickness: 18 },
        { label: 'Under Review', data: entries.map((e) => e['under-review']), backgroundColor: SEM.info, stack: 's', maxBarThickness: 18 },
        { label: 'Resolved', data: entries.map((e) => e.resolved), backgroundColor: SEM.normal, stack: 's', maxBarThickness: 18 },
      ],
      maxTotal: Math.max(1, ...entries.map((e) => e.total)),
    };
  }, [filteredViolations]);

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Executive Overview"
        subtitle="Real-time regulatory monitoring and operational intelligence for donation box management across Abu Dhabi."
        lastUpdated={lastSync}
      />

      <AttentionBanner />

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Zone" value={zoneFilter} onChange={setZoneFilter} options={[{ label: 'All Zones', value: 'all' }, ...ZONES.map((z) => ({ label: z.name, value: z.id }))]} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpiStrip.map((kpi) => {
          const Icon = STRIP_ICON_BY_ID[kpi.id];
          const onClick = kpi.id === 'strip-open-violations'
            ? () => navigate('/compliance?tab=violations')
            : STRIP_DOMAIN_BY_ID[kpi.id]
              ? () => openKpiDrawer(STRIP_DOMAIN_BY_ID[kpi.id], kpi.id)
              : () => setActiveStripKpi(kpi.id);
          return <KPICard key={kpi.id} icon={Icon ? <Icon /> : undefined} {...kpiToCardProps(kpi, { onClick })} />;
        })}
        <KPICard icon={<IcoDollar />} {...kpiToCardProps(cashDiscrepancyKpi, { onClick: () => navigate('/safekeeping?tab=reconciliation') })} />
      </div>

      <LifecycleSummary boxes={filteredBoxes} />

      <InsightsCallout
        title="Key Insights"
        items={insights}
        onSelect={(ins) => {
          if (ins.id === 'strip-open-violations') navigate('/compliance?tab=violations');
          else if (STRIP_DOMAIN_BY_ID[ins.id]) openKpiDrawer(STRIP_DOMAIN_BY_ID[ins.id], ins.id);
          else setActiveStripKpi(ins.id);
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden xl:col-span-2">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Abu Dhabi GIS Coverage</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Live donation box locations across monitored zones</p>
          </div>
          <DonationMap boxes={filteredBoxes} organizations={organizations} onSelectBox={setSelectedBox} height={380} zoom={9} />
        </div>

        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Operational Status Summary</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Snapshot of current enforcement posture</p>
          </div>
          <div className="p-3 space-y-2">
            <StatusRow icon={IcoShield} tone="#3d8560" label="Boxes in Full Compliance" value={filteredBoxes.filter((b) => b.status === 'compliant').length} />
            <StatusRow icon={IcoAlert} tone="#a63f3f" label="Open Violation Cases" value={filteredViolations.filter((v) => v.status !== 'resolved').length} />
            <StatusRow icon={IcoClipboard} tone="#3f6f9e" label="Inspections In Progress" value={filteredInspections.filter((i) => i.status === 'pending').length} />
            <StatusRow icon={IcoTruck} tone="#b8663a" label="Active Displacement Operations" value={filteredDisplacements.filter((d) => d.status !== 'completed').length} />
            <StatusRow icon={IcoAlert} tone="#b8893a" label="Critical Alerts Pending" value={filteredComplaints.filter((c) => c.severity === 'critical' && c.status !== 'resolved').length} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartPanel
          title="Compliance Trend"
          subtitle="Monthly compliance rate vs. regulatory target"
          badge={(
            <span className="font-semibold" style={{ fontSize: '11px', color: complianceGap < 0 ? COLOR_AMBER : COLOR_TEAL }}>
              {complianceGap >= 0 ? '+' : ''}{complianceGap}% vs. target
            </span>
          )}
        >
          <div style={{ height: 190 }}>
            <Line
              data={complianceChartData}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: chartTooltip({ callbacks: complianceTooltipCallbacks(complianceSeries) }) },
                scales: chartScales({
                  x: { title: axisTitle('Month'), ticks: { color: themeColor('--app-text'), font: { size: 10 } } },
                  y: { min: 70, max: 100, title: axisTitle('Compliance Rate (%)'), grid: gridLine(), ticks: { color: themeColor('--app-text'), font: { size: 9.5 } } },
                }),
              }}
            />
          </div>
        </ChartPanel>

        <ChartPanel title="Inspection Status Distribution" subtitle="Share of inspection caseload by current state">
          <div style={{ height: 190 }} className="flex items-center gap-4">
            <div style={{ width: '55%', height: 190 }}>
              <Doughnut data={inspectionDonut} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: chartTooltip() }, cutout: '62%' }} />
            </div>
            <div className="flex-1 space-y-2">
              {inspectionDonut.labels.map((label, i) => {
                const total = inspectionDonut.datasets[0].data.reduce((a, b) => a + b, 0) || 1;
                const val = inspectionDonut.datasets[0].data[i];
                return (
                  <div key={label} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-2" style={{ color: 'var(--app-text-muted)' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: inspectionDonut.datasets[0].backgroundColor[i] }} />
                      {label}
                    </span>
                    <span style={{ color: 'var(--app-text)' }}>{val} <span style={{ color: 'var(--app-text-faint)' }}>({Math.round((val / total) * 100)}%)</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartPanel title="Donation Box Status Breakdown" subtitle="Current registry distribution by compliance state">
          <div style={{ height: 190 }}>
            <Bar data={statusBarData} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: chartTooltip() },
              scales: chartScales({
                x: { title: axisTitle('Status Category'), ticks: { color: themeColor('--app-text'), font: { size: 10.5, weight: '600' } } },
                y: { title: axisTitle('Number of Boxes'), grid: gridLine(), ticks: { color: themeColor('--app-text'), font: { size: 9.5 } } },
              }),
            }} />
          </div>
        </ChartPanel>

        <ChartPanel title="Displacement Operations Trend" subtitle="Weekly logistics throughput by stage">
          <div style={{ height: 190 }}>
            <Bar data={displacementChartData} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', boxWidth: 8, usePointStyle: true, font: { size: 10 } } }, tooltip: chartTooltip() },
              scales: chartScales({
                x: { stacked: true, title: axisTitle('Day'), ticks: { color: themeColor('--app-text'), font: { size: 10.5, weight: '600' } } },
                y: { stacked: true, title: axisTitle('Number of Boxes'), grid: gridLine(), ticks: { color: themeColor('--app-text'), font: { size: 9.5, weight: '500' } } },
              }),
            }} />
          </div>
        </ChartPanel>
      </div>

      <ChartPanel title="Violations by Category" subtitle="Violation caseload by category, broken down by case status">
        <div style={{ height: 220 }}>
          <Bar
            data={violationCategoryData}
            plugins={[totalLabelPlugin]}
            options={{
              indexAxis: 'y', responsive: true, maintainAspectRatio: false,
              interaction: HBAR_INTERACTION,
              layout: { padding: { right: 28 } },
              plugins: {
                legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', boxWidth: 8, usePointStyle: true, font: { size: 10 } } },
                tooltip: chartTooltip({
                  callbacks: {
                    footer: (items) => {
                      const total = items.reduce((sum, i) => sum + i.parsed.x, 0);
                      const open = items.find((i) => i.dataset.label === 'Open')?.parsed.x || 0;
                      return `Total: ${total} cases · ${total ? Math.round((open / total) * 100) : 0}% still open`;
                    },
                  },
                }),
              },
              scales: {
                x: { stacked: true, max: violationCategoryData.maxTotal * 1.15, grid: gridLine(), ticks: { color: themeColor('--app-text'), font: { size: 10, weight: '500' } }, title: axisTitle('Number of Violations') },
                y: { stacked: true, grid: { display: false }, ticks: { color: themeColor('--app-text'), font: { size: 10.5, weight: '600' } } },
              },
            }}
          />
        </div>
      </ChartPanel>

      <BoxDetailDrawer box={selectedBox} onClose={() => setSelectedBox(null)} />
      <KPIRecordsDrawer kpiId={activeStripKpi} onClose={() => setActiveStripKpi(null)} />

      <PageSummary page="executive" />
    </div>
  );
}

function complianceTooltipCallbacks(series) {
  return {
    label: (ctx) => {
      if (ctx.dataset.label !== 'Compliance Rate') return '';
      const p = series[ctx.dataIndex];
      const delta = Math.round((p.value - p.previous) * 10) / 10;
      return [
        `Current: ${p.value}%`, `Target: ${p.target}%`, `Previous Month: ${p.previous}%`,
        `Compliance ${delta >= 0 ? 'improved' : 'declined'} by ${Math.abs(delta)} pt`,
      ];
    },
  };
}

function ChartPanel({ title, subtitle, badge, children }) {
  return (
    <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{title}</h3>
          <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusRow({ icon: Icon, tone, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
      <div className="flex items-center gap-2.5">
        <span style={{ color: tone, width: 16, height: 16, display: 'inline-flex' }}><Icon /></span>
        <span className="text-[12px]" style={{ color: 'var(--app-text-muted)' }}>{label}</span>
      </div>
      <span className="font-mono text-[13px] font-semibold" style={{ color: 'var(--app-text)' }}>{value.toLocaleString()}</span>
    </div>
  );
}
