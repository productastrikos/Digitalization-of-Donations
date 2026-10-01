// Report builders and PDF / Excel / CSV exporters. Every report is derived from the
// live data layer, so an export always matches what the dashboards show.
// SIMULATED: the underlying records are demonstration data, and every export says so.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { zoneName, formatDate, formatDateTime, formatCurrency } from './donationSeed';
import { buildGeoAreas } from './geoCoverage';
import { LIFECYCLE_STAGES, STAGE_BY_KEY, buildLifecycleIndex, lifecycleStageOf, summarizeLifecycle } from './boxLifecycle';

export const DISCLAIMER = 'SIMULATED DEMONSTRATION DATA. Not an official DCD record.';
const PDF_ROW_CAP = 600;

const RANGE_LABEL = { '30d': 'Last 30 days', q: 'Last quarter', ytd: 'Year to date' };
function rangeStart(range) {
  const now = new Date();
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1);
  const days = range === 'q' ? 90 : 30;
  return new Date(now.getTime() - days * 86400000);
}

export function buildReport(id, ctx, { zone = 'all', range = '30d' } = {}) {
  const { boxes, organizations, inspections, violations, displacements, inventory, complaints, disposalRequests = [], inspectors = [] } = ctx;
  const start = rangeStart(range);
  const inZone = (z) => zone === 'all' || z === zone;
  const inRange = (iso) => !iso || new Date(iso) >= start;
  const orgName = (oid) => organizations.find((o) => o.id === oid)?.name || 'Unknown';
  const lifecycleIndex = buildLifecycleIndex({ inventory, displacements });
  const filterLine = `${zone === 'all' ? 'All zones' : zoneName(zone)} · ${RANGE_LABEL[range] || range}`;

  switch (id) {
    case 'RPT-01': {
      const list = boxes.filter((b) => inZone(b.zoneId));
      const compliant = list.filter((b) => b.status === 'compliant').length;
      return {
        title: 'Donation Box Compliance Report', filter: `${zone === 'all' ? 'All zones' : zoneName(zone)} · current snapshot`,
        summary: [['Boxes in scope', list.length], ['Compliant', `${compliant} (${list.length ? ((compliant / list.length) * 100).toFixed(1) : 0}%)`], ['Non-compliant', list.filter((b) => b.status === 'non-compliant').length], ['Under inspection', list.filter((b) => b.status === 'under-inspection').length]],
        columns: ['Box ID', 'QR Code', 'Zone', 'Organization', 'Box Type', 'Compliance Status', 'Score', 'Lifecycle Stage', 'Last Inspection'],
        rows: list.map((b) => [b.id, b.qrCode, zoneName(b.zoneId), orgName(b.organizationId), b.boxType, b.status, b.complianceScore, STAGE_BY_KEY[lifecycleStageOf(b, lifecycleIndex)].label, formatDate(b.lastInspection)]),
      };
    }
    case 'RPT-02': {
      const areas = buildGeoAreas(boxes, complaints).filter((a) => inZone(a.id));
      return {
        title: 'Geographic Coverage Report', filter: `${zone === 'all' ? 'All zones' : zoneName(zone)} · current snapshot`,
        summary: [['Zones', areas.length], ['Average coverage', `${areas.length ? (areas.reduce((s, a) => s + a.coveragePercentage, 0) / areas.length).toFixed(1) : 0}%`]],
        columns: ['Zone', 'Region', 'Registered Boxes', 'Mapped Boxes', 'Location Accuracy %', 'Coverage %', 'Survey Status', 'Last Verified'],
        rows: areas.map((a) => [a.name, a.region, a.totalRegisteredBoxes, a.mappedBoxes, a.locationAccuracy, a.coveragePercentage, a.surveyStatus, formatDate(a.lastVerified)]),
      };
    }
    case 'RPT-03': {
      const scoped = inspections.filter((i) => inZone(i.zoneId) && inRange(i.scheduledDate));
      const rows = inspectors.map((ins) => {
        const mine = scoped.filter((i) => i.inspectorId === ins.id);
        const done = mine.filter((i) => i.status === 'completed');
        const pass = done.filter((i) => i.complianceResult === 'pass').length;
        return [ins.name, ins.team, ins.assignedZone, mine.length, done.length, mine.length - done.length, done.length ? `${Math.round((pass / done.length) * 100)}%` : '—', mine.reduce((s, i) => s + (i.evidence || []).length, 0)];
      });
      return {
        title: 'Inspection Performance Report', filter: filterLine,
        summary: [['Inspections in scope', scoped.length], ['Completed', scoped.filter((i) => i.status === 'completed').length], ['Evidence items attached', scoped.reduce((s, i) => s + (i.evidence || []).length, 0)]],
        columns: ['Inspector', 'Team', 'Assigned Zone', 'Assigned', 'Completed', 'Open', 'Pass Rate', 'Evidence Items'], rows,
      };
    }
    case 'RPT-04': {
      const list = violations.filter((v) => inZone(v.zoneId) && inRange(v.dateIdentified));
      return {
        title: 'Violation Resolution Report', filter: filterLine,
        summary: [['Violations in scope', list.length], ['Open', list.filter((v) => v.status !== 'resolved').length], ['Resolved', list.filter((v) => v.status === 'resolved').length], ['Critical', list.filter((v) => v.severity === 'critical').length]],
        columns: ['Violation', 'Box', 'Organization', 'Zone', 'Category', 'Severity', 'Status', 'Identified', 'Resolved'],
        rows: list.map((v) => [v.id, v.boxId, orgName(v.organizationId), zoneName(v.zoneId), v.category, v.severity, v.status, formatDate(v.dateIdentified), v.resolutionDate ? formatDate(v.resolutionDate) : '—']),
      };
    }
    case 'RPT-05': {
      const boxZone = new Map(boxes.map((b) => [b.id, b.zoneId]));
      const list = displacements.filter((d) => inZone(boxZone.get(d.boxId)) && inRange(d.scheduledDate));
      return {
        title: 'Displacement Activity Report', filter: filterLine,
        summary: [['Operations in scope', list.length], ['Completed', list.filter((d) => d.status === 'completed').length], ['In transit', list.filter((d) => d.status === 'in-transit').length]],
        columns: ['Operation', 'Box', 'Pickup Location', 'Destination', 'Team', 'Vehicle', 'Status', 'Priority', 'Scheduled'],
        rows: list.map((d) => [d.id, d.boxId, d.pickupLocation, d.destinationFacility, d.assignedTeam, d.vehicle, d.status, d.priority, formatDate(d.scheduledDate)]),
      };
    }
    case 'RPT-06': {
      const boxZone = new Map(boxes.map((b) => [b.id, b.zoneId]));
      const list = inventory.filter((i) => inZone(boxZone.get(i.boxId)) && inRange(i.dateReceived));
      return {
        title: 'Safekeeping Inventory Report', filter: filterLine,
        summary: [['Items in scope', list.length], ['Total value', formatCurrency(list.reduce((s, i) => s + i.value, 0))], ['Awaiting instruction', list.filter((i) => i.custodyStatus === 'awaiting-instruction').length], ['Disposal requests', disposalRequests.length]],
        columns: ['Item', 'Box', 'Facility', 'Received', 'Condition', 'Classification', 'Value (AED)', 'Custody Status'],
        rows: list.map((i) => [i.id, i.boxId, i.facility, formatDate(i.dateReceived), i.condition, i.classification, i.value, i.custodyStatus]),
      };
    }
    case 'RPT-07': {
      return {
        title: 'Organization Compliance Report', filter: 'All organizations · current snapshot',
        summary: [['Organizations', organizations.length], ['Average compliance score', (organizations.reduce((s, o) => s + o.complianceScore, 0) / (organizations.length || 1)).toFixed(1)], ['With open violations', organizations.filter((o) => o.openViolations > 0).length]],
        columns: ['Organization', 'License', 'Registration', 'Registered Boxes', 'Compliance Score', 'Open Violations', 'Last Inspection'],
        rows: organizations.map((o) => [o.name, o.licenseNumber, o.registrationStatus, o.registeredBoxes, o.complianceScore, o.openViolations, formatDate(o.lastInspection)]),
      };
    }
    case 'RPT-09': {
      const { cashDiscrepancies = [] } = ctx;
      const boxZone = new Map(boxes.map((b) => [b.id, b.zoneId]));
      const list = cashDiscrepancies.filter((c) => inZone(boxZone.get(c.boxId)) && inRange(c.createdAt));
      const totalVariance = list.reduce((s, c) => s + Math.abs(c.variance), 0);
      return {
        title: 'Cash Reconciliation Report', filter: filterLine,
        summary: [
          ['Discrepancy cases in scope', list.length],
          ['Open', list.filter((c) => c.status !== 'closed').length],
          ['Total variance in dispute (AED)', totalVariance],
          ['Confirmed misappropriation', list.filter((c) => c.resolutionType === 'misappropriation').length],
        ],
        columns: ['Case', 'Box', 'Item', 'Zone', 'Handoff Stage', 'Expected (AED)', 'Actual (AED)', 'Variance (AED)', 'Variance %', 'Status', 'Resolution', 'Flagged', 'Resolved'],
        rows: list.map((c) => [
          c.id, c.boxId, c.inventoryId, zoneName(boxZone.get(c.boxId)), c.ledgerStage,
          c.expectedAmount, c.actualAmount, c.variance, c.variancePct, c.status, c.resolutionType || '—',
          formatDate(c.createdAt), c.resolvedAt ? formatDate(c.resolvedAt) : '—',
        ]),
      };
    }
    default: {
      const scopedBoxes = boxes.filter((b) => inZone(b.zoneId));
      const counts = summarizeLifecycle(scopedBoxes, lifecycleIndex);
      const done = inspections.filter((i) => inZone(i.zoneId) && inRange(i.scheduledDate) && i.status === 'completed');
      const passRate = done.length ? Math.round((done.filter((i) => i.complianceResult === 'pass').length / done.length) * 100) : 0;
      const rows = [
        ['Registry', 'Registered boxes', scopedBoxes.length],
        ['Registry', 'Compliance rate', `${scopedBoxes.length ? ((scopedBoxes.filter((b) => b.status === 'compliant').length / scopedBoxes.length) * 100).toFixed(1) : 0}%`],
        ...LIFECYCLE_STAGES.map((s) => ['Lifecycle', s.label, counts[s.key]]),
        ['Inspections', 'Completed in period', done.length],
        ['Inspections', 'Pass rate in period', `${passRate}%`],
        ['Inspections', 'Evidence items attached', inspections.filter((i) => inZone(i.zoneId)).reduce((s, i) => s + (i.evidence || []).length, 0)],
        ['Compliance', 'Open violations', violations.filter((v) => inZone(v.zoneId) && v.status !== 'resolved').length],
        ['Complaints', 'Open complaints', complaints.filter((c) => inZone(c.zoneId) && c.status !== 'resolved').length],
        ['Displacement', 'Operations active', displacements.filter((d) => d.status !== 'completed').length],
        ['Safekeeping', 'Items in custody', inventory.filter((i) => i.custodyStatus === 'stored' || i.custodyStatus === 'awaiting-instruction').length],
        ['Disposal', 'Requests pending approval', disposalRequests.filter((r) => r.status === 'pending').length],
        ['Disposal', 'Approved, not yet executed', disposalRequests.filter((r) => r.status === 'approved').length],
        ['Disposal', 'Executed', disposalRequests.filter((r) => r.status === 'executed').length],
      ];
      return { title: 'Monthly Regulatory Summary', filter: filterLine, summary: [['Period', RANGE_LABEL[range] || range]], columns: ['Module', 'Metric', 'Value'], rows };
    }
  }
}

