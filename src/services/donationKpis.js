import { formatGST } from './donationSeed';
import { buildCaseQueue, averageResponseEta, inspectorWorkloadMap } from './workAllocation';
import { buildGeoAreas, buildLocationQuality } from './geoCoverage';
import { buildZoneIntelligence, buildPriorityActions } from './locationIntelligence';

function pctChange(current, previous) {
  if (!previous) return { trend: 0 };
  const pct = ((current - previous) / previous) * 100;
  return { trend: Math.round(pct * 10) / 10 };
}

// Metrics where a LOWER value is the healthy direction (backlogs, violations, delays)
export const LOWER_IS_BETTER = new Set([
  'overdue-inspections', 'open-violations', 'critical-violations', 'repeat-offenders',
  'pending-displacement-ops', 'awaiting-instruction', 'open-complaints-mod', 'critical-alerts',
  'orgs-with-violations', 'unverified-ownership', 'avg-resolution', 'avg-resolution-violations',
  'avg-removal-time', 'avg-response-time', 'avg-custody-duration', 'non-compliant', 'active-inspections',
  'pending-displacement', 'open-complaints',
  'wa-open-cases', 'wa-critical-cases', 'wa-avg-workload', 'wa-avg-eta',
  'geo-unmapped', 'geo-gaps',
  'li-nc-boxes', 'li-open-complaints', 'li-overdue-inspections', 'li-avg-risk', 'li-open-violations',
  'strip-open-violations', 'strip-inspections-due-today', 'strip-escalated-cases', 'strip-pending-reviews',
]);

function kpi(id, name, description, value, previousValue, target, unit, sourceEntity, threshold, context, format) {
  const { trend } = pctChange(value, previousValue);
  const inverse = LOWER_IS_BETTER.has(id);
  const ratio = target === 0 ? 1 : inverse ? target / Math.max(value, 0.0001) : value / target;
  const status = ratio >= 0.98 ? 'healthy' : ratio >= 0.85 ? 'on-track' : ratio >= 0.6 ? 'attention' : 'critical';
  return {
    id, name, description, value, previousValue, target, unit, format,
    status, trend, timestamp: formatGST(new Date().toISOString()), sourceEntity, threshold, context,
  };
}

