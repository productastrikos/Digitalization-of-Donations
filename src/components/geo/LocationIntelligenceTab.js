import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, Bubble } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, BubbleController, Tooltip, Legend, Filler,
} from 'chart.js';
import { useData } from '../../services/socket';
import { chartTooltip, chartScales, axisTitle, areaGradient } from '../chartUtils';
import KPICard, { IcoAlert, IcoPhone, IcoClock, IcoBarChart } from '../KPICard';
import DataTable from '../DataTable';
import Drawer, { DetailRow, DrawerSection } from '../Drawer';
import { GenericBadge } from '../StatusBadge';
import RiskMap, { RiskMapLegend } from '../map/RiskMap';
import { buildLocationIntelligenceKPIs } from '../../services/donationKpis';
import { kpiToCardProps } from '../../services/kpiAdapter';
import { buildZoneIntelligence, rankZonesByRisk, buildPriorityActions, buildRiskTrendSeries } from '../../services/locationIntelligence';
import { formatDate } from '../../services/donationSeed';
import { SEM, RISK_CATEGORY_COLOR } from '../../services/palette';
import InsightsCallout from '../InsightsCallout';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BubbleController, Tooltip, Legend, Filler);

const MAP_FILTERS = [
  { key: 'all', label: 'All Zones' },
  { key: 'high-risk', label: 'High Risk' },
  { key: 'non-compliance', label: 'Non-Compliant Concentration' },
  { key: 'complaints', label: 'Complaint Density' },
  { key: 'backlog', label: 'Inspection Backlog' },
  { key: 'priority', label: 'Priority Action Areas' },
];

// The 4 headline metrics shown on the dashboard, in display order — every
// other computed KPI (high-risk zones, priority action areas, etc.) still
// exists and drives the map/table/insights below, it's just not a top card.
const TOP_KPI_IDS = ['li-open-violations', 'li-open-complaints', 'li-overdue-inspections', 'li-avg-risk'];
const TOP_KPI_META = {
  'li-open-violations': { label: 'Open Violations', icon: IcoAlert },
  'li-open-complaints': { label: 'Complaints', icon: IcoPhone },
  'li-overdue-inspections': { label: 'Inspections Due', icon: IcoClock },
  'li-avg-risk': { label: 'Composite Risk', icon: IcoBarChart },
};

function formatIntelTimestamp(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' });
  return `${date}, ${time} GST`;
}

// The three inputs to the composite score. `issue` matches the zone-level
// primaryIssue strings, so a driver row can filter the Priority Actions table.
const DRIVERS = [
  { key: 'nonCompliance', label: 'Non-compliance', issue: 'Non-compliance concentration', color: SEM.critical, unit: 'boxes' },
  { key: 'complaints', label: 'Complaints', issue: 'Complaint density', color: SEM.warning, unit: 'open' },
  { key: 'backlog', label: 'Inspection backlog', issue: 'Inspection backlog', color: SEM.info, unit: 'overdue' },
];

// Round shares so they always add up to exactly 100.
function roundShares(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - floors[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { floors[i] += 1; left -= 1; } });
  return floors;
}

const RISK_TONE = { Normal: 'green', Moderate: 'cyan', High: 'amber', Critical: 'red' };
const PRIORITY_TONE = { High: 'amber', Medium: 'cyan', Low: 'slate' };
const STATUS_TONE = { Open: 'red', Assigned: 'amber', 'In Progress': 'cyan' };

