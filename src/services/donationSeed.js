// ─── Centralized mock data model for DCD Donation Control ───────────────────
// All pages consume data derived from this single seeded generator so the
// platform behaves like one connected operational system rather than a set
// of disconnected static screens.

import { DEFAULT_CRITERIA, DEFAULT_PASS_MARK, generateChecklist, DISPOSAL_CRITERIA_BY_TYPE } from './compliance';
import evdQrFront from '../assets/evidence/real-qr-front.jpg';
import evdPlacementWide from '../assets/evidence/real-placement-wide.jpg';
import evdBoxCondition from '../assets/evidence/real-box-condition.jpg';
import evdDocumentation from '../assets/evidence/real-documentation.jpg';

// Bundled locally (not hotlinked) representative photos for simulated
// evidence — matched to the caption already stored on the record, so a
// "Close-up: box condition" card shows a real box close-up, not a random
// photo. The "Simulated" badge on the card stays in place so this is never
// mistaken for a real field photo of this specific box.
const EVIDENCE_IMAGE_BY_CAPTION = {
  'Front view: QR label': evdQrFront,
  'Wide shot: placement context': evdPlacementWide,
  'Close-up: box condition': evdBoxCondition,
  'Documentation on site': evdDocumentation,
  'Unauthorized placement — wide shot': evdPlacementWide,
};
const evidenceImageFor = (caption) => EVIDENCE_IMAGE_BY_CAPTION[caption] || evdDocumentation;

/* ─── Seeded PRNG (mulberry32) — stable dataset across reloads ───────────── */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  constructor(seed) { this.rand = mulberry32(seed); }
  next() { return this.rand(); }
  int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  float(min, max, d = 1) { const f = 10 ** d; return Math.round((this.next() * (max - min) + min) * f) / f; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  weighted(items) {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [item, w] of items) { r -= w; if (r <= 0) return item; }
    return items[items.length - 1][0];
  }
  bool(p = 0.5) { return this.next() < p; }
}

export function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }
export function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }
export function formatGST(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Dubai' }) + ' GST';
}
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function formatDateTime(iso) {
  return formatDate(iso) + ' · ' + formatGST(iso);
}
export function formatCurrency(n) { return `AED ${Math.round(n).toLocaleString('en-US')}`; }

/* ─── Zones ───────────────────────────────────────────────────────────────── */
export const ZONES = [
  { id: 'Z-ABD-01', name: 'Al Markaziyah / Corniche', region: 'Abu Dhabi City', center: { lat: 24.4764, lng: 54.3705 } },
  { id: 'Z-ABD-02', name: 'Al Bateen', region: 'Abu Dhabi City', center: { lat: 24.4586, lng: 54.3325 } },
  { id: 'Z-ABD-03', name: 'Al Reem Island', region: 'Abu Dhabi City', center: { lat: 24.4964, lng: 54.4058 } },
  { id: 'Z-ABD-04', name: 'Yas Island', region: 'Abu Dhabi City', center: { lat: 24.4966, lng: 54.6046 } },
  { id: 'Z-ABD-05', name: 'Khalifa City', region: 'Abu Dhabi City', center: { lat: 24.4283, lng: 54.5972 } },
  { id: 'Z-ABD-06', name: 'Mussafah Industrial Area', region: 'Abu Dhabi City', center: { lat: 24.3450, lng: 54.4869 } },
  { id: 'Z-ABD-07', name: 'Baniyas', region: 'Abu Dhabi City', center: { lat: 24.3300, lng: 54.6270 } },
  { id: 'Z-ABD-08', name: 'Mohammed Bin Zayed City', region: 'Abu Dhabi City', center: { lat: 24.3132, lng: 54.5306 } },
  { id: 'Z-ABD-09', name: 'Al Shahama', region: 'Abu Dhabi City', center: { lat: 24.5350, lng: 54.6100 } },
  { id: 'Z-AIN-01', name: 'Al Ain City Centre', region: 'Al Ain', center: { lat: 24.2075, lng: 55.7447 } },
  { id: 'Z-AIN-02', name: 'Al Jimi / Al Muwaiji', region: 'Al Ain', center: { lat: 24.2432, lng: 55.7484 } },
  { id: 'Z-DHA-01', name: 'Madinat Zayed', region: 'Al Dhafra', center: { lat: 23.6499, lng: 53.7079 } },
  { id: 'Z-DHA-02', name: 'Ruwais', region: 'Al Dhafra', center: { lat: 24.1111, lng: 52.7297 } },
];
export function zoneById(id) { return ZONES.find((z) => z.id === id); }
export function zoneName(id) { return zoneById(id)?.name || id; }

// Dubai Marina / Palm Jumeirah — chosen over the traditional downtown
// coordinate (25.2048, 55.2708) because OpenMapTiles' road/building density
// there is concentrated in a narrow coastal strip; the old point sat at its
// edge, so any city-level framing showed mostly empty desert to the north.
// This point renders a fully dense view (Palm Jumeirah, full road network)
// across the whole frame at the zoom used for the GIS opening flight.
export const DUBAI = { lat: 25.0805, lng: 55.1403 };
export const ABU_DHABI = { lat: 24.4539, lng: 54.3773 };
export const DUBAI_ABU_DHABI_ROUTE = [
  { lat: 25.2048, lng: 55.2708 },
  { lat: 25.0754, lng: 55.1712 },
  { lat: 25.0116, lng: 55.1330 },
  { lat: 24.8607, lng: 54.9848 },
  { lat: 24.6650, lng: 54.7300 },
  { lat: 24.5350, lng: 54.6100 },
  { lat: 24.4539, lng: 54.3773 },
];
function routeDist(a, b) { return Math.hypot(a.lat - b.lat, a.lng - b.lng); }
export function totalRouteLength(points) {
  let t = 0; for (let i = 1; i < points.length; i++) t += routeDist(points[i - 1], points[i]); return t;
}
export function interpolateAlongRoute(points, t) {
  const clamped = Math.max(0, Math.min(1, t));
  const total = totalRouteLength(points);
  const target = total * clamped;
  let covered = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = routeDist(points[i - 1], points[i]);
    if (covered + segLen >= target || i === points.length - 1) {
      const segT = segLen === 0 ? 0 : (target - covered) / segLen;
      return {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * segT,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * segT,
      };
    }
    covered += segLen;
  }
  return points[points.length - 1];
}