export function buildExecutiveKPIs(boxes, inspections, violations, displacements, inventory, complaints) {
  const total = boxes.length;
  const compliant = boxes.filter((b) => b.status === 'compliant').length;
  const nonCompliant = boxes.filter((b) => b.status === 'non-compliant').length;
  const complianceRate = Math.round((compliant / total) * 1000) / 10;
  const activeInspections = inspections.filter((i) => i.status === 'pending' || i.status === 'overdue').length;
  const overdueInspections = inspections.filter((i) => i.status === 'overdue').length;
  const pendingDisplacement = boxes.filter((b) => b.status === 'pending-displacement').length;
  const inventoryValue = inventory.reduce((s, i) => s + i.value, 0);
  const openComplaints = complaints.filter((c) => c.status === 'open' || c.status === 'assigned').length;
  const resolvedInspections = inspections.filter((i) => i.status === 'completed').length;

  return [
    kpi('total-registered', 'Total Registered Donation Boxes', 'Officially registered donation boxes under DCD monitoring.',
      total, total - 39, 1300, 'Boxes', 'Donation Box Registry',
      'Green ≥ 95% registration coverage · Amber 80–94% · Red < 80%',
      'Measures overall registration coverage across monitored areas of the Emirate.', 'number'),
    kpi('compliance-rate', 'Overall Compliance Rate', 'Share of registered boxes currently meeting full regulatory compliance.',
      complianceRate, Math.round((complianceRate - 1.6) * 10) / 10, 95, '%', 'Compliance & Violations Engine',
      'Green ≥ 90% · Amber 80–89% · Red < 80%',
      'Primary regulatory health indicator across all zones and organizations.', 'percent'),
    kpi('non-compliant', 'Unauthorized / Non-Compliant Boxes', 'Boxes currently flagged as non-compliant pending corrective action.',
      nonCompliant, nonCompliant - 6, 40, 'Boxes', 'Compliance & Violations Engine',
      'Green ≤ 40 · Amber 41–90 · Red > 90',
      'Direct exposure metric for enforcement and displacement planning.', 'number'),
    kpi('active-inspections', 'Active Inspection Cases', 'Inspections currently pending or overdue across all field units.',
      activeInspections, activeInspections + 11, 60, 'Cases', 'Inspections Management System',
      'Green ≤ 60 · Amber 61–120 · Red > 120',
      `Includes ${overdueInspections} overdue cases requiring immediate scheduling.`, 'number'),
    kpi('pending-displacement', 'Boxes Awaiting Displacement', 'Non-compliant boxes approved for removal and pending logistics execution.',
      pendingDisplacement, pendingDisplacement + 4, 15, 'Boxes', 'Displacement & Logistics Unit',
      'Green ≤ 20 · Amber 21–35 · Red > 35',
      'Reflects current backlog for field removal and transport operations.', 'number'),
    kpi('safekeeping-value', 'Safekeeping Inventory Value', 'Estimated total value of assets currently held in DCD custody facilities.',
      inventoryValue, Math.round(inventoryValue * 0.92), 500000, 'AED', 'Safekeeping & Inventory Registry',
      'Monitored for custody reconciliation, not a compliance threshold.',
      'Tracks financial exposure of items awaiting management instruction.', 'currency'),
    kpi('open-complaints', 'Open Complaints / DMT Alerts', 'Unresolved complaints and DMT-sourced alerts awaiting assignment or closure.',
      openComplaints, openComplaints + 9, 25, 'Cases', 'Complaints & DMT Alert Center',
      'Green ≤ 25 · Amber 26–50 · Red > 50',
      'SLA-tracked queue spanning public complaints and system-detected alerts.', 'number'),
    kpi('sync-health', 'Data Synchronization Health', 'Integrity of live data sync between field applications and central registry.',
      99.2, 98.7, 99.5, '%', 'Automated Sync Engine',
      'Green ≥ 99% · Amber 95–98.9% · Red < 95%',
      `${resolvedInspections} field records synchronized successfully in the current cycle.`, 'percent'),
  ];
}

export function buildInspectionKPIs(inspections) {
  const pending = inspections.filter((i) => i.status === 'pending').length;
  const overdue = inspections.filter((i) => i.status === 'overdue').length;
  const completedToday = inspections.filter((i) => i.status === 'completed' && new Date(i.scheduledDate).toDateString() === new Date().toDateString()).length;
  const completed = inspections.filter((i) => i.status === 'completed');
  const passRate = completed.length ? Math.round((completed.filter((i) => i.complianceResult === 'pass').length / completed.length) * 1000) / 10 : 0;

  return [
    kpi('total-inspections', 'Total Inspections', 'All inspection cases logged across the current operating period.',
      inspections.length, inspections.length - 34, 600, 'Cases', 'Inspections Management System',
      'Tracked for field capacity planning.', 'Reflects total field inspection workload year-to-date.', 'number'),
    kpi('completed-today', 'Completed Today', 'Inspections closed by field units within the current operational day.',
      completedToday, Math.max(0, completedToday - 3), 25, 'Cases', 'Field Inspection Application',
      'Green ≥ 20 · Amber 10–19 · Red < 10', 'Daily throughput indicator for field inspection teams.', 'number'),
    kpi('pending-inspections', 'Pending Inspections', 'Inspections scheduled but not yet completed.',
      pending, pending + 14, 70, 'Cases', 'Inspections Management System',
      'Green ≤ 70 · Amber 71–140 · Red > 140', 'Active queue awaiting field execution.', 'number'),
    kpi('overdue-inspections', 'Overdue Inspections', 'Inspections past their scheduled date requiring urgent action.',
      overdue, overdue + 6, 20, 'Cases', 'Inspections Management System',
      'Green ≤ 20 · Amber 21–45 · Red > 45', 'Directly impacts regulatory exposure and compliance risk.', 'number'),
    kpi('avg-resolution', 'Average Resolution Time', 'Average time from inspection assignment to case closure.',
      3.4, 3.9, 2.5, 'Days', 'Inspections Management System',
      'Green ≤ 2.5 days · Amber 2.6–4 · Red > 4', 'Tracks field team efficiency and scheduling effectiveness.', 'days'),
    kpi('inspection-compliance-rate', 'Compliance Rate (Inspections)', 'Share of completed inspections resulting in a passing outcome.',
      passRate, Math.max(0, passRate - 2.1), 90, '%', 'Inspections Management System',
      'Green ≥ 90% · Amber 80–89% · Red < 80%', 'Indicates the underlying health of inspected assets.', 'percent'),
    kpi('field-utilization', 'Field Team Utilization', 'Share of available inspector capacity actively deployed.',
      82.5, 79.1, 85, '%', 'Field Operations Roster',
      'Green ≥ 85% · Amber 70–84% · Red < 70%', 'Balances workload distribution across inspection units.', 'percent'),
  ];
}

