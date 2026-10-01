import React, { useState } from 'react';
import { DrawerSection } from './Drawer';
import { GenericBadge } from './StatusBadge';
import { WorkflowStrip } from './WorkflowSteps';
import { useData } from '../services/socket';
import { useAuth } from '../services/access';
import { formatCurrency, formatDateTime } from '../services/donationSeed';

export const DISCREPANCY_STATUS_TONE = { reconciled: 'green', 'under-review': 'amber', 'discrepancy-confirmed': 'red' };
export const CASE_STATUS_TONE = { flagged: 'red', verified: 'amber', investigation: 'cyan', resolved: 'slate', closed: 'green' };
export const RESOLUTION_TONE = { explained: 'green', 'written-off': 'amber', misappropriation: 'red' };
const CASE_STEPS = ['Discrepancy Flagged', 'Verified', 'Investigation', 'Resolution', 'Case Closed'];
const STEP_INDEX = { flagged: 0, verified: 1, investigation: 2, resolved: 3, closed: 4 };

/** Read-only sequential value ledger for a Cash / Mixed Collection inventory item. */
export function ValueLedgerSection({ item }) {
  if (!item.valueLedger || item.valueLedger.length === 0) return null;
  return (
    <DrawerSection title="Value Ledger">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Sequential handoff count — each stage's expected amount is the previous stage's counted amount.</span>
        {item.discrepancyStatus && <GenericBadge tone={DISCREPANCY_STATUS_TONE[item.discrepancyStatus]}>{item.discrepancyStatus.replace('-', ' ')}</GenericBadge>}
      </div>
      <div className="space-y-2">
        {item.valueLedger.map((e) => (
          <div key={e.id} className="rounded-md p-2.5 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: `1px solid ${e.discrepancy ? 'var(--app-danger-border)' : 'var(--app-border)'}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{e.stage}</span>
              {e.discrepancy && <GenericBadge tone="red">variance {e.variance > 0 ? '+' : ''}{formatCurrency(e.variance)} ({e.variancePct > 0 ? '+' : ''}{e.variancePct}%)</GenericBadge>}
            </div>
            <div style={{ color: 'var(--app-text-muted)' }}>{e.location} · counted by {e.countedBy}</div>
            <div className="mt-1 flex items-center gap-3 font-mono" style={{ color: 'var(--app-text-faint)' }}>
              <span>Expected: <span style={{ color: 'var(--app-text)' }}>{formatCurrency(e.expectedAmount)}</span></span>
              <span>Actual: <span style={{ color: e.discrepancy ? 'var(--app-danger)' : 'var(--app-text)' }}>{formatCurrency(e.actualAmount)}</span></span>
            </div>
            <div className="mt-1" style={{ color: 'var(--app-text-faint)' }}>{formatDateTime(e.timestamp)}</div>
          </div>
        ))}
      </div>
    </DrawerSection>
  );
}