/* ─── Organizations ───────────────────────────────────────────────────────── */
const ORG_NAMES = [
  'Al Noor Charitable Society', 'Watani Foundation for Community Aid', 'Al Ihsan Humanitarian Foundation',
  'Bright Future Charity Association', 'Al Khair Relief Organization', 'Dar Al Wafa Society',
  'Al Rahma Social Support Foundation', 'Zayed Community Welfare Trust', 'Sanad Humanitarian Network',
  'Al Ataa Charitable Trust', 'Emirates Compassion Foundation', 'Al Amal Family Support Society',
  'Ghaith Community Development Foundation', 'Al Wesam Charitable Association', 'Hemaya Social Care Foundation',
  'Marsa Al Khair Relief Society',
];

const BOX_TYPES = ['Fixed Kiosk', 'Mobile Unit', 'Retail Partnership Box', 'Mosque-Affiliated Box', 'Event Temporary Box'];

export const VIOLATION_CATEGORIES = [
  'Unauthorized Placement', 'Missing QR Identification', 'Expired Approval', 'Incorrect Ownership',
  'Damaged Donation Box', 'Unsafe Location', 'Missing Documentation', 'Unapproved Collection Activity',
];

const STREET_FRAGMENTS = [
  'Sheikh Zayed Bin Sultan St', 'Hazza bin Zayed St', 'Airport Rd', 'Muroor Rd', 'Al Falah St',
  'Khalifa Bin Zayed St', 'Al Salam St', 'Coastal Rd', 'Sultan Bin Zayed St', 'Al Nahyan Camp St',
  'Industrial St 14', 'Al Dhafra St', 'Al Reem Blvd', 'Marina Village Rd', 'Al Maryah Blvd',
];

export const FACILITIES = ['Mussafah Central Safekeeping Facility', 'Al Ain Regional Custody Centre', 'Madinat Zayed Storage Depot'];
export const LOGISTICS_TEAMS = ['Logistics Team Alpha', 'Logistics Team Bravo', 'Logistics Team Charlie', 'Logistics Team Delta'];
const TEAMS = LOGISTICS_TEAMS;
export const VEHICLES = ['Transport Unit TV-104', 'Transport Unit TV-112', 'Transport Unit TV-118', 'Transport Unit TV-121', 'Flatbed Unit FB-06'];
const COMPLAINT_SOURCES = ['Public Complaint', 'DMT Alert', 'Field Report', 'Unauthorized Placement Notification', 'Location-Based Alert'];

export const INSPECTORS = [
  { id: 'INS-01', name: 'Ahmed Al Mansoori', team: 'Field Inspection Unit 01', assignedZone: 'Al Markaziyah / Corniche', availability: 'On Field' },
  { id: 'INS-02', name: 'Fatima Al Suwaidi', team: 'Field Inspection Unit 02', assignedZone: 'Al Reem Island', availability: 'On Field' },
  { id: 'INS-03', name: 'Khalid Al Marzooqi', team: 'Field Inspection Unit 03', assignedZone: 'Mussafah Industrial Area', availability: 'On Field' },
  { id: 'INS-04', name: 'Mariam Al Shamsi', team: 'Field Inspection Unit 04', assignedZone: 'Khalifa City', availability: 'Available' },
  { id: 'INS-05', name: 'Saeed Al Kaabi', team: 'Field Inspection Unit 05', assignedZone: 'Baniyas', availability: 'On Field' },
  { id: 'INS-06', name: 'Noura Al Dhaheri', team: 'Field Inspection Unit 01', assignedZone: 'Al Bateen', availability: 'Off Duty' },
  { id: 'INS-07', name: 'Hamdan Al Nuaimi', team: 'Field Inspection Unit 06', assignedZone: 'Al Ain City Centre', availability: 'On Field' },
  { id: 'INS-08', name: 'Shamma Al Ameri', team: 'Field Inspection Unit 02', assignedZone: 'Yas Island', availability: 'Available' },
  { id: 'INS-09', name: 'Rashed Al Falasi', team: 'Field Inspection Unit 07', assignedZone: 'Madinat Zayed', availability: 'On Field' },
  { id: 'INS-10', name: 'Aisha Al Ketbi', team: 'Field Inspection Unit 03', assignedZone: 'Mohammed Bin Zayed City', availability: 'On Field' },
];

function actionForStatus(status) {
  switch (status) {
    case 'compliant': return 'Routine Monitoring';
    case 'under-inspection': return 'Field Inspection Scheduled';
    case 'non-compliant': return 'Corrective Action Required';
    case 'pending-displacement': return 'Awaiting Removal Team';
    case 'safekeeping': return 'Pending Management Instruction';
    default: return 'Verification Required';
  }
}

export function violationDescription(cat) {
  const map = {
    'Unauthorized Placement': 'Donation box identified at a location without prior DCD placement approval.',
    'Missing QR Identification': 'QR identification label missing or unreadable during field verification.',
    'Expired Approval': "Organization's placement approval has lapsed beyond the permitted renewal window.",
    'Incorrect Ownership': 'Registered ownership record does not match the organization operating the box.',
    'Damaged Donation Box': 'Physical structure shows damage affecting collection integrity or public safety.',
    'Unsafe Location': 'Box positioned in a manner that obstructs pedestrian access or public safety egress.',
    'Missing Documentation': 'Supporting licensing or campaign documentation could not be produced on inspection.',
    'Unapproved Collection Activity': 'Collection activity observed outside the scope of the approved campaign.',
  };
  return map[cat];
}

/**
 * generateInitialState — builds the full, cross-referenced demo dataset once.
 * Every collection returned here is consumed identically by every page via
 * the DonationDataProvider context (see socket.js).
 */
