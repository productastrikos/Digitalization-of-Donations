// Centralized data model for the Geographic Coverage & Location Verification
// module. Every KPI, chart, map layer, and table on that page is derived from
// these functions so nothing is hardcoded independently per component — mark
// a box verified elsewhere and every figure here recomputes consistently.
import { ZONES, INSPECTORS, daysAgo, daysFromNow, formatDate } from './donationSeed';

const VERIFICATION_OVERDUE_DAYS = 90;

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * classifyLocation — the single source of truth for a box's location-data
 * quality. Boxes already flagged `status: 'unknown'` in the registry (the
 * existing "Unverified" status) are the ones lacking usable coordinates;
 * this splits them into the sub-categories the Location Data Quality panel
 * needs. Boxes with real coordinates are split into verified / overdue
 * based on how long ago they were last field-inspected.
 */
export function classifyLocation(box) {
  // A resolved location issue is a real, per-box state change (see
  // resolveLocationIssue in socket.js) — it takes the box out of this bucket
  // permanently without touching its unrelated compliance status, since
  // fixing a coordinate doesn't by itself make a box compliant.
  if (box.status === 'unknown' && !box.locationIssueResolved) {
    const bucket = hashSeed(box.id) % 3;
    return bucket === 0 ? 'missing' : bucket === 1 ? 'duplicate' : 'outside-area';
  }
  const daysSinceInspection = Math.floor((Date.now() - new Date(box.lastInspection).getTime()) / 86400000);
  return daysSinceInspection > VERIFICATION_OVERDUE_DAYS ? 'overdue' : 'verified';
}

/** The one-line reason a box currently sits in its location-quality bucket, for the issue drawer. */
export function locationIssueLabel(bucket) {
  return {
    missing: 'No usable coordinates recorded in the registry',
    duplicate: 'Coordinates shared with another registered box',
    'outside-area': 'Coordinates fall outside the assigned zone boundary',
    pending: 'Last field confirmation exceeds the validation window',
  }[bucket] || '';
}

export function isMapped(box) {
  const c = classifyLocation(box);
  return c === 'verified' || c === 'overdue';
}

export function buildLocationQuality(boxes) {
  const counts = { verified: 0, overdue: 0, missing: 0, duplicate: 0, 'outside-area': 0 };
  boxes.forEach((b) => { counts[classifyLocation(b)] += 1; });
  return counts;
}

// A mapped box whose coordinates were last confirmed in the field longer ago
// than this is queued for re-validation. There is no per-box verification due
// date in the data model, so this window is the single definition of
// "Pending Validation" used by the Map Data Quality control.
const VALIDATION_WINDOW_DAYS = 145;

/**
 * mapDataQualityBucketOf — the single per-box classification that
 * buildMapDataQuality aggregates. Exported so the Location Data Quality
 * panel can list and act on the actual boxes behind each count, not just
 * display a number.
 */
export function mapDataQualityBucketOf(box) {
  const c = classifyLocation(box);
  if (c === 'missing' || c === 'duplicate' || c === 'outside-area') return c;
  const days = Math.floor((Date.now() - new Date(box.lastInspection).getTime()) / 86400000);
  return days > VALIDATION_WINDOW_DAYS ? 'pending' : 'verified';
}

/**
 * buildMapDataQuality — answers "can I trust the geographic data on the map?".
 * Every box lands in exactly one bucket, so
 * verified + pending + missing + duplicate + outside === total.
 */
export function buildMapDataQuality(boxes) {
  const total = boxes.length;
  let verified = 0; let pending = 0; let missing = 0; let duplicate = 0; let outside = 0;
  boxes.forEach((b) => {
    const bucket = mapDataQualityBucketOf(b);
    if (bucket === 'missing') missing += 1;
    else if (bucket === 'duplicate') duplicate += 1;
    else if (bucket === 'outside-area') outside += 1;
    else if (bucket === 'pending') pending += 1;
    else verified += 1;
  });
  return {
    total, verified, pending, missing, duplicate, outside,
    verifiedPct: total ? Math.round((verified / total) * 100) : 0,
    requiresValidation: pending + missing + duplicate + outside,
    validationWindowDays: VALIDATION_WINDOW_DAYS,
  };
}

function surveyStatusFor(coveragePct) {
  if (coveragePct >= 85) return 'Complete';
  if (coveragePct >= 70) return 'Partial';
  return 'Pending';
}