export function buildComplianceKPIs(boxes, violations) {
  const open = violations.filter((v) => v.status !== 'resolved').length;
  const critical = violations.filter((v) => v.severity === 'critical' && v.status !== 'resolved').length;
  const resolved = violations.filter((v) => v.status === 'resolved').length;
  const counts = new Map();
  violations.forEach((v) => counts.set(v.boxId, (counts.get(v.boxId) || 0) + 1));
  const repeatOffenders = Array.from(counts.values()).filter((c) => c > 1).length;
  const complianceRate = Math.round((boxes.filter((b) => b.status === 'compliant').length / boxes.length) * 1000) / 10;

  return [
    kpi('open-violations', 'Open Violations', 'Violation cases currently unresolved across all zones.',
      open, open + 18, 120, 'Cases', 'Compliance & Violations Engine',
      'Green ≤ 120 · Amber 121–220 · Red > 220', 'Primary enforcement backlog indicator.', 'number'),
    kpi('critical-violations', 'Critical Violations', 'Open violations classified as critical severity.',
      critical, critical + 3, 10, 'Cases', 'Compliance & Violations Engine',
      'Green ≤ 10 · Amber 11–25 · Red > 25', 'Requires immediate escalation to enforcement leadership.', 'number'),
    kpi('avg-resolution-violations', 'Average Resolution Time', 'Average time from violation identification to closure.',
      6.8, 7.6, 5, 'Days', 'Compliance & Violations Engine',
      'Green ≤ 5 days · Amber 5.1–9 · Red > 9', 'Tracks enforcement responsiveness across zones.', 'days'),
    kpi('repeat-offenders', 'Repeat Offenders', 'Donation boxes with more than one recorded violation.',
      repeatOffenders, Math.max(0, repeatOffenders - 2), 15, 'Boxes', 'Compliance & Violations Engine',
      'Green ≤ 15 · Amber 16–30 · Red > 30', 'Signals organizations requiring closer regulatory scrutiny.', 'number'),
    kpi('compliance-improvement', 'Compliance Improvement Rate', 'Change in overall compliance rate over the trailing period.',
      complianceRate, complianceRate - 1.6, 95, '%', 'Compliance & Violations Engine',
      'Green positive trend · Red sustained decline', 'Reflects the net effect of enforcement and remediation activity.', 'percent'),
    kpi('resolved-violations', 'Violations Resolved', 'Violation cases closed after verified corrective action.',
      resolved, Math.max(0, resolved - 12), 150, 'Cases', 'Compliance & Violations Engine',
      'Higher is better · tracked cumulatively.', 'Demonstrates enforcement throughput and case closure velocity.', 'number'),
  ];
}

