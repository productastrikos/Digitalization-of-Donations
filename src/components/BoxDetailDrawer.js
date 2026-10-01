import React, { useMemo, useState } from 'react';
import Drawer, { DetailRow, DrawerSection } from './Drawer';
import { BoxStatusBadge, SeverityBadge, InspectionStatusBadge } from './StatusBadge';
import { EvidenceGallery } from './InspectionDetailDrawer';
import QRImage from './QRImage';
import QRLabelSheet from './QRLabelSheet';
import { useData } from '../services/socket';
import { useAuth } from '../services/access';
import { boxQrUrl } from '../services/qr';
import { LIFECYCLE_STAGES, buildLifecycleIndex, lifecycleStageOf, buildBoxHistory } from '../services/boxLifecycle';
import { ValueLedgerSection, CashDiscrepancyWorkflow } from './CashDiscrepancy';
import { GenericBadge } from './StatusBadge';
import { zoneById, formatDate, formatDateTime, LOGISTICS_TEAMS, VEHICLES, FACILITIES } from '../services/donationSeed';

const KIND_COLOR = {
  registry: '#64748b', inspection: '#3f6f9e', violation: '#a63f3f', resolved: '#3d8560', displacement: '#b8663a',
  custody: '#7a6f9e', disposal: '#b8893a', audit: '#475569',
};

