import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { useData } from '../../services/socket';
import { chartTooltip, chartScales, HBAR_INTERACTION, areaGradient } from '../chartUtils';
import KPICard, { IcoGlobe, IcoCheck, IcoBox, IcoScale, IcoAlert, IcoPin } from '../KPICard';
import DataTable from '../DataTable';
import Drawer, { DetailRow, DrawerSection } from '../Drawer';
import { GenericBadge } from '../StatusBadge';
import CoverageMap from '../map/CoverageMap';
import CoverageMapLegend from '../map/CoverageMapLegend';
import { buildGeographicCoverageKPIs } from '../../services/donationKpis';
import { kpiToCardProps } from '../../services/kpiAdapter';
import { buildGeoAreas, buildLocationQuality, buildMapDataQuality, buildCoverageGaps, buildSurveyProgressSeries, mapDataQualityBucketOf, locationIssueLabel } from '../../services/geoCoverage';
import { formatDate, zoneName } from '../../services/donationSeed';
import { SEM, bandColor } from '../../services/palette';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

const COVERAGE_TARGET = 85;
const KPI_ICONS = [IcoGlobe, IcoCheck, IcoBox, IcoScale, IcoAlert, IcoPin];

const MAP_FILTERS = [
  { key: 'all', label: 'All Locations' },
  { key: 'compliant', label: 'Verified Locations' },
  { key: 'non-compliant', label: 'Non-Compliant' },
  { key: 'under-inspection', label: 'Pending Inspection' },
  { key: 'unknown', label: 'Location Issues' },
  { key: 'pending-displacement', label: 'Awaiting Removal' },
  { key: 'density', label: 'High-Density Areas' },
];

function formatCoverageTimestamp(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' });
  return `${date}, ${time} GST`;
}

const ISSUE_BUCKET_LABEL = { missing: 'Missing Coordinates', duplicate: 'Duplicate Locations', 'outside-area': 'Outside Registered Area', pending: 'Pending Validation' };

const SURVEY_STATUS_TONE = { Complete: 'green', Partial: 'amber', Pending: 'slate' };
const PRIORITY_TONE = { High: 'amber', Medium: 'cyan', Low: 'slate' };
const GAP_STATUS_TONE = { Open: 'red', Assigned: 'amber', 'In Progress': 'cyan' };