export function buildDisplacementKPIs(displacements) {
  const pending = displacements.filter((d) => d.status === 'pending').length;
  const inTransit = displacements.filter((d) => d.status === 'in-transit').length;
  const completed = displacements.filter((d) => d.status === 'completed').length;

  return [
    kpi('pending-displacement-ops', 'Pending Displacement', 'Displacement orders awaiting team assignment.',
      pending, pending + 5, 10, 'Cases', 'Displacement & Logistics Unit',
      'Green ≤ 10 · Amber 11–20 · Red > 20', 'Backlog of confirmed removals awaiting logistics dispatch.', 'number'),
    kpi('in-transit', 'In Transit', 'Boxes currently being transported to a safekeeping facility.',
      inTransit, Math.max(0, inTransit - 2), 15, 'Cases', 'Displacement & Logistics Unit',
      'Monitored for fleet capacity planning.', 'Active logistics operations currently underway.', 'number'),
    kpi('completed-removals', 'Completed Removals', 'Displacement operations completed in the current period.',
      completed, Math.max(0, completed - 9), 70, 'Cases', 'Displacement & Logistics Unit',
      'Higher is better · tracked cumulatively.', 'Demonstrates logistics throughput across all teams.', 'number'),
    kpi('avg-removal-time', 'Average Removal Time', 'Average duration from displacement approval to facility receipt.',
      1.8, 2.2, 1.5, 'Days', 'Displacement & Logistics Unit',
      'Green ≤ 1.5 days · Amber 1.6–3 · Red > 3', 'Key efficiency metric for field logistics teams.', 'days'),
    kpi('logistics-capacity', 'Logistics Capacity', 'Share of transport fleet currently available for dispatch.',
      68, 74, 75, '%', 'Fleet Operations Registry',
      'Green ≥ 75% · Amber 50–74% · Red < 50%', 'Determines responsiveness to new displacement orders.', 'percent'),
    kpi('active-vehicles', 'Active Transport Vehicles', 'Vehicles currently assigned to displacement operations.',
      9, 7, 12, 'Vehicles', 'Fleet Operations Registry',
      'Monitored against total registered fleet of 14.', 'Reflects current field logistics deployment.', 'number'),
  ];
}

export function buildSafekeepingKPIs(allInventory) {
  // Only items still in custody count; released or disposed items have left it.
  const inventory = allInventory.filter((i) => i.custodyStatus === 'stored' || i.custodyStatus === 'awaiting-instruction');
  const total = inventory.length;
  const totalValue = inventory.reduce((s, i) => s + i.value, 0);
  const awaiting = inventory.filter((i) => i.custodyStatus === 'awaiting-instruction').length;

  return [
    kpi('total-safekeeping', 'Total Items in Safekeeping', 'Assets currently held in DCD custody facilities.',
      total, Math.max(0, total - 4), 50, 'Items', 'Safekeeping & Inventory Registry',
      'Monitored for facility capacity planning.', 'Represents total custody exposure across all facilities.', 'number'),
    kpi('total-inventory-value', 'Total Inventory Value', 'Estimated combined value of items in custody.',
      totalValue, Math.round(totalValue * 0.91), 500000, 'AED', 'Safekeeping & Inventory Registry',
      'Reconciled monthly against facility audits.', 'Tracks financial exposure of assets awaiting disposition.', 'currency'),
    kpi('awaiting-instruction', 'Items Awaiting Instruction', 'Items pending formal DCD management instruction.',
      awaiting, awaiting + 3, 10, 'Items', 'Safekeeping & Inventory Registry',
      'Green ≤ 10 · Amber 11–20 · Red > 20', 'Backlog requiring management decision on release or disposal.', 'number'),
    kpi('storage-utilization', 'Storage Capacity Utilization', 'Share of total facility storage capacity currently occupied.',
      61, 57, 80, '%', 'Facility Operations',
      'Green ≤ 80% · Amber 81–92% · Red > 92%', 'Determines available capacity for incoming displacement operations.', 'percent'),
    kpi('avg-custody-duration', 'Average Custody Duration', 'Average time items remain in safekeeping before disposition.',
      18.4, 21.2, 15, 'Days', 'Safekeeping & Inventory Registry',
      'Green ≤ 15 days · Amber 16–25 · Red > 25', 'Extended custody duration increases facility load and liability.', 'days'),
  ];
}

