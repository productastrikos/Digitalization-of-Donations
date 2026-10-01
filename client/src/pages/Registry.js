import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../services/socket';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import DataTable from '../components/DataTable';
import { BoxStatusBadge } from '../components/StatusBadge';
import BoxDetailDrawer from '../components/BoxDetailDrawer';
import QRLabelSheet from '../components/QRLabelSheet';
import { useAuth } from '../services/access';
import { findBoxFromScan } from '../services/qr';
import { LIFECYCLE_STAGES, STAGE_BY_KEY, buildLifecycleIndex, lifecycleStageOf } from '../services/boxLifecycle';
import { ZONES, zoneById, formatDate } from '../services/donationSeed';
import PageSummary from '../components/PageSummary';

const COLOR_TEAL = '#2dd4bf';
const COLOR_AMBER = '#f5a623';
const COLOR_RED = '#e5484d';
const COLOR_MUTED = '#64748b';

function scoreColor(score) {
  if (score >= 90) return COLOR_TEAL;
  if (score >= 75) return COLOR_AMBER;
  return COLOR_RED;
}

/** "in N days" for a future date, "N days overdue" for a past one. */
function actionTiming(nextInspection) {
  const diffDays = Math.ceil((new Date(nextInspection).getTime() - Date.now()) / 86400000);
  if (diffDays >= 0) return { text: `in ${diffDays} day${diffDays === 1 ? '' : 's'}`, overdue: false };
  const abs = Math.abs(diffDays);
  return { text: `${abs} day${abs === 1 ? '' : 's'} overdue`, overdue: true };
}

function ScoreHeader() {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      Score
      <span
        style={{ position: 'relative', display: 'inline-flex', opacity: 0.7, cursor: 'help' }}
        onMouseEnter={(e) => { e.stopPropagation(); setShow(true); }}
        onMouseLeave={(e) => { e.stopPropagation(); setShow(false); }}
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4m0-4h.01" />
        </svg>
        {show && (
          <div style={{
            position: 'absolute', top: '16px', left: 0, zIndex: 30, width: '150px',
            background: 'var(--app-panel)', border: '1px solid var(--app-border)', borderRadius: '8px',
            padding: '8px 10px', fontSize: '10px', lineHeight: 1.6, fontWeight: 400, textTransform: 'none', letterSpacing: 0,
            boxShadow: 'var(--app-shadow-lg)', whiteSpace: 'normal',
          }}>
            <div className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR_TEAL }} /><span style={{ color: 'var(--app-text-muted)' }}>≥ 90 Normal</span></div>
            <div className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR_AMBER }} /><span style={{ color: 'var(--app-text-muted)' }}>75–89 Warning</span></div>
            <div className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR_RED }} /><span style={{ color: 'var(--app-text-muted)' }}>&lt; 75 Critical</span></div>
          </div>
        )}
      </span>
    </span>
  );
}