export default function GeographicCoverageTab() {
  const { boxes, complaints, lastSync, openKpiDrawer, pushToast, reviewLocationIssue, resolveLocationIssue, verifyLocation } = useData();
  const navigate = useNavigate();

  const [mapFilter, setMapFilter] = useState('all');
  const [showAllGaps, setShowAllGaps] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [issueBucket, setIssueBucket] = useState(null); // 'missing' | 'duplicate' | 'outside-area' | 'pending' | null
  const [assignedKeys, setAssignedKeys] = useState(() => new Map());
  const [selectedArea, setSelectedArea] = useState(null);
  const [regionFilter, setRegionFilter] = useState('all');
  const [surveyFilter, setSurveyFilter] = useState('all');
  const [search, setSearch] = useState('');

  const areas = useMemo(() => buildGeoAreas(boxes, complaints), [boxes, complaints]);
  const kpis = useMemo(() => buildGeographicCoverageKPIs(boxes, complaints), [boxes, complaints]);
  const quality = useMemo(() => buildLocationQuality(boxes), [boxes]);
  const mapQuality = useMemo(() => buildMapDataQuality(boxes), [boxes]);
  const issueBoxes = useMemo(() => (issueBucket ? boxes.filter((b) => mapDataQualityBucketOf(b) === issueBucket) : []), [boxes, issueBucket]);
  const gaps = useMemo(() => buildCoverageGaps(areas, boxes), [areas, boxes]);
  const overallCoverage = kpis[0].value;
  const progressSeries = useMemo(() => buildSurveyProgressSeries(overallCoverage), [overallCoverage]);

  const mapBoxes = useMemo(() => (mapFilter === 'all' || mapFilter === 'density' ? boxes : boxes.filter((b) => b.status === mapFilter)), [boxes, mapFilter]);

  const statusCounts = useMemo(() => ({
    complete: areas.filter((a) => a.surveyStatus === 'Complete').length,
    partial: areas.filter((a) => a.surveyStatus === 'Partial').length,
    pending: areas.filter((a) => a.surveyStatus === 'Pending').length,
  }), [areas]);
  const totalAreas = areas.length || 1;

  // Ranked ascending (weakest first) and capped to the areas that most need
  // attention — the full register table below already lists all of them, so
  // this stays a short, dense "what to look at" chart, not a scroll of bars.
  const COVERAGE_CHART_LIMIT = 8;
  const coverageByAreaData = useMemo(() => {
    const sorted = [...areas].sort((a, b) => a.coveragePercentage - b.coveragePercentage).slice(0, COVERAGE_CHART_LIMIT);
    return {
      labels: sorted.map((a) => a.name),
      datasets: [{
        label: 'Coverage %', data: sorted.map((a) => a.coveragePercentage),
        backgroundColor: sorted.map((a) => bandColor(a.coveragePercentage, 85, 70)),
        borderRadius: 3, maxBarThickness: 20,
      }],
    };
  }, [areas]);

  const filteredAreas = useMemo(() => areas.filter((a) => {
    if (regionFilter !== 'all' && a.region !== regionFilter) return false;
    if (surveyFilter !== 'all' && a.surveyStatus !== surveyFilter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [areas, regionFilter, surveyFilter, search]);

  const regions = useMemo(() => Array.from(new Set(areas.map((a) => a.region))), [areas]);

  // assignedKeys holds the team actually assigned through this action — not
  // the data layer's precomputed "recommended team", which is only ever
  // offered as the default when the button is clicked. Until then, the area
  // genuinely has no team assigned.
  function assignTeam(key, area, team) {
    setAssignedKeys((prev) => new Map(prev).set(key, team));
    pushToast({ level: 'success', title: 'Assigned', message: `${team} assigned to ${area}` });
  }
  function unassignTeam(key) {
    setAssignedKeys((prev) => { const next = new Map(prev); next.delete(key); return next; });
  }
  function assignedTeamOf(id) { return assignedKeys.get(id); }
  /** The action + status for one area: "Assign Team" when unassigned, a quiet "Reassign" once it has been. */
  function renderAssignButton(id, area, team, className) {
    const assigned = assignedKeys.get(id);
    if (assigned) {
      return <button onClick={(e) => { e.stopPropagation(); unassignTeam(id); }} className="text-[10px] font-semibold" style={{ color: 'var(--app-text-faint)' }}>Reassign</button>;
    }
    return (
      <button onClick={(e) => { e.stopPropagation(); assignTeam(id, area, team); }} className={className}>
        Assign Team
      </button>
    );
  }

  const registerColumns = [
    { key: 'name', header: 'Zone', render: (a) => <span style={{ fontWeight: 600, color: 'var(--app-text)' }}>{a.name}</span>, sortValue: (a) => a.name },
    { key: 'region', header: 'Region', render: (a) => a.region, sortValue: (a) => a.region },
    { key: 'registered', header: 'Registered Boxes', render: (a) => <span className="font-mono">{a.totalRegisteredBoxes}</span>, sortValue: (a) => a.totalRegisteredBoxes },
    { key: 'mapped', header: 'Mapped Boxes', render: (a) => <span className="font-mono">{a.mappedBoxes}</span>, sortValue: (a) => a.mappedBoxes },
    { key: 'accuracy', header: 'Location Accuracy', render: (a) => <span className="font-mono">{a.locationAccuracy}%</span>, sortValue: (a) => a.locationAccuracy },
    { key: 'coverage', header: 'Coverage %', render: (a) => <span className="font-mono">{a.coveragePercentage}%</span>, sortValue: (a) => a.coveragePercentage },
    { key: 'status', header: 'Survey Status', render: (a) => <GenericBadge tone={SURVEY_STATUS_TONE[a.surveyStatus]}>{a.surveyStatus}</GenericBadge>, sortValue: (a) => a.surveyStatus },
    { key: 'lastVerified', header: 'Last Verified', render: (a) => formatDate(a.lastVerified), sortValue: (a) => a.lastVerified },
    { key: 'action', header: 'Action Required', render: (a) => <span style={{ color: 'var(--app-text-faint)' }}>{a.actionRequired}</span> },
  ];

  const gapColumns = [
    { key: 'area', header: 'Area', render: (g) => <span style={{ fontWeight: 600, color: 'var(--app-text)' }}>{g.area}</span>, sortValue: (g) => g.area },
    { key: 'gapType', header: 'Gap Type', render: (g) => g.gapType },
    { key: 'affected', header: 'Affected Records', render: (g) => <span className="font-mono">{g.affectedRecords} boxes</span>, sortValue: (g) => g.affectedRecords },
    { key: 'priority', header: 'Priority', render: (g) => <GenericBadge tone={PRIORITY_TONE[g.priority]}>{g.priority}</GenericBadge>, sortValue: (g) => g.priority },
    { key: 'team', header: 'Assigned Team', render: (g) => assignedTeamOf(g.key) || <span style={{ color: 'var(--app-text-faint)' }}>No team assigned</span> },
    { key: 'due', header: 'Due Date', render: (g) => formatDate(g.dueDate), sortValue: (g) => g.dueDate },
    { key: 'status', header: 'Status', render: (g) => <GenericBadge tone={GAP_STATUS_TONE[g.status]}>{g.status}</GenericBadge>, sortValue: (g) => g.status },
    {
      key: 'actions', header: 'Actions', render: (g) => (
        <div className="flex items-center gap-1.5">
          {renderAssignButton(g.key, g.area, g.assignedTeam, 'app-control-btn px-2 py-1 text-[10px] font-semibold')}
          <button onClick={(e) => { e.stopPropagation(); document.getElementById('geo-coverage-map')?.scrollIntoView({ behavior: 'smooth' }); }} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Open GIS View</button>
          <button onClick={(e) => { e.stopPropagation(); navigate('/inspections?tab=planning'); }} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Create Task</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 pt-1">
      {/* ── Sub-header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--app-text)' }}>Geographic Coverage &amp; Location Verification</h2>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
            Monitor survey coverage, mapped donation boxes, location accuracy, and geographic gaps across Abu Dhabi.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-bold tracking-wide"
            style={{ background: 'var(--app-success-bg)', color: 'var(--app-success)', border: '1px solid var(--app-success-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success)' }} />
            LIVE COVERAGE MONITORING
          </span>
          <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Last updated: {formatCoverageTimestamp(lastSync)}</span>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi, idx) => ({ kpi, Icon: KPI_ICONS[idx] }))
          .filter(({ kpi }) => ['geo-coverage', 'geo-boxes-mapped', 'geo-unmapped', 'geo-gaps'].includes(kpi.id))
          .map(({ kpi, Icon }) => (
            <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: () => openKpiDrawer('gis-coverage', kpi.id) })} />
          ))}
      </div>

      {/* ── Map + Coverage Status ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3" id="geo-coverage-map">
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden xl:col-span-2">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Abu Dhabi Geographic Coverage Map</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Click a zone boundary for full survey detail — markers show individual donation box status</p>
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
              <CoverageMap boxes={mapBoxes} areas={areas} height={440} zoom={9} />
              <div className="absolute top-3 right-3" style={{ zIndex: 1000 }}>
                <CoverageMapLegend />
              </div>
            </div>
          </div>
          <div className="px-4 py-2 border-t border-app-border flex items-center gap-x-4 gap-y-1 flex-wrap" style={{ background: 'var(--app-surface-soft)' }}>
            <span className="text-[9.5px] font-bold uppercase" style={{ color: 'var(--app-text-faint)', letterSpacing: '0.1em' }}>Map Data Quality</span>
            <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'var(--app-text)' }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: qualityTone(mapQuality.verifiedPct) }} />
              {mapQuality.verifiedPct}% Verified
            </span>
            <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
              {mapQuality.requiresValidation.toLocaleString()} locations require validation
            </span>
            <button onClick={() => setShowQuality(true)} className="ml-auto text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>Review</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Coverage Status</h3>
            </div>
            <div className="p-4">
              <div className="h-2.5 rounded-full overflow-hidden flex mb-3" style={{ background: 'var(--app-surface-raised)' }}>
                <div style={{ width: `${(statusCounts.complete / totalAreas) * 100}%`, background: '#3d8560' }} />
                <div style={{ width: `${(statusCounts.partial / totalAreas) * 100}%`, background: '#b8893a' }} />
                <div style={{ width: `${(statusCounts.pending / totalAreas) * 100}%`, background: '#a63f3f' }} />
              </div>
              <div className="space-y-2">
                <StatusStat color="#3d8560" label="Verified Areas" value={statusCounts.complete} />
                <StatusStat color="#b8893a" label="Partially Covered" value={statusCounts.partial} />
                <StatusStat color="#a63f3f" label="Pending Survey" value={statusCounts.pending} />
                <StatusStat color="#94a3b8" label="Location Data Issues" value={quality.missing + quality.duplicate + quality['outside-area']} />
              </div>
            </div>
          </div>

          <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Priority Coverage Gaps</h3>
            </div>
            <div className="p-3 space-y-2">
              {gaps.length === 0 && <p className="text-[11px] text-center py-4" style={{ color: 'var(--app-text-faint)' }}>No outstanding coverage gaps.</p>}
              {gaps.slice(0, 4).map((g) => (
                <div key={g.key} className="rounded-md p-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11.5px] font-semibold" style={{ color: 'var(--app-text)' }}>{g.area}</span>
                    <GenericBadge tone={PRIORITY_TONE[g.priority]}>{g.priority}</GenericBadge>
                  </div>
                  <div className="text-[10.5px] mb-1" style={{ color: 'var(--app-text-faint)' }}>Issue: {g.gapType}</div>
                  <div className="text-[10.5px] mb-1.5 flex items-center justify-between gap-2">
                    <span style={{ color: 'var(--app-text-faint)' }}>Team: <span style={{ color: assignedTeamOf(g.key) ? 'var(--app-text-muted)' : 'var(--app-text-faint)' }}>{assignedTeamOf(g.key) || 'No team assigned'}</span></span>
                    {assignedKeys.has(g.key) && renderAssignButton(g.key, g.area, g.assignedTeam)}
                  </div>
                  {!assignedKeys.has(g.key) && renderAssignButton(g.key, g.area, g.assignedTeam, 'app-control-btn w-full py-1 text-[10px] font-semibold')}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Coverage by Area + Survey Progress ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartPanel title="Coverage by Area" subtitle={`${COVERAGE_CHART_LIMIT} weakest operational areas by geographic coverage — full register below`}>
          <div style={{ height: 200 }}>
            <Bar data={coverageByAreaData} options={{
              indexAxis: 'y', responsive: true, maintainAspectRatio: false,
              interaction: HBAR_INTERACTION,
              plugins: {
                legend: { display: false },
                tooltip: chartTooltip({
                  callbacks: {
                    label: (ctx) => `Coverage: ${ctx.parsed.x}%`,
                    afterLabel: (ctx) => {
                      const gap = ctx.parsed.x - COVERAGE_TARGET;
                      return gap >= 0 ? `Meets the ${COVERAGE_TARGET}% target (+${gap.toFixed(1)} pts)` : `${Math.abs(gap).toFixed(1)} pts below the ${COVERAGE_TARGET}% target`;
                    },
                  },
                }),
              },
              scales: chartScales({
                x: { min: 0, max: 100, title: { display: true, text: 'Coverage Percentage (%)', color: '#94a3b8', font: { size: 10 } } },
                y: { title: { display: true, text: 'Operational Areas / Zones', color: '#94a3b8', font: { size: 10 } } },
              }),
            }} />
          </div>
        </ChartPanel>

        <ChartPanel title="Geographic Survey Progress" subtitle="Cumulative coverage percentage over the past six months">
          <div style={{ height: 200 }}>
            <Line data={{
              labels: progressSeries.map((p) => p.label),
              datasets: [{
                label: 'Coverage %', data: progressSeries.map((p) => p.value),
                borderColor: SEM.normal, backgroundColor: areaGradient(SEM.normal), fill: true, tension: 0.35, pointRadius: 3, borderWidth: 2,
              }],
            }} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: chartTooltip() },
              scales: chartScales({
                x: { title: { display: true, text: 'Month', color: '#94a3b8', font: { size: 10 } } },
                y: { min: 0, max: 100, title: { display: true, text: 'Coverage Percentage (%)', color: '#94a3b8', font: { size: 10 } } },
              }),
            }} />
          </div>
        </ChartPanel>
      </div>

      {/* ── Geographic Coverage Register ─────────────────────────────────── */}
      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Geographic Coverage Register ({filteredAreas.length})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Click a row for the full zone survey profile</p>
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
            <select value={surveyFilter} onChange={(e) => setSurveyFilter(e.target.value)} className="rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
              <option value="all">All Survey Status</option>
              <option value="Complete">Complete</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
        <div className="p-4">
          <DataTable columns={registerColumns} data={filteredAreas} keyExtractor={(a) => a.id} onRowClick={setSelectedArea} pageSize={13} />
        </div>
      </div>

      {/* ── Coverage Gaps & Required Field Actions ──────────────────────── */}
      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Coverage Gaps &amp; Required Field Actions</h3>
        </div>
        <div className="p-4">
          <DataTable columns={gapColumns} data={gaps.slice(0, 3)} keyExtractor={(g) => g.key} pageSize={3} emptyLabel="No coverage gaps currently open." />
        </div>
        <div className="px-4 py-2.5 border-t border-app-border">
          <button onClick={() => setShowAllGaps(true)} className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>View all {gaps.length} →</button>
        </div>
      </div>

      <Drawer open={showAllGaps} onClose={() => setShowAllGaps(false)} title="Coverage Gaps & Required Field Actions" subtitle={`${gaps.length} zones flagged Partial or Pending`} width={760}>
        <DataTable columns={gapColumns} data={gaps} keyExtractor={(g) => g.key} pageSize={13} emptyLabel="No coverage gaps currently open." />
      </Drawer>

      <Drawer open={showQuality} onClose={() => setShowQuality(false)} title="Map Data Quality" subtitle={`${mapQuality.verifiedPct}% of ${mapQuality.total.toLocaleString()} registered locations verified`} width={420}>
        <p className="text-[11px] mb-3" style={{ color: 'var(--app-text-faint)' }}>
          Can the geographic data on the map be trusted? {mapQuality.requiresValidation.toLocaleString()} locations need attention.
        </p>
        <div className="space-y-3">
          <QualityRow color="#3d8560" label="Verified Locations" value={mapQuality.verified} total={mapQuality.total} note={`Coordinates on file and field-confirmed within ${mapQuality.validationWindowDays} days`} />
          <QualityRow color="#b8893a" label="Pending Validation" value={mapQuality.pending} total={mapQuality.total} note={`Coordinates on file, last field confirmation older than ${mapQuality.validationWindowDays} days`} onClick={mapQuality.pending ? () => setIssueBucket('pending') : undefined} />
          <QualityRow color="#a63f3f" label="Missing Coordinates" value={mapQuality.missing} total={mapQuality.total} note="No usable coordinates recorded in the registry" onClick={mapQuality.missing ? () => setIssueBucket('missing') : undefined} />
          <QualityRow color="#a63f3f" label="Duplicate Locations" value={mapQuality.duplicate} total={mapQuality.total} note="Coordinates shared with another registered box" onClick={mapQuality.duplicate ? () => setIssueBucket('duplicate') : undefined} />
          <QualityRow color="#a63f3f" label="Outside Registered Area" value={mapQuality.outside} total={mapQuality.total} note="Coordinates fall outside the assigned zone boundary" onClick={mapQuality.outside ? () => setIssueBucket('outside-area') : undefined} />
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 text-[11.5px]" style={{ borderTop: '1px solid var(--app-border)' }}>
          <span style={{ color: 'var(--app-text-faint)' }}>Total registered locations</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--app-text)' }}>{mapQuality.total.toLocaleString()}</span>
        </div>
      </Drawer>

      {/* ── Location issue drill-down: the actual boxes behind a quality count, actionable ── */}
      <Drawer
        open={!!issueBucket}
        onClose={() => setIssueBucket(null)}
        title={ISSUE_BUCKET_LABEL[issueBucket] || ''}
        subtitle={issueBucket ? `${issueBoxes.length} of ${mapQuality.total.toLocaleString()} registered locations` : ''}
        width={480}
      >
        {issueBucket && (
          <>
            <p className="text-[11px] mb-3" style={{ color: 'var(--app-text-faint)' }}>{locationIssueLabel(issueBucket)}</p>
            <div className="space-y-2">
              {issueBoxes.length === 0 && <p className="text-[11px] text-center py-8" style={{ color: 'var(--app-text-faint)' }}>No locations currently in this bucket.</p>}
              {issueBoxes.map((b) => (
                <div key={b.id} className="rounded-md p-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>{b.id}</span>
                    <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{zoneName(b.zoneId)}</span>
                  </div>
                  <div className="text-[10.5px] mb-2" style={{ color: 'var(--app-text-muted)' }}>{b.address}</div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => reviewLocationIssue(b.id)} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Review</button>
                    {issueBucket === 'pending' ? (
                      <button onClick={() => verifyLocation(b.id)} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Verify</button>
                    ) : (
                      <button onClick={() => resolveLocationIssue(b.id)} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Resolve</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Drawer>

      <Drawer open={!!selectedArea} onClose={() => setSelectedArea(null)} title={selectedArea?.name || ''} subtitle={selectedArea?.region}>
        {selectedArea && (
          <>
            <div className="flex items-center justify-between mb-4">
              <GenericBadge tone={SURVEY_STATUS_TONE[selectedArea.surveyStatus]}>{selectedArea.surveyStatus}</GenericBadge>
              <span className="font-mono text-[12px]" style={{ color: 'var(--app-text-muted)' }}>Coverage: <span style={{ color: 'var(--app-text)', fontWeight: 700 }}>{selectedArea.coveragePercentage}%</span></span>
            </div>
            <DrawerSection title="Registration & Mapping">
              <DetailRow label="Registered Boxes" value={selectedArea.totalRegisteredBoxes} />
              <DetailRow label="Mapped Boxes" value={selectedArea.mappedBoxes} />
              <DetailRow label="Location Accuracy" value={`${selectedArea.locationAccuracy}%`} />
              <DetailRow label="Geographic Coverage" value={`${selectedArea.coveragePercentage}%`} />
            </DrawerSection>
            <DrawerSection title="Compliance & Complaints">
              <DetailRow label="Non-Compliant Boxes" value={selectedArea.nonCompliant} />
              <DetailRow label="Open Complaints" value={selectedArea.openComplaints} />
            </DrawerSection>
            <DrawerSection title="Survey">
              <DetailRow label="Survey Status" value={selectedArea.surveyStatus} />
              <DetailRow label="Last Verified" value={formatDate(selectedArea.lastVerified)} />
              <DetailRow label="Assigned Team" value={selectedArea.assignedTeam} />
              <DetailRow label="Action Required" value={selectedArea.actionRequired} />
            </DrawerSection>
            <div className="flex gap-2">
              {renderAssignButton(`area-${selectedArea.id}`, selectedArea.name, selectedArea.assignedTeam, 'app-control-btn flex-1 py-2 text-[11px] font-semibold')}
              <button onClick={() => navigate('/inspections?tab=planning')} className="app-control-btn flex-1 py-2 text-[11px] font-semibold">Create Inspection Task</button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

function StatusStat({ color, label, value }) {
  return (
    <div className="flex items-center justify-between text-[11.5px]">
      <span className="flex items-center gap-2" style={{ color: 'var(--app-text-muted)' }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        {label}
      </span>
      <span className="font-mono font-semibold" style={{ color: 'var(--app-text)' }}>{value}</span>
    </div>
  );
}

function qualityTone(pct) {
  return pct >= 95 ? '#3d8560' : pct >= 85 ? '#b8893a' : '#a63f3f';
}

function QualityRow({ color, label, value, total, note, onClick }) {
  const pct = total ? (value / total) * 100 : 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="w-full text-left"
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-2 font-semibold" style={{ color: 'var(--app-text)' }}>
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
          {label}
        </span>
        <span className="font-mono flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
          {value.toLocaleString()} <span style={{ color: 'var(--app-text-faint)', fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
          {onClick && <span style={{ color: 'var(--app-accent)', fontSize: 10 }}>Review →</span>}
        </span>
      </div>
      <div className="h-1 mt-1.5 overflow-hidden" style={{ background: 'var(--app-surface-raised)' }}>
        <div className="h-full" style={{ width: `${Math.max(pct, value ? 1.5 : 0)}%`, background: color }} />
      </div>
      <div className="text-[10.5px] mt-1" style={{ color: 'var(--app-text-faint)' }}>{note}</div>
    </Tag>
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
