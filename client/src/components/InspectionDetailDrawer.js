import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Drawer, { DetailRow, DrawerSection } from './Drawer';
import { InspectionStatusBadge, GenericBadge } from './StatusBadge';
import { useData } from '../services/socket';
import { useAuth } from '../services/access';
import { scoreChecklist } from '../services/compliance';
import { zoneById, formatDate, formatDateTime } from '../services/donationSeed';

// Downscale phone photos so evidence stays light in memory.
function readAndResize(file, maxSide = 1280) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a readable image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 4000, maximumAge: 60000 },
    );
  });
}

function EvidenceLightbox({ item, onClose }) {
  if (!item) return null;
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: 'rgba(6,12,20,0.82)', zIndex: 200 }}
      onClick={onClose}
      role="dialog" aria-modal="true"
    >
      <div
        className="flex flex-col md:flex-row overflow-hidden rounded-xl max-w-3xl w-full"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center shrink-0" style={{ background: '#0a1622', minHeight: 260, flex: '1 1 60%' }}>
          <img src={item.image} alt={item.caption} style={{ width: '100%', height: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
          {item.simulated && (
            <span className="absolute top-2 left-2 rounded px-2 py-1 text-[9.5px] font-bold uppercase" style={{ background: 'rgba(13,24,38,0.85)', color: '#c9a55e', letterSpacing: '0.06em' }}>Simulated</span>
          )}
        </div>
        <div className="p-4 space-y-2 text-[11.5px] shrink-0" style={{ flex: '1 1 40%', color: 'var(--app-text-muted)', overflowY: 'auto' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="font-bold text-[13px]" style={{ color: 'var(--app-text)' }}>{item.caption}</div>
            <button onClick={onClose} className="icon-btn shrink-0" aria-label="Close" style={{ width: 24, height: 24 }}>✕</button>
          </div>
          <DetailRow label="Captured" value={formatDateTime(item.capturedAt)} />
          <DetailRow label="Inspector" value={item.inspectorName || '—'} />
          <DetailRow label="Coordinates" value={<span className="font-mono">{Number(item.lat).toFixed(5)}, {Number(item.lng).toFixed(5)}</span>} />
          <DetailRow label="Source" value={item.coordsSource || '—'} />
          {item.fileName && <DetailRow label="File" value={item.fileName} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function EvidenceGallery({ evidence }) {
  const [open, setOpen] = useState(null);
  if (!evidence || evidence.length === 0) {
    return <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>No evidence attached.</p>;
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {evidence.map((e) => (
          <figure key={e.id} className="rounded-md overflow-hidden" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
            <button
              type="button"
              onClick={() => e.image && setOpen(e)}
              className="relative flex items-center justify-center w-full"
              style={{ height: 92, background: 'var(--app-surface-raised)', cursor: e.image ? 'zoom-in' : 'default', padding: 0, border: 'none' }}
              title={e.image ? 'Click to view full size' : undefined}
            >
              {e.image ? (
                <img src={e.image} alt={e.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg className="w-7 h-7" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M3 9a2 2 0 012-2h1.5l1-2h9l1 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm9 8a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" /></svg>
              )}
              {e.simulated && (
                <span className="absolute top-1 left-1 rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase" style={{ background: 'rgba(13,24,38,0.85)', color: '#c9a55e', letterSpacing: '0.06em' }}>Simulated</span>
              )}
            </button>
            <figcaption className="p-2 text-[10px]" style={{ color: 'var(--app-text-faint)', lineHeight: 1.45 }}>
              <div className="font-semibold" style={{ color: 'var(--app-text)' }}>{e.caption}</div>
              <div>{formatDateTime(e.capturedAt)}</div>
              <div>{e.inspectorName}</div>
              <div className="font-mono">{Number(e.lat).toFixed(5)}, {Number(e.lng).toFixed(5)}</div>
              <div style={{ opacity: 0.8 }}>{e.coordsSource}</div>
            </figcaption>
          </figure>
        ))}
      </div>
      <EvidenceLightbox item={open} onClose={() => setOpen(null)} />
    </>
  );
}

export default function InspectionDetailDrawer({ inspectionId, onClose }) {
  const { inspections, boxes, inspectors, criteria, passMark, addInspectionEvidence, recordInspection } = useData();
  const { can } = useAuth();
  const [draft, setDraft] = useState({});
  const [caption, setCaption] = useState('');
  const [status, setStatus] = useState('');

  const insp = inspections.find((i) => i.id === inspectionId);
  const box = insp ? boxes.find((b) => b.id === insp.boxId) : null;
  const inspector = insp ? inspectors.find((i) => i.id === insp.inspectorId) : null;
  const activeCriteria = useMemo(() => criteria.filter((c) => c.active), [criteria]);
  const completed = insp?.status === 'completed';
  const results = useMemo(() => (completed ? (insp.checklist || {}) : draft), [completed, insp, draft]);
  const scored = useMemo(() => scoreChecklist(results, criteria, passMark), [results, criteria, passMark]);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      setStatus('Processing photo and capturing location…');
      const [image, coords] = await Promise.all([readAndResize(file), getPosition()]);
      addInspectionEvidence(insp.id, { image, caption: caption.trim(), fileName: file.name, coords });
      setCaption('');
      setStatus('');
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <Drawer open={!!insp} onClose={() => { setDraft({}); setStatus(''); onClose(); }} title={insp ? `Inspection ${insp.id}` : ''} subtitle={insp ? `${insp.boxId} · ${zoneById(insp.zoneId)?.name || ''}` : ''} width={520}>
      {insp && (
        <>
          <div className="flex items-center justify-between mb-3">
            <InspectionStatusBadge status={insp.status} />
            {completed && <GenericBadge tone={insp.complianceResult === 'pass' ? 'green' : 'red'}>{insp.complianceResult}</GenericBadge>}
          </div>
          <div className="mb-3">
            <DetailRow label="Donation Box" value={insp.boxId} />
            <DetailRow label="Inspection Type" value={insp.inspectionType} />
            <DetailRow label="Inspector" value={inspector?.name || 'Unassigned'} />
            <DetailRow label="Scheduled" value={formatDate(insp.scheduledDate)} />
            {box && <DetailRow label="Box Coordinates" value={`${box.location.lat.toFixed(5)}, ${box.location.lng.toFixed(5)}`} />}
            {insp.completedBy && <DetailRow label="Completed By" value={insp.completedBy} />}
          </div>

          <DrawerSection title={`Compliance criteria (pass mark ${passMark})`}>
            <div className="space-y-1.5">
              {activeCriteria.map((c) => {
                const value = results[c.id];
                if (completed && value === undefined) return null;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
                    <div className="min-w-0">
                      <div style={{ color: 'var(--app-text)', fontWeight: 600 }}>{c.title}{c.mandatory && <span style={{ color: 'var(--app-warning)', marginLeft: 6, fontSize: 9 }}>MANDATORY</span>}</div>
                      <div style={{ color: 'var(--app-text-faint)' }}>Weight {c.weight}</div>
                    </div>
                    {completed || !can('inspection.conduct') ? (
                      <GenericBadge tone={value === 'pass' ? 'green' : value === 'fail' ? 'red' : 'slate'}>{value || 'not assessed'}</GenericBadge>
                    ) : (
                      <div className="flex gap-1 shrink-0">
                        {['pass', 'fail'].map((v) => (
                          <button
                            key={v}
                            onClick={() => setDraft((d) => ({ ...d, [c.id]: v }))}
                            className="rounded px-2 py-1 text-[10px] font-semibold uppercase"
                            style={draft[c.id] === v
                              ? { background: v === 'pass' ? 'var(--app-success-bg)' : 'var(--app-danger-bg)', color: v === 'pass' ? 'var(--app-success)' : 'var(--app-danger)', border: `1px solid ${v === 'pass' ? 'var(--app-success-border)' : 'var(--app-danger-border)'}` }
                              : { background: 'transparent', color: 'var(--app-text-faint)', border: '1px solid var(--app-border)' }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {scored.assessedCount > 0 && (
              <div className="flex items-center justify-between mt-2 text-[11.5px]">
                <span style={{ color: 'var(--app-text-faint)' }}>Weighted score</span>
                <span className="font-mono font-bold" style={{ color: scored.passed ? 'var(--app-success)' : 'var(--app-danger)' }}>
                  {scored.score}/100 · {scored.passed ? 'PASS' : 'FAIL'}{scored.mandatoryFailed.length > 0 && ` (${scored.mandatoryFailed.length} mandatory failed)`}
                </span>
              </div>
            )}
            {!completed && can('inspection.conduct') && (
              <button onClick={() => { const r = recordInspection(insp.id, draft); if (r) setDraft({}); }} className="app-control-btn w-full py-2 mt-3 text-[11.5px] font-semibold">
                Submit inspection result
              </button>
            )}
            {!completed && !can('inspection.conduct') && (
              <p className="text-[10.5px] mt-2" style={{ color: 'var(--app-text-faint)' }}>Your role can view but not record inspection results.</p>
            )}
          </DrawerSection>

          <DrawerSection title={`Evidence (${(insp.evidence || []).length})`}>
            <EvidenceGallery evidence={insp.evidence} />
            {can('evidence.upload') ? (
              <div className="mt-3 rounded-md p-2.5" style={{ background: 'var(--app-surface-soft)', border: '1px dashed var(--app-border)' }}>
                <input
                  value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)"
                  className="w-full rounded-md px-2 py-1.5 mb-2 text-[11px]"
                  style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                />
                <label className="app-control-btn flex items-center justify-center gap-1.5 py-2 text-[11.5px] font-semibold cursor-pointer">
                  <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
                  Attach photo
                </label>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--app-text-faint)' }}>
                  Each photo is stamped with the time, the inspector and device coordinates (the box position is used if GPS is unavailable).
                </p>
                {status && <p className="text-[10.5px] mt-1" style={{ color: 'var(--app-accent)' }}>{status}</p>}
              </div>
            ) : (
              <p className="text-[10.5px] mt-2" style={{ color: 'var(--app-text-faint)' }}>Your role cannot attach evidence.</p>
            )}
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}
