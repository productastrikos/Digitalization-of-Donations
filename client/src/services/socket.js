import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { generateInitialState, Rng, INSPECTORS, zoneName, VIOLATION_CATEGORIES, violationDescription } from './donationSeed';
import { generateChecklist, scoreChecklist } from './compliance';
import { roleCan } from './access';

const SocketContext = createContext(null);
export const DataContext = createContext(null);

const INITIAL = generateInitialState();

// ── Static operational advisories (rule-based recommendations) ──────────────
const SEED_ADVISORIES = [
  {
    advisoryId: 'ADV-CMP-001', priority: 'high',
    title: 'Violation cluster forming in Mussafah Industrial Area — pre-emptive sweep recommended',
    template: 'compliance_cluster',
    rootCause: {
      primary: 'Non-compliant box density in Mussafah Industrial Area has risen faster than the citywide average over the trailing 30 days, concentrated among mobile-unit collection boxes.',
      contributing: 'Three organizations operating in the zone have approvals expiring within 45 days with no renewal submitted yet.',
      systemic: 'Placement approvals are not flagged for renewal follow-up until after expiry. A 30-day pre-expiry reminder would prevent recurrence.',
    },
    evidence: [
      'Mussafah Industrial Area — 14 non-compliant boxes vs. zone average of 6',
      '3 organizations with approvals expiring within 45 days',
      'Complaint volume in zone up 22% month-over-month',
    ],
    recommendations: [
      'Schedule a proactive inspection sweep for Mussafah Industrial Area this week',
      'Send renewal notices to the 3 organizations with approvals expiring within 45 days',
      'Enable automated 30-day pre-expiry reminders for placement approvals',
    ],
    actions: [
      { type: 'dispatch_crew', label: 'Assign Inspection Sweep' },
      { type: 'create_work_order', label: 'Create Enforcement Order' },
    ],
    impact: { complianceChange: -3.1, zoneRisk: 'Elevated' },
  },
  {
    advisoryId: 'ADV-INS-002', priority: 'medium',
    title: 'Inspection backlog trending upward — field capacity reallocation suggested',
    template: 'capacity_pressure',
    rootCause: {
      primary: 'Overdue inspections have increased across Al Ain zones while Abu Dhabi City units are running below full utilization.',
      contributing: 'Field Inspection Unit 06 and 07 cover a wider geographic radius per inspector than city-based units.',
      systemic: 'Zone-to-unit assignment has not been rebalanced since the last registry expansion.',
    },
    evidence: [
      'Al Ain zones — 18 overdue inspections vs. 5 two months ago',
      'Field Inspection Unit 06/07 utilization at 91% vs. citywide average of 78%',
      'Average travel time per inspection 34% higher in Al Ain zones',
    ],
    recommendations: [
      'Temporarily reassign one Abu Dhabi City inspector to support Al Ain coverage',
      'Prioritize overdue inspections in Al Ain City Centre and Al Jimi / Al Muwaiji',
      'Review zone-to-unit assignment ratios at the next operations review',
    ],
    actions: [
      { type: 'optimize_routes', label: 'Rebalance Field Assignments' },
    ],
    impact: { backlogReduction: 13, recoveryDays: 5 },
  },
  {
    advisoryId: 'ADV-DSP-003', priority: 'low',
    title: 'Safekeeping facility utilization approaching threshold — release review recommended',
    template: 'capacity_pressure',
    rootCause: {
      primary: 'Mussafah Central Safekeeping Facility is approaching 80% capacity utilization as displacement operations continue at current pace.',
      contributing: '11 items in custody have been awaiting a management instruction for over 20 days.',
      systemic: 'No automated review trigger exists for items awaiting instruction beyond 15 days.',
    },
    evidence: [
      'Mussafah Central Safekeeping Facility — 78% capacity utilized',
      '11 items awaiting management instruction beyond 20 days',
      'Average custody duration up 3.2 days vs. prior period',
    ],
    recommendations: [
      'Convene a disposition review for items awaiting instruction beyond 20 days',
      'Prioritize release or disposal decisions for Good-condition items first',
      'Set an automated 15-day review trigger for future intakes',
    ],
    actions: [
      { type: 'create_work_order', label: 'Schedule Disposition Review' },
    ],
    impact: { itemsReviewed: 11, capacityRecovered: '8%' },
  },
];

function severityToAlertType(severity) {
  if (severity === 'critical') return 'critical';
  if (severity === 'high' || severity === 'medium') return 'warning';
  return 'info';
}

