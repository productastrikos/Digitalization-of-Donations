// Single box lifecycle: Identified > Inspected > Violation > Displaced > In Storage > Disposed / Released.
// The stage is DERIVED from the existing records (box status, displacement,
// custody and disposal records) so it can never disagree with them.
import { formatDate } from './donationSeed';

// The seven canonical stages. Every stage is derived purely from box.status
// and (for the two custody-closed stages) inventory.custodyStatus — nothing
// else stores a parallel copy of a box's lifecycle position. Disposed and
// Released are kept as two distinct terminal stages (custodyStatus already
// tracks them separately); collapsing them into one hid a real distinction.
export const LIFECYCLE_STAGES = [
  { key: 'identified', label: 'Identified', hint: 'Registered or detected, not yet inspected', color: '#94a3b8' },
  { key: 'inspected', label: 'Inspected', hint: 'Inspected; compliant or under inspection', color: '#3b82f6' },
  { key: 'violation', label: 'Violation', hint: 'Non-compliant; awaiting removal', color: '#ef4444' },
  { key: 'displaced', label: 'Displaced', hint: 'Removed and in transit to a facility', color: '#f59e0b' },
  { key: 'in-storage', label: 'In Storage', hint: 'Held in a DCD custody facility', color: '#8b5cf6' },
  { key: 'disposed', label: 'Disposed', hint: 'Destroyed under an approved instruction', color: '#64748b' },
  { key: 'released', label: 'Released', hint: 'Returned to the owner under an approved instruction', color: '#22c55e' },
];
export const STAGE_BY_KEY = Object.fromEntries(LIFECYCLE_STAGES.map((s) => [s.key, s]));
export const STAGE_KEYS = LIFECYCLE_STAGES.map((s) => s.key);

export function buildLifecycleIndex({ inventory = [], displacements = [] }) {
  const inventoryByBox = new Map();
  inventory.forEach((i) => { inventoryByBox.set(i.boxId, i); });
  const inTransit = new Set(displacements.filter((d) => d.status === 'in-transit').map((d) => d.boxId));
  return { inventoryByBox, inTransit };
}

export function lifecycleStageOf(box, index) {
  switch (box.status) {
    case 'safekeeping': {
      const item = index.inventoryByBox.get(box.id);
      if (item?.custodyStatus === 'disposed') return 'disposed';
      if (item?.custodyStatus === 'released') return 'released';
      return 'in-storage';
    }
    case 'pending-displacement': return index.inTransit.has(box.id) ? 'displaced' : 'violation';
    case 'non-compliant': return 'violation';
    case 'unknown': return 'identified';
    default: return 'inspected';
  }
}

export function summarizeLifecycle(boxes, index) {
  const counts = Object.fromEntries(LIFECYCLE_STAGES.map((s) => [s.key, 0]));
  boxes.forEach((b) => { counts[lifecycleStageOf(b, index)] += 1; });
  return counts;
}

/**
 * buildBoxHistory — every recorded event for one box, newest first.
 * Draws on inspections (with evidence), violations, displacement, custody chain,
 * disposal requests and the audit log, so it is a true per-box history.
 */
export function buildBoxHistory(box, { inspections = [], violations = [], displacements = [], inventory = [], disposalRequests = [], auditLog = [], inspectors = [] }) {
  const events = [];
  const inspectorName = (id) => inspectors.find((i) => i.id === id)?.name || 'Unassigned';
  events.push({ ts: box.registrationDate, kind: 'registry', title: 'Registered in the DCD registry', detail: `QR ${box.qrCode}`, actor: 'DCD Registry Portal' });

  inspections.filter((i) => i.boxId === box.id).forEach((i) => {
    const evidence = (i.evidence || []).length;
    const done = i.status === 'completed';
    events.push({
      ts: i.scheduledDate, kind: 'inspection',
      title: done ? `${i.inspectionType} inspection completed (${i.complianceResult})` : `${i.inspectionType} inspection ${i.status}`,
      detail: `${i.id}${evidence ? ` · ${evidence} evidence item${evidence === 1 ? '' : 's'}` : ''}`,
      actor: inspectorName(i.inspectorId), future: !done && new Date(i.scheduledDate) > new Date(),
    });
  });

  violations.filter((v) => v.boxId === box.id).forEach((v) => {
    events.push({ ts: v.dateIdentified, kind: 'violation', title: `Violation identified: ${v.category}`, detail: `${v.id} · ${v.severity} severity`, actor: 'Compliance & Violations Engine' });
    if (v.resolutionDate) events.push({ ts: v.resolutionDate, kind: 'resolved', title: `Violation resolved: ${v.category}`, detail: v.id, actor: 'Compliance & Violations Engine' });
  });

  displacements.filter((d) => d.boxId === box.id).forEach((d) => {
    events.push({ ts: d.scheduledDate, kind: 'displacement', title: `Displacement ${d.status}`, detail: `${d.id} to ${d.destinationFacility}`, actor: d.assignedTeam });
  });

  inventory.filter((i) => i.boxId === box.id).forEach((i) => {
    (i.chainOfCustody || []).forEach((c) => events.push({ ts: c.timestamp, kind: 'custody', title: `Custody: ${c.stage}`, detail: `${i.id} at ${i.facility}`, actor: c.actor }));
  });

  disposalRequests.filter((r) => r.boxId === box.id).forEach((r) => {
    events.push({ ts: r.requestedAt, kind: 'disposal', title: `${r.type} requested`, detail: `${r.id} · ${r.criteria.join(', ')}`, actor: r.requestedBy });
    if (r.decidedAt) events.push({ ts: r.decidedAt, kind: 'disposal', title: `${r.type} ${r.status === 'rejected' ? 'rejected' : 'approved'}`, detail: `${r.id}${r.decisionNote ? ` · ${r.decisionNote}` : ''}`, actor: r.approver });
    if (r.executedAt) events.push({ ts: r.executedAt, kind: 'disposal', title: `${r.type} executed`, detail: r.id, actor: r.executedBy });
  });

  // Matches both direct box-entity entries (entityId === box.id) and any
  // audit entry stamped with this box's id as its boxId — an inspection,
  // disposal or discrepancy audit entry is about its own record, but it's
  // also about this box, and belongs in the box's own journey.
  auditLog.filter((a) => a.entityId === box.id || a.boxId === box.id).forEach((a) => {
    events.push({ ts: a.timestamp, kind: 'audit', title: a.action, detail: a.previousStatus || a.newStatus ? `${a.previousStatus || '—'} → ${a.newStatus || '—'}` : '', actor: a.user });
  });

  return events.filter((e) => e.ts).sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

export const formatEventDate = formatDate;
