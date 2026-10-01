import React, { useEffect, useRef, useState } from 'react';
import MapLibreMap from './MapLibreMap';
import { openReactPopup } from './reactPopup';
import { geoCircle } from './maplibreIcons';
import { ABU_DHABI, formatDate } from '../../services/donationSeed';
import { RISK_CATEGORY_COLOR } from '../../services/palette';

const RISK_COLOR = RISK_CATEGORY_COLOR;

function zonesGeoJSON(zones) {
  return {
    type: 'FeatureCollection',
    features: zones.map((zone) => {
      const color = RISK_COLOR[zone.riskCategory] || RISK_COLOR.Normal;
      const radius = 3200 + zone.riskScore * 140;
      return { type: 'Feature', properties: { id: zone.id, color }, geometry: geoCircle(zone.center, radius) };
    }),
  };
}

const popupBtnStyle = {
  fontSize: 9.5, fontWeight: 700, padding: '4px 6px', borderRadius: 4,
  border: '1px solid #c7d3e0', background: '#eef3f9', color: '#28466a', cursor: 'pointer', flex: 1,
};

function PopupRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '1.5px 0', color: '#28466a' }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function ZonePopup({ zone, onOpenZone, onCreateTask, onAssignTeam }) {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#0d1826', marginBottom: 1 }}>{zone.name}</div>
      <div style={{ color: '#5b7290', fontSize: 10.5, marginBottom: 8 }}>Region: {zone.region}</div>
      <PopupRow label="Risk Score" value={zone.riskScore} />
      <PopupRow label="Non-Compliant Boxes" value={zone.nonCompliantBoxes} />
      <PopupRow label="Open Complaints" value={zone.openComplaints} />
      <PopupRow label="Overdue Inspections" value={zone.overdueInspections} />
      <PopupRow label="Last Verified" value={formatDate(zone.lastVerified)} />
      <div style={{ borderTop: '1px solid #e5e9f0', margin: '6px 0', paddingTop: 6 }}>
        <div style={{ color: '#5b7290', fontSize: 10, marginBottom: 2 }}>Recommended Action</div>
        <div style={{ color: '#28466a', fontWeight: 600 }}>{zone.recommendedAction}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => onOpenZone?.(zone)} style={popupBtnStyle}>View Zone</button>
        <button onClick={() => onCreateTask?.(zone)} style={popupBtnStyle}>Inspection Task</button>
        <button onClick={() => onAssignTeam?.(zone)} style={popupBtnStyle}>Assign Team</button>
      </div>
    </div>
  );
}

/**
 * RiskMap — Location Intelligence's geographic visualization: each zone is a
 * shaded circle sized/colored by composite risk category, with a click popup
 * carrying the full risk breakdown so the map stays consistent with the
 * register table and charts below it (all derived from the same zone list).
 */
export default function RiskMap({ zones, height = 460, zoom = 9, onOpenZone, onCreateTask, onAssignTeam }) {
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const callbacksRef = useRef({ onOpenZone, onCreateTask, onAssignTeam });
  callbacksRef.current = { onOpenZone, onCreateTask, onAssignTeam };

  function handleLoad(map) {
    mapRef.current = map;
    map.addSource('risk-zones', { type: 'geojson', data: zonesGeoJSON(zones) });
    map.addLayer({ id: 'risk-zones-fill', type: 'fill', source: 'risk-zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.22 } });
    map.addLayer({ id: 'risk-zones-line', type: 'line', source: 'risk-zones', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5 } });

    map.on('mouseenter', 'risk-zones-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'risk-zones-fill', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'risk-zones-fill', (e) => {
      const zone = zonesRef.current.find((z) => z.id === e.features[0].properties.id);
      if (zone) {
        const { onOpenZone: openZ, onCreateTask: createT, onAssignTeam: assignT } = callbacksRef.current;
        openReactPopup(map, e.lngLat, <ZonePopup zone={zone} onOpenZone={openZ} onCreateTask={createT} onAssignTeam={assignT} />, { minWidth: '260px' });
      }
    });
    setReady(true);
  }

  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  useEffect(() => {
    const map = mapRef.current;
    const src = map && ready && map.getSource('risk-zones');
    if (src) src.setData(zonesGeoJSON(zones));
  }, [zones, ready]);

  return (
    <div style={{ height, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--app-border)' }}>
      <MapLibreMap center={ABU_DHABI} zoom={zoom} onLoad={handleLoad} />
    </div>
  );
}

export function RiskMapLegend() {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-md)' }}>
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>Risk Category</div>
      <div className="space-y-1">
        {Object.entries(RISK_COLOR).map(([label, color]) => (
          <div key={label} className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--app-text-muted)' }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
