// Specific, record-level information for KPIs where a trend graph says little
// (counts and compositions). Each function derives its rows from the live data,
// so the drawer always agrees with the KPI card that opened it.
import { zoneName, formatCurrency, formatDate } from './donationSeed';

const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const cap = (s) => String(s).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

// unit names the thing being counted (e.g. "items", "boxes", "cases") so a
// bare number in the drawer is never ambiguous about what it's counting or
// what share of the total it represents.
function countBy(list, keyFn, labelFn = (k) => cap(k), unit = 'items') {
  const map = new Map();
  list.forEach((item) => { const k = keyFn(item); map.set(k, (map.get(k) || 0) + 1); });
  const total = list.length || 1;
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => ({ label: labelFn(k), value: `${n.toLocaleString('en-US')} ${unit} · ${Math.round((n / total) * 100)}%`, share: n / total }));
}
function sumBy(list, keyFn, valFn) {
  const map = new Map();
  list.forEach((item) => { const k = keyFn(item); map.set(k, (map.get(k) || 0) + valFn(item)); });
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, value: `${formatCurrency(v)} · ${Math.round((v / total) * 100)}%`, share: v / total }));
}

// Appends the total the block's rows sum to, e.g. "By facility (51 items
// total)" — so the breakdown's own heading lets you check the numbers add up
// without doing the arithmetic yourself.
const withTotal = (heading, n, unit) => `${heading} (${n.toLocaleString('en-US')} ${unit} total)`;

const inCustody = (inventory) => inventory.filter((i) => i.custodyStatus === 'stored' || i.custodyStatus === 'awaiting-instruction');

// SIMULATED: nominal facility capacities for the utilization view.
const FACILITY_CAPACITY = { 'Mussafah Central Safekeeping Facility': 30, 'Al Ain Regional Custody Centre': 20, 'Madinat Zayed Storage Depot': 15 };