export default function Registry() {
  const { boxes, organizations, inventory, displacements, lastSync, pushToast } = useData();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(params.get('status') || 'all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [needsActionOnly, setNeedsActionOnly] = useState(false);
  const [selectedBox, setSelectedBox] = useState(null);
  const [sort, setSort] = useState(null);
  const [stageFilter, setStageFilter] = useState(params.get('stage') || 'all');
  const [scanValue, setScanValue] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const lifecycleIndex = useMemo(() => buildLifecycleIndex({ inventory, displacements }), [inventory, displacements]);
  const openRemovalByBox = useMemo(() => {
    const m = new Map();
    displacements.forEach((d) => { if (d.status !== 'completed') m.set(d.boxId, d); });
    return m;
  }, [displacements]);

  // A scanned QR code opens /registry?box=DCD-xxxxx
  const boxParam = params.get('box');
  useEffect(() => {
    if (!boxParam) return;
    const found = findBoxFromScan(boxParam, boxes);
    if (found) setSelectedBox(found);
    else pushToast({ level: 'warning', title: 'Box not found', message: `No registered box matches "${boxParam}".` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxParam]);

  function closeBox() {
    setSelectedBox(null);
    if (params.get('box')) { const next = new URLSearchParams(params); next.delete('box'); setParams(next); }
  }
  function onScan(e) {
    e.preventDefault();
    const found = findBoxFromScan(scanValue, boxes);
    if (found) { setSelectedBox(found); setScanValue(''); } else pushToast({ level: 'warning', title: 'Box not found', message: `No registered box matches "${scanValue.trim()}".` });
  }

  const orgName = (id) => organizations.find((o) => o.id === id)?.name || 'Unknown Organization';
  const needsAction = (b) => b.complianceScore < 75 || b.currentAction !== 'Routine Monitoring';

  const filtered = useMemo(() => boxes.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (zoneFilter !== 'all' && b.zoneId !== zoneFilter) return false;
    if (stageFilter !== 'all' && lifecycleStageOf(b, lifecycleIndex) !== stageFilter) return false;
    if (needsActionOnly && !needsAction(b)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${b.id} ${b.qrCode} ${b.address} ${orgName(b.organizationId)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [boxes, statusFilter, zoneFilter, stageFilter, lifecycleIndex, needsActionOnly, search, organizations]);

  const needsActionCount = useMemo(() => boxes.filter(needsAction).length, [boxes]);

  const columns = [
    { key: 'id', header: 'Box ID', render: (b) => <span className="font-mono font-medium" style={{ color: 'var(--app-text)' }}>{b.id}</span>, sortValue: (b) => b.id, width: 100 },
    { key: 'qr', header: 'QR Code', render: (b) => <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{b.qrCode}</span>, width: 100 },
    { key: 'location', header: 'Location', render: (b) => <span style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.address}</span> },
    { key: 'zone', header: 'Zone', render: (b) => zoneById(b.zoneId)?.name || b.zoneId, sortValue: (b) => zoneById(b.zoneId)?.name || '' },
    { key: 'org', header: 'Organization / Owner', render: (b) => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{orgName(b.organizationId)}</span> },
    { key: 'type', header: 'Box Type', render: (b) => b.boxType },
    { key: 'status', header: 'Compliance Status', render: (b) => <BoxStatusBadge status={b.status} removal={openRemovalByBox.get(b.id)} />, sortValue: (b) => b.status },
    {
      key: 'stage', header: 'Lifecycle',
      render: (b) => { const st = STAGE_BY_KEY[lifecycleStageOf(b, lifecycleIndex)]; return <span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span>; },
      sortValue: (b) => LIFECYCLE_STAGES.findIndex((x) => x.key === lifecycleStageOf(b, lifecycleIndex)),
    },
    { key: 'lastInspection', header: 'Last Inspection', render: (b) => formatDate(b.lastInspection), sortValue: (b) => b.lastInspection },
    {
      key: 'score', header: <ScoreHeader />,
      render: (b) => <span className="font-mono font-semibold" style={{ color: scoreColor(b.complianceScore) }}>{b.complianceScore}</span>,
      sortValue: (b) => b.complianceScore,
    },
    {
      key: 'action', header: 'Next Action',
      render: (b) => {
        if (b.currentAction === 'Routine Monitoring') {
          return <span style={{ color: COLOR_MUTED, fontWeight: 400 }}>{b.currentAction}</span>;
        }
        const { text, overdue } = actionTiming(b.nextInspection);
        const color = overdue || b.status === 'non-compliant' ? COLOR_RED : COLOR_AMBER;
        return (
          <span style={{ color, fontWeight: 600 }}>
            {b.currentAction} <span style={{ fontWeight: 500, opacity: 0.85 }}>— {text}</span>
          </span>
        );
      },
    },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Donation Box Registry"
        subtitle="Centralized registry of all donation boxes under DCD monitoring across the Emirate of Abu Dhabi."
        lastUpdated={lastSync}
        filters={
          <>
            <div className="header-search" style={{ maxWidth: 260 }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search box ID, QR, location, organization…" />
            </div>
            <FilterSelect
              label="Status" value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setParams(v === 'all' ? {} : { status: v }); }}
              options={[
                { label: 'All', value: 'all' }, { label: 'Compliant', value: 'compliant' }, { label: 'Non-Compliant', value: 'non-compliant' },
                { label: 'Under Inspection', value: 'under-inspection' }, { label: 'Pending Displacement', value: 'pending-displacement' },
                { label: 'Safekeeping', value: 'safekeeping' }, { label: 'Unverified', value: 'unknown' },
              ]}
            />
            <form onSubmit={onScan} className="header-search" style={{ maxWidth: 240 }}>
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 2v-2" /></svg>
              <input value={scanValue} onChange={(e) => setScanValue(e.target.value)} placeholder="Scan or enter QR / Box ID" aria-label="Scan or look up a box by QR code or Box ID" />
            </form>
            <FilterSelect label="Stage" value={stageFilter} onChange={setStageFilter} options={[{ label: 'All', value: 'all' }, ...LIFECYCLE_STAGES.map((st) => ({ label: st.label, value: st.key }))]} />
            <FilterSelect label="Zone" value={zoneFilter} onChange={setZoneFilter} options={[{ label: 'All Zones', value: 'all' }, ...ZONES.map((z) => ({ label: z.name, value: z.id }))]} />
            <button
              onClick={() => setNeedsActionOnly((v) => !v)}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition-colors flex items-center gap-1.5"
              style={needsActionOnly
                ? { background: 'var(--app-accent-bg)', borderColor: 'var(--app-accent-border)', color: 'var(--app-accent)' }
                : { background: 'var(--app-surface-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text-faint)' }}
            >
              Needs Action
              <span className="font-mono" style={{ fontSize: '10px', opacity: 0.8 }}>({needsActionCount})</span>
            </button>
            <button
              onClick={() => setSort({ key: 'score', dir: 1 })}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition-colors"
              style={sort?.key === 'score' && sort.dir === 1
                ? { background: 'var(--app-accent-bg)', borderColor: 'var(--app-accent-border)', color: 'var(--app-accent)' }
                : { background: 'var(--app-surface-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text-faint)' }}
            >
              Score (Lowest First)
            </button>
            {can('qr.print') && (
              <button onClick={() => setShowLabels(true)} className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition-colors" style={{ background: 'var(--app-surface-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                Print QR labels ({filtered.length.toLocaleString()})
              </button>
            )}
          </>
        }
      />

      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border">
          <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>Registered Boxes ({filtered.length.toLocaleString()})</h3>
          <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Click a record to open the full donation box profile</p>
        </div>
        <div className="p-4">
          <DataTable columns={columns} data={filtered} keyExtractor={(b) => b.id} onRowClick={setSelectedBox} pageSize={18} sort={sort} onSortChange={setSort} stickyHeader />
        </div>
      </div>

      <BoxDetailDrawer box={selectedBox} onClose={closeBox} />
      <QRLabelSheet open={showLabels} onClose={() => setShowLabels(false)} boxes={filtered} title="QR label sheet" />

      <PageSummary page="registry" />
    </div>
  );
}
