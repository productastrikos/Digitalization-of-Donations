import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../services/socket';
import { useAuth, ROLES, ROLE_KEYS } from '../services/access';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DataTable from '../components/DataTable';
import Drawer, { DetailRow, DrawerSection } from '../components/Drawer';
import { GenericBadge } from '../components/StatusBadge';
import { formatDateTime } from '../services/donationSeed';
import { buildAuditReport, exportReport, DISCLAIMER } from '../services/reportExport';
import PageSummary from '../components/PageSummary';
import { buildAuditChain, shortHash } from '../services/auditIntegrity';
import { runIntegrityChecks } from '../services/dataIntegrity';

// SIMULATED: demonstration user directory and integration health.
const USERS = [
  { id: 'USR-0101', name: 'Compliance Officer 02', role: 'compliance_officer', status: 'Active' },
  { id: 'USR-0102', name: 'Director, Compliance & Inspections', role: 'director', status: 'Active' },
  { id: 'USR-0103', name: 'Ahmed Al Mansoori', role: 'field_inspector', status: 'Active' },
  { id: 'USR-0104', name: 'System Administrator', role: 'administrator', status: 'Active' },
  { id: 'USR-0105', name: 'Logistics Coordinator', role: 'logistics_coordinator', status: 'Suspended' },
  { id: 'USR-0106', name: 'Internal Auditor', role: 'auditor', status: 'Active' },
];

const INTEGRATIONS = [
  { name: 'Field Inspection Application', status: 'Operational', lastSync: '2 min ago' },
  { name: 'DCD Registry Portal', status: 'Operational', lastSync: '4 min ago' },
  { name: 'DMT Integration', status: 'Operational', lastSync: '6 min ago' },
  { name: 'Automated Sync Engine', status: 'Operational', lastSync: '1 min ago' },
  { name: 'Fleet Operations Registry', status: 'Degraded', lastSync: '38 min ago' },
];

const TABS = [
  { key: 'access', label: 'Users & Access' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'integrity', label: 'Data Integrity' },
  { key: 'criteria', label: 'Compliance Criteria' },
];

const fmtState = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v !== 'object') return String(v);
  return Object.entries(v).map(([k, val]) => `${k}: ${Array.isArray(val) ? val.join('; ') : val}`).join(', ');
};

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'access';
  const { lastSync } = useData();

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Administration & Audit"
        subtitle="System configuration, user access management, and searchable audit history for the DCD Donation Control platform."
        lastUpdated={lastSync}
      />
      <Tabs tabs={TABS} active={tab} onChange={(k) => setParams({ tab: k })} />
      {tab === 'access' && <AccessTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'integrity' && <IntegrityTab />}
      {tab === 'criteria' && <CriteriaTab />}

      <PageSummary page={`admin-${tab}`} />
    </div>
  );
}

