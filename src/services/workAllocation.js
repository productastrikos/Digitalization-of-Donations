// Shared logic for the Work Allocation console — used by both the page itself
// and the KPI builder, so the KPI numbers always match what's on screen.
import { zoneById } from './donationSeed';

export const PRIORITY_RANK = { critical: 0, high: 1, urgent: 0, priority: 1, medium: 2, routine: 3, low: 3 };

export function buildCaseQueue({ inspections, complaints, displacements, boxes, inspectors }) {
  const zoneOfBox = (boxId) => boxes.find((b) => b.id === boxId)?.zoneId;
  const list = [];

  inspections.filter((i) => i.status === 'overdue' || i.status === 'escalated').forEach((i) => {
    list.push({
      key: `insp-${i.id}`, kind: 'inspection', id: i.id,
      title: `${i.inspectionType} Inspection — ${i.boxId}`,
      zoneId: i.zoneId, priority: i.status === 'escalated' ? 'critical' : i.priority,
      status: i.status, currentAssignee: inspectors.find((x) => x.id === i.inspectorId)?.name || 'Unassigned',
      scheduledDate: i.scheduledDate, raw: i,
    });
  });
  complaints.filter((c) => c.status !== 'resolved' && (c.severity === 'critical' || c.severity === 'high')).forEach((c) => {
    list.push({
      key: `cmp-${c.id}`, kind: 'complaint', id: c.id,
      title: `${c.source} — ${c.location}`,
      zoneId: c.zoneId, priority: c.severity, status: c.status,
      currentAssignee: c.assignedTeam || 'Unassigned', scheduledDate: c.dateReceived, raw: c,
    });
  });
  displacements.filter((d) => d.status === 'pending').forEach((d) => {
    list.push({
      key: `dsp-${d.id}`, kind: 'displacement', id: d.id,
      title: `Displacement — ${d.boxId}`,
      zoneId: zoneOfBox(d.boxId), priority: d.priority, status: d.status,
      currentAssignee: d.assignedTeam || 'Unassigned', scheduledDate: d.scheduledDate, raw: d,
    });
  });

  return list.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) || new Date(a.scheduledDate) - new Date(b.scheduledDate));
}

// Deterministic, non-random distance/ETA estimate so the console doesn't jitter on re-render.
export function estimateReach(seedStr, zoneMatch) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0;
  const base = Math.abs(h) % 18;
  const km = zoneMatch ? (0.6 + (base % 4) * 0.4).toFixed(1) : (8 + base).toFixed(1);
  const min = zoneMatch ? 4 + (base % 6) : 15 + base;
  return { km, min };
}

export function bestEtaMinutes(caseItem, inspectors) {
  const zoneName = zoneById(caseItem.zoneId)?.name;
  let best = Infinity;
  inspectors.forEach((ins) => {
    if (ins.availability === 'Off Duty') return;
    const match = ins.assignedZone === zoneName;
    const r = estimateReach(ins.id + caseItem.id, match);
    if (r.min < best) best = r.min;
  });
  return best === Infinity ? 30 : best;
}

export function averageResponseEta(cases, inspectors) {
  if (cases.length === 0) return 0;
  const total = cases.reduce((sum, c) => sum + bestEtaMinutes(c, inspectors), 0);
  return Math.round((total / cases.length) * 10) / 10;
}

export function inspectorWorkloadMap(inspections) {
  const map = {};
  inspections.forEach((i) => { if (i.status !== 'completed') map[i.inspectorId] = (map[i.inspectorId] || 0) + 1; });
  return map;
}
