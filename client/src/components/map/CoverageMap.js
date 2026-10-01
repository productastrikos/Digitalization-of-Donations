import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import MapLibreMap from './MapLibreMap';
import { openReactPopup } from './reactPopup';
import { boxMarkerEl, clusterMarkerEl, geoCircle } from './maplibreIcons';
import { BOX_STATUS_COLOR } from '../StatusBadge';
import { ABU_DHABI, formatDate } from '../../services/donationSeed';
import { SEM } from '../../services/palette';

function gridCellSize(zoom) { return 6 / Math.pow(2, zoom); }

function buildClusters(boxes, zoom) {
  const cell = gridCellSize(zoom);
  if (cell < 0.0015) return boxes.map((b) => ({ single: b, lat: b.location.lat, lng: b.location.lng }));
  const groups = new Map();
  for (const b of boxes) {
    const key = `${Math.round(b.location.lat / cell)}_${Math.round(b.location.lng / cell)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  return Array.from(groups.values()).map((items) => {
    if (items.length === 1) return { single: items[0], lat: items[0].location.lat, lng: items[0].location.lng };
    const lat = items.reduce((s, b) => s + b.location.lat, 0) / items.length;
    const lng = items.reduce((s, b) => s + b.location.lng, 0) / items.length;
    const counts = {};
    items.forEach((b) => { counts[b.status] = (counts[b.status] || 0) + 1; });
    const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return { cluster: items, lat, lng, count: items.length, color: BOX_STATUS_COLOR[dominant] };
  });
}

function zoneCircleColor(area) {
  if (area.surveyStatus === 'Complete') return SEM.normal;
  if (area.surveyStatus === 'Partial') return SEM.warning;
  return SEM.neutral;
}

function areasGeoJSON(areas) {
  return {
    type: 'FeatureCollection',
    features: areas.map((area) => ({
      type: 'Feature',
      properties: { id: area.id, color: zoneCircleColor(area) },
      geometry: geoCircle(area.center, 5200),
    })),
  };
}

function PopupRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '1.5px 0', color: '#28466a' }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function AreaPopup({ area }) {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: '#0d1826', marginBottom: 1 }}>{area.name}</div>
      <div style={{ color: '#5b7290', fontSize: 10.5, marginBottom: 8 }}>Region: {area.region}</div>
      <PopupRow label="Registered Boxes" value={area.totalRegisteredBoxes} />
      <PopupRow label="Mapped Locations" value={area.mappedBoxes} />
      <PopupRow label="Geographic Coverage" value={`${area.coveragePercentage}%`} />
      <PopupRow label="Location Accuracy" value={`${area.locationAccuracy}%`} />
      <PopupRow label="Non-Compliant" value={area.nonCompliant} />
      <PopupRow label="Open Complaints" value={area.openComplaints} />
      <div style={{ borderTop: '1px solid #e5e9f0', margin: '6px 0', paddingTop: 6 }}>
        <PopupRow label="Survey Status" value={area.surveyStatus} />
        <PopupRow label="Last Verified" value={formatDate(area.lastVerified)} />
        <PopupRow label="Action Required" value={area.actionRequired} />
      </div>
    </div>
  );
}

/**
 * CoverageMap — the Geographic Coverage tab's map: zone circles are the
 * primary interactive layer (click for the full survey detail popup),
 * with the same clustered box markers used across the app underneath.
 */
export default function CoverageMap({ boxes, areas, height = 480, zoom = 9 }) {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const clusters = useMemo(() => buildClusters(boxes, currentZoom), [boxes, currentZoom]);

  function handleLoad(map) {
    mapRef.current = map;
    map.addSource('areas', { type: 'geojson', data: areasGeoJSON(areas) });
    map.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } });
    map.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5 } });

    map.on('mouseenter', 'areas-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'areas-fill', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'areas-fill', (e) => {
      const area = areas.find((a) => a.id === e.features[0].properties.id);
      if (area) openReactPopup(map, e.lngLat, <AreaPopup area={area} />, { minWidth: '260px' });
    });

    map.on('zoom', () => setCurrentZoom(map.getZoom()));
    map.on('moveend', () => setCurrentZoom(map.getZoom()));
    setReady(true);
  }

  useEffect(() => {
    const map = mapRef.current;
    const src = map && ready && map.getSource('areas');
    if (src) src.setData(areasGeoJSON(areas));
  }, [areas, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = clusters.map((item) => {
      const el = item.single ? boxMarkerEl(BOX_STATUS_COLOR[item.single.status], item.single.status === 'non-compliant') : clusterMarkerEl(item.count, item.color);
      const pos = item.single ? [item.single.location.lng, item.single.location.lat] : [item.lng, item.lat];
      return new maplibregl.Marker({ element: el }).setLngLat(pos).addTo(map);
    });
    return () => markersRef.current.forEach((m) => m.remove());
  }, [clusters, ready]);

  return (
    <div style={{ height, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--app-border)' }}>
      <MapLibreMap center={ABU_DHABI} zoom={zoom} onLoad={handleLoad} />
    </div>
  );
}