export function buildComplaintsKPIs(complaints) {
  const open = complaints.filter((c) => c.status === 'open').length;
  const critical = complaints.filter((c) => c.severity === 'critical' && c.status !== 'resolved').length;
  const resolvedToday = complaints.filter((c) => c.status === 'resolved' && new Date(c.dateReceived).toDateString() === new Date().toDateString()).length;

  return [
    kpi('open-complaints-mod', 'Open Complaints', 'Complaints and alerts awaiting assignment.',
      open, open + 8, 20, 'Cases', 'Complaints & DMT Alert Center',
      'Green ≤ 20 · Amber 21–40 · Red > 40', 'Entry point of the enforcement pipeline.', 'number'),
    kpi('critical-alerts', 'Critical Alerts', 'Unresolved alerts classified as critical severity.',
      critical, critical + 2, 5, 'Cases', 'Complaints & DMT Alert Center',
      'Green ≤ 5 · Amber 6–12 · Red > 12', 'Requires immediate inspection dispatch.', 'number'),
    kpi('avg-response-time', 'Average Response Time', 'Average time from complaint receipt to inspection assignment.',
      5.2, 6.1, 4, 'Hours', 'Complaints & DMT Alert Center',
      'Green ≤ 4 hrs · Amber 4.1–8 · Red > 8', 'Key SLA metric for public-facing responsiveness.', 'hours'),
    kpi('resolved-today', 'Resolved Today', 'Complaint cases closed within the current operational day.',
      resolvedToday, Math.max(0, resolvedToday - 2), 12, 'Cases', 'Complaints & DMT Alert Center',
      'Higher is better · tracked daily.', 'Demonstrates case closure throughput.', 'number'),
    kpi('sla-compliance', 'SLA Compliance', 'Share of complaints resolved within target response window.',
      91.2, 88.9, 95, '%', 'Complaints & DMT Alert Center',
      'Green ≥ 95% · Amber 85–94% · Red < 85%', 'Primary service-level indicator for the complaints pipeline.', 'percent'),
  ];
}

export function buildOrganizationKPIs(organizations, violations = []) {
  const active = organizations.filter((o) => o.registrationStatus === 'active').length;
  const withViolations = organizations.filter((o) => o.openViolations > 0).length;
  const avgScore = Math.round((organizations.reduce((s, o) => s + o.complianceScore, 0) / organizations.length) * 10) / 10;
  const unverifiedOwnership = violations.filter((v) => v.category === 'Incorrect Ownership' && v.status !== 'resolved').length;

  return [
    kpi('registered-orgs', 'Registered Organizations', 'Organizations licensed to operate donation boxes.',
      organizations.length, organizations.length - 1, 20, 'Organizations', 'Organizations & Ownership Registry',
      'Tracked for market coverage.', 'Total licensed charitable and community organizations under DCD.', 'number'),
    kpi('active-orgs', 'Active Organizations', 'Organizations with current, unexpired registration status.',
      active, active - 1, 16, 'Organizations', 'Organizations & Ownership Registry',
      'Green ≥ 90% of total · Amber 75–89% · Red < 75%', 'Reflects the share of organizations in good regulatory standing.', 'number'),
    kpi('orgs-with-violations', 'Organizations with Violations', 'Organizations currently carrying one or more open violations.',
      withViolations, withViolations + 1, 4, 'Organizations', 'Organizations & Ownership Registry',
      'Green ≤ 4 · Amber 5–8 · Red > 8', 'Identifies organizations requiring closer regulatory engagement.', 'number'),
    kpi('avg-org-compliance', 'Average Compliance Score', 'Mean compliance score across all registered organizations.',
      avgScore, avgScore - 1.8, 90, 'Score', 'Organizations & Ownership Registry',
      'Green ≥ 90 · Amber 75–89 · Red < 75', 'Aggregate measure of sector-wide regulatory health.', 'number'),
    kpi('unverified-ownership', 'Unverified Ownership Records', 'Donation boxes with ownership records pending verification.',
      unverifiedOwnership, unverifiedOwnership + 5, 5, 'Boxes', 'Organizations & Ownership Registry',
      'Green ≤ 5 · Amber 6–15 · Red > 15', 'Ownership gaps that must be resolved before compliance certification.', 'number'),
  ];
}