/** A report object for the audit log so it can use the same exporters. */
export function buildAuditReport(entries, filterText) {
  const json = (v) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v));
  return {
    title: 'Audit Log', filter: filterText,
    summary: [['Entries', entries.length]],
    columns: ['Log ID', 'Timestamp', 'User', 'Role', 'Entity Type', 'Entity ID', 'Action', 'Before', 'After', 'Source'],
    rows: entries.map((a) => [a.id, formatDateTime(a.timestamp), a.user, a.role || '', a.entityType || '', a.entityId || '', a.action, json(a.before ?? a.previousStatus), json(a.after ?? a.newStatus), a.source]),
  };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function exportReport(format, report) {
  const name = `DCD-${slug(report.title)}-${stamp()}`;
  const generated = `Generated ${formatDateTime(new Date().toISOString())}`;

  if (format === 'csv') {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [report.columns, ...report.rows].map((r) => r.map(esc).join(','));
    download(new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
    return;
  }

  if (format === 'excel') {
    const wb = XLSX.utils.book_new();
    const info = [[report.title], [report.filter], [generated], [], ...report.summary.map(([k, v]) => [k, v]), [], [DISCLAIMER]];
    const infoSheet = XLSX.utils.aoa_to_sheet(info);
    infoSheet['!cols'] = [{ wch: 34 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, infoSheet, 'Summary');
    const dataSheet = XLSX.utils.aoa_to_sheet([report.columns, ...report.rows]);
    dataSheet['!cols'] = report.columns.map((c, i) => ({ wch: Math.min(48, Math.max(c.length + 2, ...report.rows.slice(0, 200).map((r) => String(r[i] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Data');
    XLSX.writeFile(wb, `${name}.xlsx`);
    return;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(report.title, 40, 44);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text(`${report.filter}  ·  ${generated}`, 40, 60);
  doc.setTextColor(160, 60, 30); doc.text(DISCLAIMER, 40, 74); doc.setTextColor(0);
  let y = 90;
  if (report.summary.length) {
    autoTable(doc, { startY: y, head: [['Summary', '']], body: report.summary.map(([k, v]) => [k, String(v)]), theme: 'grid', styles: { fontSize: 8.5 }, headStyles: { fillColor: [29, 53, 80] }, tableWidth: 300, margin: { left: 40 } });
    y = doc.lastAutoTable.finalY + 14;
  }
  const rows = report.rows.slice(0, PDF_ROW_CAP).map((r) => r.map((c) => String(c ?? '')));
  autoTable(doc, {
    startY: y, head: [report.columns], body: rows, styles: { fontSize: 7.5, cellPadding: 3 }, headStyles: { fillColor: [29, 53, 80] },
    alternateRowStyles: { fillColor: [244, 247, 251] }, margin: { left: 40, right: 40, bottom: 34 },
    didDrawPage: () => {
      doc.setFontSize(7.5); doc.setTextColor(120);
      doc.text(`${DISCLAIMER}   Page ${doc.internal.getNumberOfPages()}`, 40, doc.internal.pageSize.getHeight() - 16);
      doc.setTextColor(0);
    },
  });
  if (report.rows.length > PDF_ROW_CAP) {
    doc.setFontSize(8); doc.text(`Showing the first ${PDF_ROW_CAP} of ${report.rows.length} rows. Export to Excel for the full data set.`, 40, doc.lastAutoTable.finalY + 14);
  }
  doc.save(`${name}.pdf`);
  return pageW;
}
