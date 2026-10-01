import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { useData } from '../services/socket';
import { chartTooltip, axisTitle, gridLine, themeColor, HBAR_INTERACTION } from '../components/chartUtils';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Drawer, { DetailRow } from '../components/Drawer';
import { GenericBadge } from '../components/StatusBadge';
import KPICard, { IcoPeople, IcoCheck, IcoAlert, IcoShield, IcoLock } from '../components/KPICard';
import OrgRecordsDrawer from '../components/OrgRecordsDrawer';
import { buildOrganizationKPIs } from '../services/donationKpis';
import { kpiToCardProps } from '../services/kpiAdapter';
import { formatDate } from '../services/donationSeed';
import { buildOrgRiskProfiles, buildFlaggedOrganizations, buildOrgActivityFeed } from '../services/orgRisk';
import { SEM } from '../services/palette';
import PageSummary from '../components/PageSummary';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const KPI_ICONS = [IcoPeople, IcoCheck, IcoAlert, IcoShield, IcoLock];
const COLOR_TEAL = SEM.normal;
const COLOR_AMBER = SEM.warning;
const COLOR_RED = SEM.critical;

const RISK_TONE = { High: 'red', Medium: 'amber', Low: 'cyan' };
// active (blue: live licence) ≠ Verified (green: confirmed). Red is reserved for the critical states.
const OWNERSHIP_TONE = { Verified: 'green', Pending: 'cyan', Unverified: 'amber' };
const REG_STATUS_TONE = { active: 'cyan', pending: 'slate', suspended: 'red', expired: 'amber' };
const ACTIVITY_DOT_COLOR = { red: COLOR_RED, amber: COLOR_AMBER, cyan: COLOR_TEAL };

const REVIEW_OFFICERS = ['Compliance Officer 02', 'Compliance Officer 05', 'Director, Compliance & Inspections'];
const REVIEW_TONE = { assigned: 'amber', 'in-progress': 'cyan', completed: 'green' };

const ACTION_FILTER_LABEL = {
  all: 'All flagged organizations',
  violations: 'Organizations with open violations',
  ownership: 'Organizations with unverified ownership',
};