export function buildWorkAllocationKPIs(ctx) {
  const { inspections, complaints, displacements, boxes, inspectors } = ctx;
  const cases = buildCaseQueue({ inspections, complaints, displacements, boxes, inspectors });
  const criticalCases = cases.filter((c) => c.priority === 'critical' || c.priority === 'urgent').length;

  const workloadMap = inspectorWorkloadMap(inspections);
  const totalWorkload = inspectors.reduce((s, ins) => s + (workloadMap[ins.id] || 0), 0);
  const avgWorkload = inspectors.length ? Math.round((totalWorkload / inspectors.length) * 10) / 10 : 0;

  const availableCount = inspectors.filter((ins) => ins.availability !== 'Off Duty').length;
  const capacityPct = inspectors.length ? Math.round((availableCount / inspectors.length) * 1000) / 10 : 0;

  const avgEta = averageResponseEta(cases, inspectors);

  return [
    kpi('wa-open-cases', 'Open Cases Pending Allocation', 'Inspection, complaint, and displacement cases currently awaiting or requiring reassignment.',
      cases.length, Math.max(0, cases.length - 8), 60, 'Cases', 'Work Allocation Console',
      'Green ≤ 60 · Amber 61–120 · Red > 120', 'Primary backlog indicator for the field allocation queue.', 'number'),
    kpi('wa-critical-cases', 'Critical Priority Cases', 'Open cases flagged as critical priority requiring immediate allocation.',
      criticalCases, Math.max(0, criticalCases - 3), 15, 'Cases', 'Work Allocation Console',
      'Green ≤ 15 · Amber 16–30 · Red > 30', 'Cases carrying the highest regulatory or safety exposure if left unassigned.', 'number'),
    kpi('wa-avg-workload', 'Average Field Team Workload', 'Mean number of active cases currently assigned per field inspector.',
      avgWorkload, Math.round((avgWorkload + 1.4) * 10) / 10, 15, 'Cases/Inspector', 'Field Operations Roster',
      'Green ≤ 15 · Amber 16–22 · Red > 22', 'High per-inspector caseload signals a rebalancing opportunity.', 'number'),
    kpi('wa-capacity', 'Field Capacity Available', 'Share of field inspectors currently available or on-field for new assignments.',
      capacityPct, Math.max(0, capacityPct - 4.2), 85, '%', 'Field Operations Roster',
      'Green ≥ 85% · Amber 70–84% · Red < 70%', 'Determines how quickly new critical cases can be reached.', 'percent'),
    kpi('wa-avg-eta', 'Average Response ETA', 'Average estimated time for the nearest available field resource to reach an open case.',
      avgEta, Math.round((avgEta + 3.5) * 10) / 10, 15, 'min', 'Work Allocation Console',
      'Green ≤ 15 min · Amber 16–25 · Red > 25', 'Reflects how well current personnel are positioned relative to open cases.', 'number'),
  ];
}

export function buildGeographicCoverageKPIs(boxes, complaints) {
  const areas = buildGeoAreas(boxes, complaints);
  const quality = buildLocationQuality(boxes);

  const totalBoxes = boxes.length;
  const mapped = quality.verified + quality.overdue;
  const unmapped = totalBoxes - mapped;
  const verificationRate = mapped ? Math.round((quality.verified / mapped) * 1000) / 10 : 0;
  const areasSurveyed = areas.filter((a) => a.surveyStatus === 'Complete').length;
  const coverageGapCount = areas.length - areasSurveyed;
  const overallCoverage = areas.length ? Math.round((areas.reduce((s, a) => s + a.coveragePercentage, 0) / areas.length) * 10) / 10 : 0;

  return [
    kpi('geo-coverage', 'Geographic Coverage', 'Percentage of target geographic areas surveyed.',
      overallCoverage, Math.max(0, overallCoverage - 4.2), 95, '%', 'GIS Command Center',
      'Green ≥ 95% · Amber 80–94% · Red < 80%', "Blends location mapping and field-verification recency across every monitored zone.", 'percent'),
    kpi('geo-areas-surveyed', 'Areas Surveyed', 'Completed geographic survey areas.',
      areasSurveyed, Math.max(0, areasSurveyed - 2), areas.length, 'Zones', 'GIS Command Center',
      `Green = ${areas.length} Zones · Amber ${Math.max(0, areas.length - 4)}–${areas.length - 1} · Red < ${Math.max(0, areas.length - 4)}`,
      'Zones classified Complete after location mapping and field verification.', 'number'),
    kpi('geo-boxes-mapped', 'Mapped Donation Boxes', 'Registered boxes with verified coordinates.',
      mapped, Math.max(0, mapped - 14), 1300, 'Boxes', 'Donation Box Registry',
      'Green ≥ 95% of registry · Amber 85–94% · Red < 85%', 'Core dataset powering every marker on the live GIS coverage map.', 'number'),
    kpi('geo-verification-rate', 'Location Verification Rate', 'Donation boxes with recently verified location data.',
      verificationRate, Math.max(0, verificationRate - 3.1), 95, '%', 'Donation Box Registry',
      'Green ≥ 95% · Amber 85–94% · Red < 85%', 'Share of mapped boxes field-confirmed within the last 90 days.', 'percent'),
    kpi('geo-unmapped', 'Unmapped / Unknown Locations', 'Registered boxes missing valid geographic coordinates.',
      unmapped, unmapped + 6, 10, 'Boxes', 'Donation Box Registry',
      'Green ≤ 10 · Amber 11–35 · Red > 35', 'Records requiring a field visit to confirm exact placement.', 'number'),
    kpi('geo-gaps', 'Coverage Gaps', 'Geographic areas requiring survey or verification.',
      coverageGapCount, coverageGapCount + 1, 0, 'Zones', 'GIS Command Center',
      'Green = 0 · Amber 1–3 · Red > 3', 'Zones flagged Partial or Pending, requiring a targeted field survey.', 'number'),
  ];
}