export function generateInitialState() {
  const rng = new Rng(19870424);
  const TOTAL_BOXES = 1248;

  const organizations = ORG_NAMES.map((name, i) => {
    const id = `ORG-${String(i + 1).padStart(3, '0')}`;
    return {
      id, name,
      licenseNumber: `CN-${rng.int(1000, 4999)}-${rng.int(10, 99)}`,
      registrationStatus: rng.weighted([['active', 80], ['pending', 8], ['suspended', 7], ['expired', 5]]),
      approvedActivities: rng.pick([
        ['Cash Collection', 'In-Kind Donations'], ['Cash Collection'],
        ['In-Kind Donations', 'Seasonal Campaigns'], ['Cash Collection', 'In-Kind Donations', 'Seasonal Campaigns'],
      ]),
      registeredBoxes: 0,
      complianceScore: rng.int(58, 99),
      openViolations: 0,
      lastInspection: daysAgo(rng.int(1, 120)),
      contactName: rng.pick(['Yousef Al Hammadi', 'Reem Al Zaabi', 'Omar Al Mazrouei', 'Latifa Al Qubaisi', 'Sultan Al Dhaheri']),
      contactPhone: `+971 5${rng.int(0, 9)} ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
      contactEmail: `compliance@${name.toLowerCase().replace(/[^a-z]+/g, '')}.ae`,
    };
  });

  const STATUS_WEIGHTS = [
    ['compliant', 82], ['non-compliant', 6.5], ['under-inspection', 5],
    ['pending-displacement', 2.8], ['safekeeping', 2.2], ['unknown', 1.5],
  ];

  const boxes = [];
  for (let i = 1; i <= TOTAL_BOXES; i++) {
    const zone = rng.pick(ZONES);
    const org = rng.pick(organizations);
    const status = rng.weighted(STATUS_WEIGHTS);
    const id = `DCD-${String(i).padStart(5, '0')}`;

    let complianceScore;
    switch (status) {
      case 'compliant': complianceScore = rng.int(85, 100); break;
      case 'under-inspection': complianceScore = rng.int(55, 82); break;
      case 'non-compliant': complianceScore = rng.int(25, 62); break;
      case 'pending-displacement': complianceScore = rng.int(15, 48); break;
      case 'safekeeping': complianceScore = rng.int(0, 40); break;
      default: complianceScore = rng.int(40, 60);
    }

    const lastInspection = daysAgo(rng.int(1, 150));
    const overdue = rng.bool(0.14);
    const nextInspection = overdue ? daysAgo(rng.int(1, 20)) : daysFromNow(rng.int(1, 75));
    const jitter = (v, span) => v + (rng.next() - 0.5) * span;

    boxes.push({
      id, qrCode: `QR-${String(i).padStart(5, '0')}`,
      location: { lat: jitter(zone.center.lat, 0.09), lng: jitter(zone.center.lng, 0.09) },
      address: `${rng.pick(STREET_FRAGMENTS)}, ${zone.name}`,
      zoneId: zone.id, organizationId: org.id, boxType: rng.pick(BOX_TYPES),
      donationType: rng.weighted([['Cash', 38], ['In-Kind', 62]]), status,
      registrationDate: daysAgo(rng.int(60, 900)), lastInspection, nextInspection, complianceScore,
      currentAction: actionForStatus(status), evidenceAvailable: rng.bool(0.7),
      previousViolations: status === 'compliant' ? rng.int(0, 1) : rng.int(0, 4),
    });
  }

  for (const org of organizations) {
    const orgBoxes = boxes.filter((b) => b.organizationId === org.id);
    org.registeredBoxes = orgBoxes.length;
  }

  const inspections = [];
  for (let i = 0, n = 1; i < 520; i++, n++) {
    const box = boxes[rng.int(0, boxes.length - 1)];
    const inspector = rng.pick(INSPECTORS);
    const status = rng.weighted([['completed', 58], ['pending', 20], ['overdue', 13], ['escalated', 9]]);
    // Pending inspections are a near-term operational queue, not a flat
    // month-long spread — a real field team's schedule is front-loaded, with
    // a shrinking tail further out. Squaring a uniform draw biases toward 0
    // so "due today/this week" stays a meaningful, non-trivial count instead
    // of the ~1-in-31 share a uniform 0-30 day spread would produce.
    const pendingDaysOut = Math.min(30, Math.floor((rng.float(0, 1, 4) ** 2) * 31));
    const scheduledDate = status === 'completed' ? daysAgo(rng.int(0, 120)) : status === 'overdue' ? daysAgo(rng.int(1, 25)) : daysFromNow(pendingDaysOut);
    inspections.push({
      id: `INSP-${String(n).padStart(5, '0')}`, boxId: box.id, zoneId: box.zoneId, inspectorId: inspector.id,
      inspectionType: rng.weighted([['Routine', 55], ['Complaint-Driven', 20], ['Follow-up', 18], ['Registration Verification', 7]]),
      scheduledDate, status,
      complianceResult: status === 'completed' ? rng.weighted([['pass', 78], ['fail', 22]]) : 'pending',
      priority: rng.weighted([['routine', 60], ['priority', 30], ['urgent', 10]]),
      nextAction: status === 'completed' ? 'Filed — No Further Action' : status === 'escalated' ? 'Escalated to Compliance Unit' : 'Field Visit Required',
    });
  }
  inspections.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

  // SIMULATED: checklist results and evidence records for completed inspections.
  // A separate RNG keeps the primary dataset above stable.
  const extraRng = new Rng(20260921);
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const EVIDENCE_CAPTIONS = ['Front view: QR label', 'Wide shot: placement context', 'Close-up: box condition', 'Documentation on site'];
  for (const insp of inspections) {
    if (insp.status !== 'completed') continue;
    insp.checklist = generateChecklist(insp.complianceResult, DEFAULT_CRITERIA, () => extraRng.next());
    const box = boxById.get(insp.boxId);
    insp.evidence = [];
    if (box && box.evidenceAvailable) {
      const n = extraRng.int(1, 3);
      const inspector = INSPECTORS.find((x) => x.id === insp.inspectorId);
      for (let k = 0; k < n; k++) {
        const evdCaption = EVIDENCE_CAPTIONS[(k + extraRng.int(0, 3)) % 4];
        insp.evidence.push({
          id: `EVD-${insp.id.slice(5)}-${k + 1}`, kind: 'photo', caption: evdCaption,
          image: evidenceImageFor(evdCaption), simulated: true,
          capturedAt: new Date(new Date(insp.scheduledDate).getTime() + (k + 1) * 4 * 60000).toISOString(),
          inspectorId: insp.inspectorId, inspectorName: inspector ? inspector.name : 'Unassigned',
          lat: box.location.lat + (extraRng.next() - 0.5) * 0.0004, lng: box.location.lng + (extraRng.next() - 0.5) * 0.0004,
          coordsSource: 'device GPS (simulated)',
        });
      }
    }
  }

  // Every violation must originate from an inspection: reuse a completed,
  // failed inspection already on file for the box, or — if none exists,
  // since inspections and boxes are otherwise independently sampled above —
  // synthesize the missing inspection record (with its own evidence and
  // checklist, exactly like a real completed inspection) so the link is
  // never broken. `backfilledInspectionCount` is reported by generateInitialState.
  let backfilledInspectionCount = 0;
  const usedInspectionIds = new Set();
  function originInspectionFor(box, whenIso) {
    const existing = inspections.find((insp) => insp.boxId === box.id && insp.status === 'completed' && insp.complianceResult === 'fail' && !usedInspectionIds.has(insp.id));
    if (existing) { usedInspectionIds.add(existing.id); return existing; }
    const inspector = INSPECTORS.find((x) => x.assignedZone === zoneById(box.zoneId)?.name) || rng.pick(INSPECTORS);
    const scheduledDate = whenIso || daysAgo(rng.int(1, 160));
    const insp = {
      id: `INSP-${String(inspections.length + 1).padStart(5, '0')}`, boxId: box.id, zoneId: box.zoneId, inspectorId: inspector.id,
      inspectionType: 'Complaint-Driven', scheduledDate, status: 'completed', complianceResult: 'fail',
      priority: 'priority', nextAction: 'Filed — No Further Action', completedAt: scheduledDate, completedBy: inspector.name,
      checklist: generateChecklist('fail', DEFAULT_CRITERIA, () => extraRng.next()), evidence: [],
    };
    if (box.evidenceAvailable) {
      const n = extraRng.int(1, 3);
      for (let k = 0; k < n; k++) {
        const evdCaption = EVIDENCE_CAPTIONS[(k + extraRng.int(0, 3)) % 4];
        insp.evidence.push({
          id: `EVD-${insp.id.slice(5)}-${k + 1}`, kind: 'photo', caption: evdCaption,
          image: evidenceImageFor(evdCaption), simulated: true, capturedAt: new Date(new Date(scheduledDate).getTime() + (k + 1) * 4 * 60000).toISOString(),
          inspectorId: inspector.id, inspectorName: inspector.name,
          lat: box.location.lat + (extraRng.next() - 0.5) * 0.0004, lng: box.location.lng + (extraRng.next() - 0.5) * 0.0004,
          coordsSource: 'device GPS (simulated)',
        });
      }
    }
    inspections.push(insp);
    usedInspectionIds.add(insp.id);
    backfilledInspectionCount += 1;
    return insp;
  }

  const violations = [];
  let vn = 1;
  const violationCandidates = boxes.filter((b) => b.status === 'non-compliant' || b.status === 'pending-displacement' || b.previousViolations > 0);
  for (const box of violationCandidates) {
    const num = box.status === 'non-compliant' ? rng.int(1, 2) : 1;
    for (let i = 0; i < num; i++) {
      const severity = rng.weighted([['critical', 8], ['high', 24], ['medium', 43], ['low', 25]]);
      const status = box.status === 'compliant' ? 'resolved' : rng.weighted([['open', 55], ['under-review', 25], ['resolved', 20]]);
      const category = rng.pick(VIOLATION_CATEGORIES);
      const dateIdentified = daysAgo(rng.int(1, 160));
      const origin = originInspectionFor(box, dateIdentified);
      violations.push({
        id: `VIO-${String(vn++).padStart(5, '0')}`, boxId: box.id, organizationId: box.organizationId, zoneId: box.zoneId,
        category, severity, status, dateIdentified, inspectionId: origin.id,
        resolutionDate: status === 'resolved' ? daysAgo(rng.int(0, 40)) : undefined,
        description: violationDescription(category),
      });
    }
  }
  violations.sort((a, b) => new Date(b.dateIdentified) - new Date(a.dateIdentified));
  inspections.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

  // Derived after violations exist so every view (KPI cards, tables, charts,
  // drawers) that reads org.openViolations agrees with the actual violation
  // records — rather than a separate box-status heuristic that could drift.
  for (const org of organizations) {
    org.openViolations = violations.filter((v) => v.organizationId === org.id && v.status !== 'resolved').length;
  }

  const displacements = [];
  let dn = 1;
  for (const box of boxes.filter((b) => b.status === 'pending-displacement')) {
    displacements.push({
      id: `DSP-${String(dn++).padStart(5, '0')}`, boxId: box.id, pickupLocation: box.address,
      destinationFacility: rng.pick(FACILITIES), assignedTeam: rng.pick(TEAMS), vehicle: rng.pick(VEHICLES),
      status: rng.weighted([['pending', 45], ['assigned', 30], ['in-transit', 25]]),
      scheduledDate: daysFromNow(rng.int(0, 10)), priority: rng.weighted([['routine', 40], ['priority', 40], ['urgent', 20]]),
    });
  }
  for (let i = 0; i < 58; i++) {
    const box = rng.pick(boxes);
    displacements.push({
      id: `DSP-${String(dn++).padStart(5, '0')}`, boxId: box.id, pickupLocation: box.address,
      destinationFacility: rng.pick(FACILITIES), assignedTeam: rng.pick(TEAMS), vehicle: rng.pick(VEHICLES),
      status: 'completed', scheduledDate: daysAgo(rng.int(1, 90)),
      priority: rng.weighted([['routine', 50], ['priority', 35], ['urgent', 15]]),
    });
  }
  displacements.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

  // Cash discrepancy detection thresholds — any handoff whose counted amount
  // misses the previous handoff's amount by at least this much (AED or %)
  // auto-creates a Cash Discrepancy case. Above ESCALATION_THRESHOLD_AED, the
  // case also requires Admin-level sign-off before it can be closed.
  const DISCREPANCY_THRESHOLD_AED = 200;
  const DISCREPANCY_THRESHOLD_PCT = 3;
  const ESCALATION_THRESHOLD_AED = 2000;
  const RECON_OFFICERS = ['Compliance Officer 02', 'Compliance Officer 05', 'Director, Compliance & Inspections'];

  function buildValueLedger(box, received, facility) {
    // A sequential ledger: each handoff's "expected" amount is the previous
    // handoff's counted "actual" amount, not an independently rolled number —
    // a discrepancy can only ever be the difference between two real counts.
    // Every stage after collection happens at this item's own facility, not
    // an independently rolled one.
    const declared = rng.int(800, 42000);
    const stages = [
      { stage: 'Collected', location: box.address, countedBy: rng.pick(TEAMS), timestamp: received, matchOdds: 0.82 },
      { stage: 'Received at Facility', location: facility, countedBy: 'Facility Intake Officer', timestamp: daysAgo(rng.int(0, 2)), matchOdds: 0.88 },
      { stage: 'Custody Verification', location: facility, countedBy: 'Custody Verification Unit', timestamp: daysAgo(rng.int(0, 1)), matchOdds: 0.92 },
    ];
    let expected = declared;
    const ledger = stages.map((s, i) => {
      const actual = rng.bool(s.matchOdds) ? expected : Math.round(expected * rng.float(0.85, 1.15, 3));
      const variance = actual - expected;
      const variancePct = expected ? Math.round((variance / expected) * 1000) / 10 : 0;
      const entry = {
        id: `VL-${box.id}-${i + 1}`, stage: s.stage, location: s.location,
        expectedAmount: expected, actualAmount: actual, countedBy: s.countedBy, timestamp: s.timestamp,
        variance, variancePct, discrepancy: Math.abs(variance) >= DISCREPANCY_THRESHOLD_AED || Math.abs(variancePct) >= DISCREPANCY_THRESHOLD_PCT,
      };
      expected = actual;
      return entry;
    });
    return ledger;
  }

  const inventory = [];
  const cashDiscrepancies = [];
  let iv = 1;
  let cdn = 1;
  for (const box of boxes.filter((b) => b.status === 'safekeeping')) {
    const received = daysAgo(rng.int(2, 200));
    // Contents collected from a Cash box are always classified Cash; an
    // In-Kind box's contents are classified into the categories DCD actually
    // handles in safekeeping — never a random/unrelated label.
    const contentCategory = box.donationType === 'Cash' ? 'Cash' : rng.pick(['Food', 'Clothing', 'Medical', 'Household', 'Other In-Kind']);
    // classification follows the same box, not a second independent roll —
    // a Cash box's contents can't land in an "In-Kind Collection Unit".
    const classification = box.donationType === 'Cash' ? 'Cash Donation Box' : rng.weighted([['In-Kind Collection Unit', 80], ['Mixed Collection Unit', 20]]);
    const isCashLike = classification === 'Cash Donation Box' || classification === 'Mixed Collection Unit';
    const invId = `INV-${String(iv++).padStart(5, '0')}`;
    const facility = rng.pick(FACILITIES);

    let value = rng.int(800, 42000);
    let valueLedger; let discrepancyStatus;
    if (isCashLike) {
      valueLedger = buildValueLedger(box, received, facility);
      value = valueLedger[valueLedger.length - 1].actualAmount;
      discrepancyStatus = 'reconciled';
      const flagged = valueLedger.find((e) => e.discrepancy);
      if (flagged) {
        const requiresAdminSignoff = Math.abs(flagged.variance) >= ESCALATION_THRESHOLD_AED;
        const status = rng.weighted([['flagged', 20], ['verified', 20], ['investigation', 20], ['resolved', 25], ['closed', 15]]);
        const resolutionType = (status === 'resolved' || status === 'closed')
          ? rng.weighted([['explained', 45], ['written-off', 35], ['misappropriation', 20]]) : undefined;
        const createdAt = flagged.timestamp;
        const hoursAfter = (h) => new Date(new Date(createdAt).getTime() + h * 3600000).toISOString();
        cashDiscrepancies.push({
          id: `CD-${String(cdn++).padStart(5, '0')}`, inventoryId: invId, boxId: box.id,
          ledgerEntryId: flagged.id, ledgerStage: flagged.stage,
          expectedAmount: flagged.expectedAmount, actualAmount: flagged.actualAmount,
          variance: flagged.variance, variancePct: flagged.variancePct,
          status, resolutionType,
          resolutionNote: resolutionType === 'explained' ? 'Counted amount confirmed correct — prior count used an outdated exchange estimate.'
            : resolutionType === 'written-off' ? 'Variance below materiality threshold for recovery — written off per DCD policy.'
              : resolutionType === 'misappropriation' ? 'Custody records could not account for the shortfall — referred for disciplinary and recovery action.' : undefined,
          requiresAdminSignoff, signedOffBy: requiresAdminSignoff && (status === 'resolved' || status === 'closed') ? 'System Administrator' : undefined,
          assignedOfficer: rng.pick(RECON_OFFICERS), createdAt,
          verifiedAt: ['verified', 'investigation', 'resolved', 'closed'].includes(status) ? hoursAfter(3) : undefined,
          investigationStartedAt: ['investigation', 'resolved', 'closed'].includes(status) ? hoursAfter(9) : undefined,
          resolvedAt: ['resolved', 'closed'].includes(status) ? hoursAfter(30) : undefined,
          closedAt: status === 'closed' ? hoursAfter(48) : undefined,
        });
        discrepancyStatus = status === 'flagged' || status === 'verified' || status === 'investigation' ? 'under-review'
          : resolutionType === 'explained' ? 'reconciled' : 'discrepancy-confirmed';
      }
    }

    inventory.push({
      id: invId, boxId: box.id, facility, dateReceived: received,
      condition: rng.weighted([['Good', 55], ['Fair', 33], ['Damaged', 12]]),
      classification,
      contentCategory, quantity: contentCategory === 'Cash' ? undefined : rng.int(1, 40),
      custodyStatus: rng.weighted([['stored', 55], ['awaiting-instruction', 35], ['released', 7], ['disposed', 3]]),
      value, valueLedger, discrepancyStatus,
      chainOfCustody: [
        { stage: 'Collected', timestamp: received, actor: rng.pick(TEAMS) },
        { stage: 'Received at Facility', timestamp: daysAgo(rng.int(0, 2)), actor: 'Facility Intake Officer' },
        { stage: 'Inspected', timestamp: daysAgo(rng.int(0, 1)), actor: 'Custody Verification Unit' },
      ],
      releaseInstruction: rng.bool(0.3) ? 'Pending DCD Management Instruction' : undefined,
    });
  }

  // SIMULATED: disposal / demolition / release requests. Every item already
  // disposed or released has an approved and executed request on record.
  const disposalRequests = [];
  let dr = 1;
  const decisionNotes = ['Criteria evidenced in the inspection file.', 'Approved per DCD management instruction.', 'Confirmed against custody records.'];
  for (const item of inventory) {
    const closed = item.custodyStatus === 'disposed' || item.custodyStatus === 'released';
    const roll = extraRng.next();
    let status = null;
    if (closed) status = 'executed';
    else if (item.custodyStatus === 'awaiting-instruction' && roll < 0.14) status = 'pending';
    else if (item.custodyStatus === 'awaiting-instruction' && roll < 0.2) status = 'rejected';
    else if (item.custodyStatus === 'stored' && roll < 0.05) status = 'approved';
    if (!status) continue;
    const type = item.custodyStatus === 'released' ? 'Release' : item.condition === 'Damaged' ? 'Demolition' : 'Disposal';
    const pool = DISPOSAL_CRITERIA_BY_TYPE[type];
    const requestedAt = daysAgo(extraRng.int(3, 60));
    const decidedAt = status === 'pending' ? undefined : new Date(new Date(requestedAt).getTime() + 86400000).toISOString();
    disposalRequests.push({
      id: `DSR-${String(dr++).padStart(5, '0')}`, inventoryId: item.id, boxId: item.boxId, type,
      criteria: [pool[extraRng.int(0, pool.length - 1)]], reason: `${type} of ${item.classification} held at ${item.facility}.`,
      requestedBy: 'Compliance Officer 02', requestedRole: 'Compliance Officer', requestedAt, status,
      approver: decidedAt ? 'Director, Compliance & Inspections' : undefined, decidedAt,
      decisionNote: decidedAt ? (status === 'rejected' ? 'Insufficient supporting evidence.' : decisionNotes[extraRng.int(0, 2)]) : undefined,
      executedAt: status === 'executed' ? new Date(new Date(requestedAt).getTime() + 2 * 86400000).toISOString() : undefined,
      executedBy: status === 'executed' ? 'Logistics Coordinator' : undefined,
    });
  }

  const complaints = [];
  let cn = 1;
  for (let i = 0; i < 150; i++) {
    const zone = rng.pick(ZONES);
    const linkBox = rng.bool(0.65) ? rng.pick(boxes) : undefined;
    const status = rng.weighted([['open', 30], ['assigned', 25], ['resolved', 45]]);
    complaints.push({
      id: `CMP-${String(cn++).padStart(5, '0')}`, source: rng.pick(COMPLAINT_SOURCES),
      location: linkBox ? linkBox.address : `${rng.pick(STREET_FRAGMENTS)}, ${zone.name}`,
      zoneId: zone.id, boxId: linkBox?.id,
      severity: rng.weighted([['critical', 6], ['high', 20], ['medium', 44], ['low', 30]]),
      dateReceived: daysAgo(rng.int(0, 60)), assignedTeam: rng.pick(INSPECTORS).team, status,
      resolution: status === 'resolved' ? rng.pick(['Verified — No Violation Found', 'Inspection Conducted — Corrective Action Issued', 'Box Relocated per Approval', 'Duplicate Report — Closed']) : undefined,
    });
  }
  complaints.sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived));

  const auditLog = [];
  const auditUsers = ['Compliance Officer 02', 'Compliance Officer 05', 'Field Supervisor 01', 'System Automation', 'Registry Administrator', 'Inspections Coordinator'];
  const AUDIT_ROLE = {
    'Compliance Officer 02': 'Compliance Officer', 'Compliance Officer 05': 'Compliance Officer', 'Field Supervisor 01': 'Field Inspector',
    'System Automation': 'System', 'Registry Administrator': 'System Administrator', 'Inspections Coordinator': 'Compliance Officer',
  };
  const auditActions = [
    { a: 'Updated donation box status', prev: 'Under Inspection', next: 'Compliant' },
    { a: 'Registered new donation box', prev: undefined, next: 'Registered' },
    { a: 'Logged field inspection result', prev: 'Pending', next: 'Completed' },
    { a: 'Flagged violation', prev: 'Compliant', next: 'Non-Compliant' },
    { a: 'Approved displacement order', prev: 'Non-Compliant', next: 'Pending Displacement' },
    { a: 'Confirmed safekeeping receipt', prev: 'In Transit', next: 'Safekeeping' },
    { a: 'Closed complaint case', prev: 'Open', next: 'Resolved' },
    { a: 'Updated organization license record', prev: 'Pending', next: 'Active' },
  ];
  let an = 1;
  for (let i = 0; i < 220; i++) {
    const act = rng.pick(auditActions);
    const box = rng.pick(boxes);
    const auditUser = rng.pick(auditUsers);
    auditLog.push({
      id: `AUD-${String(an++).padStart(6, '0')}`, timestamp: daysAgo(rng.float(0, 45, 3)), user: auditUser, role: AUDIT_ROLE[auditUser] || 'System',
      action: `${act.a} — ${box.id}`, previousStatus: act.prev, newStatus: act.next,
      entityType: 'Donation Box', entityId: box.id, before: { status: act.prev || null }, after: { status: act.next },
      source: rng.pick(['Field Inspection Application', 'DCD Registry Portal', 'Automated Sync Engine', 'DMT Integration']),
    });
  }
  // ─── Demonstration Scenario: DBX-001843 ───────────────────────────────────
  // One fully linked, deterministic thread through every stage of the
  // regulatory lifecycle — DMT alert → box → inspection → violation →
  // removal → transport → storage → inventory — so a reviewer can follow a
  // single donation box end-to-end using nothing but the app's existing
  // Registry, QR view, Inspections, Compliance, Displacement, Safekeeping
  // and Audit Log screens. Every ID below is real and cross-referenced; none
  // of it is narrated text bolted on top of unrelated numbers.
  {
    const demoOrg = organizations[1];
    const demoZone = zoneById('Z-ABD-06'); // Mussafah Industrial Area
    const today = new Date();
    const at = (h, m) => { const d = new Date(today); d.setHours(h, m, 0, 0); return d.toISOString(); };

    const demoBox = {
      id: 'DBX-001843', qrCode: 'QR-DBX-001843',
      location: { lat: demoZone.center.lat + 0.004, lng: demoZone.center.lng - 0.006 },
      address: 'Industrial St 14, Mussafah Industrial Area',
      zoneId: demoZone.id, organizationId: demoOrg.id, boxType: 'Mobile Unit', donationType: 'In-Kind',
      registrationDate: daysAgo(410), lastInspection: at(11, 5), nextInspection: daysFromNow(30),
      complianceScore: 42, status: 'safekeeping', currentAction: 'Pending Management Instruction',
      evidenceAvailable: true, previousViolations: 1,
    };
    boxes.push(demoBox);

    const demoInspector = INSPECTORS.find((i) => i.id === 'INS-03'); // covers Mussafah Industrial Area
    const demoInspectionId = 'INSP-DBX1843';
    inspections.unshift({
      id: demoInspectionId, boxId: demoBox.id, zoneId: demoZone.id, inspectorId: demoInspector.id,
      inspectionType: 'Complaint-Driven', scheduledDate: at(10, 27), status: 'completed',
      complianceResult: 'fail', priority: 'urgent', nextAction: 'Violation Filed — Removal Recommended',
      completedAt: at(11, 5), completedBy: demoInspector.name, sourceAlertId: 'DMT-2026-00481',
      checklist: generateChecklist('fail', DEFAULT_CRITERIA, () => extraRng.next()),
      evidence: [{
        id: 'EVD-DBX1843-1', kind: 'photo', caption: 'Unauthorized placement — wide shot', image: evidenceImageFor('Unauthorized placement — wide shot'), simulated: true,
        capturedAt: at(10, 55), inspectorId: demoInspector.id, inspectorName: demoInspector.name,
        lat: demoBox.location.lat, lng: demoBox.location.lng, coordsSource: 'device GPS (simulated)',
      }],
    });

    const demoViolationId = 'VIO-DBX1843';
    violations.unshift({
      id: demoViolationId, boxId: demoBox.id, organizationId: demoOrg.id, zoneId: demoZone.id,
      category: 'Unauthorized Placement', severity: 'high', status: 'resolved', dateIdentified: at(11, 8),
      resolutionDate: at(15, 29), description: violationDescription('Unauthorized Placement'),
      inspectionId: demoInspectionId, assignedOfficer: 'Field Supervisor 01',
    });

    const demoRemovalId = 'REM-2026-00482';
    displacements.unshift({
      id: demoRemovalId, boxId: demoBox.id, pickupLocation: demoBox.address,
      destinationFacility: 'Mussafah Central Safekeeping Facility', assignedTeam: 'Logistics Team Alpha',
      vehicle: 'Transport Unit TV-104', status: 'completed', scheduledDate: at(13, 42), priority: 'urgent',
      approvedBy: 'Director, Compliance & Inspections', approvedAt: at(11, 41),
      departureTime: at(13, 42), arrivalTime: at(15, 22), receivingOfficer: 'Facility Intake Officer',
      violationRef: demoViolationId,
    });

    const demoInventoryId = 'INV-DBX1843';
    inventory.unshift({
      id: demoInventoryId, boxId: demoBox.id, facility: 'Mussafah Central Safekeeping Facility',
      dateReceived: at(15, 22), condition: 'Good', classification: 'In-Kind Collection Unit',
      contentCategory: 'Household', quantity: 14, custodyStatus: 'awaiting-instruction', value: 3200,
      chainOfCustody: [
        { stage: 'Collected', timestamp: at(13, 42), actor: 'Logistics Team Alpha' },
        { stage: 'Received at Facility', timestamp: at(15, 22), actor: 'Facility Intake Officer' },
        { stage: 'Classified', timestamp: at(15, 29), actor: 'Custody Verification Unit' },
      ],
      releaseInstruction: 'Pending DCD Management Instruction', removalRef: demoRemovalId,
    });

    // Reuses the existing Complaints model (source: 'DMT Alert') so it
    // renders in Complaints & DMT Alert Center's existing DMT tab with the
    // same View Alert / Create Inspection / Create Violation actions as any
    // other alert — this one already has both records linked, since the
    // scenario has run to completion.
    complaints.unshift({
      id: 'DMT-2026-00481', source: 'DMT Alert', location: 'Mussafah', zoneId: demoZone.id, boxId: demoBox.id,
      severity: 'high', dateReceived: at(10, 14), assignedTeam: demoInspector.team, status: 'resolved',
      resolution: 'Inspection Conducted — Violation Confirmed — Box Removed to Safekeeping',
      linkedInspectionId: demoInspectionId, linkedViolationId: demoViolationId,
    });

    const scenarioAudit = [
      { t: at(10, 14), u: 'System Automation', role: 'System', a: `DMT alert received — ${demoBox.id}`, ent: 'Complaint', id_: 'DMT-2026-00481', prev: null, next: 'Open', src: 'DMT Integration' },
      { t: at(10, 21), u: 'Compliance Officer 02', role: 'Compliance Officer', a: `Inspection created from alert — ${demoInspectionId} (${demoBox.id}) ← DMT-2026-00481`, ent: 'Inspection', id_: demoInspectionId, prev: null, next: 'Pending', src: 'Complaints & DMT Alert Center' },
      { t: at(10, 27), u: 'Field Supervisor 01', role: 'Field Inspector', a: `Inspector assigned — ${demoInspectionId} → ${demoInspector.name}`, ent: 'Inspection', id_: demoInspectionId, prev: 'Unassigned', next: demoInspector.name, src: 'Work Allocation Console' },
      { t: at(11, 5), u: demoInspector.name, role: 'Field Inspector', a: `Inspection completed — ${demoBox.id}`, ent: 'Inspection', id_: demoInspectionId, prev: 'Pending', next: 'Completed — Fail', src: 'Field Inspection Application' },
      { t: at(11, 8), u: demoInspector.name, role: 'Field Inspector', a: `Violation created — ${demoViolationId} (${demoBox.id})`, ent: 'Donation Box', id_: demoBox.id, prev: 'Under Inspection', next: 'Non-Compliant', src: 'Field Inspection Application' },
      { t: at(11, 22), u: 'Compliance Officer 02', role: 'Compliance Officer', a: `Removal requested — ${demoRemovalId} (${demoBox.id})`, ent: 'Displacement', id_: demoRemovalId, prev: null, next: 'Pending Approval', src: 'Compliance & Violations Engine' },
      { t: at(11, 41), u: 'Director, Compliance & Inspections', role: 'Director', a: `Removal approved — ${demoRemovalId}`, ent: 'Displacement', id_: demoRemovalId, prev: 'Pending Approval', next: 'Approved', src: 'Displacement & Logistics' },
      { t: at(12, 10), u: 'Operations Coordinator', role: 'Operations Coordinator', a: `Removal team assigned — ${demoRemovalId} → Logistics Team Alpha`, ent: 'Displacement', id_: demoRemovalId, prev: 'Approved', next: 'Assigned', src: 'Work Allocation Console' },
      { t: at(13, 42), u: 'Logistics Team Alpha', role: 'Removal / Logistics Team', a: `Box removed — ${demoBox.id}`, ent: 'Donation Box', id_: demoBox.id, prev: 'Non-Compliant', next: 'Pending Displacement', src: 'Displacement & Logistics' },
      { t: at(14, 15), u: 'Logistics Team Alpha', role: 'Removal / Logistics Team', a: `Transport initiated — ${demoRemovalId} → Mussafah Central Safekeeping Facility`, ent: 'Displacement', id_: demoRemovalId, prev: 'Assigned', next: 'In Transit', src: 'Displacement & Logistics' },
      { t: at(15, 22), u: 'Facility Intake Officer', role: 'Storage Officer', a: `Storage received — ${demoInventoryId} (${demoBox.id})`, ent: 'Inventory Item', id_: demoInventoryId, prev: 'In Transit', next: 'Received', src: 'Safekeeping & Inventory' },
      { t: at(15, 29), u: 'Facility Intake Officer', role: 'Storage Officer', a: `Contents classified — ${demoInventoryId} → Household`, ent: 'Inventory Item', id_: demoInventoryId, prev: 'Received', next: 'Classified', src: 'Safekeeping & Inventory' },
    ];
    let dan = 1;
    scenarioAudit.forEach((e) => {
      auditLog.push({
        id: `AUD-DBX1843-${String(dan++).padStart(2, '0')}`, timestamp: e.t, user: e.u, role: e.role,
        action: e.a, previousStatus: e.prev || undefined, newStatus: e.next,
        entityType: e.ent, entityId: e.id_, before: { status: e.prev }, after: { status: e.next }, source: e.src,
      });
    });
  }

  auditLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // eslint-disable-next-line no-console
  console.info(`[seed] backfilled ${backfilledInspectionCount} inspection record(s) to give every violation a real inspection origin.`);

  return {
    organizations, boxes, inspections, violations, displacements, inventory, complaints, auditLog,
    criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })), passMark: DEFAULT_PASS_MARK, disposalRequests,
    cashDiscrepancies, backfilledInspectionCount,
  };
}

/* ─── Historical trend series (Executive Overview / Compliance charts) ────── */
export function complianceTrend(currentRate) {
  // Guard against a transient NaN/undefined input (e.g. a divide-by-zero
  // during a live data mutation) — an invalid seed would otherwise propagate
  // NaN through every point below and the line would silently fail to draw.
  const rate = Number.isFinite(currentRate) ? currentRate : 80;
  const rng = new Rng(55221);
  const MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const points = [];
  let v = rate - 6.5;
  for (let i = 0; i < MONTHS.length; i++) {
    v = Math.min(rate, v + rng.float(0.3, 1.4, 1));
    if (i === MONTHS.length - 1) v = rate;
    points.push({
      label: MONTHS[i], value: Math.round(v * 10) / 10, target: 95,
      previous: i === 0 ? Math.round((v - 1.4) * 10) / 10 : points[i - 1].value,
    });
  }
  return points;
}

export function displacementTrendSeries() {
  const rng = new Rng(883211);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((label) => ({ label, assigned: rng.int(2, 9), inTransit: rng.int(1, 6), completed: rng.int(3, 12) }));
}

export { Rng };