export default function Organizations() {
  const { organizations, boxes, violations, lastSync, openKpiDrawer, orgReviews, assignOrgReview, advanceOrgReview, createOrgInspection } = useData();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [reviewOfficer, setReviewOfficer] = useState(REVIEW_OFFICERS[0]);
  const [reviewPriority, setReviewPriority] = useState('priority');
  const [reviewNote, setReviewNote] = useState('');
  const [activeOrgKpi, setActiveOrgKpi] = useState(null);
  const [actionFilter, setActionFilter] = useState('all');

  const [regStatusFilter, setRegStatusFilter] = useState('all');
  const [complianceRangeFilter, setComplianceRangeFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [expiryWindowFilter, setExpiryWindowFilter] = useState('all');

  const actionPanelRef = useRef(null);

  const kpis = useMemo(() => buildOrganizationKPIs(organizations, violations), [organizations, violations]);
  const profiles = useMemo(() => buildOrgRiskProfiles(organizations, violations), [organizations, violations]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const flaggedOrgs = useMemo(() => buildFlaggedOrganizations(profiles), [profiles]);
  const activityFeed = useMemo(() => buildOrgActivityFeed(profiles), [profiles]);

  const filteredFlagged = useMemo(() => {
    if (actionFilter === 'violations') return flaggedOrgs.filter((o) => o.openViolations > 0);
    if (actionFilter === 'ownership') return flaggedOrgs.filter((o) => o.ownershipStatus !== 'Verified');
    return flaggedOrgs;
  }, [flaggedOrgs, actionFilter]);

  const selectedOpenViolations = useMemo(
    () => (selected ? violations.filter((v) => v.organizationId === selected.id && v.status !== 'resolved') : []),
    [selected, violations],
  );

  function selectOrgById(org) {
    setActiveOrgKpi(null);
    setSelected(profileById.get(org.id) || org);
  }

  function scrollToAction(filterKey) {
    setActionFilter(filterKey);
    actionPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Capped to the most-flagged organizations — the register table below
  // already lists every organization with an open violation.
  const VIOLATION_CHART_LIMIT = 8;
  const violationChartData = useMemo(() => {
    const withViolations = [...organizations].filter((o) => o.openViolations > 0).sort((a, b) => b.openViolations - a.openViolations).slice(0, VIOLATION_CHART_LIMIT);
    return {
      labels: withViolations.map((o) => o.name),
      datasets: [{
        label: 'Open Violations',
        data: withViolations.map((o) => o.openViolations),
        backgroundColor: withViolations.map((o) => (o.openViolations > 8 ? COLOR_RED : o.openViolations >= 5 ? COLOR_AMBER : COLOR_TEAL)),
        borderRadius: 4, maxBarThickness: 20,
      }],
    };
  }, [organizations]);

  const tableColumns = useMemo(() => [
    { key: 'name', header: 'Organization Name', render: (o) => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: 'var(--app-text)' }}>{o.name}</span>, sortValue: (o) => o.name },
    { key: 'license', header: 'License Number', render: (o) => <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{o.licenseNumber}</span> },
    { key: 'status', header: 'Registration Status', render: (o) => <GenericBadge tone={REG_STATUS_TONE[o.registrationStatus]}>{o.registrationStatus}</GenericBadge>, sortValue: (o) => o.registrationStatus },
    { key: 'boxes', header: 'Registered Boxes', render: (o) => <span className="font-mono">{o.registeredBoxes}</span>, sortValue: (o) => o.registeredBoxes },
    { key: 'score', header: 'Compliance Score', render: (o) => <span className="font-mono font-semibold" style={{ color: 'var(--app-text)' }}>{o.complianceScore}</span>, sortValue: (o) => o.complianceScore },
    { key: 'violations', header: 'Open Violations', render: (o) => <span className="font-mono">{o.openViolations}</span>, sortValue: (o) => o.openViolations },
    { key: 'ownership', header: 'Ownership Status', render: (o) => <GenericBadge tone={OWNERSHIP_TONE[o.ownershipStatus]}>{o.ownershipStatus}</GenericBadge>, sortValue: (o) => o.ownershipStatus },
    { key: 'expiry', header: 'License Expiry', render: (o) => formatDate(o.licenseExpiryDate), sortValue: (o) => o.licenseExpiryDate },
    { key: 'lastInspection', header: 'Last Inspection', render: (o) => formatDate(o.lastInspection), sortValue: (o) => o.lastInspection },
  ], []);

  const filteredTableData = useMemo(() => profiles.filter((o) => {
    if (regStatusFilter !== 'all' && o.registrationStatus !== regStatusFilter) return false;
    if (complianceRangeFilter === 'high' && o.complianceScore < 90) return false;
    if (complianceRangeFilter === 'warning' && (o.complianceScore < 75 || o.complianceScore >= 90)) return false;
    if (complianceRangeFilter === 'critical' && o.complianceScore >= 75) return false;
    if (ownershipFilter !== 'all' && o.ownershipStatus !== ownershipFilter) return false;
    if (expiryWindowFilter !== 'all' && o.daysToExpiry > Number(expiryWindowFilter)) return false;
    return true;
  }), [profiles, regStatusFilter, complianceRangeFilter, ownershipFilter, expiryWindowFilter]);

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Organizations & Ownership"
        subtitle="Regulatory oversight of licensed organizations authorized to operate donation collection boxes."
        lastUpdated={lastSync}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {kpis.map((kpi, idx) => {
          const Icon = KPI_ICONS[idx];
          const handlers = {
            'registered-orgs': () => setActiveOrgKpi('registered-orgs'),
            'active-orgs': () => setActiveOrgKpi('active-orgs'),
            'orgs-with-violations': () => scrollToAction('violations'),
            'avg-org-compliance': () => openKpiDrawer('organizations', kpi.id),
            'unverified-ownership': () => scrollToAction('ownership'),
          };
          return <KPICard key={kpi.id} icon={<Icon />} {...kpiToCardProps(kpi, { onClick: handlers[kpi.id] })} />;
        })}
      </div>

      <OrgRecordsDrawer
        kpiId={activeOrgKpi}
        organizations={organizations}
        profiles={flaggedOrgs}
        onClose={() => setActiveOrgKpi(null)}
        onSelectOrg={selectOrgById}
      />

      {/* ── Organizations Requiring Action ──────────────────────────────── */}
      <div ref={actionPanelRef} className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Organizations Requiring Action ({filteredFlagged.length})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Organizations currently flagged critical or warning, ranked by risk</p>
          </div>
          {actionFilter !== 'all' && (
            <button onClick={() => setActionFilter('all')} className="app-control-btn flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px] font-semibold">
              {ACTION_FILTER_LABEL[actionFilter]}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <div className="p-3 space-y-2">
          {filteredFlagged.length === 0 && (
            <p className="text-[11.5px] text-center py-6" style={{ color: 'var(--app-text-faint)' }}>No organizations currently match this filter.</p>
          )}
          {filteredFlagged.slice(0, 6).map((org) => (
            <div key={org.id} className="flex items-center gap-3 rounded-md px-3 py-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: `var(--app-${org.riskTier === 'High' ? 'danger' : org.riskTier === 'Medium' ? 'warning' : 'info'})` }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>{org.name}</span>
                  <GenericBadge tone={RISK_TONE[org.riskTier]} className={org.riskTier === 'High' ? 'badge-blink-red' : ''}>{org.riskTier} Risk</GenericBadge>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{org.primaryReason}</p>
              </div>
              <button onClick={() => setSelected(org)} className="app-control-btn px-2.5 py-1.5 text-[10.5px] font-semibold shrink-0">View Details</button>
            </div>
          ))}
          {filteredFlagged.length > 6 && (
            <button onClick={() => setActiveOrgKpi('flagged-orgs')} className="w-full text-center text-[11px] font-semibold py-2" style={{ color: 'var(--app-accent)' }}>
              View All Flagged Organizations ({filteredFlagged.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Violation count chart + activity feed ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Organizations by Violation Count</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Top {VIOLATION_CHART_LIMIT} organizations by open violations — full list below</p>
          </div>
          <div className="p-4">
            <div style={{ height: 200 }}>
              <Bar
                data={violationChartData}
                options={{
                  indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                  interaction: HBAR_INTERACTION,
                  plugins: { legend: { display: false }, tooltip: chartTooltip() },
                  scales: {
                    x: { grid: gridLine(), ticks: { color: themeColor('--app-text'), font: { size: 10 } }, title: axisTitle('Open Violations') },
                    y: { grid: { display: false }, ticks: { color: themeColor('--app-text'), font: { size: 10, weight: '500' } } },
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-app-border">
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Recent Activity / Audit Log</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Latest organization-level regulatory events</p>
          </div>
          <div className="p-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: 340 }}>
            {activityFeed.slice(0, 20).map((e) => (
              <div key={e.id} className="flex items-start gap-2.5 rounded-md px-2.5 py-2" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: ACTIVITY_DOT_COLOR[e.tone] }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{e.org}</span>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--app-text-faint)' }}>{formatDate(e.timestamp)}</span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{e.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Registered Organizations table ───────────────────────────────── */}
      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Registered Organizations ({filteredTableData.length})</h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Click a record to open the organization profile</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterSelect label="Registration Status" value={regStatusFilter} onChange={setRegStatusFilter} options={[
              { label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Pending', value: 'pending' }, { label: 'Suspended', value: 'suspended' }, { label: 'Expired', value: 'expired' },
            ]} />
            <FilterSelect label="Compliance Score" value={complianceRangeFilter} onChange={setComplianceRangeFilter} options={[
              { label: 'All', value: 'all' }, { label: '≥ 90 (Normal)', value: 'high' }, { label: '75–89 (Warning)', value: 'warning' }, { label: '< 75 (Critical)', value: 'critical' },
            ]} />
            <FilterSelect label="Ownership Status" value={ownershipFilter} onChange={setOwnershipFilter} options={[
              { label: 'All', value: 'all' }, { label: 'Verified', value: 'Verified' }, { label: 'Pending', value: 'Pending' }, { label: 'Unverified', value: 'Unverified' },
            ]} />
            <FilterSelect label="License Expiry" value={expiryWindowFilter} onChange={setExpiryWindowFilter} options={[
              { label: 'All', value: 'all' }, { label: 'Next 30 Days', value: '30' }, { label: 'Next 60 Days', value: '60' }, { label: 'Next 90 Days', value: '90' },
            ]} />
          </div>
        </div>
        <div className="p-4">
          <DataTable columns={tableColumns} data={filteredTableData} keyExtractor={(o) => o.id} onRowClick={setSelected} pageSize={18} />
        </div>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} subtitle={selected?.licenseNumber}>
        {selected && (
          <>
            <div className="mb-4">
              <DetailRow label="Registration Status" value={<span className="capitalize">{selected.registrationStatus}</span>} />
              <DetailRow label="Approved Activities" value={selected.approvedActivities.join(', ')} />
              <DetailRow label="Registered Boxes" value={selected.registeredBoxes} />
              <DetailRow label="Compliance Score" value={`${selected.complianceScore}/100`} />
              <DetailRow label="Open Violations" value={selectedOpenViolations.length} />
              {selected.ownershipStatus && <DetailRow label="Ownership Status" value={selected.ownershipStatus} />}
              {selected.licenseExpiryDate && <DetailRow label="License Expiry" value={formatDate(selected.licenseExpiryDate)} />}
              <DetailRow label="Last Inspection" value={formatDate(selected.lastInspection)} />
            </div>
            <div className="mb-4 rounded-md p-3 space-y-2" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Assign &amp; Investigate</div>
              <div className="grid grid-cols-2 gap-2">
                <select value={reviewOfficer} onChange={(e) => setReviewOfficer(e.target.value)} aria-label="Reviewing officer" className="rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
                  {REVIEW_OFFICERS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={reviewPriority} onChange={(e) => setReviewPriority(e.target.value)} aria-label="Review priority" className="rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
                  <option value="routine">Routine</option><option value="priority">Priority</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Review note (optional)" className="w-full rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { assignOrgReview({ orgId: selected.id, officer: reviewOfficer, priority: reviewPriority, note: reviewNote }); setReviewNote(''); }} className="app-control-btn py-1.5 text-[11px] font-semibold">Assign Compliance Review</button>
                <button onClick={() => createOrgInspection(selected.id)} className="app-control-btn py-1.5 text-[11px] font-semibold">Create Inspection Task</button>
                <button onClick={() => { setSelected(null); navigate('/compliance?tab=violations'); }} className="app-control-btn py-1.5 text-[11px] font-semibold col-span-2">View Violations Register</button>
              </div>
              {orgReviews.filter((r) => r.orgId === selected.id).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {orgReviews.filter((r) => r.orgId === selected.id).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)' }}>
                      <span style={{ color: 'var(--app-text-muted)' }}><span className="font-mono">{r.id}</span> · {r.assignee}</span>
                      <span className="flex items-center gap-1.5">
                        <GenericBadge tone={REVIEW_TONE[r.status]}>{r.status.replace('-', ' ')}</GenericBadge>
                        {r.status !== 'completed' && <button onClick={() => advanceOrgReview(r.id)} className="app-control-btn px-2 py-0.5 text-[10px] font-semibold">{r.status === 'assigned' ? 'Start' : 'Complete'}</button>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Contact</h4>
            <div className="mb-4">
              <DetailRow label="Contact Name" value={selected.contactName} />
              <DetailRow label="Phone" value={selected.contactPhone} />
              <DetailRow label="Email" value={selected.contactEmail} />
            </div>
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>
              Registered Boxes ({boxes.filter((b) => b.organizationId === selected.id).length})
            </h4>
            <div className="space-y-1.5 mb-4">
              {boxes.filter((b) => b.organizationId === selected.id).slice(0, 8).map((b) => (
                <div key={b.id} onClick={() => { setSelected(null); navigate(`/registry?box=${b.id}`); }} title="Open in Registry" className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', cursor: 'pointer' }}>
                  <span className="font-mono" style={{ color: 'var(--app-text-muted)' }}>{b.id}</span>
                  <span className="capitalize" style={{ color: 'var(--app-text-faint)' }}>{b.status.replace('-', ' ')}</span>
                </div>
              ))}
            </div>
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>
              Open Violations ({selectedOpenViolations.length})
            </h4>
            <div className="space-y-1.5">
              {selectedOpenViolations.slice(0, 6).map((v) => (
                <div key={v.id} onClick={() => { setSelected(null); navigate(`/registry?box=${v.boxId}`); }} title="Open in Registry" className="rounded-md px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)', cursor: 'pointer' }}>
                  {v.category} — {v.boxId}
                </div>
              ))}
            </div>
          </>
        )}
      </Drawer>

      <PageSummary page="organizations" />
    </div>
  );
}