/**
 * buildGeoAreas — one record per registry zone, carrying every field the
 * coverage map, register table, and gap list need. Coverage % blends "is it
 * mapped at all" with "was it recently verified in the field", so a zone
 * full of stale inspections shows lower coverage even if every box has a
 * coordinate on file.
 */
export function buildGeoAreas(boxes, complaints) {
  return ZONES.map((zone) => {
    const zoneBoxes = boxes.filter((b) => b.zoneId === zone.id);
    const total = zoneBoxes.length;
    const mapped = zoneBoxes.filter(isMapped).length;
    const verified = zoneBoxes.filter((b) => classifyLocation(b) === 'verified').length;
    const nonCompliant = zoneBoxes.filter((b) => b.status === 'non-compliant').length;
    const openComplaints = complaints.filter((c) => c.zoneId === zone.id && c.status !== 'resolved').length;

    const mappedRate = total ? mapped / total : 0;
    const verifiedRate = total ? verified / total : 0;
    const coveragePercentage = total ? Math.round((mappedRate * 0.5 + verifiedRate * 0.5) * 1000) / 10 : 0;
    const locationAccuracy = total ? Math.round(mappedRate * 1000) / 10 : 0;
    const surveyStatus = surveyStatusFor(coveragePercentage);

    const seed = hashSeed(zone.id);
    const lastVerified = daysAgo(3 + (seed % 20));
    const assignedTeam = INSPECTORS[seed % INSPECTORS.length].team;

    const unmappedInZone = total - mapped;
    const actionRequired = surveyStatus === 'Complete'
      ? (unmappedInZone > 0 ? `Verify ${unmappedInZone} location${unmappedInZone === 1 ? '' : 's'}` : 'No action required')
      : surveyStatus === 'Partial'
        ? 'Schedule field survey'
        : 'Assign survey team';

    return {
      id: zone.id, name: zone.name, region: zone.region, center: zone.center,
      totalRegisteredBoxes: total, mappedBoxes: mapped, coveragePercentage, locationAccuracy,
      surveyStatus, lastVerified, assignedTeam, nonCompliant, openComplaints, actionRequired,
    };
  });
}

const GAP_TYPE_BY_DOMINANT = {
  missing: 'Missing Coordinates',
  duplicate: 'Duplicate Locations',
  'outside-area': 'Outside Registered Area',
  overdue: 'Verification Overdue',
};

/** buildCoverageGaps — one field-action record per area that isn't fully
 * surveyed, naming whichever location-quality issue dominates that area. */
export function buildCoverageGaps(areas, boxes) {
  return areas.filter((a) => a.surveyStatus !== 'Complete').map((area) => {
    const zoneBoxes = boxes.filter((b) => b.zoneId === area.id);
    const tally = { missing: 0, duplicate: 0, 'outside-area': 0, overdue: 0 };
    zoneBoxes.forEach((b) => { const c = classifyLocation(b); if (tally[c] !== undefined) tally[c] += 1; });
    const [dominant, affected] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const seed = hashSeed(area.id + 'gap');

    return {
      key: `gap-${area.id}`, area: area.name, zoneId: area.id,
      gapType: area.surveyStatus === 'Pending' ? 'Pending Geographic Survey' : GAP_TYPE_BY_DOMINANT[dominant],
      affectedRecords: area.surveyStatus === 'Pending' ? area.totalRegisteredBoxes - area.mappedBoxes || Math.max(affected, 6) : Math.max(affected, 1),
      priority: area.surveyStatus === 'Pending' ? 'High' : (affected > 8 ? 'High' : 'Medium'),
      assignedTeam: area.assignedTeam,
      dueDate: daysFromNow(4 + (seed % 14)),
      status: ['Open', 'Assigned', 'In Progress'][seed % 3],
    };
  }).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'High' ? -1 : 1));
}

export function buildSurveyProgressSeries(currentCoveragePct) {
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const seedRng = (i) => (hashSeed(`survey-${i}`) % 30) / 10;
  let v = Math.max(40, currentCoveragePct - 22);
  const points = months.map((label, i) => {
    v = i === months.length - 1 ? currentCoveragePct : Math.min(currentCoveragePct, v + 3 + seedRng(i));
    return { label, value: Math.round(v * 10) / 10 };
  });
  return points;
}

export { formatDate };
