// ── Live referential-integrity checks ────────────────────────────────────────
// These are not descriptions of what the app is "supposed to" enforce — each
// check below queries the current shared dataset directly and reports a real
// pass/fail count, so the result changes if the underlying data changes.
export function runIntegrityChecks(d) {
  const {
    boxes = [], inspections = [], violations = [], displacements = [],
    inventory = [], disposalRequests = [], cashDiscrepancies = [], complaints = [],
  } = d;

  const boxIds = new Set(boxes.map((b) => b.id));
  const inspectionIds = new Set(inspections.map((i) => i.id));
  const inventoryIds = new Set(inventory.map((i) => i.id));

  const checks = [];

  const check = (id, label, items, predicate) => {
    const total = items.length;
    const failing = items.filter((x) => !predicate(x));
    checks.push({
      id, label, total, passing: total - failing.length, failing: failing.length,
      failingIds: failing.slice(0, 8).map((x) => x.id),
      ok: failing.length === 0,
    });
  };

  check('violation-inspection', 'Every violation has a linked, real inspection', violations,
    (v) => !!v.inspectionId && inspectionIds.has(v.inspectionId));

  check('violation-box', 'Every violation references a real donation box', violations,
    (v) => boxIds.has(v.boxId));

  check('inspection-box', 'Every inspection references a real donation box', inspections,
    (i) => boxIds.has(i.boxId));

  check('displacement-box', 'Every displacement references a real donation box', displacements,
    (dsp) => boxIds.has(dsp.boxId));

  check('inventory-box', 'Every safekeeping inventory item references a real donation box', inventory,
    (item) => boxIds.has(item.boxId));

  check('disposal-inventory', 'Every disposal/release request references a real inventory item', disposalRequests,
    (r) => inventoryIds.has(r.inventoryId));

  check('cash-inventory', 'Every cash discrepancy case references a real inventory item', cashDiscrepancies,
    (c) => inventoryIds.has(c.inventoryId));

  check('complaint-linkage', 'Every DMT alert linked to an inspection points to a real, completed inspection', complaints.filter((c) => c.linkedInspectionId),
    (c) => {
      const insp = inspections.find((i) => i.id === c.linkedInspectionId);
      return !!insp && insp.status === 'completed';
    });

  // Lifecycle-state sanity: a box's status and its inventory custody state
  // must agree (this is exactly what boxLifecycle.lifecycleStageOf derives
  // from, so if this check fails, the Box Journey view would be showing a
  // stage that contradicts the underlying records).
  const inventoryByBox = new Map(inventory.map((i) => [i.boxId, i]));
  check('lifecycle-consistency', 'No box is in an impossible lifecycle state (status vs. custody)', boxes,
    (b) => {
      const item = inventoryByBox.get(b.id);
      if (b.status === 'safekeeping') return !!item;
      if ((item?.custodyStatus === 'disposed' || item?.custodyStatus === 'released')) return b.status === 'safekeeping';
      return true;
    });

  const failingChecks = checks.filter((c) => !c.ok);
  return {
    checks,
    allOk: failingChecks.length === 0,
    failingCount: failingChecks.length,
    totalChecks: checks.length,
  };
}