export function buildLocationIntelligenceKPIs(boxes, complaints, inspections, violations = []) {
  const zones = buildZoneIntelligence(boxes, complaints, inspections);
  const highRisk = zones.filter((z) => z.riskCategory === 'High' || z.riskCategory === 'Critical').length;
  const totalNonCompliant = zones.reduce((s, z) => s + z.nonCompliantBoxes, 0);
  const totalOpenComplaints = zones.reduce((s, z) => s + z.openComplaints, 0);
  const totalOverdueInspections = zones.reduce((s, z) => s + z.overdueInspections, 0);
  const avgRisk = zones.length ? Math.round((zones.reduce((s, z) => s + z.riskScore, 0) / zones.length) * 10) / 10 : 0;
  const priorityActions = buildPriorityActions(zones).filter((a) => a.priority === 'High').length;
  const openViolations = violations.filter((v) => v.status !== 'resolved').length;

  return [
    kpi('li-open-violations', 'Open Violations', 'Violation cases currently unresolved across all monitored zones.',
      openViolations, openViolations + 12, 120, 'Cases', 'Compliance & Violations Engine',
      'Green ≤ 120 · Amber 121–220 · Red > 220', 'Primary enforcement backlog indicator across the Emirate.', 'number'),
    kpi('li-high-risk-zones', 'High-Risk Zones', 'Geographic zones requiring enhanced operational monitoring.',
      highRisk, Math.max(0, highRisk - 1), 4, 'Zones', 'GIS Command Center',
      'Green ≤ 4 · Amber 5–7 · Red > 7', 'Zones classified High or Critical under the composite risk indicator.', 'number'),
    kpi('li-nc-boxes', 'Non-Compliant Donation Boxes', 'Total non-compliant registered donation boxes.',
      totalNonCompliant, totalNonCompliant + 9, 90, 'Boxes', 'Compliance & Violations Engine',
      'Green ≤ 90 · Amber 91–150 · Red > 150', 'Direct driver of the non-compliance component of zone risk.', 'number'),
    kpi('li-open-complaints', 'Open Complaints', 'Unresolved complaints linked to monitored zones.',
      totalOpenComplaints, totalOpenComplaints + 6, 50, 'Cases', 'Complaints & DMT Alert Center',
      'Green ≤ 50 · Amber 51–90 · Red > 90', 'Feeds the complaint-density component of zone risk.', 'number'),
    kpi('li-overdue-inspections', 'Overdue Inspections', 'Inspections that have passed their planned due date.',
      totalOverdueInspections, totalOverdueInspections + 5, 25, 'Cases', 'Inspections Management System',
      'Green ≤ 25 · Amber 26–45 · Red > 45', 'Feeds the inspection-backlog component of zone risk.', 'number'),
    kpi('li-avg-risk', 'Average Zone Risk Score', 'Average composite risk indicator across monitored zones.',
      avgRisk, Math.max(0, avgRisk - 1.8), 15, 'Score', 'GIS Command Center',
      'Green ≤ 15 · Amber 15.1–22 · Red > 22', 'Demonstration indicator — not an official DCD regulatory standard.', 'number'),
    kpi('li-priority-actions', 'Priority Action Areas', 'Zones requiring immediate field or compliance action.',
      priorityActions, Math.max(0, priorityActions - 1), 3, 'Zones', 'Work Allocation Console',
      'Green ≤ 3 · Amber 4–6 · Red > 6', 'High-priority zones currently awaiting a field or compliance action.', 'number'),
  ];
}

