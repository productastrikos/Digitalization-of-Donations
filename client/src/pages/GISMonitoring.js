import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../services/socket';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DonationMap from '../components/map/DonationMap';
import MapLegend from '../components/map/MapLegend';
import BoxDetailDrawer from '../components/BoxDetailDrawer';
import GeographicCoverageTab from '../components/geo/GeographicCoverageTab';
import LocationIntelligenceTab from '../components/geo/LocationIntelligenceTab';
import { ZONES } from '../services/donationSeed';
import PageSummary from '../components/PageSummary';

const TABS = [
  { key: 'map', label: 'Map Monitoring' },
  { key: 'coverage', label: 'Geographic Coverage' },
  { key: 'intelligence', label: 'Location Intelligence' },
];

const isOverdue = (nextInspection) => new Date(nextInspection).getTime() < Date.now();
const within = (nextInspection, days) => {
  const diff = (new Date(nextInspection).getTime() - Date.now()) / 86400000;
  return diff >= 0 && diff <= days;
};

export default function GISMonitoring() {
  const { boxes, organizations, lastSync } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'map';

  const [status, setStatus] = useState('all');
  const [org, setOrg] = useState('all');
  const [zone, setZone] = useState('all');
  const [category, setCategory] = useState('all');
  const [risk, setRisk] = useState('all');
  const [inspectionWindow, setInspectionWindow] = useState('all');
  const [selectedBox, setSelectedBox] = useState(null);

  const filtered = useMemo(() => boxes.filter((b) => {
    if (status !== 'all' && b.status !== status) return false;
    if (org !== 'all' && b.organizationId !== org) return false;
    if (zone !== 'all' && b.zoneId !== zone) return false;
    if (category !== 'all' && b.donationType !== category) return false;
    if (risk === 'high' && b.complianceScore >= 50) return false;
    if (risk === 'elevated' && (b.complianceScore < 50 || b.complianceScore >= 75)) return false;
    if (risk === 'low' && b.complianceScore < 75) return false;
    if (inspectionWindow === '7d' && !within(b.nextInspection, 7)) return false;
    if (inspectionWindow === '30d' && !within(b.nextInspection, 30)) return false;
    if (inspectionWindow === 'overdue' && !isOverdue(b.nextInspection)) return false;
    return true;
  }), [boxes, status, org, zone, category, risk, inspectionWindow]);

  return (
    <div className="h-full overflow-y-auto space-y-3 p-1">
      <PageHeader
        title="GIS Command Center"
        subtitle="Live geographic surveillance of registered donation boxes and their operational compliance status."
        lastUpdated={lastSync}
      />

      <Tabs tabs={TABS} active={tab} onChange={(k) => setParams(k === 'map' ? {} : { tab: k })} />

      {tab === 'map' && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Status" value={status} onChange={setStatus} options={[
              { label: 'All', value: 'all' }, { label: 'Compliant', value: 'compliant' }, { label: 'Non-Compliant', value: 'non-compliant' },
              { label: 'Under Inspection', value: 'under-inspection' }, { label: 'Pending Displacement', value: 'pending-displacement' }, { label: 'Safekeeping', value: 'safekeeping' },
            ]} />
            <FilterSelect label="Ownership" value={org} onChange={setOrg} options={[{ label: 'All Organizations', value: 'all' }, ...organizations.map((o) => ({ label: o.name, value: o.id }))]} />
            <FilterSelect label="Zone" value={zone} onChange={setZone} options={[{ label: 'All Zones', value: 'all' }, ...ZONES.map((z) => ({ label: z.name, value: z.id }))]} />
            <FilterSelect label="Category" value={category} onChange={setCategory} options={[
              { label: 'All', value: 'all' }, { label: 'Cash', value: 'Cash' }, { label: 'In-Kind', value: 'In-Kind' },
            ]} />
            <FilterSelect label="Risk" value={risk} onChange={setRisk} options={[
              { label: 'All', value: 'all' }, { label: 'High Risk (<50)', value: 'high' }, { label: 'Elevated (50–74)', value: 'elevated' }, { label: 'Low Risk (75+)', value: 'low' },
            ]} />
            <FilterSelect label="Inspection Due" value={inspectionWindow} onChange={setInspectionWindow} options={[
              { label: 'All', value: 'all' }, { label: 'Within 7 Days', value: '7d' }, { label: 'Within 30 Days', value: '30d' }, { label: 'Overdue', value: 'overdue' },
            ]} />
          </div>

          <div className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>
            Displaying <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{filtered.length.toLocaleString()}</span> of {boxes.length.toLocaleString()} registered boxes
          </div>

          <div className="relative">
            <DonationMap boxes={filtered} organizations={organizations} onSelectBox={setSelectedBox} height="calc(100vh - 320px)" zoom={9} playIntro fitToData />
            <div className="absolute top-3 right-3" style={{ zIndex: 1000 }}>
              <MapLegend />
            </div>
          </div>
        </div>
      )}

      {tab === 'coverage' && <GeographicCoverageTab />}

      {tab === 'intelligence' && <LocationIntelligenceTab />}

      <BoxDetailDrawer box={selectedBox} onClose={() => setSelectedBox(null)} />

      <PageSummary page={`gis-${tab}`} />
    </div>
  );
}