export function buildKpiSpecifics(kpiId, ctx) {
  const { boxes, inspections, violations, displacements, inventory, complaints, organizations } = ctx;
  const held = inCustody(inventory);

  switch (kpiId) {
    case 'total-safekeeping':
      return {
        title: 'Items in custody',
        blocks: [
          { heading: withTotal('By facility', held.length, 'items'), rows: countBy(held, (i) => i.facility, (k) => k, 'items') },
          { heading: withTotal('By condition', held.length, 'items'), rows: countBy(held, (i) => i.condition, (k) => k, 'items') },
          { heading: 'Oldest items (longest days in custody)', rows: [...held].sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived)).slice(0, 3).map((i) => ({ label: `${i.id} · ${i.boxId}`, value: `${daysSince(i.dateReceived)} days`, note: i.facility })) },
        ],
      };
    case 'awaiting-instruction': {
      const waiting = held.filter((i) => i.custodyStatus === 'awaiting-instruction');
      const bucket = (i) => { const d = daysSince(i.dateReceived); return d < 7 ? 'Under 7 days' : d <= 20 ? '7 to 20 days' : 'Over 20 days'; };
      const order = ['Under 7 days', '7 to 20 days', 'Over 20 days'];
      const counts = countBy(waiting, bucket, (k) => k, 'items').sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
      return {
        title: 'Waiting for a management instruction',
        blocks: [
          { heading: withTotal('How long they have waited', waiting.length, 'items'), rows: counts },
          { heading: 'Longest waiting (days since received)', rows: [...waiting].sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived)).slice(0, 4).map((i) => ({ label: `${i.id} · ${i.boxId}`, value: `${daysSince(i.dateReceived)} days`, note: i.facility })) },
        ],
      };
    }
    case 'total-inventory-value': {
      const totalValue = held.reduce((s, i) => s + i.value, 0);
      return {
        title: 'Value in custody',
        blocks: [
          { heading: `By facility (${formatCurrency(totalValue)} total)`, rows: sumBy(held, (i) => i.facility, (i) => i.value) },
          { heading: 'Highest value items', rows: [...held].sort((a, b) => b.value - a.value).slice(0, 3).map((i) => ({ label: `${i.id} · ${i.boxId}`, value: formatCurrency(i.value), note: i.classification })) },
        ],
      };
    }
    case 'storage-utilization':
      return {
        title: 'Facility utilization (nominal capacities are simulated)',
        blocks: [{
          heading: 'Items held against capacity',
          rows: Object.entries(FACILITY_CAPACITY).map(([f, cap2]) => {
            const n = held.filter((i) => i.facility === f).length;
            return { label: f, value: `${n} of ${cap2}`, share: Math.min(1, n / cap2) };
          }),
        }],
      };
    case 'avg-custody-duration': {
      const byFacility = Object.keys(FACILITY_CAPACITY).map((f) => {
        const items = held.filter((i) => i.facility === f);
        const avg = items.length ? Math.round(items.reduce((s, i) => s + daysSince(i.dateReceived), 0) / items.length) : 0;
        return { label: f, value: `${avg} days`, note: `${items.length} items` };
      });
      return { title: 'Time in custody', blocks: [{ heading: 'Average by facility', rows: byFacility }] };
    }

    case 'total-registered':
      return {
        title: 'Registered boxes',
        blocks: [
          { heading: withTotal('By compliance status', boxes.length, 'boxes'), rows: countBy(boxes, (b) => b.status, undefined, 'boxes') },
          { heading: 'Zones with the most boxes', rows: countBy(boxes, (b) => b.zoneId, (k) => zoneName(k), 'boxes').slice(0, 5) },
        ],
      };
    case 'non-compliant': {
      const open = violations.filter((v) => v.status !== 'resolved');
      return {
        title: 'Non-compliant boxes',
        blocks: [
          { heading: withTotal('Open violations by category', open.length, 'violations'), rows: countBy(open, (v) => v.category, (k) => k, 'violations').slice(0, 6) },
          { heading: 'Zones with the most non-compliant boxes', rows: countBy(boxes.filter((b) => b.status === 'non-compliant'), (b) => b.zoneId, (k) => zoneName(k), 'boxes').slice(0, 4) },
        ],
      };
    }
    case 'pending-displacement':
    case 'pending-displacement-ops': {
      const active = displacements.filter((d) => d.status !== 'completed');
      return {
        title: 'Removal queue',
        blocks: [
          { heading: withTotal('By stage', active.length, 'cases'), rows: countBy(active, (d) => d.status, undefined, 'cases') },
          { heading: withTotal('By priority', active.length, 'cases'), rows: countBy(active, (d) => d.priority, undefined, 'cases') },
          { heading: 'Earliest scheduled', rows: [...active].sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate)).slice(0, 3).map((d) => ({ label: `${d.boxId} · ${cap(d.status)}`, value: formatDate(d.scheduledDate), note: d.assignedTeam })) },
        ],
      };
    }
    case 'in-transit': {
      const moving = displacements.filter((d) => d.status === 'in-transit');
      return {
        title: 'Boxes on the road now',
        blocks: [{ heading: withTotal('In transit', moving.length, 'boxes'), rows: moving.slice(0, 6).map((d) => ({ label: `${d.boxId} to ${d.destinationFacility}`, value: d.vehicle, note: d.assignedTeam })) }],
      };
    }
    case 'active-vehicles': {
      const active = displacements.filter((d) => d.status === 'in-transit' || d.status === 'assigned');
      return { title: 'Vehicles on jobs', blocks: [{ heading: withTotal('Jobs per vehicle', active.length, 'jobs'), rows: countBy(active, (d) => d.vehicle, (k) => k, 'jobs') }] };
    }
    case 'open-complaints':
    case 'open-complaints-mod': {
      const open = complaints.filter((c) => c.status !== 'resolved');
      return {
        title: 'Open complaints',
        blocks: [{ heading: withTotal('By source', open.length, 'cases'), rows: countBy(open, (c) => c.source, (k) => k, 'cases') }, { heading: withTotal('By severity', open.length, 'cases'), rows: countBy(open, (c) => c.severity, undefined, 'cases') }],
      };
    }
    case 'critical-alerts': {
      const crit = complaints.filter((c) => c.severity === 'critical' && c.status !== 'resolved');
      return { title: 'Critical alerts', blocks: [{ heading: 'Unresolved', rows: crit.slice(0, 6).map((c) => ({ label: `${c.id} · ${c.source}`, value: cap(c.status), note: `${zoneName(c.zoneId)} · ${formatDate(c.dateReceived)}` })) }] };
    }
    case 'active-inspections':
    case 'pending-inspections': {
      const list = inspections.filter((i) => i.status === 'pending' || i.status === 'overdue');
      return { title: 'Inspection workload', blocks: [{ heading: withTotal('By type', list.length, 'cases'), rows: countBy(list, (i) => i.inspectionType, (k) => k, 'cases') }, { heading: withTotal('By status', list.length, 'cases'), rows: countBy(list, (i) => i.status, undefined, 'cases') }] };
    }
    case 'overdue-inspections': {
      const list = inspections.filter((i) => i.status === 'overdue');
      return { title: 'Overdue inspections', blocks: [{ heading: 'Most overdue', rows: [...list].sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate)).slice(0, 5).map((i) => ({ label: `${i.id} · ${i.boxId}`, value: `${daysSince(i.scheduledDate)} days late`, note: zoneName(i.zoneId) })) }] };
    }
    case 'open-violations': {
      const open = violations.filter((v) => v.status !== 'resolved');
      return { title: 'Open violations', blocks: [{ heading: withTotal('By severity', open.length, 'violations'), rows: countBy(open, (v) => v.severity, undefined, 'violations') }, { heading: 'By category', rows: countBy(open, (v) => v.category, (k) => k, 'violations').slice(0, 5) }] };
    }
    case 'critical-violations': {
      const crit = violations.filter((v) => v.severity === 'critical' && v.status !== 'resolved');
      return { title: 'Critical violations', blocks: [{ heading: 'Open, newest first', rows: crit.slice(0, 5).map((v) => ({ label: `${v.id} · ${v.boxId}`, value: v.category, note: `${zoneName(v.zoneId)} · ${formatDate(v.dateIdentified)}` })) }] };
    }
    case 'registered-orgs':
    case 'active-orgs':
      return { title: 'Organizations', blocks: [{ heading: withTotal('By registration status', organizations.length, 'organizations'), rows: countBy(organizations, (o) => o.registrationStatus, undefined, 'organizations') }] };
    case 'orgs-with-violations':
      return { title: 'Organizations with violations', blocks: [{ heading: 'Most open violations', rows: [...organizations].filter((o) => o.openViolations > 0).sort((a, b) => b.openViolations - a.openViolations).slice(0, 5).map((o) => ({ label: o.name, value: `${o.openViolations} open`, note: `${o.registeredBoxes} boxes` })) }] };
    default:
      return null;
  }
}
