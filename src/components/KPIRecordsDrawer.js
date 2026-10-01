import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { useData } from '../services/socket';
import Drawer from './Drawer';
import DataTable from './DataTable';
import { GenericBadge } from './StatusBadge';
import { chartTooltip, chartScales, axisTitle, gridLine, areaGradient } from './chartUtils';
import { complianceTrend, formatDate, formatGST } from '../services/donationSeed';
import { SEM } from '../services/palette';
import {
  buildInspectionsDueTodayRecords, buildZoneComplianceRecords,
  buildEscalatedCaseRecords, buildPendingReviewRecords,
} from '../services/kpiRecords';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const PRIORITY_TONE = { Critical: 'red', Urgent: 'amber', High: 'amber', Priority: 'cyan', Medium: 'cyan', Low: 'slate', Routine: 'slate' };
const STATUS_TONE = {
  Open: 'red', 'Under Review': 'amber', 'Under Compliance Review': 'amber',
  'Awaiting Supervisor Action': 'amber', 'Scheduled Today': 'cyan',
};

const KPI_META = {
  'strip-inspections-due-today': { title: 'Inspections Due Today', subtitle: 'Pending inspections scheduled for completion within the current operational day.' },
  'strip-compliance-pct': { title: 'Overall Compliance %', subtitle: 'Compliance trend and zone-by-zone breakdown behind the headline figure.' },
  'strip-escalated-cases': { title: 'Escalated Cases', subtitle: 'Inspection cases escalated to the Compliance & Inspections Division.' },
  'strip-pending-reviews': { title: 'Pending Reviews', subtitle: 'Violation cases currently under compliance review, ranked by age.' },
};