export default function BoxDetailDrawer({ box, onClose }) {
  const { organizations, inspections, violations, displacements, inventory, disposalRequests, auditLog, inspectors, approveRemoval } = useData();
  const { can } = useAuth();
  const [showLabel, setShowLabel] = useState(false);
  const [tab, setTab] = useState('overview');
  const [removalTeam, setRemovalTeam] = useState(LOGISTICS_TEAMS[0]);
  const [removalVehicle, setRemovalVehicle] = useState(VEHICLES[0]);
  const [removalFacility, setRemovalFacility] = useState(FACILITIES[0]);

  const lifecycleIndex = useMemo(() => buildLifecycleIndex({ inventory, displacements }), [inventory, displacements]);
  const history = useMemo(
    () => (box ? buildBoxHistory(box, { inspections, violations, displacements, inventory, disposalRequests, auditLog, inspectors }) : []),
    [box, inspections, violations, displacements, inventory, disposalRequests, auditLog, inspectors],
  );
  if (!box) return null;

  const openRemoval = displacements.find((d) => d.boxId === box.id && d.status !== 'completed');
  const canApproveRemoval = box.status === 'non-compliant' && !openRemoval;

  const org = organizations.find((o) => o.id === box.organizationId);
  const boxInventoryItem = inventory.find((i) => i.boxId === box.id && i.valueLedger);
  const boxInspections = inspections.filter((i) => i.boxId === box.id).slice(0, 6);
  const boxViolations = violations.filter((v) => v.boxId === box.id);
  const evidence = inspections.filter((i) => i.boxId === box.id).flatMap((i) => i.evidence || [])
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
  const stage = lifecycleStageOf(box, lifecycleIndex);
  const stageIdx = LIFECYCLE_STAGES.findIndex((s) => s.key === stage);
  const qrUrl = boxQrUrl(box.id);

  return (
    <>
      <Drawer open={!!box} onClose={onClose} title={`Donation Box ${box.id}`} subtitle={`QR ${box.qrCode} · ${zoneById(box.zoneId)?.name}`} width={520}>
        <div className="flex items-center justify-between mb-3">
          <BoxStatusBadge status={box.status} removal={openRemoval} />
          <span className="text-[12px] font-mono" style={{ color: 'var(--app-text-muted)' }}>
            Score: <span style={{ color: 'var(--app-text)', fontWeight: 700 }}>{box.complianceScore}</span>/100
          </span>
        </div>

        <DrawerSection title="Lifecycle stage">
          <div className="flex items-center gap-1 flex-wrap" role="list" aria-label="Box lifecycle">
            {LIFECYCLE_STAGES.map((s, i) => (
              <React.Fragment key={s.key}>
                <span
                  role="listitem"
                  aria-current={i === stageIdx ? 'step' : undefined}
                  className="rounded px-2 py-1 text-[10px] font-semibold"
                  style={i === stageIdx
                    ? { background: s.color, color: '#fff' }
                    : { background: 'var(--app-surface-soft)', color: i < stageIdx ? 'var(--app-text-muted)' : 'var(--app-text-faint)', border: '1px solid var(--app-border)' }}
                >
                  {s.label}
                </span>
                {i < LIFECYCLE_STAGES.length - 1 && <span style={{ color: 'var(--app-text-faint)', fontSize: 10 }}>›</span>}
              </React.Fragment>
            ))}
          </div>
        </DrawerSection>

        <div className="flex gap-1.5 mb-4">
          {[['overview', 'Overview'], ['journey', `Box Journey (${history.length})`]].map(([key, label]) => (
            <button
              key={key} onClick={() => setTab(key)}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold border"
              style={tab === key
                ? { background: 'var(--app-accent-bg)', borderColor: 'var(--app-accent-border)', color: 'var(--app-accent)' }
                : { background: 'var(--app-surface-soft)', borderColor: 'var(--app-border)', color: 'var(--app-text-faint)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
        <>
        <DrawerSection title="QR label">
          <div className="flex items-center gap-3">
            <QRImage value={qrUrl} size={96} />
            <div className="min-w-0 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
              <div className="break-all font-mono" style={{ color: 'var(--app-text-muted)' }}>{qrUrl}</div>
              <div className="mt-1">Scanning opens this record.</div>
              {can('qr.print') && (
                <button onClick={() => setShowLabel(true)} className="app-control-btn mt-2 px-2.5 py-1 text-[10.5px] font-semibold">Print label</button>
              )}
            </div>
          </div>
        </DrawerSection>

        <DrawerSection title="Location & Identification">
          <DetailRow label="Box ID" value={box.id} />
          <DetailRow label="QR Code" value={box.qrCode} />
          <DetailRow label="Address" value={box.address} />
          <DetailRow label="Coordinates" value={`${box.location.lat.toFixed(4)}, ${box.location.lng.toFixed(4)}`} />
          <DetailRow label="Box Type" value={box.boxType} />
          <DetailRow label="Registration Date" value={formatDate(box.registrationDate)} />
        </DrawerSection>

        <DrawerSection title="Ownership">
          <DetailRow label="Organization" value={org?.name || 'Unknown'} />
          <DetailRow label="License Number" value={org?.licenseNumber || '—'} />
          <DetailRow label="License Status" value={org?.registrationStatus || '—'} />
          <DetailRow label="Org. Compliance Score" value={`${org?.complianceScore ?? '—'}/100`} />
        </DrawerSection>

        <DrawerSection title="Compliance & Inspection">
          <DetailRow label="Compliance Status" value={<BoxStatusBadge status={box.status} removal={openRemoval} />} />
          <DetailRow label="Last Inspection" value={formatDate(box.lastInspection)} />
          <DetailRow label="Next Inspection" value={formatDate(box.nextInspection)} />
          <DetailRow label="Current Action" value={box.currentAction} />
        </DrawerSection>

        <DrawerSection title="Inspection History">
          {boxInspections.length === 0 && <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>No inspection records for this box.</p>}
          <div className="space-y-2">
            {boxInspections.map((i) => {
              const inspector = inspectors.find((ins) => ins.id === i.inspectorId);
              return (
                <div key={i.id} className="flex items-center justify-between rounded-md px-2.5 py-2 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--app-text)' }}>{i.inspectionType}</div>
                    <div style={{ color: 'var(--app-text-faint)' }}>{inspector?.name || 'Unassigned'} · {formatDate(i.scheduledDate)}</div>
                  </div>
                  <InspectionStatusBadge status={i.status} />
                </div>
              );
            })}
          </div>
        </DrawerSection>

        <DrawerSection title={`Previous Violations (${boxViolations.length})`}>
          {boxViolations.length === 0 && <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>No violations recorded.</p>}
          <div className="space-y-2">
            {boxViolations.map((v) => (
              <div key={v.id} className="rounded-md px-2.5 py-2 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: 'var(--app-text)' }}>{v.category}</span>
                  <SeverityBadge severity={v.severity} />
                </div>
                <div className="mt-1" style={{ color: 'var(--app-text-faint)' }}>{v.description}</div>
                <div className="mt-1" style={{ color: 'var(--app-text-faint)', opacity: 0.8 }}>Identified {formatDate(v.dateIdentified)} · Status: {v.status}</div>
              </div>
            ))}
          </div>
        </DrawerSection>

        <DrawerSection title={`Evidence (${evidence.length})`}>
          <EvidenceGallery evidence={evidence.slice(0, 4)} />
          {evidence.length > 4 && <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--app-text-faint)' }}>Showing the latest 4 of {evidence.length}. Open an inspection for the full set.</p>}
        </DrawerSection>

        {boxInventoryItem && <ValueLedgerSection item={boxInventoryItem} />}
        {boxInventoryItem && <CashDiscrepancyWorkflow item={boxInventoryItem} />}
        </>
        )}

        {tab === 'journey' && (
        <>
        {box.status === 'non-compliant' && (
          <DrawerSection title="Operational Action">
            {openRemoval ? (
              <div className="rounded-md p-3 text-[11.5px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                Removal <span className="font-mono">{openRemoval.id}</span> already <GenericBadge tone="cyan">{openRemoval.status}</GenericBadge> — {openRemoval.assignedTeam} · {openRemoval.vehicle}
              </div>
            ) : can('page.allocation') ? (
              <div className="rounded-md p-3 space-y-2" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Confirmed non-compliant — approve removal to move this box to Displaced. This creates the logistics assignment the transition requires.</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <select value={removalTeam} onChange={(e) => setRemovalTeam(e.target.value)} aria-label="Removal team" className="rounded-md px-1.5 py-1.5 text-[10.5px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
                    {LOGISTICS_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={removalVehicle} onChange={(e) => setRemovalVehicle(e.target.value)} aria-label="Removal vehicle" className="rounded-md px-1.5 py-1.5 text-[10.5px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
                    {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select value={removalFacility} onChange={(e) => setRemovalFacility(e.target.value)} aria-label="Destination facility" className="rounded-md px-1.5 py-1.5 text-[10.5px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
                    {FACILITIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => approveRemoval(box.id, { team: removalTeam, vehicle: removalVehicle, facility: removalFacility })}
                  disabled={!canApproveRemoval}
                  className="app-control-btn w-full py-1.5 text-[11px] font-semibold"
                >
                  Approve Removal
                </button>
              </div>
            ) : (
              <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Your role cannot approve a removal.</p>
            )}
          </DrawerSection>
        )}

        <DrawerSection title={`Box Journey (${history.length})`}>
          <p className="text-[10.5px] mb-2" style={{ color: 'var(--app-text-faint)' }}>Every stage transition, inspection, evidence item, discrepancy and disposal event for this box, newest first — drawn from the same audit log used across the platform.</p>
          <ol className="relative" style={{ borderLeft: '1px solid var(--app-border)', marginLeft: 5 }}>
            {history.slice(0, 30).map((e, i) => (
              <li key={`${e.kind}-${e.ts}-${i}`} className="pl-4 pb-3 relative">
                <span className="absolute rounded-full" style={{ left: -5, top: 3, width: 9, height: 9, background: KIND_COLOR[e.kind] || '#64748b', border: '2px solid var(--app-panel)' }} />
                <div className="text-[11.5px] font-semibold" style={{ color: e.future ? 'var(--app-text-faint)' : 'var(--app-text)' }}>{e.title}{e.future ? ' (scheduled)' : ''}</div>
                {e.detail && <div className="text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>{e.detail}</div>}
                <div className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>{formatDateTime(e.ts)} · {e.actor}</div>
              </li>
            ))}
          </ol>
          {history.length > 30 && <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Showing the latest 30 of {history.length} events.</p>}
        </DrawerSection>
        </>
        )}
      </Drawer>
      <QRLabelSheet open={showLabel} onClose={() => setShowLabel(false)} boxes={[box]} title={`QR label ${box.id}`} />
    </>
  );
}
