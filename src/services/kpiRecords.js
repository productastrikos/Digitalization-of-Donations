// Record-level data builders for the Executive Overview KPI strip. Unlike the
// aggregate kpi() objects in donationKpis.js, these return the underlying
// case-by-case records (one row per violation, inspection, escalation, or
// review) so an officer can see exactly which records, personnel, and
// required actions sit behind each headline number.
import { ZONES, zoneName, INSPECTORS, formatDate, formatGST, daysFromNow } from './donationSeed';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function officerFor(seedKey) {
  return INSPECTORS[hashSeed(seedKey) % INSPECTORS.length].name;
}

const SEVERITY_PRIORITY = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const INSPECTION_PRIORITY = { urgent: 'Urgent', priority: 'High', routine: 'Routine' };

/** Open Violations — every violation not yet resolved. */
export function buildOpenViolationRecords(violations, boxes, organizations) {
  const orgById = new Map(organizations.map((o) => [o.id, o]));
  return violations
    .filter((v) => v.status !== 'resolved')
    .map((v) => ({
      id: v.id,
      boxId: v.boxId,
      zone: zoneName(v.zoneId),
      organization: orgById.get(v.organizationId)?.name || '—',
      violationType: v.category,
      dateReported: v.dateIdentified,
      priority: SEVERITY_PRIORITY[v.severity] || v.severity,
      assignedOfficer: officerFor(v.id),
      status: v.status === 'open' ? 'Open' : 'Under Review',
      requiredAction: v.status === 'open'
        ? 'Issue corrective notice and schedule re-inspection'
        : 'Complete compliance review determination',
    }))
    .sort((a, b) => new Date(b.dateReported) - new Date(a.dateReported));
}

/** Inspections Due Today — pending inspections scheduled for today. */
export function buildInspectionsDueTodayRecords(inspections) {
  const todayStr = new Date().toDateString();
  const inspectorById = new Map(INSPECTORS.map((i) => [i.id, i]));
  return inspections
    .filter((i) => i.status === 'pending' && new Date(i.scheduledDate).toDateString() === todayStr)
    .map((i) => ({
      id: i.id,
      boxId: i.boxId,
      zone: zoneName(i.zoneId),
      assignedTeam: inspectorById.get(i.inspectorId)?.team || '—',
      scheduledTime: i.scheduledDate,
      inspectionType: i.inspectionType,
      priority: INSPECTION_PRIORITY[i.priority] || i.priority,
      status: 'Scheduled Today',
      action: 'Confirm field visit',
    }))
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
}

/** Overall Compliance % — zone-wise compliance breakdown. */
export function buildZoneComplianceRecords(boxes) {
  return ZONES.map((zone) => {
    const zBoxes = boxes.filter((b) => b.zoneId === zone.id);
    const total = zBoxes.length;
    const compliant = zBoxes.filter((b) => b.status === 'compliant').length;
    const nonCompliant = zBoxes.filter((b) => b.status === 'non-compliant').length;
    const pct = total ? Math.round((compliant / total) * 1000) / 10 : 0;
    const lastInspection = zBoxes.length
      ? zBoxes.reduce((latest, b) => (new Date(b.lastInspection) > new Date(latest) ? b.lastInspection : latest), zBoxes[0].lastInspection)
      : null;
    const requiredAction = pct >= 90 ? 'Routine Monitoring' : pct >= 75 ? 'Schedule Follow-Up Inspection' : 'Priority Compliance Sweep Required';
    return { zone: zone.name, region: zone.region, total, compliant, nonCompliant, pct, lastInspection, requiredAction };
  }).sort((a, b) => a.pct - b.pct);
}

const ESCALATION_REASONS = [
  'Repeated non-compliance identified during inspection',
  'Inspector flagged a safety concern requiring supervisory review',
  'Organization failed to produce required documentation',
  'Field evidence contradicts registered ownership record',
];

/** Escalated Cases — inspections escalated to the Compliance & Inspections Division. */
export function buildEscalatedCaseRecords(inspections, boxes) {
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  return inspections
    .filter((i) => i.status === 'escalated')
    .map((i) => {
      const seed = hashSeed(i.id);
      const box = boxById.get(i.boxId);
      return {
        id: i.id,
        zone: zoneName(i.zoneId),
        issueType: i.inspectionType,
        escalationReason: ESCALATION_REASONS[seed % ESCALATION_REASONS.length],
        priority: INSPECTION_PRIORITY[i.priority] || i.priority,
        assignedOfficer: officerFor(i.id),
        escalationDate: i.scheduledDate,
        deadline: daysFromNow(2 + (seed % 5)),
        status: box?.status === 'non-compliant' ? 'Under Compliance Review' : 'Awaiting Supervisor Action',
      };
    })
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

/** Pending Reviews — violations currently under compliance review. */
export function buildPendingReviewRecords(violations) {
  return violations
    .filter((v) => v.status === 'under-review')
    .map((v) => {
      const daysPending = Math.max(0, Math.floor((Date.now() - new Date(v.dateIdentified).getTime()) / 86400000));
      return {
        id: `REV-${v.id.replace('VIO-', '')}`,
        relatedCaseId: v.id,
        zone: zoneName(v.zoneId),
        reviewType: v.category,
        submittedDate: v.dateIdentified,
        assignedReviewer: officerFor(`${v.id}-review`),
        daysPending,
        priority: SEVERITY_PRIORITY[v.severity] || v.severity,
        status: 'Under Review',
        requiredAction: daysPending > 14 ? 'Escalate for senior compliance determination' : 'Complete review determination',
      };
    })
    .sort((a, b) => b.daysPending - a.daysPending);
}

export { formatDate, formatGST };