export default function LocationIntelligenceTab() {
  const { boxes, complaints, inspections, violations, lastSync, openKpiDrawer, createInspectionTask, assignZoneTeam } = useData();
  const navigate = useNavigate();

  const [mapFilter, setMapFilter] = useState('all');
  const [selectedZone, setSelectedZone] = useState(null);
  const [regionFilter, setRegionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAllActions, setShowAllActions] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [scopeZoneId, setScopeZoneId] = useState(null);
  const [issueFilter, setIssueFilter] = useState(null);

  const zones = useMemo(() => buildZoneIntelligence(boxes, complaints, inspections), [boxes, complaints, inspections]);
  const rankedZones = useMemo(() => rankZonesByRisk(zones), [zones]);
  const kpis = useMemo(() => buildLocationIntelligenceKPIs(boxes, complaints, inspections, violations), [boxes, complaints, inspections, violations]);
  const kpiById = useMemo(() => new Map(kpis.map((k) => [k.id, k])), [kpis]);
  const topKpis = useMemo(() => TOP_KPI_IDS.map((id) => kpiById.get(id)).filter(Boolean), [kpiById]);
  const priorityActions = useMemo(() => buildPriorityActions(zones), [zones]);
  const avgRisk = kpiById.get('li-avg-risk')?.value ?? 0;
  const trendSeries = useMemo(() => buildRiskTrendSeries(avgRisk), [avgRisk]);

  const insights = useMemo(() => topKpis.map((kpi) => {
    const trend = kpi.trend || 0;
    const worse = trend > 0; // every top KPI here is "lower is better"
    return {
      id: kpi.id,
      text: `${kpi.name} ${trend === 0 ? 'held steady' : `${worse ? 'increased' : 'decreased'} by ${Math.abs(trend).toFixed(1)}%`}.`,
      tone: trend === 0 ? 'slate' : worse ? 'red' : 'cyan',
      arrow: trend === 0 ? '—' : worse ? '▲' : '▼',
      delta: Math.abs(trend),
    };
  }), [topKpis]);

  const scopeZone = useMemo(() => zones.find((z) => z.id === scopeZoneId) || null, [zones, scopeZoneId]);
  const riskKpi = kpiById.get('li-avg-risk');
  const driverData = useMemo(() => {
    const scoped = scopeZone ? [scopeZone] : zones;
    const sum = (pick) => scoped.reduce((t, z) => t + pick(z), 0);
    const scores = [
      sum((z) => z.riskFactors.nonComplianceScore),
      sum((z) => z.riskFactors.complaintScore),
      sum((z) => z.riskFactors.inspectionBacklogScore),
    ];
    // All-zone counts come straight from the KPIs Key Insights reads, so the two panels can't disagree.
    const counts = scopeZone
      ? [scopeZone.nonCompliantBoxes, scopeZone.openComplaints, scopeZone.overdueInspections]
      : [kpiById.get('li-nc-boxes')?.value ?? 0, kpiById.get('li-open-complaints')?.value ?? 0, kpiById.get('li-overdue-inspections')?.value ?? 0];
    const shares = roundShares(scores);
    return DRIVERS.map((d, i) => ({ ...d, count: counts[i], pct: shares[i], zonesLed: zones.filter((z) => z.primaryIssue === d.issue).length }));
  }, [zones, scopeZone, kpiById]);
  const topDriver = useMemo(() => driverData.reduce((a, b) => (b.pct > a.pct ? b : a), driverData[0]), [driverData]);
  const visibleActions = useMemo(() => (issueFilter ? priorityActions.filter((a) => a.issueType === issueFilter) : priorityActions), [priorityActions, issueFilter]);

  const mapZones = useMemo(() => {
    switch (mapFilter) {
      case 'high-risk': return zones.filter((z) => z.riskCategory === 'High' || z.riskCategory === 'Critical');
      case 'non-compliance': return zones.filter((z) => z.primaryIssue === 'Non-compliance concentration');
      case 'complaints': return zones.filter((z) => z.primaryIssue === 'Complaint density');
      case 'backlog': return zones.filter((z) => z.primaryIssue === 'Inspection backlog');
      case 'priority': return zones.filter((z) => z.riskCategory !== 'Normal');
      default: return zones;
    }
  }, [zones, mapFilter]);

  const bubbleData = useMemo(() => ({
    datasets: [{
      label: 'Zones',
      data: zones.map((z) => ({ x: z.openComplaints, y: z.nonCompliantBoxes, r: 5 + z.overdueInspections * 1.4, zone: z })),
      backgroundColor: zones.map((z) => {
        return `${RISK_CATEGORY_COLOR[z.riskCategory]}D9`;
      }),
      borderColor: zones.map((z) => {
        return RISK_CATEGORY_COLOR[z.riskCategory];
      }),
      borderWidth: 1.5,
    }],
  }), [zones]);

  const filteredZones = useMemo(() => rankedZones.filter((z) => {
    if (regionFilter !== 'all' && z.region !== regionFilter) return false;
    if (categoryFilter !== 'all' && z.riskCategory !== categoryFilter) return false;
    if (statusFilter !== 'all' && z.actionStatus !== statusFilter) return false;
    if (search && !z.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rankedZones, regionFilter, categoryFilter, statusFilter, search]);

  const regions = useMemo(() => Array.from(new Set(zones.map((z) => z.region))), [zones]);

  const selectZone = (zone) => { if (!zone) return; setScopeZoneId(zone.id); setSelectedZone(zone); };
  const openZoneFor = (zoneId) => selectZone(zones.find((z) => z.id === zoneId));

  const registerColumns = [
    { key: 'rank', header: 'Rank', render: (z) => <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{rankedZones.indexOf(z) + 1}</span> },
    { key: 'name', header: 'Zone', render: (z) => <span style={{ fontWeight: 600, color: 'var(--app-text)' }}>{z.name}</span>, sortValue: (z) => z.name },
    { key: 'region', header: 'Region', render: (z) => z.region, sortValue: (z) => z.region },
    { key: 'riskScore', header: 'Risk Score', render: (z) => <span className="font-mono">{z.riskScore}</span>, sortValue: (z) => z.riskScore },
    { key: 'riskCategory', header: 'Risk Category', render: (z) => <GenericBadge tone={RISK_TONE[z.riskCategory]}>{z.riskCategory}</GenericBadge>, sortValue: (z) => z.riskScore },
    { key: 'nonCompliant', header: 'Non-Compliant Boxes', render: (z) => <span className="font-mono">{z.nonCompliantBoxes}</span>, sortValue: (z) => z.nonCompliantBoxes },
    { key: 'complaints', header: 'Open Complaints', render: (z) => <span className="font-mono">{z.openComplaints}</span>, sortValue: (z) => z.openComplaints },
    { key: 'overdue', header: 'Overdue Inspections', render: (z) => <span className="font-mono">{z.overdueInspections}</span>, sortValue: (z) => z.overdueInspections },
    { key: 'lastVerified', header: 'Last Verified', render: (z) => formatDate(z.lastVerified), sortValue: (z) => z.lastVerified },
    { key: 'action', header: 'Recommended Action', render: (z) => <span style={{ color: 'var(--app-text-faint)' }}>{z.recommendedAction}</span> },
    { key: 'team', header: 'Assigned Team', render: (z) => z.assignedTeam },
    { key: 'status', header: 'Status', render: (z) => <GenericBadge tone={STATUS_TONE[z.actionStatus]}>{z.actionStatus}</GenericBadge>, sortValue: (z) => z.actionStatus },
  ];

  const fullActionColumns = [
    { key: 'area', header: 'Area', render: (a) => <span style={{ fontWeight: 600, color: 'var(--app-text)' }}>{a.area}</span>, sortValue: (a) => a.area },
    { key: 'issue', header: 'Primary Issue', render: (a) => a.issueType },
    { key: 'action', header: 'Recommended Action', render: (a) => a.recommendedAction },
    { key: 'team', header: 'Assigned Team', render: (a) => a.assignedTeam },
    { key: 'priority', header: 'Priority', render: (a) => <GenericBadge tone={PRIORITY_TONE[a.priority]}>{a.priority}</GenericBadge>, sortValue: (a) => a.priority },
    { key: 'status', header: 'Status', render: (a) => <GenericBadge tone={STATUS_TONE[a.status]}>{a.status}</GenericBadge>, sortValue: (a) => a.status },
    {
      key: 'actions', header: 'Actions', render: (a) => (
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); assignZoneTeam({ zoneId: a.zoneId, zoneName: a.area, team: a.assignedTeam }); }} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Assign Team</button>
          <button onClick={(e) => { e.stopPropagation(); createInspectionTask({ zoneId: a.zoneId, zoneName: a.area, priority: a.priority === 'High' ? 'urgent' : 'priority' }); }} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Create Task</button>
          <button onClick={(e) => { e.stopPropagation(); openZoneFor(a.zoneId); }} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Open Zone</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 pt-1">
      {/* ── Sub-header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--app-text)' }}>Location Intelligence</h2>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>Geographic risk overview and priority field actions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-bold tracking-wide"
            style={{ background: 'var(--app-success-bg)', color: 'var(--app-success)', border: '1px solid var(--app-success-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success)' }} />
            LIVE
          </span>
          <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{formatIntelTimestamp(lastSync)}</span>
          <button className="app-control-btn flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        </div>
      </div>

      {/* ── 1. Top KPI strip — 4 compact cards ───────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {topKpis.map((kpi) => {
          const meta = TOP_KPI_META[kpi.id];
          const Icon = meta.icon;
          return (
            <KPICard
              key={kpi.id}
              icon={<Icon />}
              {...{ ...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('gis-intelligence', kpi.id) }), label: meta.label }}
            />
          );
        })}
      </div>

      {/* ── Geographic Risk Map ──────────────────────────────────────────── */}
      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Geographic Risk Map</h3>
        </div>
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {MAP_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setMapFilter(f.key)}
              className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold border transition-colors"
              style={mapFilter === f.key
                ? { background: 'var(--app-accent-bg)', borderColor: 'var(--app-accent-border)', color: 'var(--app-accent)' }
                : { background: 'var(--app-surface-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text-faint)' }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          <div className="relative">
            <RiskMap
              zones={mapZones} height={340} zoom={9}
              onOpenZone={setSelectedZone}
              onCreateTask={(zone) => createInspectionTask({ zoneId: zone.id, zoneName: zone.name })}
              onAssignTeam={(zone) => assignZoneTeam({ zoneId: zone.id, zoneName: zone.name, team: zone.assignedTeam })}
            />
            <div className="absolute top-3 right-3" style={{ zIndex: 1000 }}>
              <RiskMapLegend />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Risk Contribution | Risk Trend | Risk by Zone ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <RiskScoreDriversCard
          scopeZone={scopeZone}
          score={scopeZone ? scopeZone.riskScore : avgRisk}
          delta={scopeZone ? null : (riskKpi?.trend ?? 0)}
          vsAverage={scopeZone ? Math.round((scopeZone.riskScore - avgRisk) * 10) / 10 : null}
          drivers={driverData}
          topDriver={topDriver}
          zoneCount={zones.length}
          issueFilter={issueFilter}
          onToggleIssue={(issue) => setIssueFilter((cur) => (cur === issue ? null : issue))}
          onClear={() => setScopeZoneId(null)}
          onOpenMethodology={() => setShowMethodology(true)}
        />

        <ChartPanel title="Average Geographic Risk Trend" subtitle="Average composite risk across monitored zones">
          <div style={{ height: 200 }}>
            <Line data={{
              labels: trendSeries.map((p) => p.label),
              datasets: [{
                label: 'Average Risk Score', data: trendSeries.map((p) => p.value),
                borderColor: SEM.analytic, backgroundColor: areaGradient(SEM.analytic), fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
              }],
            }} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: chartTooltip() },
              scales: chartScales({
                x: { title: axisTitle('Month') },
                y: { min: 0, title: axisTitle('Risk Score') },
              }),
            }} />
          </div>
        </ChartPanel>

        <ChartPanel title="Risk by Zone" subtitle="Hover or click a zone for its full breakdown">
          <div style={{ height: 200 }}>
            <Bubble data={bubbleData} options={{
              responsive: true, maintainAspectRatio: false,
              interaction: { mode: 'point', intersect: true },
              onClick: (evt, elements) => {
                if (!elements.length) return;
                const point = bubbleData.datasets[0].data[elements[0].index];
                if (point?.zone) selectZone(point.zone);
              },
              plugins: {
                legend: { display: false },
                tooltip: chartTooltip({
                  position: 'nearest',
                  callbacks: {
                    label: (ctx) => {
                      const z = ctx.raw.zone;
                      return [`${z.name} — Risk ${z.riskScore}`, `Open Complaints: ${z.openComplaints}`, `Non-Compliance: ${z.nonCompliantBoxes}`];
                    },
                  },
                }),
              },
              scales: chartScales({
                x: { title: axisTitle('Open Complaints') },
                y: { title: axisTitle('Non-Compliant Boxes') },
              }),
            }} />
          </div>
        </ChartPanel>
      </div>

      {/* ── 3. Priority Geographic Actions | Key Insights ────────────────── */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Priority Geographic Actions</h3>
            {issueFilter && (
              <button
                onClick={() => setIssueFilter(null)}
                className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-semibold"
                style={{ background: 'var(--app-accent-bg)', border: '1px solid var(--app-accent-border)', color: 'var(--app-accent)' }}
                aria-label={`Remove filter: ${issueFilter}`}
              >
                {issueFilter} <span aria-hidden="true">✕</span>
              </button>
            )}
          </div>
          <div className="px-4 py-2">
            <table className="w-full text-left" style={{ fontSize: '11.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                  {['Area', 'Primary Issue', 'Recommended Action', 'Status'].map((h) => (
                    <th key={h} style={{ padding: '6px 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--app-text-faint)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleActions.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '14px 8px', textAlign: 'center', color: 'var(--app-text-faint)' }}>No priority zones with this primary issue.</td></tr>
                )}
                {visibleActions.slice(0, 3).map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => openZoneFor(a.zoneId)}
                    style={{ borderBottom: '1px solid var(--app-border-soft)', cursor: 'pointer', background: scopeZoneId === a.zoneId ? 'var(--app-accent-bg)' : undefined }}
                    className="hover:bg-white/[0.03]"
                  >
                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--app-text)' }}>{a.area}</td>
                    <td style={{ padding: '8px', color: 'var(--app-text-muted)' }}>{a.issueType}</td>
                    <td style={{ padding: '8px', color: 'var(--app-text-muted)' }}>{a.recommendedAction}</td>
                    <td style={{ padding: '8px' }}><GenericBadge tone={STATUS_TONE[a.status]}>{a.status}</GenericBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-app-border">
            <button onClick={() => setShowAllActions(true)} className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
              View all {visibleActions.length} →
            </button>
          </div>
        </div>
      </div>

      <InsightsCallout title="Key Insights" items={insights} onSelect={(ins) => openKpiDrawer('gis-intelligence', ins.id)} />

      {/* ── Zone Intelligence Register (full detail) ─────────────────────── */}
      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Zone Intelligence Register ({filteredZones.length})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Click a row for the full zone risk profile</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="header-search" style={{ maxWidth: 200 }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search zone…" />
            </div>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className="rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
              <option value="all">All Regions</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
              <option value="all">All Risk Categories</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Moderate">Moderate</option>
              <option value="Normal">Normal</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
              <option value="all">All Status</option>
              <option value="Open">Open</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
            </select>
          </div>
        </div>
        <div className="p-4">
          <DataTable columns={registerColumns} data={filteredZones} keyExtractor={(z) => z.id} onRowClick={setSelectedZone} pageSize={13} />
        </div>
      </div>

      {/* ── Composite Risk Methodology drawer ────────────────────────────── */}
      <Drawer open={showMethodology} onClose={() => setShowMethodology(false)} title="Composite Risk Methodology" subtitle="GIS Command Center">
        <p className="text-[11.5px] mb-4" style={{ color: 'var(--app-text-muted)', lineHeight: 1.55 }}>
          Composite demonstration indicator based on non-compliance concentration, complaint activity, and inspection backlog. Thresholds and weighting are configurable.
        </p>
        <DrawerSection title="Weighting">
          <DetailRow label="Non-compliance concentration" value="55%" />
          <DetailRow label="Complaint activity" value="30%" />
          <DetailRow label="Inspection backlog" value="15%" />
        </DrawerSection>
        <DrawerSection title="Formula">
          <div className="rounded-md p-3 font-mono text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)', lineHeight: 1.7 }}>
            Risk = (Non-compliance × 55%)<br />
            &nbsp;&nbsp;&nbsp;+ (Complaints × 30%)<br />
            &nbsp;&nbsp;&nbsp;+ (Inspection Backlog × 15%)
          </div>
        </DrawerSection>
        <p className="text-[10.5px] mt-4 pt-3" style={{ color: 'var(--app-text-faint)', borderTop: '1px solid var(--app-border)', lineHeight: 1.5 }}>
          This score is a demonstration analytical construct and is not an official DCD regulatory rating.
        </p>
      </Drawer>

      {/* ── Full Priority Geographic Actions drawer ("View all") ─────────── */}
      <Drawer open={showAllActions} onClose={() => setShowAllActions(false)} title="Priority Geographic Actions" subtitle={issueFilter ? `${visibleActions.length} zones with primary issue: ${issueFilter}` : `${priorityActions.length} zones flagged Moderate risk or above`} width={760}>
        <DataTable columns={fullActionColumns} data={visibleActions} keyExtractor={(a) => a.id} onRowClick={(a) => { setShowAllActions(false); openZoneFor(a.zoneId); }} pageSize={13} emptyLabel="No priority actions currently open." />
      </Drawer>

      {/* ── Zone detail drawer ────────────────────────────────────────────── */}
      <Drawer open={!!selectedZone} onClose={() => setSelectedZone(null)} title={selectedZone?.name || ''} subtitle={selectedZone?.region}>
        {selectedZone && (
          <>
            <div className="flex items-center justify-between mb-4">
              <GenericBadge tone={RISK_TONE[selectedZone.riskCategory]}>{selectedZone.riskCategory}</GenericBadge>
              <span className="font-mono text-[12px]" style={{ color: 'var(--app-text-muted)' }}>Risk Score: <span style={{ color: 'var(--app-text)', fontWeight: 700 }}>{selectedZone.riskScore}</span></span>
            </div>
            <DrawerSection title="Operational Indicators">
              <DetailRow label="Registered Boxes" value={selectedZone.registeredBoxes} />
              <DetailRow label="Non-Compliant Boxes" value={selectedZone.nonCompliantBoxes} />
              <DetailRow label="Open Complaints" value={selectedZone.openComplaints} />
              <DetailRow label="Overdue Inspections" value={selectedZone.overdueInspections} />
              <DetailRow label="Inspection Completion Rate" value={`${selectedZone.inspectionCompletionRate}%`} />
              <DetailRow label="Last Inspection Date" value={formatDate(selectedZone.lastInspectionDate)} />
            </DrawerSection>
            <DrawerSection title="Risk Drivers">
              <DetailRow label="Non-Compliance Contribution" value={selectedZone.riskFactors.nonComplianceScore} />
              <DetailRow label="Complaint Contribution" value={selectedZone.riskFactors.complaintScore} />
              <DetailRow label="Inspection Backlog Contribution" value={selectedZone.riskFactors.inspectionBacklogScore} />
            </DrawerSection>
            <DrawerSection title="Location Information">
              <DetailRow label="Geographic Coverage" value={`${selectedZone.geographicCoverage}%`} />
              <DetailRow label="Last Location Verification" value={formatDate(selectedZone.lastVerified)} />
              <DetailRow label="Location Data Issues" value={selectedZone.locationIssues} />
            </DrawerSection>
            <DrawerSection title="Recommended Action">
              <DetailRow label="Primary Issue" value={selectedZone.primaryIssue} />
              <DetailRow label="Recommended Action" value={selectedZone.recommendedAction} />
              <DetailRow label="Assigned Team" value={selectedZone.assignedTeam} />
              <DetailRow label="Status" value={selectedZone.actionStatus} />
            </DrawerSection>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => assignZoneTeam({ zoneId: selectedZone.id, zoneName: selectedZone.name, team: selectedZone.assignedTeam })} className="app-control-btn py-2 text-[11px] font-semibold">Assign Field Team</button>
              <button onClick={() => createInspectionTask({ zoneId: selectedZone.id, zoneName: selectedZone.name })} className="app-control-btn py-2 text-[11px] font-semibold">Create Inspection Task</button>
              <button onClick={() => navigate('/compliance')} className="app-control-btn py-2 text-[11px] font-semibold">Open Compliance Case</button>
              <button onClick={() => navigate('/complaints')} className="app-control-btn py-2 text-[11px] font-semibold">View Complaint History</button>
              <button onClick={() => navigate('/gis?tab=coverage')} className="app-control-btn py-2 text-[11px] font-semibold col-span-2">View Geographic Map</button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

function RiskScoreDriversCard({ scopeZone, score, delta, vsAverage, drivers, topDriver, zoneCount, issueFilter, onToggleIssue, onClear, onOpenMethodology }) {
  const [tip, setTip] = useState(null);
  const showTip = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.max(8, r.right - 292);
    setTip(window.innerHeight - r.bottom < 320 ? { bottom: window.innerHeight - r.top + 8, left } : { top: r.bottom + 8, left });
  };

  const worse = (delta ?? vsAverage ?? 0) > 0;
  const changeColor = (delta ?? vsAverage ?? 0) === 0 ? 'var(--app-text-faint)' : worse ? 'var(--app-danger)' : 'var(--app-info)';
  const changeText = scopeZone
    ? `${vsAverage > 0 ? '+' : ''}${vsAverage} vs all-zone avg`
    : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} ${Math.abs(delta).toFixed(1)}% vs previous period`;

  return (
    <div className="bg-app-panel border border-app-border rounded-xl flex flex-col">
      <div className="px-4 py-3 border-b border-app-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Risk Score Drivers</h3>
          <p className="text-[10.5px] flex items-center gap-2" style={{ color: 'var(--app-text-faint)' }}>
            <span className="truncate">{scopeZone ? scopeZone.name : 'All zones'}</span>
            {scopeZone && (
              <button onClick={onClear} className="font-semibold shrink-0" style={{ color: 'var(--app-accent)' }}>Clear</button>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setTip(null); onOpenMethodology(); }}
          onMouseEnter={showTip}
          onFocus={showTip}
          onMouseLeave={() => setTip(null)}
          onBlur={() => setTip(null)}
          onKeyDown={(e) => e.key === 'Escape' && setTip(null)}
          aria-label="Composite risk methodology"
          style={{ color: 'var(--app-text-faint)', display: 'inline-flex', padding: 2 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4m0-4h.01" /></svg>
        </button>
        {tip && (
          <div role="tooltip" className="fixed rounded-lg p-3 text-[10.5px]" style={{
            top: tip.top, bottom: tip.bottom, left: tip.left, width: 284, zIndex: 1600, pointerEvents: 'none', lineHeight: 1.5,
            background: 'var(--app-panel)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)', color: 'var(--app-text-muted)',
          }}>
            <div className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--app-text)' }}>Composite Risk Methodology</div>
            <div><span style={{ color: 'var(--app-text)', fontWeight: 600 }}>Weights: </span>Non-compliance 55% · Complaints 30% · Inspection backlog 15%</div>
            <div className="mt-1"><span style={{ color: 'var(--app-text)', fontWeight: 600 }}>Data sources: </span>Compliance &amp; Violations Engine (non-compliant boxes), Complaints &amp; DMT Alert Center (open complaints), Inspections Management System (overdue inspections)</div>
            <div className="mt-1"><span style={{ color: 'var(--app-text)', fontWeight: 600 }}>Period: </span>Current live reporting period; change is measured against the previous period.</div>
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}>
              This score is a demonstration analytical construct and is not an official DCD regulatory rating.
            </div>
            <div className="mt-1.5" style={{ color: 'var(--app-accent)' }}>Click the icon for the full methodology.</div>
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[9.5px] font-semibold uppercase" style={{ color: 'var(--app-text-faint)', letterSpacing: '0.08em' }}>
              {scopeZone ? 'Zone risk score' : 'Composite risk score'}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold leading-none" style={{ color: 'var(--app-text)', fontSize: 28 }}>{Number(score).toFixed(1)}</span>
              {scopeZone && <GenericBadge tone={RISK_TONE[scopeZone.riskCategory]}>{scopeZone.riskCategory}</GenericBadge>}
            </div>
          </div>
          <span className="text-[10.5px] font-semibold" style={{ color: changeColor }}>{changeText}</span>
        </div>

        <div>
          <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'var(--app-surface-raised)' }} role="img"
            aria-label={drivers.map((d) => `${d.label} ${d.pct}%`).join(', ')}>
            {drivers.map((d) => <div key={d.key} style={{ width: `${d.pct}%`, background: d.color }} />)}
          </div>
          <div className="mt-2 space-y-0.5">
            {drivers.map((d) => {
              const active = issueFilter === d.issue;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onToggleIssue(d.issue)}
                  aria-pressed={active}
                  title="Filter Priority Geographic Actions by this issue"
                  className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.04]"
                  style={{
                    background: active ? 'var(--app-accent-bg)' : undefined,
                    border: active ? '1px solid var(--app-accent-border)' : '1px solid transparent',
                  }}
                >
                  <span className="flex items-center gap-2" style={{ color: 'var(--app-text-muted)' }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    {d.label}
                  </span>
                  <span className="flex items-center gap-3">
                    <span style={{ color: 'var(--app-text-faint)' }}>{d.count.toLocaleString()} {d.unit}</span>
                    <span className="font-mono font-semibold" style={{ color: 'var(--app-text)', minWidth: 34, textAlign: 'right' }}>{d.pct}%</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md px-2.5 py-2 text-[11px] flex items-start gap-2" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
          <span className="w-2 h-2 rounded-full shrink-0 mt-[5px]" style={{ background: topDriver.color }} />
          <span>
            {scopeZone
              ? `${topDriver.label} drives ${topDriver.pct}% of ${scopeZone.name}'s risk score.`
              : `${topDriver.label} is the top driver (${topDriver.pct}%) and leads ${topDriver.zonesLed} of ${zoneCount} zones.`}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border">
        <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{title}</h3>
        <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