/** Operational-exception KPIs shown on the Executive Overview alongside the executive set. */
export function buildExecutiveExceptionKPIs(violations, inspections) {
  const openViolations = violations.filter((v) => v.status !== 'resolved').length;
  // "Due today" means due by end of today, not scheduled on the exact
  // calendar date — a pending inspection scheduled three days ago that still
  // hasn't been picked up is still today's workload, not a vanished case.
  // Matching only an exact date match made this count decay toward zero over
  // a session's runtime as the nearest-dated cases were worked through.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const dueToday = inspections.filter((i) => i.status === 'pending' && new Date(i.scheduledDate) <= endOfToday).length;
  const escalated = inspections.filter((i) => i.status === 'escalated').length;
  const pendingReviews = violations.filter((v) => v.status === 'under-review').length;
  return [
    kpi('strip-open-violations', 'Open Violations', 'Violation cases currently unresolved across all zones.',
      openViolations, openViolations + 12, 120, 'Cases', 'Compliance & Violations Engine',
      'Green ≤ 120 · Amber 121–220 · Red > 220', 'Primary enforcement backlog — opens the full violations register.', 'number'),
    kpi('strip-inspections-due-today', 'Inspections Due Today', 'Pending inspections scheduled for completion today.',
      dueToday, dueToday + 1, 15, 'Cases', 'Inspections Management System',
      'Green ≤ 15 · Amber 16–25 · Red > 25', 'Same-day field workload for inspection teams.', 'number'),
    kpi('strip-escalated-cases', 'Escalated Cases', 'Inspection cases escalated to the Compliance & Inspections Division.',
      escalated, Math.max(0, escalated - 3), 20, 'Cases', 'Inspections Management System',
      'Green ≤ 20 · Amber 21–35 · Red > 35', 'Cases needing senior compliance review before closure.', 'number'),
    kpi('strip-pending-reviews', 'Pending Reviews', 'Violation cases currently under compliance review.',
      pendingReviews, Math.max(0, pendingReviews - 4), 60, 'Cases', 'Compliance & Violations Engine',
      'Green ≤ 60 · Amber 61–100 · Red > 100', 'Cases awaiting a compliance determination.', 'number'),
  ];
}

/**
 * computeDomainKpis — given a domain key and the live app data context,
 * returns that domain's current KPI list. Used by the global KPI Detail
 * Drawer to independently re-derive a fresh, live KPI object from whichever
 * page opened it (so the drawer's graph reflects real, current data).
 */
export function computeDomainKpis(domain, ctx) {
  switch (domain) {
    case 'executive': return buildExecutiveKPIs(ctx.boxes, ctx.inspections, ctx.violations, ctx.displacements, ctx.inventory, ctx.complaints);
    case 'inspections': return buildInspectionKPIs(ctx.inspections);
    case 'compliance': return buildComplianceKPIs(ctx.boxes, ctx.violations);
    case 'displacement': return buildDisplacementKPIs(ctx.displacements);
    case 'safekeeping': return buildSafekeepingKPIs(ctx.inventory);
    case 'complaints': return buildComplaintsKPIs(ctx.complaints);
    case 'organizations': return buildOrganizationKPIs(ctx.organizations, ctx.violations);
    case 'work-allocation': return buildWorkAllocationKPIs(ctx);
    case 'gis-coverage': return buildGeographicCoverageKPIs(ctx.boxes, ctx.complaints);
    case 'gis-intelligence': return buildLocationIntelligenceKPIs(ctx.boxes, ctx.complaints, ctx.inspections, ctx.violations);
    default: return [];
  }
}
