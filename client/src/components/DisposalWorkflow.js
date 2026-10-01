import React, { useState } from 'react';
import { DrawerSection } from './Drawer';
import { GenericBadge } from './StatusBadge';
import { useData } from '../services/socket';
import { useAuth } from '../services/access';
import { DISPOSAL_CRITERIA_BY_TYPE, DISPOSAL_TYPES } from '../services/compliance';
import { formatDateTime } from '../services/donationSeed';

export const REQUEST_TONE = { pending: 'amber', approved: 'cyan', rejected: 'red', executed: 'green' };

function RequestCard({ r }) {
  return (
    <div className="rounded-md p-2.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{r.type} · <span className="font-mono">{r.id}</span></span>
        <GenericBadge tone={REQUEST_TONE[r.status]}>{r.status}</GenericBadge>
      </div>
      <div style={{ color: 'var(--app-text-muted)' }}>Criteria: {r.criteria.join('; ')}</div>
      <div style={{ color: 'var(--app-text-faint)' }}>{r.reason}</div>
      <div className="mt-1" style={{ color: 'var(--app-text-faint)' }}>Requested by {r.requestedBy} · {formatDateTime(r.requestedAt)}</div>
      {r.decidedAt && <div style={{ color: 'var(--app-text-faint)' }}>{r.status === 'rejected' ? 'Rejected' : 'Approved'} by {r.approver} · {formatDateTime(r.decidedAt)}{r.decisionNote ? ` · "${r.decisionNote}"` : ''}</div>}
      {r.executedAt && <div style={{ color: 'var(--app-text-faint)' }}>Executed by {r.executedBy} · {formatDateTime(r.executedAt)}</div>}
    </div>
  );
}

/** Request → approver decision → execution. Execution is blocked unless the request is approved. */
export default function DisposalWorkflow({ item }) {
  const { disposalRequests, requestDisposal, decideDisposal, executeDisposal } = useData();
  const { can } = useAuth();
  const [type, setType] = useState('Disposal');
  const [chosen, setChosen] = useState([]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const requests = disposalRequests.filter((r) => r.inventoryId === item.id);
  const open = requests.find((r) => r.status === 'pending' || r.status === 'approved');
  const closed = item.custodyStatus === 'disposed' || item.custodyStatus === 'released';
  const criteriaPool = DISPOSAL_CRITERIA_BY_TYPE[type];

  function submit() {
    // Checked here too (not just in the data layer) so the reason a request
    // was rejected shows right on this form instead of only as a toast the
    // user has to come back and notice.
    if (chosen.length === 0) return setError('Select at least one justification criterion.');
    if (!reason || reason.trim().length < 10) return setError(`Add a reason of at least 10 characters (currently ${reason.trim().length}).`);
    const created = requestDisposal({ inventoryId: item.id, type, criteria: chosen, reason });
    if (created) { setChosen([]); setReason(''); setError(''); }
    else setError('Request not submitted — an open request may already exist for this item, or it has already left custody.');
  }

  return (
    <DrawerSection title="Disposal, demolition and release">
      <p className="text-[10.5px] mb-2" style={{ color: 'var(--app-text-faint)' }}>Custody can only be closed by an approved instruction. Every step is recorded in the audit log.</p>

      {closed && <p className="text-[11.5px] mb-2" style={{ color: 'var(--app-success)' }}>Custody closed: this item is {item.custodyStatus}.</p>}

      {open && (
        <div className="space-y-2">
          <RequestCard r={open} />
          {open.status === 'pending' && can('disposal.approve') && (
            <div className="rounded-md p-2.5" style={{ border: '1px dashed var(--app-border)' }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (optional)" className="w-full rounded-md px-2 py-1.5 mb-2 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => decideDisposal(open.id, 'approved', note)} className="app-control-btn py-1.5 text-[11px] font-semibold">Approve</button>
                <button onClick={() => decideDisposal(open.id, 'rejected', note)} className="app-control-btn py-1.5 text-[11px] font-semibold">Reject</button>
              </div>
            </div>
          )}
          {open.status === 'pending' && !can('disposal.approve') && <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Waiting for an authorised approver (Director or Administrator).</p>}
          {open.status === 'approved' && can('disposal.execute') && (
            <button onClick={() => executeDisposal(open.id)} className="app-control-btn w-full py-2 text-[11.5px] font-semibold">Execute {open.type.toLowerCase()}</button>
          )}
          {open.status === 'approved' && !can('disposal.execute') && <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Approved. Waiting for the Logistics Coordinator to execute.</p>}
        </div>
      )}

      {!open && !closed && can('disposal.request') && (
        <div className="rounded-md p-2.5 space-y-2" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)' }}>
          <label className="block text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
            Request type
            <select value={type} onChange={(e) => { setType(e.target.value); setChosen([]); }} className="mt-1 w-full rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
              {DISPOSAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-[10.5px] mb-1" style={{ color: 'var(--app-text-faint)' }}>Justification criteria</legend>
            {criteriaPool.map((c) => (
              <label key={c} className="flex items-center gap-2 text-[11px] py-0.5" style={{ color: 'var(--app-text-muted)' }}>
                <input type="checkbox" checked={chosen.includes(c)} onChange={(e) => { setChosen((cur) => (e.target.checked ? [...cur, c] : cur.filter((x) => x !== c))); setError(''); }} />
                {c}
              </label>
            ))}
          </fieldset>
          <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} rows={2} placeholder="Reason (at least 10 characters)" className="w-full rounded-md px-2 py-1.5 text-[11px]" style={{ background: 'var(--app-panel)', border: `1px solid ${error ? 'var(--app-danger-border)' : 'var(--app-border)'}`, color: 'var(--app-text)' }} />
          {error && (
            <p className="text-[10.5px] flex items-start gap-1.5" style={{ color: 'var(--app-danger)' }}>
              <span aria-hidden="true">⚠</span> {error}
            </p>
          )}
          <button onClick={submit} className="app-control-btn w-full py-2 text-[11.5px] font-semibold">Submit for approval</button>
        </div>
      )}
      {!open && !closed && !can('disposal.request') && <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Your role cannot raise disposal requests.</p>}

      {requests.filter((r) => r !== open).length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[10.5px] font-semibold uppercase" style={{ color: 'var(--app-text-faint)', letterSpacing: '0.06em' }}>Previous requests</div>
          {requests.filter((r) => r !== open).map((r) => <RequestCard key={r.id} r={r} />)}
        </div>
      )}
    </DrawerSection>
  );
}