function buildSeedAlerts() {
  const alerts = [];
  INITIAL.violations.filter((v) => v.status !== 'resolved').slice(0, 6).forEach((v) => {
    alerts.push({
      alertId: `AL-${v.id}`, type: severityToAlertType(v.severity), category: 'violation',
      title: `${v.category} — ${v.boxId}`, message: v.description, zone: v.zoneId, assetId: v.boxId,
      acknowledged: false, createdAt: v.dateIdentified,
    });
  });
  INITIAL.complaints.filter((c) => c.status !== 'resolved').slice(0, 6).forEach((c) => {
    alerts.push({
      alertId: `AL-${c.id}`, type: severityToAlertType(c.severity), category: 'complaint',
      title: `${c.source} — ${c.location}`, message: c.resolution || 'Awaiting field verification and risk assessment.',
      zone: c.zoneId, assetId: c.boxId || '—', acknowledged: c.status === 'resolved', createdAt: c.dateReceived,
    });
  });
  return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

const simRng = new Rng(Date.now() % 1000000 || 42);
let uid = 1;
const nextId = (prefix) => `${prefix}-${(uid++).toString(36)}${Date.now().toString(36).slice(-4)}`;

// ── Cross-tab live sync ──────────────────────────────────────────────────
// Each browser tab mounts its own SocketProvider with its own in-memory
// state, so without this, two tabs of the same demo (or two people viewing
// it side by side) would diverge the moment either one's simulation ticked
// or a user acted — same app, different data. A BroadcastChannel relay
// keeps every open tab showing one shared feed: a single tab is elected
// "leader" via a localStorage heartbeat and is the only one whose
// simulation clock actually ticks; every tab's resulting changes (simulated
// or user-triggered) are broadcast and adopted verbatim by every other tab.
const SYNC_CHANNEL = 'dcd-donation-control-sync';
const LEADER_KEY = 'dcd-donation-control-leader';
const LEADER_TTL_MS = 12000;
const LEADER_HEARTBEAT_MS = 4000;

export function SocketProvider({ children }) {
  const [boxes, setBoxes] = useState(INITIAL.boxes);
  const [baseOrganizations] = useState(INITIAL.organizations);
  const [inspections, setInspections] = useState(INITIAL.inspections);
  const [violations, setViolations] = useState(INITIAL.violations);

  // org.openViolations is derived from the live violation records, not stored:
  // the simulation keeps adding violations, so a value frozen at seed time would
  // drift from every view (drawers, tables, charts, KPIs) that counts records.
  const organizations = useMemo(() => {
    const open = {};
    violations.forEach((v) => { if (v.status !== 'resolved') open[v.organizationId] = (open[v.organizationId] || 0) + 1; });
    return baseOrganizations.map((o) => ({ ...o, openViolations: open[o.id] || 0 }));
  }, [baseOrganizations, violations]);
  const [displacements, setDisplacements] = useState(INITIAL.displacements);
  const [inventory, setInventory] = useState(INITIAL.inventory);
  const [complaints, setComplaints] = useState(INITIAL.complaints);
  const [auditLog, setAuditLog] = useState(INITIAL.auditLog);
  const [alerts, setAlerts] = useState(buildSeedAlerts);
  const [toasts, setToasts] = useState([]);
  const [lastSync, setLastSync] = useState(new Date().toISOString());
  const [activeKpiDrawer, setActiveKpiDrawer] = useState(null); // { domain, kpiId } | null
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [criteria, setCriteria] = useState(INITIAL.criteria);
  const [passMark, setPassMark] = useState(INITIAL.passMark);
  const [disposalRequests, setDisposalRequests] = useState(INITIAL.disposalRequests);
  const [cashDiscrepancies, setCashDiscrepancies] = useState(INITIAL.cashDiscrepancies);
  const [orgReviews, setOrgReviews] = useState([]);
  // Inspector availability is live state (it changes during the day), not a constant.
  const [inspectors, setInspectors] = useState(() => INSPECTORS.map((x) => ({ ...x })));

  // Identity and bookkeeping for the cross-tab sync relay (see the block below).
  const tabIdRef = useRef(null);
  if (!tabIdRef.current) tabIdRef.current = `t${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const isLeaderRef = useRef(false);
  const channelRef = useRef(null);
  const syncVersionRef = useRef(0);
  const applyingRemoteRef = useRef(false);

  // Who is acting. Stamped on every audit entry and checked before guarded actions.
  const actorRef = useRef({ name: 'System', role: 'System', roleKey: 'compliance_officer' });
  const setActor = useCallback((u) => {
    actorRef.current = u
      ? { name: u.fullName, role: u.role, roleKey: u.roleKey || 'compliance_officer' }
      : { name: 'System', role: 'System', roleKey: 'compliance_officer' };
  }, []);

  const openKpiDrawer = useCallback((domain, kpiId) => setActiveKpiDrawer({ domain, kpiId }), []);
  const closeKpiDrawer = useCallback(() => setActiveKpiDrawer(null), []);
  const openAlertPanel = useCallback(() => setAlertPanelOpen(true), []);
  const closeAlertPanel = useCallback(() => setAlertPanelOpen(false), []);
  const toggleAlertPanel = useCallback(() => setAlertPanelOpen((v) => !v), []);

  const acknowledgeAlert = useCallback((alertId) => {
    setAlerts((prev) => prev.map((a) => (a.alertId === alertId ? { ...a, acknowledged: true } : a)));
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const entry = { ...toast, id: nextId('TST'), createdAt: new Date().toISOString() };
    setToasts((prev) => [entry, ...prev].slice(0, 4));
  }, []);

  const pushAlert = useCallback((alert) => {
    setAlerts((prev) => [{ ...alert, alertId: nextId('AL'), acknowledged: false, createdAt: new Date().toISOString() }, ...prev].slice(0, 40));
  }, []);

  // ── Work allocation — reassign an open case to a field resource ─────────
  const reassignInspection = useCallback((inspectionId, inspectorId) => {
    const now = new Date().toISOString();
    let boxId = null;
    setInspections((prev) => prev.map((i) => {
      if (i.id !== inspectionId) return i;
      boxId = i.boxId;
      return { ...i, inspectorId, status: i.status === 'overdue' || i.status === 'escalated' ? 'pending' : i.status };
    }));
    const inspector = INSPECTORS.find((ins) => ins.id === inspectorId);
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: now, user: actorRef.current.name, role: actorRef.current.role,
      action: `Inspection reassigned — ${inspectionId}${boxId ? ` (${boxId})` : ''} → ${inspector?.name || inspectorId}`,
      entityType: 'Inspection', entityId: inspectionId, boxId,
      before: { inspector: 'Unassigned' }, after: { inspector: inspector?.name || inspectorId },
      previousStatus: 'Unassigned', newStatus: inspector?.name || inspectorId, source: 'Work Allocation Console',
    }, ...prev]);
    pushToast({ level: 'success', title: 'Case Assigned', message: `${inspectionId} assigned to ${inspector?.name || inspectorId}` });
  }, [pushToast]);

  const reassignComplaint = useCallback((complaintId, team) => {
    const now = new Date().toISOString();
    setComplaints((prev) => prev.map((c) => (c.id === complaintId ? { ...c, assignedTeam: team, status: c.status === 'open' ? 'assigned' : c.status } : c)));
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: now, user: actorRef.current.name, role: actorRef.current.role,
      action: `Complaint reassigned — ${complaintId} → ${team}`,
      entityType: 'Complaint', entityId: complaintId, boxId: stateRef.current.complaints?.find?.((c) => c.id === complaintId)?.boxId,
      before: { team: 'Unassigned' }, after: { team },
      previousStatus: 'Unassigned', newStatus: team, source: 'Work Allocation Console',
    }, ...prev]);
    pushToast({ level: 'success', title: 'Case Assigned', message: `${complaintId} assigned to ${team}` });
  }, [pushToast]);

  const reassignDisplacement = useCallback((displacementId, team) => {
    const now = new Date().toISOString();
    setDisplacements((prev) => prev.map((d) => (d.id === displacementId ? { ...d, assignedTeam: team, status: d.status === 'pending' ? 'assigned' : d.status } : d)));
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: now, user: actorRef.current.name, role: actorRef.current.role,
      action: `Displacement reassigned — ${displacementId} → ${team}`,
      entityType: 'Displacement', entityId: displacementId, boxId: stateRef.current.displacements?.find?.((d) => d.id === displacementId)?.boxId,
      before: { team: 'Unassigned' }, after: { team },
      previousStatus: 'Unassigned', newStatus: team, source: 'Work Allocation Console',
    }, ...prev]);
    pushToast({ level: 'success', title: 'Case Assigned', message: `${displacementId} assigned to ${team}` });
  }, [pushToast]);

  // ── Location Intelligence — dispatch actions against a geographic zone ──
  // Zones are computed aggregates (not a stored entity), so "assigning" or
  // "creating a task" for one acts on its real underlying inspection
  // records — the change genuinely shows up on Inspections & Field
  // Operations and Work Allocation, not just a toast.
  const createInspectionTask = useCallback(({ zoneId, zoneName, priority = 'priority' } = {}) => {
    const now = new Date().toISOString();
    const zoneBoxes = stateRef.current.boxes.filter((b) => b.zoneId === zoneId);
    const targetBox = zoneBoxes.find((b) => b.status === 'non-compliant') || zoneBoxes[0];
    if (!targetBox) {
      pushToast({ level: 'warning', title: 'No Boxes Found', message: `Unable to create an inspection task — no registered boxes in ${zoneName || zoneId}.` });
      return null;
    }
    const inspector = INSPECTORS.find((i) => i.assignedZone === zoneName) || INSPECTORS[0];
    const id = nextId('INSP');
    const newInspection = {
      id, boxId: targetBox.id, zoneId, inspectorId: inspector.id,
      inspectionType: 'Priority Follow-up', scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      status: 'pending', complianceResult: 'pending', priority, nextAction: 'Field Visit Required',
    };
    setInspections((prev) => [newInspection, ...prev]);
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: now, user: actorRef.current.name, role: actorRef.current.role,
      action: `Inspection task created — ${id} (${targetBox.id}) in ${zoneName || zoneId}`,
      entityType: 'Inspection', entityId: id, boxId: targetBox.id, before: null, after: { status: 'pending', boxId: targetBox.id, zoneId },
      previousStatus: undefined, newStatus: 'Pending', source: 'Location Intelligence Console',
    }, ...prev]);
    pushToast({ level: 'success', title: 'Inspection Task Created', message: `${id} scheduled for ${targetBox.id} — ${inspector.name}` });
    return newInspection;
  }, [pushToast]);

  // ── DMT / external alert intake ──────────────────────────────────────────
  // "Create Inspection" and "Create Violation" on an alert produce a real,
  // linked record (not a status label): the alert is stamped with the new
  // record's ID and the new record carries the alert's ID back, so the link
  // shows from either side (Complaints & DMT Alert Center, or the box's own
  // history timeline).
  const createInspectionFromAlert = useCallback((complaint) => {
    if (!allowed('page.inspections', 'create an inspection from an alert')) return null;
    if (!complaint.boxId) {
      pushToast({ level: 'warning', title: 'No Box Reference', message: `${complaint.id} has no associated donation box to inspect.` });
      return null;
    }
    const now = new Date().toISOString();
    const box = stateRef.current.boxes.find((b) => b.id === complaint.boxId);
    const inspector = INSPECTORS.find((i) => i.assignedZone === zoneName(box?.zoneId)) || INSPECTORS.find((i) => i.team === complaint.assignedTeam) || INSPECTORS[0];
    const id = nextId('INSP');
    const newInspection = {
      id, boxId: complaint.boxId, zoneId: box?.zoneId, inspectorId: inspector.id,
      inspectionType: 'Complaint-Driven', scheduledDate: now, status: 'pending', complianceResult: 'pending',
      priority: complaint.severity === 'critical' || complaint.severity === 'high' ? 'urgent' : 'priority',
      nextAction: 'Field Visit Required', sourceAlertId: complaint.id,
    };
    setInspections((prev) => [newInspection, ...prev]);
    setComplaints((prev) => prev.map((c) => (c.id === complaint.id ? { ...c, status: c.status === 'open' ? 'assigned' : c.status, linkedInspectionId: id } : c)));
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: now, user: actorRef.current.name, role: actorRef.current.role,
      action: `Inspection created from alert — ${id} (${complaint.boxId}) ← ${complaint.id}`,
      entityType: 'Inspection', entityId: id, boxId: complaint.boxId, before: null, after: { status: 'pending', boxId: complaint.boxId, sourceAlertId: complaint.id },
      previousStatus: undefined, newStatus: 'Pending', source: complaint.source === 'DMT Alert' ? 'DMT Integration' : 'Complaints & DMT Alert Center',
    }, ...prev]);
    pushToast({ level: 'success', title: 'Inspection Created', message: `${id} created for ${complaint.boxId} from ${complaint.id}` });
    return newInspection;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushToast]);

  const createViolationFromAlert = useCallback((complaint) => {
    if (!allowed('page.compliance', 'create a violation from an alert')) return null;
    if (!complaint.boxId) {
      pushToast({ level: 'warning', title: 'No Box Reference', message: `${complaint.id} has no associated donation box to cite.` });
      return null;
    }
    // Transition gate: a violation must originate from an inspection. The
    // alert alone isn't a compliance assessment — "Create Inspection" has to
    // run (and fail) first, exactly like the rest of the inspection workflow.
    if (!complaint.linkedInspectionId) {
      pushToast({ level: 'warning', title: 'Inspection required first', message: 'Create the inspection from this alert and record a failed result before citing a violation.' });
      return null;
    }
    const insp = stateRef.current.inspections?.find?.((i) => i.id === complaint.linkedInspectionId);
    if (insp && insp.status !== 'completed') {
      pushToast({ level: 'warning', title: 'Inspection not complete', message: `${insp.id} must be completed with a failed result before a violation can be cited.` });
      return null;
    }
    // Completing that inspection as a fail already creates its violation
    // (see recordInspection) — reuse it instead of citing a duplicate.
    const already = stateRef.current.violations?.find?.((v) => v.inspectionId === complaint.linkedInspectionId);
    if (already) {
      setComplaints((prev) => prev.map((c) => (c.id === complaint.id ? { ...c, linkedViolationId: already.id } : c)));
      pushToast({ level: 'info', title: 'Violation already on file', message: `${already.id} was already created when ${complaint.linkedInspectionId} was completed.` });
      return already;
    }
    const now = new Date().toISOString();
    const box = stateRef.current.boxes.find((b) => b.id === complaint.boxId);
    const id = nextId('VIO');
    const category = 'Unauthorized Placement';
    const newViolation = {
      id, boxId: complaint.boxId, organizationId: box?.organizationId, zoneId: box?.zoneId,
      category, severity: complaint.severity, status: 'open', dateIdentified: now, inspectionId: complaint.linkedInspectionId,
      description: `Field-detected violation raised from ${complaint.source.toLowerCase()} ${complaint.id}, confirmed on inspection ${complaint.linkedInspectionId}.`,
      sourceAlertId: complaint.id,
    };
    setViolations((prev) => [newViolation, ...prev]);
    if (box) setBoxes((prev) => prev.map((b) => (b.id === box.id ? { ...b, status: 'non-compliant', currentAction: 'Corrective Action Required' } : b)));
    setComplaints((prev) => prev.map((c) => (c.id === complaint.id ? { ...c, status: c.status === 'open' ? 'assigned' : c.status, linkedViolationId: id } : c)));
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: now, user: actorRef.current.name, role: actorRef.current.role,
      action: `Violation created from alert — ${id} (${complaint.boxId}) ← ${complaint.id}`,
      entityType: 'Donation Box', entityId: complaint.boxId, boxId: complaint.boxId, before: { status: box?.status }, after: { status: 'Non-Compliant', violationId: id },
      previousStatus: box?.status, newStatus: 'Non-Compliant', source: complaint.source === 'DMT Alert' ? 'DMT Integration' : 'Complaints & DMT Alert Center',
    }, ...prev]);
    pushToast({ level: 'warning', title: 'Violation Created', message: `${id} logged for ${complaint.boxId} from ${complaint.id}` });
    return newViolation;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushToast]);

  const assignZoneTeam = useCallback(({ zoneId, zoneName, team } = {}) => {
    const now = new Date().toISOString();
    const inspector = INSPECTORS.find((i) => i.team === team) || INSPECTORS[0];
    const candidates = stateRef.current.inspections.filter((i) => i.zoneId === zoneId && (i.status === 'overdue' || i.status === 'pending') && i.inspectorId !== inspector.id);
    if (candidates.length === 0) {
      pushToast({ level: 'success', title: 'Field Team Assigned', message: `${team} assigned to ${zoneName || zoneId} — no open cases required reassignment.` });
      return;
    }
    const ids = candidates.map((c) => c.id);
    setInspections((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, inspectorId: inspector.id, status: i.status === 'overdue' ? 'pending' : i.status } : i)));
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: now, user: actorRef.current.name, role: actorRef.current.role,
      action: `Field team assigned — ${zoneName || zoneId} → ${team} (${ids.length} case${ids.length === 1 ? '' : 's'} reassigned)`,
      entityType: 'Zone', entityId: zoneId, before: { team: 'Unassigned' }, after: { team, casesReassigned: ids.length },
      previousStatus: 'Unassigned', newStatus: team, source: 'Location Intelligence Console',
    }, ...prev]);
    pushToast({ level: 'success', title: 'Field Team Assigned', message: `${team} assigned to ${zoneName || zoneId} — ${ids.length} case${ids.length === 1 ? '' : 's'} reassigned` });
  }, [pushToast]);

  // ── Structured audit trail: who, when, which entity, before / after ─────
  const logAudit = useCallback(({ entityType, entityId, action, before, after, source = 'DCD Donation Control', boxId }) => {
    const a = actorRef.current;
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: new Date().toISOString(), user: a.name, role: a.role, action, entityType, entityId,
      // boxId is the canonical foreign key back to the donation box this entry
      // is about, even when entityType/entityId point at a sub-record
      // (Inspection, Disposal Request, Cash Discrepancy, …). Falls back to
      // entityId when the entry IS a Donation Box entity, so every existing
      // "Donation Box" entry is already correctly keyed without a call-site change.
      boxId: boxId ?? (entityType === 'Donation Box' ? entityId : undefined),
      before: before ?? null, after: after ?? null,
      previousStatus: before && before.status !== undefined ? String(before.status) : undefined,
      newStatus: after && after.status !== undefined ? String(after.status) : undefined,
      source,
    }, ...prev]);
  }, []);

  const allowed = (permission, what) => {
    if (roleCan(actorRef.current.roleKey, permission)) return true;
    pushToast({ level: 'warning', title: 'Not permitted', message: `Your role cannot ${what}.` });
    const a = actorRef.current;
    setAuditLog((prev) => [{
      id: nextId('AUD'), timestamp: new Date().toISOString(), user: a.name, role: a.role,
      action: `Access denied — ${a.role} attempted to ${what} (missing permission: ${permission})`,
      entityType: 'Security', entityId: permission, before: null, after: null,
      previousStatus: undefined, newStatus: undefined, source: 'Access Control',
    }, ...prev]);
    return false;
  };

  // ── Approve removal: the transition gate for the Violation → Displaced
  // stage. A box can't become "Displaced" without a real logistics
  // assignment behind it — this creates that assignment and only then
  // moves the box's canonical status, so the two can never disagree.
  const approveRemoval = useCallback((boxId, { team, vehicle, facility, priority = 'priority' } = {}) => {
    if (!allowed('page.allocation', 'approve a removal')) return null;
    const { boxes: curBoxes, displacements: curDisplacements } = stateRef.current;
    const box = curBoxes.find((b) => b.id === boxId);
    const fail = (message) => { pushToast({ level: 'warning', title: 'Removal not approved', message }); return null; };
    if (!box) return fail('Box not found.');
    if (box.status !== 'non-compliant') return fail('Only a confirmed non-compliant box can be approved for removal.');
    if (curDisplacements.some((d) => d.boxId === boxId && d.status !== 'completed')) return fail('An open removal already exists for this box.');
    if (!team || !vehicle || !facility) return fail('Select a team, vehicle and destination facility.');
    const now = new Date().toISOString();
    const displacement = {
      id: nextId('DSP'), boxId, pickupLocation: box.address, destinationFacility: facility,
      assignedTeam: team, vehicle, status: 'assigned', scheduledDate: now, priority,
    };
    setDisplacements((prev) => [displacement, ...prev]);
    setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, status: 'pending-displacement', currentAction: 'Awaiting Removal Team' } : b)));
    logAudit({
      entityType: 'Displacement', entityId: displacement.id, boxId, action: `Removal approved — ${displacement.id} (${boxId}) → ${team}`,
      before: { status: 'Non-Compliant' }, after: { status: 'Pending Displacement', displacementId: displacement.id, team, vehicle, facility },
      previousStatus: 'Non-Compliant', newStatus: 'Pending Displacement', source: 'Work Allocation Console',
    });
    pushToast({ level: 'success', title: 'Removal approved', message: `${displacement.id} assigned to ${team} · ${vehicle}` });
    return displacement;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  // ── Inspection evidence (photo + timestamp + inspector + coordinates) ───
  const addInspectionEvidence = useCallback((inspectionId, { image, caption, fileName, coords }) => {
    if (!allowed('evidence.upload', 'attach inspection evidence')) return null;
    const { inspections: curInspections, boxes: curBoxes } = stateRef.current;
    const insp = curInspections.find((i) => i.id === inspectionId);
    if (!insp) return null;
    const box = curBoxes.find((b) => b.id === insp.boxId);
    const inspector = INSPECTORS.find((x) => x.id === insp.inspectorId);
    const evidence = {
      id: nextId('EVD'), kind: 'photo', caption: caption || fileName || 'Field photo', image, fileName, simulated: false,
      capturedAt: new Date().toISOString(), inspectorId: insp.inspectorId, inspectorName: inspector ? inspector.name : actorRef.current.name,
      uploadedBy: actorRef.current.name,
      lat: coords ? coords.lat : box?.location.lat, lng: coords ? coords.lng : box?.location.lng,
      coordsSource: coords ? 'device GPS' : 'box registry position (GPS unavailable)',
    };
    setInspections((prev) => prev.map((i) => (i.id === inspectionId ? { ...i, evidence: [...(i.evidence || []), evidence] } : i)));
    if (box && !box.evidenceAvailable) setBoxes((prev) => prev.map((b) => (b.id === box.id ? { ...b, evidenceAvailable: true } : b)));
    logAudit({
      entityType: 'Inspection', entityId: inspectionId, boxId: insp.boxId, action: `Evidence attached — ${insp.boxId}`,
      before: { evidenceCount: (insp.evidence || []).length }, after: { evidenceCount: (insp.evidence || []).length + 1, evidenceId: evidence.id },
      source: 'Field Inspection Application',
    });
    pushToast({ level: 'success', title: 'Evidence attached', message: `${evidence.caption} added to ${inspectionId}` });
    return evidence;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  // ── Score an inspection against the compliance criteria ─────────────────
  const recordInspection = useCallback((inspectionId, results) => {
    if (!allowed('inspection.conduct', 'record inspection results')) return null;
    const { inspections: curInspections, criteria: curCriteria, passMark: curPassMark } = stateRef.current;
    const insp = curInspections.find((i) => i.id === inspectionId);
    if (!insp || insp.status === 'completed') return null;
    // Transition gate: a box can't move into the Inspected stage on a
    // finding with no supporting evidence — that's the box's actual
    // condition on record, not a workflow formality.
    if (!(insp.evidence || []).length) {
      pushToast({ level: 'warning', title: 'Evidence required', message: 'Attach at least one evidence item before recording a compliance result.' });
      return null;
    }
    const scored = scoreChecklist(results, curCriteria, curPassMark);
    if (scored.assessedCount === 0) {
      pushToast({ level: 'warning', title: 'Checklist incomplete', message: 'Mark at least one criterion before submitting.' });
      return null;
    }
    const now = new Date().toISOString();
    setInspections((prev) => prev.map((i) => (i.id === inspectionId
      ? { ...i, status: 'completed', complianceResult: scored.result, checklist: results, completedAt: now, completedBy: actorRef.current.name, nextAction: 'Filed — No Further Action' }
      : i)));
    setBoxes((prev) => prev.map((b) => (b.id === insp.boxId
      ? { ...b, status: scored.passed ? 'compliant' : 'non-compliant', lastInspection: now, complianceScore: scored.score }
      : b)));
    logAudit({
      entityType: 'Inspection', entityId: inspectionId, boxId: insp.boxId, action: `Inspection scored against criteria — ${insp.boxId}`,
      before: { status: insp.status, result: insp.complianceResult }, after: { status: 'completed', result: scored.result, score: scored.score, passMark: curPassMark },
      source: 'Field Inspection Application',
    });
    // A failed compliance assessment IS the origin of a violation — create
    // the real record here rather than leaving the box non-compliant with
    // nothing behind it. The failed criteria drive the category.
    let newViolation = null;
    if (!scored.passed) {
      const box = stateRef.current.boxes.find((b) => b.id === insp.boxId);
      const failedCriterion = curCriteria.find((c) => results[c.id] === false);
      const category = failedCriterion ? VIOLATION_CATEGORIES.find((cat) => failedCriterion.title.toLowerCase().includes(cat.split(' ')[0].toLowerCase())) || VIOLATION_CATEGORIES[0] : VIOLATION_CATEGORIES[0];
      const severity = scored.score < 40 ? 'critical' : scored.score < 55 ? 'high' : 'medium';
      newViolation = {
        id: nextId('VIO'), boxId: insp.boxId, organizationId: box?.organizationId, zoneId: insp.zoneId,
        category, severity, status: 'open', dateIdentified: now, inspectionId,
        description: failedCriterion ? `${failedCriterion.title} — failed during compliance assessment.` : violationDescription(category),
      };
      setViolations((prev) => [newViolation, ...prev]);
      logAudit({
        entityType: 'Donation Box', entityId: insp.boxId, action: `Violation created — ${newViolation.id} (${insp.boxId}) ← ${inspectionId}`,
        before: { status: 'Under Inspection' }, after: { status: 'Non-Compliant', violationId: newViolation.id },
        previousStatus: 'Under Inspection', newStatus: 'Non-Compliant', source: 'Field Inspection Application',
      });
    }
    pushToast({ level: scored.passed ? 'success' : 'warning', title: `Inspection ${scored.passed ? 'passed' : 'failed'}`, message: `${inspectionId} scored ${scored.score}/100 (pass mark ${curPassMark}).${newViolation ? ` Violation ${newViolation.id} logged.` : ''}` });
    return scored;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  // ── Organization actions (assign a compliance review / raise an inspection) ──
  const assignOrgReview = useCallback(({ orgId, officer, priority = 'priority', note = '' }) => {
    if (!allowed('page.organizations', 'assign compliance reviews')) return null;
    const org = stateRef.current.organizations.find((o) => o.id === orgId);
    if (!org) return null;
    const review = { id: nextId('ORV'), orgId, orgName: org.name, assignee: officer, priority, note: (note || '').trim(), status: 'assigned', createdAt: new Date().toISOString(), createdBy: actorRef.current.name };
    setOrgReviews((prev) => [review, ...prev]);
    logAudit({ entityType: 'Organization', entityId: orgId, action: `Compliance review assigned — ${org.name} → ${officer}`, before: null, after: { reviewId: review.id, assignee: officer, priority }, source: 'Organizations & Ownership' });
    pushToast({ level: 'success', title: 'Review assigned', message: `${org.name} → ${officer}` });
    return review;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const advanceOrgReview = useCallback((reviewId) => {
    const r = stateRef.current.orgReviews.find((x) => x.id === reviewId);
    if (!r || r.status === 'completed') return false;
    const next = r.status === 'assigned' ? 'in-progress' : 'completed';
    setOrgReviews((prev) => prev.map((x) => (x.id === reviewId ? { ...x, status: next, updatedAt: new Date().toISOString() } : x)));
    logAudit({ entityType: 'Organization', entityId: r.orgId, action: `Compliance review ${next === 'completed' ? 'completed' : 'started'} — ${r.orgName}`, before: { status: r.status }, after: { status: next }, source: 'Organizations & Ownership' });
    pushToast({ level: 'info', title: next === 'completed' ? 'Review completed' : 'Review started', message: r.orgName });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const createOrgInspection = useCallback((orgId) => {
    if (!allowed('page.inspections', 'create an inspection task')) return null;
    const { boxes: curBoxes, organizations: orgs } = stateRef.current;
    const org = orgs.find((o) => o.id === orgId);
    const orgBoxes = curBoxes.filter((b) => b.organizationId === orgId);
    const target = orgBoxes.find((b) => b.status === 'non-compliant') || orgBoxes[0];
    if (!org || !target) {
      pushToast({ level: 'warning', title: 'No boxes found', message: 'This organization has no registered box to inspect.' });
      return null;
    }
    const inspector = INSPECTORS.find((i) => i.assignedZone === zoneName(target.zoneId)) || INSPECTORS[0];
    const id = nextId('INSP');
    const insp = {
      id, boxId: target.id, zoneId: target.zoneId, inspectorId: inspector.id, inspectionType: 'Follow-up',
      scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString(), status: 'pending', complianceResult: 'pending',
      priority: org.openViolations > 8 ? 'urgent' : 'priority', nextAction: 'Field Visit Required', sourceOrgId: orgId,
    };
    setInspections((prev) => [insp, ...prev]);
    logAudit({ entityType: 'Inspection', entityId: id, boxId: target.id, action: `Inspection task created — ${id} (${target.id}) for ${org.name}`, before: null, after: { status: 'pending', boxId: target.id, organizationId: orgId }, source: 'Organizations & Ownership' });
    pushToast({ level: 'success', title: 'Inspection task created', message: `${id} → ${target.id} · ${inspector.name}` });
    return insp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  // ── Location data quality actions ────────────────────────────────────────
  // A box's location-quality bucket (missing / duplicate / outside-area /
  // pending validation) is always a pure function of its real fields (see
  // classifyLocation in geoCoverage.js) — these actions change the actual
  // field that drives the classification, so every count on the Location
  // Data Quality panel recomputes live instead of being decremented by hand.
  const reviewLocationIssue = useCallback((boxId) => {
    if (!allowed('page.gis', 'review location issues')) return;
    logAudit({
      entityType: 'Donation Box', entityId: boxId, action: `Location issue reviewed — ${boxId}`,
      before: { locationReview: 'Pending' }, after: { locationReview: 'Under Review' }, source: 'Location Data Quality',
    });
    pushToast({ level: 'info', title: 'Marked under review', message: `${boxId} location issue queued for correction.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const resolveLocationIssue = useCallback((boxId) => {
    if (!allowed('page.gis', 'resolve location issues')) return;
    const box = stateRef.current.boxes.find((b) => b.id === boxId);
    if (!box) return;
    setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, locationIssueResolved: true } : b)));
    logAudit({
      entityType: 'Donation Box', entityId: boxId, action: `Location issue resolved — ${boxId}`,
      before: { locationIssueResolved: false }, after: { locationIssueResolved: true }, source: 'Location Data Quality',
    });
    pushToast({ level: 'success', title: 'Location issue resolved', message: `${boxId} coordinates corrected and confirmed.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const verifyLocation = useCallback((boxId) => {
    if (!allowed('page.gis', 'verify locations')) return;
    const now = new Date().toISOString();
    const box = stateRef.current.boxes.find((b) => b.id === boxId);
    if (!box) return;
    setBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, lastInspection: now } : b)));
    logAudit({
      entityType: 'Donation Box', entityId: boxId, action: `Location re-verified in the field — ${boxId}`,
      before: { lastVerified: box.lastInspection }, after: { lastVerified: now }, source: 'Location Data Quality',
    });
    pushToast({ level: 'success', title: 'Location verified', message: `${boxId} coordinates re-confirmed in the field.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  // ── Compliance criteria administration ──────────────────────────────────
  const saveCriterion = useCallback((criterion) => {
    if (!allowed('criteria.edit', 'edit compliance criteria')) return false;
    const title = (criterion.title || '').trim();
    const weight = Number(criterion.weight);
    if (!title || !Number.isFinite(weight) || weight <= 0 || weight > 100) {
      pushToast({ level: 'warning', title: 'Invalid criterion', message: 'A title and a weight between 1 and 100 are required.' });
      return false;
    }
    const cur = stateRef.current.criteria;
    const existing = criterion.id ? cur.find((c) => c.id === criterion.id) : null;
    const next = { ...(existing || { active: true }), ...criterion, title, weight, id: existing ? existing.id : `CRT-${String(cur.length + 1).padStart(2, '0')}` };
    setCriteria((prev) => (existing ? prev.map((c) => (c.id === existing.id ? next : c)) : [...prev, next]));
    logAudit({
      entityType: 'Compliance Criterion', entityId: next.id, action: existing ? `Criterion updated — ${title}` : `Criterion added — ${title}`,
      before: existing ? { title: existing.title, weight: existing.weight, mandatory: existing.mandatory, active: existing.active } : null,
      after: { title: next.title, weight: next.weight, mandatory: !!next.mandatory, active: next.active }, source: 'Administration',
    });
    pushToast({ level: 'success', title: 'Criteria saved', message: title });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const setCriterionActive = useCallback((id, active) => {
    if (!allowed('criteria.edit', 'edit compliance criteria')) return;
    const c = stateRef.current.criteria.find((x) => x.id === id);
    if (!c) return;
    setCriteria((prev) => prev.map((x) => (x.id === id ? { ...x, active } : x)));
    logAudit({ entityType: 'Compliance Criterion', entityId: id, action: `Criterion ${active ? 'activated' : 'retired'} — ${c.title}`, before: { active: c.active }, after: { active }, source: 'Administration' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const updatePassMark = useCallback((value) => {
    if (!allowed('criteria.edit', 'change the pass mark')) return;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1 || n > 100) return;
    const before = stateRef.current.passMark;
    setPassMark(n);
    logAudit({ entityType: 'Compliance Criterion', entityId: 'PASS-MARK', action: 'Pass mark changed', before: { passMark: before }, after: { passMark: n }, source: 'Administration' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit]);

  // ── Disposal / demolition / release: request → decision → execution ─────
  // Nothing reaches "disposed" or "released" without an approved request.
  const requestDisposal = useCallback(({ inventoryId, type, criteria: chosen, reason }) => {
    if (!allowed('disposal.request', 'request a disposal')) return null;
    const { inventory: curInventory, disposalRequests: curRequests } = stateRef.current;
    const item = curInventory.find((i) => i.id === inventoryId);
    const fail = (message) => { pushToast({ level: 'warning', title: 'Request not submitted', message }); return null; };
    if (!item) return fail('Inventory item not found.');
    if (item.custodyStatus === 'disposed' || item.custodyStatus === 'released') return fail('This item has already left custody.');
    if (curRequests.some((r) => r.inventoryId === inventoryId && (r.status === 'pending' || r.status === 'approved'))) return fail('An open request already exists for this item.');
    if (!chosen || chosen.length === 0) return fail('Select at least one justification criterion.');
    if (!reason || reason.trim().length < 10) return fail('Add a reason of at least 10 characters.');
    const request = {
      id: nextId('DSR'), inventoryId, boxId: item.boxId, type, criteria: chosen, reason: reason.trim(),
      requestedBy: actorRef.current.name, requestedRole: actorRef.current.role, requestedAt: new Date().toISOString(), status: 'pending',
    };
    setDisposalRequests((prev) => [request, ...prev]);
    logAudit({ entityType: 'Disposal Request', entityId: request.id, boxId: item.boxId, action: `${type} requested — ${item.boxId}`, before: null, after: { status: 'pending', type, criteria: chosen }, source: 'Safekeeping & Inventory' });
    pushToast({ level: 'success', title: `${type} requested`, message: `${request.id} sent for approval.` });
    return request;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const decideDisposal = useCallback((requestId, decision, note) => {
    if (!allowed('disposal.approve', 'approve or reject disposal requests')) return false;
    const req = stateRef.current.disposalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return false;
    if (req.requestedBy === actorRef.current.name) {
      pushToast({ level: 'warning', title: 'Segregation of duties', message: 'The approver must be different from the requester.' });
      return false;
    }
    const decidedAt = new Date().toISOString();
    setDisposalRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: decision, approver: actorRef.current.name, decidedAt, decisionNote: (note || '').trim() } : r)));
    logAudit({ entityType: 'Disposal Request', entityId: requestId, boxId: req.boxId, action: `${req.type} ${decision} — ${req.boxId}`, before: { status: 'pending' }, after: { status: decision, approver: actorRef.current.name, note: (note || '').trim() }, source: 'Safekeeping & Inventory' });
    pushToast({ level: decision === 'approved' ? 'success' : 'info', title: `${req.type} ${decision}`, message: requestId });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const executeDisposal = useCallback((requestId) => {
    if (!allowed('disposal.execute', 'execute a disposal')) return false;
    const req = stateRef.current.disposalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'approved') {
      pushToast({ level: 'critical', title: 'Blocked', message: 'No disposal without an approved instruction.' });
      return false;
    }
    const now = new Date().toISOString();
    const closedStatus = req.type === 'Release' ? 'released' : 'disposed';
    setInventory((prev) => prev.map((i) => (i.id === req.inventoryId
      ? { ...i, custodyStatus: closedStatus, chainOfCustody: [...i.chainOfCustody, { stage: req.type === 'Release' ? 'Released' : 'Disposed', timestamp: now, actor: actorRef.current.name }] }
      : i)));
    setDisposalRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'executed', executedAt: now, executedBy: actorRef.current.name } : r)));
    logAudit({ entityType: 'Inventory Item', entityId: req.inventoryId, boxId: req.boxId, action: `${req.type} executed — ${req.boxId}`, before: { status: 'stored' }, after: { status: closedStatus, request: requestId }, source: 'Safekeeping & Inventory' });
    pushToast({ level: 'success', title: `${req.type} executed`, message: `${req.boxId} custody closed under ${requestId}.` });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  // ── Cash discrepancy case workflow ───────────────────────────────────────
  // Flagged → Verified → Investigation → Resolved (explained / written-off /
  // misappropriation) → Closed. A case above the escalation threshold, or
  // resolved as misappropriation, can only be closed by an Administrator —
  // the same role gate the disposal workflow uses for segregation of duties.
  function applyInventoryDiscrepancyStatus(caseRecord) {
    const status = caseRecord.status === 'flagged' || caseRecord.status === 'verified' || caseRecord.status === 'investigation'
      ? 'under-review'
      : caseRecord.resolutionType === 'explained' ? 'reconciled' : 'discrepancy-confirmed';
    setInventory((prev) => prev.map((i) => (i.id === caseRecord.inventoryId ? { ...i, discrepancyStatus: status } : i)));
  }

  const verifyDiscrepancy = useCallback((caseId) => {
    if (!allowed('discrepancy.review', 'verify a cash discrepancy')) return false;
    const c = stateRef.current.cashDiscrepancies.find((x) => x.id === caseId);
    if (!c || c.status !== 'flagged') return false;
    const now = new Date().toISOString();
    setCashDiscrepancies((prev) => prev.map((x) => (x.id === caseId ? { ...x, status: 'verified', verifiedAt: now, verifiedBy: actorRef.current.name } : x)));
    logAudit({
      entityType: 'Cash Discrepancy', entityId: caseId, boxId: c.boxId, action: `Discrepancy verified — ${caseId} (${c.boxId})`,
      before: { status: 'flagged' }, after: { status: 'verified' }, source: 'Safekeeping & Inventory',
    });
    pushToast({ level: 'info', title: 'Discrepancy verified', message: `${caseId} moved to recount review.` });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const startDiscrepancyInvestigation = useCallback((caseId) => {
    if (!allowed('discrepancy.review', 'investigate a cash discrepancy')) return false;
    const c = stateRef.current.cashDiscrepancies.find((x) => x.id === caseId);
    if (!c || c.status !== 'verified') return false;
    const now = new Date().toISOString();
    setCashDiscrepancies((prev) => prev.map((x) => (x.id === caseId ? { ...x, status: 'investigation', investigationStartedAt: now, investigatedBy: actorRef.current.name } : x)));
    logAudit({
      entityType: 'Cash Discrepancy', entityId: caseId, boxId: c.boxId, action: `Discrepancy investigation opened — ${caseId} (${c.boxId})`,
      before: { status: 'verified' }, after: { status: 'investigation' }, source: 'Safekeeping & Inventory',
    });
    pushToast({ level: 'info', title: 'Investigation opened', message: caseId });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const resolveDiscrepancy = useCallback((caseId, resolutionType, note) => {
    const c = stateRef.current.cashDiscrepancies.find((x) => x.id === caseId);
    if (!c || c.status !== 'investigation') return false;
    if (resolutionType === 'misappropriation' && !allowed('discrepancy.adminSignoff', 'resolve a discrepancy as misappropriation')) return false;
    if (resolutionType !== 'misappropriation' && !allowed('discrepancy.review', 'resolve a cash discrepancy')) return false;
    const now = new Date().toISOString();
    const updated = { ...c, status: 'resolved', resolutionType, resolutionNote: (note || '').trim(), resolvedAt: now, resolvedBy: actorRef.current.name };
    setCashDiscrepancies((prev) => prev.map((x) => (x.id === caseId ? updated : x)));
    applyInventoryDiscrepancyStatus(updated);
    logAudit({
      entityType: 'Cash Discrepancy', entityId: caseId, boxId: c.boxId, action: `Discrepancy resolved — ${caseId} (${c.boxId}) → ${resolutionType}`,
      before: { status: 'investigation' }, after: { status: 'resolved', resolutionType }, source: 'Safekeeping & Inventory',
    });
    pushToast({ level: resolutionType === 'misappropriation' ? 'critical' : 'success', title: 'Discrepancy resolved', message: `${caseId} — ${resolutionType.replace('-', ' ')}` });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  const closeDiscrepancyCase = useCallback((caseId) => {
    const c = stateRef.current.cashDiscrepancies.find((x) => x.id === caseId);
    if (!c || c.status !== 'resolved') return false;
    const needsAdmin = c.requiresAdminSignoff || c.resolutionType === 'misappropriation';
    if (needsAdmin && !allowed('discrepancy.adminSignoff', 'close a high-value or misappropriation discrepancy case')) return false;
    if (!needsAdmin && !allowed('discrepancy.review', 'close a cash discrepancy case')) return false;
    const now = new Date().toISOString();
    setCashDiscrepancies((prev) => prev.map((x) => (x.id === caseId ? { ...x, status: 'closed', closedAt: now, closedBy: actorRef.current.name, signedOffBy: needsAdmin ? actorRef.current.name : x.signedOffBy } : x)));
    logAudit({
      entityType: 'Cash Discrepancy', entityId: caseId, boxId: c.boxId, action: `Discrepancy case closed — ${caseId} (${c.boxId})`,
      before: { status: 'resolved' }, after: { status: 'closed', signedOffBy: needsAdmin ? actorRef.current.name : undefined }, source: 'Safekeeping & Inventory',
    });
    pushToast({ level: 'success', title: 'Case closed', message: caseId });
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAudit, pushToast]);

  // ── Live simulation engine ─────────────────────────────────────────────
  // Every ~18s, mutate a random slice of shared state so the platform feels
  // like a connected operational system rather than static pages. Only the
  // elected leader tab (see the cross-tab sync block below) actually runs
  // this — every other open tab skips it and adopts the leader's broadcast
  // result instead, so two tabs never roll independent, conflicting events.
  const stateRef = useRef({});
  stateRef.current = { boxes, inspections, displacements, criteria, passMark, inventory, disposalRequests, cashDiscrepancies, organizations, orgReviews, inspectors, complaints, violations };

  useEffect(() => {
    const tick = () => {
      if (!isLeaderRef.current) return;
      const scenario = simRng.int(1, 3);
      const now = new Date().toISOString();
      const { boxes: curBoxes, inspections: curInspections, displacements: curDisplacements } = stateRef.current;

      if (scenario === 1) {
        const pending = curInspections.filter((i) => i.status === 'pending' || i.status === 'overdue');
        if (pending.length === 0) return;
        const target = pending[simRng.int(0, pending.length - 1)];
        const pass = simRng.bool(0.76);
        setBoxes((prev) => prev.map((b) => (b.id === target.boxId
          ? { ...b, status: pass ? 'compliant' : 'non-compliant', lastInspection: now, complianceScore: pass ? simRng.int(85, 100) : simRng.int(30, 60) }
          : b)));
        setInspections((prev) => prev.map((i) => (i.id === target.id
          ? { ...i, status: 'completed', complianceResult: pass ? 'pass' : 'fail', nextAction: 'Filed — No Further Action', completedAt: now, completedBy: 'Field Inspection Application', checklist: generateChecklist(pass ? 'pass' : 'fail', stateRef.current.criteria, () => simRng.next()), evidence: i.evidence || [] }
          : i)));
        setAuditLog((prev) => [{
          id: nextId('AUD'), timestamp: now, user: 'Field Inspection Application', role: 'System',
          action: `Inspection completed — ${target.boxId}`, previousStatus: 'Under Inspection',
          newStatus: pass ? 'Compliant' : 'Non-Compliant', source: 'Field Inspection Application',
          entityType: 'Donation Box', entityId: target.boxId, boxId: target.boxId, before: { status: 'Under Inspection' }, after: { status: pass ? 'Compliant' : 'Non-Compliant' },
        }, ...prev]);
        // A failed simulated inspection is the origin of a violation, exactly
        // like the user-driven path — never leaves a non-compliant box with
        // nothing behind it.
        let simViolation = null;
        if (!pass) {
          const category = simRng.pick(VIOLATION_CATEGORIES);
          simViolation = {
            id: nextId('VIO'), boxId: target.boxId, organizationId: curBoxes.find((b) => b.id === target.boxId)?.organizationId, zoneId: target.zoneId,
            category, severity: simRng.weighted([['critical', 10], ['high', 25], ['medium', 40], ['low', 25]]), status: 'open',
            dateIdentified: now, inspectionId: target.id, description: violationDescription(category),
          };
          setViolations((prev) => [simViolation, ...prev]);
          setAuditLog((prev) => [{
            id: nextId('AUD'), timestamp: now, user: 'Field Inspection Application', role: 'System',
            action: `Violation created — ${simViolation.id} (${target.boxId}) ← ${target.id}`,
            entityType: 'Donation Box', entityId: target.boxId, boxId: target.boxId, before: { status: 'Under Inspection' }, after: { status: 'Non-Compliant', violationId: simViolation.id },
            previousStatus: 'Under Inspection', newStatus: 'Non-Compliant', source: 'Field Inspection Application',
          }, ...prev]);
        }
        pushToast({ level: pass ? 'success' : 'warning', title: 'Inspection Completed', message: `${target.boxId} inspection closed — result: ${pass ? 'Pass' : 'Fail'}${simViolation ? ` — ${simViolation.id} logged` : ''}` });
      }

      if (scenario === 2) {
        const compliant = curBoxes.filter((b) => b.status === 'compliant');
        if (compliant.length === 0) return;
        const box = compliant[simRng.int(0, compliant.length - 1)];
        const severity = simRng.weighted([['critical', 10], ['high', 25], ['medium', 40], ['low', 25]]);
        const category = simRng.pick(VIOLATION_CATEGORIES);
        const inspector = INSPECTORS.find((i) => i.assignedZone === zoneName(box.zoneId)) || INSPECTORS[0];
        // DMT flags the box; DCD still verifies it with a real (simulated)
        // inspection before the violation is recorded, so this violation has
        // the same real inspection origin as any other.
        const verifyInsp = {
          id: nextId('INSP'), boxId: box.id, zoneId: box.zoneId, inspectorId: inspector.id,
          inspectionType: 'Complaint-Driven', scheduledDate: now, status: 'completed', complianceResult: 'fail',
          priority: severity === 'critical' || severity === 'high' ? 'urgent' : 'priority', nextAction: 'Filed — No Further Action',
          completedAt: now, completedBy: inspector.name, sourceAlertId: 'DMT-SIM', evidence: [],
        };
        setInspections((prev) => [verifyInsp, ...prev]);
        setViolations((prev) => [{
          id: nextId('VIO'), boxId: box.id, organizationId: box.organizationId, zoneId: box.zoneId,
          category, severity, status: 'open', dateIdentified: now, inspectionId: verifyInsp.id,
          description: 'Field-detected violation flagged during live monitoring sync, confirmed on inspection.',
        }, ...prev]);
        setBoxes((prev) => prev.map((b) => (b.id === box.id ? { ...b, status: 'non-compliant', complianceScore: simRng.int(30, 55), lastInspection: now } : b)));
        setAuditLog((prev) => [{
          id: nextId('AUD'), timestamp: now, user: 'DMT Integration', role: 'System', action: `Violation flagged — ${box.id}`,
          entityType: 'Donation Box', entityId: box.id, boxId: box.id, before: { status: 'Compliant' }, after: { status: 'Non-Compliant', category, severity },
          previousStatus: 'Compliant', newStatus: 'Non-Compliant', source: 'DMT Integration',
        }, ...prev]);
        pushAlert({ type: severityToAlertType(severity), category: 'violation', title: `${category} — ${box.id}`, message: 'Field-detected violation flagged during live monitoring sync.', zone: box.zoneId, assetId: box.id });
        pushToast({ level: severity === 'critical' || severity === 'high' ? 'critical' : 'warning', title: 'Violation Detected', message: `${box.id} — ${category} (${severity.toUpperCase()})` });
      }

      if (scenario === 3) {
        const active = curDisplacements.filter((d) => d.status === 'in-transit' || d.status === 'assigned');
        if (active.length === 0) return;
        const target = active[simRng.int(0, active.length - 1)];
        setDisplacements((prev) => prev.map((d) => (d.id === target.id ? { ...d, status: 'completed' } : d)));
        setBoxes((prev) => prev.map((b) => (b.id === target.boxId ? { ...b, status: 'safekeeping', currentAction: 'Pending Management Instruction' } : b)));
        const targetBox = stateRef.current.boxes.find((b) => b.id === target.boxId);
        const contentCategory = targetBox?.donationType === 'Cash' ? 'Cash' : simRng.pick(['Food', 'Clothing', 'Medical', 'Household', 'Other In-Kind']);
        const classification = targetBox?.donationType === 'Cash' ? 'Cash Donation Box' : simRng.weighted([['In-Kind Collection Unit', 80], ['Mixed Collection Unit', 20]]);
        setInventory((prev) => [{
          id: nextId('INV'), boxId: target.boxId, facility: target.destinationFacility, dateReceived: now,
          condition: simRng.weighted([['Good', 60], ['Fair', 30], ['Damaged', 10]]), classification,
          contentCategory, quantity: contentCategory === 'Cash' ? undefined : simRng.int(1, 40),
          custodyStatus: 'awaiting-instruction', value: simRng.int(1000, 30000),
          chainOfCustody: [
            { stage: 'Collected', timestamp: target.scheduledDate, actor: target.assignedTeam },
            { stage: 'Received at Facility', timestamp: now, actor: 'Facility Intake Officer' },
          ],
          releaseInstruction: 'Pending DCD Management Instruction',
        }, ...prev]);
        setAuditLog((prev) => [{
          id: nextId('AUD'), timestamp: now, user: 'Logistics Coordination Unit', role: 'System', action: `Displacement completed — ${target.boxId}`,
          entityType: 'Displacement', entityId: target.id, boxId: target.boxId, before: { status: 'In Transit' }, after: { status: 'Safekeeping' },
          previousStatus: 'In Transit', newStatus: 'Safekeeping', source: 'Registry Sync',
        }, ...prev]);
        pushToast({ level: 'info', title: 'Displacement Completed', message: `${target.boxId} received at ${target.destinationFacility}` });
      }

      setLastSync(now);
    };

    const id = setInterval(tick, 18000);

    // Field availability shifts every few seconds (leader tab only; every tab
    // receives the result through the shared sync). Off Duty is capped so the
    // field is never left empty.
    const nextAvailability = (a, offDuty) => {
      const roll = simRng.next();
      if (a === 'On Field') return roll < 0.6 ? 'Available' : roll < 0.8 && offDuty < 3 ? 'Off Duty' : a;
      if (a === 'Available') return roll < 0.7 ? 'On Field' : roll < 0.85 && offDuty < 3 ? 'Off Duty' : a;
      return roll < 0.8 ? 'Available' : a;
    };
    const invId = setInterval(() => {
      if (!isLeaderRef.current) return;
      setInspectors((prev) => {
        const offDuty = prev.filter((x) => x.availability === 'Off Duty').length;
        const k = simRng.int(0, prev.length - 1);
        const next = nextAvailability(prev[k].availability, offDuty);
        return next === prev[k].availability ? prev : prev.map((x, j) => (j === k ? { ...x, availability: next } : x));
      });
    }, 6000);
    return () => { clearInterval(id); clearInterval(invId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Leader election ───────────────────────────────────────────────────
  // A localStorage heartbeat with a short TTL: whichever tab last renewed
  // the key within LEADER_TTL_MS holds the lease. If that tab closes, its
  // heartbeat goes stale and the next tab to check claims it — no explicit
  // coordination needed beyond "read, and write if it's free or mine".
  useEffect(() => {
    const tabId = tabIdRef.current;
    const claim = () => {
      try {
        const raw = localStorage.getItem(LEADER_KEY);
        const rec = raw ? JSON.parse(raw) : null;
        const mine = rec && rec.tabId === tabId;
        const stale = !rec || (Date.now() - rec.ts) > LEADER_TTL_MS;
        if (mine || stale) {
          localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, ts: Date.now() }));
          isLeaderRef.current = true;
        } else {
          isLeaderRef.current = false;
        }
      } catch {
        // localStorage unavailable (private mode, storage disabled) — act as
        // leader locally; there is no cross-tab coordination to lose anyway.
        isLeaderRef.current = true;
      }
    };
    const release = () => {
      try {
        const raw = localStorage.getItem(LEADER_KEY);
        const rec = raw ? JSON.parse(raw) : null;
        if (rec && rec.tabId === tabId) localStorage.removeItem(LEADER_KEY);
      } catch { /* ignore */ }
    };

    claim();
    const hb = setInterval(claim, LEADER_HEARTBEAT_MS);
    window.addEventListener('beforeunload', release);
    return () => { clearInterval(hb); isLeaderRef.current = false; release(); window.removeEventListener('beforeunload', release); };
  }, []);

  // ── Cross-tab broadcast: receive ─────────────────────────────────────────
  // Adopt another tab's state verbatim whenever it broadcasts something newer
  // than what this tab has already seen.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(SYNC_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.tabId === tabIdRef.current || msg.version <= syncVersionRef.current) return;
      syncVersionRef.current = msg.version;
      applyingRemoteRef.current = true;
      const s = msg.state;
      setBoxes(s.boxes); setInspections(s.inspections); setViolations(s.violations);
      setDisplacements(s.displacements); setInventory(s.inventory); setComplaints(s.complaints);
      setAuditLog(s.auditLog); setAlerts(s.alerts); setDisposalRequests(s.disposalRequests);
      setCashDiscrepancies(s.cashDiscrepancies); if (s.orgReviews) setOrgReviews(s.orgReviews); if (s.inspectors) setInspectors(s.inspectors); setCriteria(s.criteria); setPassMark(s.passMark); setLastSync(s.lastSync);
    };
    return () => channel.close();
  }, []);

  // ── Cross-tab broadcast: send ─────────────────────────────────────────────
  // Fires whenever this tab's own synced state changes — from its own
  // simulation tick (leader only) or from a user action in this tab. Skips
  // the one render that just adopted a remote snapshot, so tabs don't echo
  // the same update back and forth.
  useEffect(() => {
    if (applyingRemoteRef.current) { applyingRemoteRef.current = false; return; }
    if (!channelRef.current) return;
    syncVersionRef.current += 1;
    channelRef.current.postMessage({
      tabId: tabIdRef.current, version: syncVersionRef.current,
      state: { boxes, inspections, violations, displacements, inventory, complaints, auditLog, alerts, disposalRequests, cashDiscrepancies, orgReviews, inspectors, criteria, passMark, lastSync },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes, inspections, violations, displacements, inventory, complaints, auditLog, alerts, disposalRequests, cashDiscrepancies, orgReviews, inspectors, criteria, passMark, lastSync]);

  const dataValue = {
    boxes, organizations, inspections, violations, displacements, inventory, complaints, auditLog,
    alerts, advisories: SEED_ADVISORIES, toasts, lastSync,
    inspectors,
    acknowledgeAlert, pushAlert, dismissToast, pushToast,
    reassignInspection, reassignComplaint, reassignDisplacement, approveRemoval,
    createInspectionTask, assignZoneTeam, createInspectionFromAlert, createViolationFromAlert,
    setComplaints,
    criteria, passMark, disposalRequests, cashDiscrepancies, setActor, logAudit,
    addInspectionEvidence, recordInspection, saveCriterion, setCriterionActive, updatePassMark,
    requestDisposal, decideDisposal, executeDisposal,
    verifyDiscrepancy, startDiscrepancyInvestigation, resolveDiscrepancy, closeDiscrepancyCase,
    orgReviews, assignOrgReview, advanceOrgReview, createOrgInspection,
    reviewLocationIssue, resolveLocationIssue, verifyLocation,
    activeKpiDrawer, openKpiDrawer, closeKpiDrawer,
    alertPanelOpen, openAlertPanel, closeAlertPanel, toggleAlertPanel,
    weather: null, connected: false, requestData: () => {},
  };

  return (
    <SocketContext.Provider value={null}>
      <DataContext.Provider value={dataValue}>
        {children}
      </DataContext.Provider>
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
export const useData = () => useContext(DataContext);