export default function KPIRecordsDrawer({ kpiId, onClose }) {
  const { boxes, violations, inspections } = useData();
  const meta = kpiId ? KPI_META[kpiId] : null;

  const inspectionsDueRecords = useMemo(() => (kpiId === 'strip-inspections-due-today' ? buildInspectionsDueTodayRecords(inspections) : []), [kpiId, inspections]);
  const zoneComplianceRecords = useMemo(() => (kpiId === 'strip-compliance-pct' ? buildZoneComplianceRecords(boxes) : []), [kpiId, boxes]);
  const escalatedRecords = useMemo(() => (kpiId === 'strip-escalated-cases' ? buildEscalatedCaseRecords(inspections, boxes) : []), [kpiId, inspections, boxes]);
  const pendingReviewRecords = useMemo(() => (kpiId === 'strip-pending-reviews' ? buildPendingReviewRecords(violations) : []), [kpiId, violations]);

  const complianceRate = useMemo(() => {
    const total = boxes.length;
    return total ? Math.round((boxes.filter((b) => b.status === 'compliant').length / total) * 1000) / 10 : 0;
  }, [boxes]);
  const complianceSeries = useMemo(() => (kpiId === 'strip-compliance-pct' ? complianceTrend(complianceRate) : []), [kpiId, complianceRate]);

  if (!kpiId || !meta) return null;

  return (
    <Drawer open={true} onClose={onClose} title={meta.title} subtitle={meta.subtitle} width={460}>
      {kpiId === 'strip-inspections-due-today' && (
        <DataTable
          columns={[
            { key: 'id', header: 'Inspection ID', render: (r) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{r.id}</span>, sortValue: (r) => r.id },
            { key: 'boxId', header: 'Donation Box ID', render: (r) => <span className="font-mono">{r.boxId}</span>, sortValue: (r) => r.boxId },
            { key: 'zone', header: 'Zone', render: (r) => r.zone, sortValue: (r) => r.zone },
            { key: 'assignedTeam', header: 'Inspector / Assigned Team', render: (r) => r.assignedTeam, sortValue: (r) => r.assignedTeam },
            { key: 'scheduledTime', header: 'Scheduled Time', render: (r) => formatGST(r.scheduledTime), sortValue: (r) => r.scheduledTime },
            { key: 'inspectionType', header: 'Inspection Type', render: (r) => r.inspectionType, sortValue: (r) => r.inspectionType },
            { key: 'priority', header: 'Priority', render: (r) => <GenericBadge tone={PRIORITY_TONE[r.priority]}>{r.priority}</GenericBadge>, sortValue: (r) => r.priority },
            { key: 'status', header: 'Status', render: (r) => <GenericBadge tone={STATUS_TONE[r.status]}>{r.status}</GenericBadge> },
            { key: 'action', header: 'Action', render: (r) => <span style={{ color: 'var(--app-text-faint)' }}>{r.action}</span> },
          ]}
          data={inspectionsDueRecords}
          keyExtractor={(r) => r.id}
          pageSize={12}
          emptyLabel="No inspections due today."
        />
      )}

      {kpiId === 'strip-compliance-pct' && (
        <>
          <div className="mb-4" style={{ height: 180 }}>
            <Line
              data={{
                labels: complianceSeries.map((p) => p.label),
                datasets: [
                  { label: 'Compliance Rate', data: complianceSeries.map((p) => p.value), borderColor: SEM.normal, backgroundColor: areaGradient(SEM.normal), fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2 },
                  { label: 'Target', data: complianceSeries.map(() => 95), borderColor: SEM.analytic, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5, fill: false },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: chartTooltip() },
                scales: chartScales({
                  x: { title: axisTitle('Month') },
                  y: { min: 70, max: 100, title: axisTitle('Compliance Rate (%)'), grid: gridLine() },
                }),
              }}
            />
          </div>
          <DataTable
            columns={[
              { key: 'zone', header: 'Zone', render: (r) => <span style={{ fontWeight: 600, color: 'var(--app-text)' }}>{r.zone}</span>, sortValue: (r) => r.zone },
              { key: 'total', header: 'Total Registered Boxes', render: (r) => <span className="font-mono">{r.total}</span>, sortValue: (r) => r.total },
              { key: 'compliant', header: 'Compliant Boxes', render: (r) => <span className="font-mono">{r.compliant}</span>, sortValue: (r) => r.compliant },
              { key: 'nonCompliant', header: 'Non-Compliant Boxes', render: (r) => <span className="font-mono">{r.nonCompliant}</span>, sortValue: (r) => r.nonCompliant },
              { key: 'pct', header: 'Compliance %', render: (r) => <span className="font-mono">{r.pct}%</span>, sortValue: (r) => r.pct },
              { key: 'lastInspection', header: 'Last Inspection', render: (r) => (r.lastInspection ? formatDate(r.lastInspection) : '—'), sortValue: (r) => r.lastInspection || '' },
              { key: 'requiredAction', header: 'Required Action', render: (r) => <span style={{ color: 'var(--app-text-faint)' }}>{r.requiredAction}</span> },
            ]}
            data={zoneComplianceRecords}
            keyExtractor={(r) => r.zone}
            pageSize={13}
          />
        </>
      )}

      {kpiId === 'strip-escalated-cases' && (
        <DataTable
          columns={[
            { key: 'id', header: 'Case ID', render: (r) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{r.id}</span>, sortValue: (r) => r.id },
            { key: 'zone', header: 'Zone', render: (r) => r.zone, sortValue: (r) => r.zone },
            { key: 'issueType', header: 'Issue Type', render: (r) => r.issueType, sortValue: (r) => r.issueType },
            { key: 'escalationReason', header: 'Escalation Reason', render: (r) => <span style={{ color: 'var(--app-text-faint)' }}>{r.escalationReason}</span> },
            { key: 'priority', header: 'Priority', render: (r) => <GenericBadge tone={PRIORITY_TONE[r.priority]}>{r.priority}</GenericBadge>, sortValue: (r) => r.priority },
            { key: 'assignedOfficer', header: 'Assigned Officer', render: (r) => r.assignedOfficer, sortValue: (r) => r.assignedOfficer },
            { key: 'escalationDate', header: 'Escalation Date', render: (r) => formatDate(r.escalationDate), sortValue: (r) => r.escalationDate },
            { key: 'deadline', header: 'Deadline', render: (r) => formatDate(r.deadline), sortValue: (r) => r.deadline },
            { key: 'status', header: 'Current Status', render: (r) => <GenericBadge tone={STATUS_TONE[r.status]}>{r.status}</GenericBadge>, sortValue: (r) => r.status },
          ]}
          data={escalatedRecords}
          keyExtractor={(r) => r.id}
          pageSize={12}
          emptyLabel="No escalated cases at this time."
        />
      )}

      {kpiId === 'strip-pending-reviews' && (
        <DataTable
          columns={[
            { key: 'id', header: 'Review ID', render: (r) => <span className="font-mono" style={{ color: 'var(--app-text)' }}>{r.id}</span>, sortValue: (r) => r.id },
            { key: 'relatedCaseId', header: 'Related Case / Violation ID', render: (r) => <span className="font-mono">{r.relatedCaseId}</span>, sortValue: (r) => r.relatedCaseId },
            { key: 'zone', header: 'Zone', render: (r) => r.zone, sortValue: (r) => r.zone },
            { key: 'reviewType', header: 'Review Type', render: (r) => r.reviewType, sortValue: (r) => r.reviewType },
            { key: 'submittedDate', header: 'Submitted Date', render: (r) => formatDate(r.submittedDate), sortValue: (r) => r.submittedDate },
            { key: 'assignedReviewer', header: 'Assigned Reviewer', render: (r) => r.assignedReviewer, sortValue: (r) => r.assignedReviewer },
            { key: 'daysPending', header: 'Days Pending', render: (r) => <span className="font-mono">{r.daysPending}</span>, sortValue: (r) => r.daysPending },
            { key: 'priority', header: 'Priority', render: (r) => <GenericBadge tone={PRIORITY_TONE[r.priority]}>{r.priority}</GenericBadge>, sortValue: (r) => r.priority },
            { key: 'status', header: 'Status', render: (r) => <GenericBadge tone={STATUS_TONE[r.status]}>{r.status}</GenericBadge> },
            { key: 'requiredAction', header: 'Required Action', render: (r) => <span style={{ color: 'var(--app-text-faint)' }}>{r.requiredAction}</span> },
          ]}
          data={pendingReviewRecords}
          keyExtractor={(r) => r.id}
          pageSize={12}
          emptyLabel="No pending reviews at this time."
        />
      )}
    </Drawer>
  );
}