function Panel({ title, subtitle, children, actions }) {
  return (
    <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{title}</h3>
          {subtitle && <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

/* ── Users, roles, integrations ─────────────────────────────────────────── */
function AccessTab() {
  const { roleKey } = useAuth();
  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Panel title="User Management" subtitle="Platform users and role assignments (simulated directory)">
          <div className="p-3 space-y-1.5">
            {USERS.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-md px-3 py-2 text-[11.5px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--app-text)' }}>{u.name}</div>
                  <div style={{ color: 'var(--app-text-faint)' }}>{ROLES[u.role].label}</div>
                </div>
                <GenericBadge tone={u.status === 'Active' ? 'green' : 'red'}>{u.status}</GenericBadge>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Integration Health" subtitle="Data synchronization status across connected systems (simulated)">
          <div className="p-3 space-y-1.5">
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="flex items-center justify-between rounded-md px-3 py-2 text-[11.5px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div>
                  <div className="font-medium" style={{ color: 'var(--app-text)' }}>{i.name}</div>
                  <div style={{ color: 'var(--app-text-faint)' }}>Last sync: {i.lastSync}</div>
                </div>
                <GenericBadge tone={i.status === 'Operational' ? 'green' : 'amber'}>{i.status}</GenericBadge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
        Simulated: the user directory, roles and integration status are demonstration data. The Arabic interface strings are a working draft and need review by a native speaker before real use.
      </p>

      <Panel title="Roles and permissions" subtitle={`Access is enforced in the navigation, on each page and in the data layer. You are signed in as: ${ROLES[roleKey]?.label}`}>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {ROLE_KEYS.map((k) => (
            <div key={k} className="rounded-md p-3 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: k === roleKey ? '1px solid var(--app-accent-border)' : '1px solid var(--app-border)' }}>
              <div className="font-semibold" style={{ color: 'var(--app-text)' }}>{ROLES[k].label}{k === roleKey && <span style={{ color: 'var(--app-accent)', marginLeft: 6, fontSize: 9.5 }}>CURRENT</span>}</div>
              <div className="mt-1" style={{ color: 'var(--app-text-faint)', lineHeight: 1.5 }}>{ROLES[k].summary}</div>
            </div>
          ))}
        </div>
      </Panel>

      <SecurityPostureTab />
    </>
  );
}

/* ── Security posture: real controls vs. out-of-scope for a static demo ─── */
function SecurityPostureTab() {
  const { auditLog } = useData();
  const deniedAttempts = useMemo(() => auditLog.filter((a) => a.entityType === 'Security').length, [auditLog]);

  const controls = [
    { label: 'Role-based access control', status: 'active', detail: 'Every page, action and data-layer write checks the signed-in role before proceeding — see Roles and permissions above.' },
    { label: 'Denied-access attempts logged', status: 'active', detail: `${deniedAttempts} denied attempt${deniedAttempts === 1 ? '' : 's'} recorded this session — every blocked action is written to the audit log, not just shown as a toast.` },
    { label: 'Audit trail, hash-chained', status: 'active', detail: 'Every write is attributed and chained to a content hash of the entry before it — see the Audit Log tab for the verification panel.' },
    { label: 'Referential data integrity checks', status: 'active', detail: 'Cross-record relationships (violation ↔ inspection, inventory ↔ box, etc.) are checked live against current data — see the Data Integrity tab.' },
    { label: 'Session idle timeout', status: 'active', detail: 'An inactive session signs itself out automatically after a fixed period — see App-level session control.' },
    { label: 'Encryption in transit / at rest', status: 'n/a', detail: 'Not applicable in this environment: a static frontend demo has no server or database to secure. In production this sits with DCD\'s hosting/identity infrastructure, not the dashboard layer.' },
    { label: 'Centralized identity & authentication', status: 'n/a', detail: 'This demo uses a role switcher for evaluation. A real deployment would authenticate against DCD\'s identity provider (SSO/AD) before any role is granted.' },
  ];

  return (
    <Panel title="Security posture" subtitle="An honest accounting of what is genuinely enforced in this build versus what is out of scope for a frontend-only demo.">
      <div className="p-3 space-y-1.5">
        {controls.map((c) => (
          <div key={c.label} className="flex items-start justify-between gap-3 rounded-md px-3 py-2 text-[11.5px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
            <div>
              <div className="font-medium" style={{ color: 'var(--app-text)' }}>{c.label}</div>
              <div style={{ color: 'var(--app-text-faint)', lineHeight: 1.5, marginTop: 2 }}>{c.detail}</div>
            </div>
            <GenericBadge tone={c.status === 'active' ? 'green' : 'slate'}>{c.status === 'active' ? 'Enforced' : 'Out of scope'}</GenericBadge>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ── Audit log with filters and export ──────────────────────────────────── */
// The action text is free-form (e.g. "Inspection reassigned — INS-0042 →
// Team 3"), so the filterable "Action" is the category before the em-dash —
// stable across entities, unlike the full string which always carries an ID.
const actionCategory = (action) => (action || '').split(' — ')[0];

function AuditTab() {
  const { auditLog } = useData();
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [user, setUser] = useState('all');
  const [actionType, setActionType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);

  const chain = useMemo(() => buildAuditChain(auditLog), [auditLog]);
  const entityTypes = useMemo(() => Array.from(new Set(auditLog.map((a) => a.entityType).filter(Boolean))).sort(), [auditLog]);
  const users = useMemo(() => Array.from(new Set(auditLog.map((a) => a.user))).sort(), [auditLog]);
  const actionTypes = useMemo(() => Array.from(new Set(auditLog.map((a) => actionCategory(a.action)).filter(Boolean))).sort(), [auditLog]);

  const filtered = useMemo(() => auditLog.filter((a) => {
    if (entityType !== 'all' && a.entityType !== entityType) return false;
    if (user !== 'all' && a.user !== user) return false;
    if (actionType !== 'all' && actionCategory(a.action) !== actionType) return false;
    if (dateFrom && a.timestamp < `${dateFrom}T00:00:00`) return false;
    if (dateTo && a.timestamp > `${dateTo}T23:59:59`) return false;
    if (search && !`${a.action} ${a.user} ${a.entityId || ''} ${a.entityType || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [auditLog, entityType, user, actionType, dateFrom, dateTo, search]);

  if (!can('audit.view')) {
    return <Panel title="Audit Log"><p className="p-4 text-[12px]" style={{ color: 'var(--app-text-faint)' }}>Your role cannot view the audit log.</p></Panel>;
  }

  const columns = [
    { key: 'id', header: 'Log ID', render: (a) => <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{a.id}</span> },
    { key: 'timestamp', header: 'Timestamp', render: (a) => formatDateTime(a.timestamp), sortValue: (a) => a.timestamp },
    { key: 'user', header: 'User', render: (a) => <span>{a.user}{a.role && <span style={{ display: 'block', color: 'var(--app-text-faint)', fontSize: 10 }}>{a.role}</span>}</span>, sortValue: (a) => a.user },
    { key: 'entity', header: 'Entity', render: (a) => (a.entityId ? <span><span style={{ color: 'var(--app-text-faint)' }}>{a.entityType}</span> <span className="font-mono">{a.entityId}</span></span> : '—'), sortValue: (a) => a.entityId || '' },
    { key: 'action', header: 'Action', render: (a) => <span style={{ maxWidth: 240, display: 'inline-block' }}>{a.action}</span> },
    { key: 'change', header: 'Before → After', render: (a) => <span style={{ color: 'var(--app-text-muted)' }}>{fmtState(a.before ?? a.previousStatus)} → {fmtState(a.after ?? a.newStatus)}</span> },
    { key: 'source', header: 'Source', render: (a) => a.source, sortValue: (a) => a.source },
    { key: 'hash', header: 'Integrity Hash', render: (a) => <span className="font-mono" style={{ color: 'var(--app-text-faint)', fontSize: 10 }}>{shortHash(chain.byId.get(a.id)?.hash)}</span> },
  ];

  const filterText = `${filtered.length} of ${auditLog.length} entries`
    + `${entityType !== 'all' ? ` · ${entityType}` : ''}${user !== 'all' ? ` · ${user}` : ''}${actionType !== 'all' ? ` · ${actionType}` : ''}`
    + `${dateFrom || dateTo ? ` · ${dateFrom || 'earliest'} → ${dateTo || 'latest'}` : ''}${search ? ` · "${search}"` : ''}`;
  const doExport = (fmt) => exportReport(fmt, buildAuditReport(filtered, filterText));
  const dateFieldStyle = { background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)', colorScheme: 'dark' };

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: `1px solid ${chain.orderIntact ? 'var(--app-border)' : 'var(--app-danger-border)'}` }}>
        <GenericBadge tone={chain.orderIntact ? 'green' : 'red'}>{chain.orderIntact ? 'Chain verified' : 'Chain order anomaly'}</GenericBadge>
        <span style={{ color: 'var(--app-text-faint)' }}>
          {chain.count.toLocaleString()} entries hash-chained · each entry's hash is derived from its own content plus the previous entry's hash, so altering or reordering any past entry breaks every hash computed after it. Recomputed on every load from the current data — this is a demonstration integrity mechanism, not a cryptographic signature.
        </span>
      </div>
      <Panel
        title={`Audit Log (${filtered.length.toLocaleString()})`}
        subtitle="Every change records who, when, which entity, and its state before and after. Click a row for the full entry."
        actions={(
          <div className="flex items-center gap-2 flex-wrap">
            <div className="header-search" style={{ maxWidth: 220 }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, user, entity…" aria-label="Search audit log" />
            </div>
            <FilterSelect label="Entity" value={entityType} onChange={setEntityType} options={[{ label: 'All', value: 'all' }, ...entityTypes.map((e) => ({ label: e, value: e }))]} />
            <FilterSelect label="User" value={user} onChange={setUser} options={[{ label: 'All', value: 'all' }, ...users.map((u) => ({ label: u, value: u }))]} />
            <FilterSelect label="Action" value={actionType} onChange={setActionType} options={[{ label: 'All', value: 'all' }, ...actionTypes.map((a) => ({ label: a, value: a }))]} />
            <label className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              From
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md px-1.5 py-1 text-[11px]" style={dateFieldStyle} aria-label="Audit log date from" />
            </label>
            <label className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              To
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md px-1.5 py-1 text-[11px]" style={dateFieldStyle} aria-label="Audit log date to" />
            </label>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="app-control-btn px-2 py-1.5 text-[10.5px] font-semibold">Clear dates</button>
            )}
            {can('audit.export') && ['pdf', 'excel', 'csv'].map((f) => (
              <button key={f} onClick={() => doExport(f)} className="app-control-btn px-2.5 py-1.5 text-[10.5px] font-semibold uppercase">{f}</button>
            ))}
          </div>
        )}
      >
        <div className="p-4">
          <DataTable columns={columns} data={filtered} keyExtractor={(a) => a.id} onRowClick={setSelected} pageSize={16} />
        </div>
      </Panel>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.id || ''} subtitle="Audit entry" width={480}>
        {selected && (
          <>
            <DetailRow label="Timestamp" value={formatDateTime(selected.timestamp)} />
            <DetailRow label="User" value={selected.user} />
            <DetailRow label="Role" value={selected.role || '—'} />
            <DetailRow label="Entity" value={selected.entityId ? `${selected.entityType} · ${selected.entityId}` : '—'} />
            <DetailRow label="Action" value={selected.action} />
            <DetailRow label="Source" value={selected.source} />
            <DetailRow label="Integrity hash" value={<span className="font-mono">{chain.byId.get(selected.id)?.hash || '—'}</span>} />
            <DetailRow label="Chained from" value={<span className="font-mono">{shortHash(chain.byId.get(selected.id)?.prevHash)}</span>} />
            <DrawerSection title="Before">
              <pre className="rounded-md p-2.5 text-[11px] whitespace-pre-wrap" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>{JSON.stringify(selected.before ?? (selected.previousStatus ? { status: selected.previousStatus } : null), null, 2)}</pre>
            </DrawerSection>
            <DrawerSection title="After">
              <pre className="rounded-md p-2.5 text-[11px] whitespace-pre-wrap" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>{JSON.stringify(selected.after ?? (selected.newStatus ? { status: selected.newStatus } : null), null, 2)}</pre>
            </DrawerSection>
          </>
        )}
      </Drawer>
      <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{DISCLAIMER} Audit history is held in memory for this session.</p>
    </>
  );
}

/* ── Data integrity: live referential-integrity checks ──────────────────── */
function IntegrityTab() {
  const { boxes, inspections, violations, displacements, inventory, disposalRequests, cashDiscrepancies, complaints } = useData();
  const result = useMemo(
    () => runIntegrityChecks({ boxes, inspections, violations, displacements, inventory, disposalRequests, cashDiscrepancies, complaints }),
    [boxes, inspections, violations, displacements, inventory, disposalRequests, cashDiscrepancies, complaints],
  );

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: `1px solid ${result.allOk ? 'var(--app-border)' : 'var(--app-danger-border)'}` }}>
        <GenericBadge tone={result.allOk ? 'green' : 'red'}>{result.allOk ? 'All checks passing' : `${result.failingCount} check${result.failingCount === 1 ? '' : 's'} failing`}</GenericBadge>
        <span style={{ color: 'var(--app-text-faint)' }}>
          {result.totalChecks} cross-record integrity checks, recomputed live from the current dataset — not a static claim. Each row below queries the live data (boxes, inspections, violations, inventory, disposal requests, cash discrepancies, DMT alerts) directly.
        </span>
      </div>

      <Panel title="Referential integrity checks" subtitle="Every relationship the box lifecycle depends on, verified against current records.">
        <div className="p-3 space-y-1.5">
          {result.checks.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-md px-3 py-2 text-[11.5px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
              <div>
                <div className="font-medium" style={{ color: 'var(--app-text)' }}>{c.label}</div>
                <div style={{ color: 'var(--app-text-faint)', marginTop: 2 }}>
                  {c.passing.toLocaleString()} / {c.total.toLocaleString()} pass
                  {!c.ok && c.failingIds.length > 0 && <> — failing: <span className="font-mono">{c.failingIds.join(', ')}</span>{c.failing > c.failingIds.length ? ` (+${c.failing - c.failingIds.length} more)` : ''}</>}
                </div>
              </div>
              <GenericBadge tone={c.ok ? 'green' : 'red'}>{c.ok ? 'Pass' : `${c.failing} failing`}</GenericBadge>
            </div>
          ))}
        </div>
      </Panel>
      <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>These checks describe the invariants the transition gates in the data layer are designed to maintain (e.g. a violation cannot be created without a completed inspection). A failing check here would mean live data has drifted from that guarantee.</p>
    </>
  );
}

/* ── Compliance criteria editor ─────────────────────────────────────────── */
function CriteriaTab() {
  const { criteria, passMark, saveCriterion, setCriterionActive, updatePassMark } = useData();
  const { can } = useAuth();
  const canEdit = can('criteria.edit');
  const [draft, setDraft] = useState(null);
  const [pass, setPass] = useState(passMark);
  const activeWeight = criteria.filter((c) => c.active).reduce((s, c) => s + c.weight, 0);

  const startNew = () => setDraft({ title: '', description: '', weight: 5, mandatory: false });
  const submit = () => { if (saveCriterion(draft)) setDraft(null); };
  const field = 'rounded-md px-2 py-1.5 text-[11px] w-full';
  const fieldStyle = { background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' };

  return (
    <>
      <Panel
        title="Compliance criteria"
        subtitle="Inspections are scored against this checklist. The score is the weighted share of criteria passed; an inspection fails if any mandatory criterion fails or the score is below the pass mark."
        actions={canEdit && <button onClick={startNew} className="app-control-btn px-3 py-1.5 text-[11px] font-semibold">Add criterion</button>}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <label className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
              Pass mark (score out of 100)
              <input type="number" min={1} max={100} value={pass} disabled={!canEdit} onChange={(e) => setPass(e.target.value)} className={`${field} block mt-1`} style={{ ...fieldStyle, width: 110 }} />
            </label>
            {canEdit && <button onClick={() => updatePassMark(pass)} className="app-control-btn px-3 py-1.5 text-[11px] font-semibold">Save pass mark</button>}
            <span className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>Active weight: <strong style={{ color: 'var(--app-text)' }}>{activeWeight}</strong> (scores are normalised, so weights need not total 100)</span>
          </div>

          {draft && (
            <div className="rounded-md p-3 space-y-2" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-accent-border)' }}>
              <div className="text-[11px] font-semibold" style={{ color: 'var(--app-text)' }}>{draft.id ? `Edit ${draft.id}` : 'New criterion'}</div>
              <input className={field} style={fieldStyle} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Criterion title" />
              <input className={field} style={fieldStyle} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} aria-label="Criterion description" />
              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Weight
                  <input type="number" min={1} max={100} value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} className={`${field} block mt-1`} style={{ ...fieldStyle, width: 90 }} />
                </label>
                <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  <input type="checkbox" checked={!!draft.mandatory} onChange={(e) => setDraft({ ...draft, mandatory: e.target.checked })} /> Mandatory (failing it fails the inspection)
                </label>
                <div className="ml-auto flex gap-2">
                  <button onClick={submit} className="app-control-btn px-3 py-1.5 text-[11px] font-semibold">Save</button>
                  <button onClick={() => setDraft(null)} className="app-control-btn px-3 py-1.5 text-[11px] font-semibold">Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--app-border)' }}>
            <table className="w-full border-collapse" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--app-surface-soft)', borderBottom: '1px solid var(--app-border)' }}>
                  {['ID', 'Criterion', 'Weight', 'Mandatory', 'Status', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--app-text-faint)', textAlign: 'start' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criteria.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--app-border-soft)', opacity: c.active ? 1 : 0.55 }}>
                    <td style={{ padding: '8px 12px' }} className="font-mono">{c.id}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ color: 'var(--app-text)', fontWeight: 600 }}>{c.title}</div>
                      <div style={{ color: 'var(--app-text-faint)', fontSize: 11 }}>{c.description}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }} className="font-mono">{c.weight}</td>
                    <td style={{ padding: '8px 12px' }}>{c.mandatory ? <GenericBadge tone="amber">Mandatory</GenericBadge> : '—'}</td>
                    <td style={{ padding: '8px 12px' }}><GenericBadge tone={c.active ? 'green' : 'slate'}>{c.active ? 'Active' : 'Retired'}</GenericBadge></td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      {canEdit && (
                        <div className="flex gap-1.5">
                          <button onClick={() => setDraft({ ...c })} className="app-control-btn px-2 py-1 text-[10px] font-semibold">Edit</button>
                          <button onClick={() => setCriterionActive(c.id, !c.active)} className="app-control-btn px-2 py-1 text-[10px] font-semibold">{c.active ? 'Retire' : 'Activate'}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            Retiring a criterion never changes the score of past inspections. New criteria apply to inspections recorded from now on. {!canEdit && 'Your role can view but not edit the criteria.'}
          </p>
        </div>
      </Panel>
      <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{DISCLAIMER} The default criteria and weights are illustrative.</p>
    </>
  );
}
