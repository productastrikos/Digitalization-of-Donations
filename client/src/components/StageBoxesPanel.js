import React, { useMemo, useState } from 'react';
import { useData } from '../services/socket';
import DataTable from './DataTable';
import { BoxStatusBadge } from './StatusBadge';
import BoxDetailDrawer from './BoxDetailDrawer';
import { LIFECYCLE_STAGES, STAGE_BY_KEY, buildLifecycleIndex, lifecycleStageOf } from '../services/boxLifecycle';
import { zoneById, formatDate } from '../services/donationSeed';

/**
 * StageBoxesPanel — the canonical-lifecycle default view for a module's
 * landing page: the actual boxes currently at this stage, not that
 * module's own record type. Every module reads the same box.status /
 * custodyStatus derivation (see boxLifecycle.js), so a box can never show
 * one stage here and a different one in the Registry.
 */
export default function StageBoxesPanel({ stage, title, subtitle, emptyLabel, pageSize = 8 }) {
  const { boxes, organizations, inventory, displacements } = useData();
  const [selectedBox, setSelectedBox] = useState(null);
  const lifecycleIndex = useMemo(() => buildLifecycleIndex({ inventory, displacements }), [inventory, displacements]);
  const stageBoxes = useMemo(() => boxes.filter((b) => lifecycleStageOf(b, lifecycleIndex) === stage), [boxes, lifecycleIndex, stage]);
  const openRemovalByBox = useMemo(() => {
    const m = new Map();
    displacements.forEach((d) => { if (d.status !== 'completed') m.set(d.boxId, d); });
    return m;
  }, [displacements]);
  const orgName = (id) => organizations.find((o) => o.id === id)?.name || 'Unknown Organization';
  const stageMeta = STAGE_BY_KEY[stage] || LIFECYCLE_STAGES[0];

  const columns = [
    { key: 'id', header: 'Box ID', render: (b) => <span className="font-mono font-medium" style={{ color: 'var(--app-text)' }}>{b.id}</span>, sortValue: (b) => b.id },
    { key: 'zone', header: 'Zone', render: (b) => zoneById(b.zoneId)?.name || b.zoneId },
    { key: 'org', header: 'Organization', render: (b) => <span style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{orgName(b.organizationId)}</span> },
    { key: 'status', header: 'Compliance Status', render: (b) => <BoxStatusBadge status={b.status} removal={openRemovalByBox.get(b.id)} /> },
    { key: 'action', header: 'Current Action', render: (b) => b.currentAction },
    { key: 'next', header: 'Next Inspection', render: (b) => formatDate(b.nextInspection), sortValue: (b) => b.nextInspection },
  ];

  return (
    <>
      <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stageMeta.color }} />
              {title} ({stageBoxes.length.toLocaleString()})
            </h3>
            <p className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--app-text-faint)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success)' }} /> Live · canonical lifecycle stage: {stageMeta.label}
          </span>
        </div>
        <div className="p-4">
          <DataTable columns={columns} data={stageBoxes} keyExtractor={(b) => b.id} onRowClick={setSelectedBox} pageSize={pageSize} emptyLabel={emptyLabel || `No boxes currently at the ${stageMeta.label} stage.`} />
        </div>
      </div>
      <BoxDetailDrawer box={selectedBox} onClose={() => setSelectedBox(null)} />
    </>
  );
}
