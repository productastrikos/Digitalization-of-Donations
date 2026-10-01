// Centralized data model for the Location Intelligence & Geographic Risk
// Monitoring module. Every KPI, chart, map layer, ranking, and action panel
// on that tab derives from these functions so a change to the underlying
// boxes/complaints/inspections data propagates consistently everywhere.
import { ZONES, INSPECTORS, daysAgo, formatDate } from './donationSeed';
import { buildGeoAreas } from './geoCoverage';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function riskCategoryFor(score) {
  if (score >= 25) return 'Critical';
  if (score >= 18) return 'High';
  if (score >= 10) return 'Moderate';
  return 'Normal';
}

const ISSUE_BY_DOMINANT = {
  nonCompliance: { issue: 'Non-compliance concentration', action: 'Schedule compliance inspection' },
  complaints: { issue: 'Complaint density', action: 'Investigate unresolved complaints' },
  backlog: { issue: 'Inspection backlog', action: 'Assign overdue inspections' },
};

/**
 * buildZoneIntelligence — one record per zone carrying every risk-driving
 * field the KPI cards, risk map, charts, register, and action panel need.
 * The three RiskFactor sub-scores (non-compliance / complaints / backlog)
 * are weighted 55/30/15 into a single composite riskScore, mirroring the
 * legacy calculation so historical framing stays consistent while now
 * exposing each contributing factor individually.
 */
export function buildZoneIntelligence(boxes, complaints, inspections) {
  const areas = buildGeoAreas(boxes, complaints);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  return ZONES.map((zone) => {
    const zBoxes = boxes.filter((b) => b.zoneId === zone.id);
    const registeredBoxes = zBoxes.length;
    const nonCompliantBoxes = zBoxes.filter((b) => b.status === 'non-compliant').length;
    const openComplaints = complaints.filter((c) => c.zoneId === zone.id && c.status !== 'resolved').length;
    const zoneInspections = inspections.filter((i) => i.zoneId === zone.id);
    const overdueInspections = zoneInspections.filter((i) => i.status === 'overdue').length;
    const completedInspections = zoneInspections.filter((i) => i.status === 'completed').length;
    const inspectionCompletionRate = zoneInspections.length
      ? Math.round((completedInspections / zoneInspections.length) * 1000) / 10
      : 0;

    const nonComplianceRate = registeredBoxes ? nonCompliantBoxes / registeredBoxes : 0;
    const complaintDensity = registeredBoxes ? openComplaints / registeredBoxes : 0;

    const nonComplianceScore = Math.round(nonComplianceRate * 55 * 10) / 10;
    const complaintScore = Math.round(complaintDensity * 30 * 10) / 10;
    const inspectionBacklogScore = overdueInspections > 0 ? Math.min(15, Math.round(overdueInspections * 1.8 * 10) / 10) : 0;

    const riskScore = Math.round((nonComplianceScore + complaintScore + inspectionBacklogScore) * 10) / 10;
    const riskCategory = riskCategoryFor(riskScore);

    const seed = hashSeed(zone.id + 'intel');
    const lastInspectionDate = daysAgo(2 + (seed % 18));
    const assignedTeam = INSPECTORS[seed % INSPECTORS.length].team;

    const dominant = [
      ['nonCompliance', nonComplianceScore],
      ['complaints', complaintScore],
      ['backlog', inspectionBacklogScore],
    ].sort((a, b) => b[1] - a[1])[0][0];
    const { issue: primaryIssue, action: recommendedAction } = ISSUE_BY_DOMINANT[dominant];
    const actionStatus = ['Open', 'Assigned', 'In Progress'][seed % 3];

    const area = areaById.get(zone.id);

    return {
      id: zone.id, name: zone.name, region: zone.region, center: zone.center,
      registeredBoxes, nonCompliantBoxes, openComplaints, overdueInspections,
      riskScore, riskCategory, lastVerified: area ? area.lastVerified : lastInspectionDate,
      lastInspectionDate, inspectionCompletionRate,
      geographicCoverage: area ? area.coveragePercentage : 0,
      locationIssues: area ? area.totalRegisteredBoxes - area.mappedBoxes : 0,
      assignedTeam, primaryIssue, recommendedAction, actionStatus,
      riskFactors: { nonComplianceScore, complaintScore, inspectionBacklogScore },
    };
  });
}

export function rankZonesByRisk(zones) {
  return [...zones].sort((a, b) => b.riskScore - a.riskScore);
}

const PRIORITY_BY_CATEGORY = { Critical: 'High', High: 'High', Moderate: 'Medium', Normal: 'Low' };

/**
 * buildPriorityActions — one field-action record per zone flagged Moderate
 * risk or above, so the Priority Geographic Actions panel and the register's
 * "Recommended Action" column always describe the same underlying case.
 */
export function buildPriorityActions(zones) {
  return zones
    .filter((z) => z.riskCategory !== 'Normal')
    .map((z) => ({
      id: `action-${z.id}`, zoneId: z.id, area: z.name,
      issueType: z.primaryIssue, recommendedAction: z.recommendedAction,
      assignedTeam: z.assignedTeam, priority: PRIORITY_BY_CATEGORY[z.riskCategory],
      status: z.actionStatus,
    }))
    .sort((a, b) => rankZonesByRisk(zones).findIndex((z) => z.id === a.zoneId) - rankZonesByRisk(zones).findIndex((z) => z.id === b.zoneId));
}

export function buildRiskTrendSeries(currentAvgRisk) {
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const seedRng = (i) => (hashSeed(`risk-trend-${i}`) % 20) / 10;
  let v = Math.max(10, currentAvgRisk - 4.4);
  return months.map((label, i) => {
    if (i === months.length - 1) v = currentAvgRisk;
    else v = Math.min(currentAvgRisk + 1, v + 0.9 + seedRng(i));
    return { label, value: Math.round(v * 10) / 10 };
  });
}

export { formatDate };
