import React, { useMemo } from 'react';
import Drawer from './Drawer';
import DataTable from './DataTable';
import { GenericBadge } from './StatusBadge';
import { formatDate } from '../services/donationSeed';

const KPI_META = {
  'registered-orgs': { title: 'Registered Organizations', subtitle: 'Every licensed organization authorized to operate donation collection boxes.' },
  'active-orgs': { title: 'Active Organizations', subtitle: 'Organizations with current, unexpired registration status.' },
  'flagged-orgs': { title: 'Flagged Organizations', subtitle: 'Every organization currently flagged High, Medium, or Low risk, ranked by severity.' },
};

const STATUS_TONE = { active: 'cyan', pending: 'slate', suspended: 'red', expired: 'amber' };
const RISK_TONE = { High: 'red', Medium: 'amber', Low: 'cyan' };

/**
 * OrgRecordsDrawer — record-level detail behind the Organizations & Ownership
 * KPI cards. Each KPI (other than Average Compliance Score, which keeps the
 * standard trend-chart drawer, and the two risk KPIs which scroll/filter the
 * on-page action panel instead) opens the specific slice of the registry
 * that explains its number, instead of a generic graph.
 */
export default function OrgRecordsDrawer({ kpiId, organizations, profiles, onClose, onSelectOrg }) {
  const meta = kpiId ? KPI_META[kpiId] : null;

  const orgColumns = useMemo(() => [
    { key: 'name', header: 'Organization Name', render: (o) => <span style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: 'var(--app-text)' }}>{o.name}</span>, sortValue: (o) => o.name },
    { key: 'license', header: 'License Number', render: (o) => <span className="font-mono" style={{ color: 'var(--app-text-faint)' }}>{o.licenseNumber}</span> },
    { key: 'status', header: 'Registration Status', render: (o) => <GenericBadge tone={STATUS_TONE[o.registrationStatus]}>{o.registrationStatus}</GenericBadge>, sortValue: (o) => o.registrationStatus },
    { key: 'boxes', header: 'Registered Boxes', render: (o) => <span className="font-mono">{o.registeredBoxes}</span>, sortValue: (o) => o.registeredBoxes },
    { key: 'score', header: 'Compliance Score', render: (o) => <span className="font-mono font-semibold" style={{ color: 'var(--app-text)' }}>{o.complianceScore}</span>, sortValue: (o) => o.complianceScore },
    { key: 'violations', header: 'Open Violations', render: (o) => <span className="font-mono">{o.openViolations}</span>, sortValue: (o) => o.openViolations },
    { key: 'lastInspection', header: 'Last Inspection', render: (o) => formatDate(o.lastInspection), sortValue: (o) => o.lastInspection },
  ], []);

  const flaggedColumns = useMemo(() => [
    { key: 'name', header: 'Organization Name', render: (o) => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: 'var(--app-text)' }}>{o.name}</span>, sortValue: (o) => o.name },
    { key: 'tier', header: 'Risk Tier', render: (o) => <GenericBadge tone={RISK_TONE[o.riskTier]}>{o.riskTier}</GenericBadge>, sortValue: (o) => o.riskTier },
    { key: 'reason', header: 'Primary Reason', render: (o) => <span style={{ color: 'var(--app-text-faint)' }}>{o.primaryReason}</span> },
    { key: 'score', header: 'Compliance Score', render: (o) => <span className="font-mono">{o.complianceScore}</span>, sortValue: (o) => o.complianceScore },
    { key: 'violations', header: 'Open Violations', render: (o) => <span className="font-mono">{o.openViolations}</span>, sortValue: (o) => o.openViolations },
    { key: 'ownership', header: 'Ownership Status', render: (o) => <GenericBadge tone={o.ownershipStatus === 'Verified' ? 'green' : o.ownershipStatus === 'Pending' ? 'amber' : 'red'}>{o.ownershipStatus}</GenericBadge>, sortValue: (o) => o.ownershipStatus },
  ], []);

  const registeredOrgs = useMemo(() => (kpiId === 'registered-orgs' ? [...organizations].sort((a, b) => a.name.localeCompare(b.name)) : []), [kpiId, organizations]);
  const activeOrgs = useMemo(() => (kpiId === 'active-orgs' ? organizations.filter((o) => o.registrationStatus === 'active').sort((a, b) => a.name.localeCompare(b.name)) : []), [kpiId, organizations]);

  if (!kpiId || !meta) return null;

  const orgTableData = kpiId === 'registered-orgs' ? registeredOrgs : kpiId === 'active-orgs' ? activeOrgs : null;

  return (
    <Drawer open={true} onClose={onClose} title={meta.title} subtitle={meta.subtitle} width={kpiId === 'flagged-orgs' ? 560 : 460}>
      {orgTableData && (
        <DataTable
          columns={orgColumns}
          data={orgTableData}
          keyExtractor={(o) => o.id}
          onRowClick={onSelectOrg}
          pageSize={25}
          emptyLabel="No matching organizations."
        />
      )}

      {kpiId === 'flagged-orgs' && (
        <DataTable
          columns={flaggedColumns}
          data={profiles || []}
          keyExtractor={(o) => o.id}
          onRowClick={onSelectOrg}
          pageSize={25}
          emptyLabel="No organizations currently flagged."
        />
      )}
    </Drawer>
  );
}