/** Case workflow: Flagged → Verified → Investigation → Resolution → Closed. */
export function CashDiscrepancyWorkflow({ item }) {
  const { cashDiscrepancies, verifyDiscrepancy, startDiscrepancyInvestigation, resolveDiscrepancy, closeDiscrepancyCase } = useData();
  const { can } = useAuth();
  const [resolutionType, setResolutionType] = useState('explained');
  const [note, setNote] = useState('');

  const cases = cashDiscrepancies.filter((c) => c.inventoryId === item.id);
  if (cases.length === 0) return null;
  const open = cases.find((c) => c.status !== 'closed') || cases[cases.length - 1];
  const needsAdmin = open.requiresAdminSignoff || open.resolutionType === 'misappropriation';
  const canReview = can('discrepancy.review');
  const canAdminSignoff = can('discrepancy.adminSignoff');

  return (
    <DrawerSection title="Cash Discrepancy Case">
      {cases.map((c) => (
        <div key={c.id} className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>{c.id}</span>
            <GenericBadge tone={CASE_STATUS_TONE[c.status]}>{c.status}</GenericBadge>
          </div>
          <WorkflowStrip steps={CASE_STEPS} activeIndex={STEP_INDEX[c.status]} />
          <div className="mt-2 text-[11px] space-y-0.5" style={{ color: 'var(--app-text-muted)' }}>
            <div>{c.ledgerStage} — expected {formatCurrency(c.expectedAmount)}, counted {formatCurrency(c.actualAmount)}
              {' '}(<span style={{ color: 'var(--app-danger)' }}>{c.variance > 0 ? '+' : ''}{formatCurrency(c.variance)}, {c.variancePct > 0 ? '+' : ''}{c.variancePct}%</span>)
            </div>
            <div style={{ color: 'var(--app-text-faint)' }}>Assigned: {c.assignedOfficer} · Flagged {formatDateTime(c.createdAt)}</div>
            {needsAdmin && c.status !== 'closed' && <div style={{ color: 'var(--app-warning)' }}>Above escalation threshold — requires Admin sign-off before closure.</div>}
            {c.resolutionType && (
              <div className="mt-1 flex items-center gap-1.5">
                <span>Resolution:</span> <GenericBadge tone={RESOLUTION_TONE[c.resolutionType]}>{c.resolutionType.replace('-', ' ')}</GenericBadge>
              </div>
            )}
            {c.resolutionNote && <div style={{ color: 'var(--app-text-faint)' }}>&ldquo;{c.resolutionNote}&rdquo;</div>}
            {c.signedOffBy && <div style={{ color: 'var(--app-text-faint)' }}>Signed off by {c.signedOffBy}</div>}
          </div>

          {c.id === open.id && c.status === 'flagged' && (
            canReview
              ? <button onClick={() => verifyDiscrepancy(c.id)} className="app-control-btn w-full mt-2 py-1.5 text-[11px] font-semibold">Verify (recount)</button>
              : <p className="mt-2 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Waiting for a Compliance Officer or Director to verify.</p>
          )}
          {c.id === open.id && c.status === 'verified' && (
            canReview
              ? <button onClick={() => startDiscrepancyInvestigation(c.id)} className="app-control-btn w-full mt-2 py-1.5 text-[11px] font-semibold">Open Investigation</button>
              : <p className="mt-2 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Waiting for investigation to open.</p>
          )}
          {c.id === open.id && c.status === 'investigation' && (
            (canReview || canAdminSignoff)
              ? (
                <div className="mt-2 rounded-md p-2.5" style={{ border: '1px dashed var(--app-border)' }}>
                  <select value={resolutionType} onChange={(e) => setResolutionType(e.target.value)} className="w-full rounded-md px-2 py-1.5 mb-2 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}>
                    <option value="explained">Explained — no real loss</option>
                    <option value="written-off">Written off</option>
                    <option value="misappropriation" disabled={!canAdminSignoff}>Misappropriation (requires Admin sign-off){!canAdminSignoff ? ' — not available to your role' : ''}</option>
                  </select>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Resolution note" className="w-full rounded-md px-2 py-1.5 mb-2 text-[11px]" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }} />
                  <button onClick={() => { resolveDiscrepancy(c.id, resolutionType, note); setNote(''); }} className="app-control-btn w-full py-1.5 text-[11px] font-semibold">Resolve Case</button>
                </div>
              )
              : <p className="mt-2 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Under investigation.</p>
          )}
          {c.id === open.id && c.status === 'resolved' && (
            (needsAdmin ? canAdminSignoff : canReview)
              ? <button onClick={() => closeDiscrepancyCase(c.id)} className="app-control-btn w-full mt-2 py-1.5 text-[11px] font-semibold">Close Case</button>
              : <p className="mt-2 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>Resolved — awaiting {needsAdmin ? 'Administrator sign-off' : 'closure'}.</p>
          )}
        </div>
      ))}
    </DrawerSection>
  );
}
