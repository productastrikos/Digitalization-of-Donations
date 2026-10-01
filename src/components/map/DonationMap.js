import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import MapLibreMap from './MapLibreMap';
import { openReactPopup } from './reactPopup';
import { boxMarkerEl, clusterMarkerEl, geoCircle } from './maplibreIcons';
import { BOX_STATUS_COLOR } from '../StatusBadge';
import { ZONES, zoneById, DUBAI, ABU_DHABI, formatDate } from '../../services/donationSeed';
import { SEM } from '../../services/palette';

function gridCellSize(zoom) {
  // Larger grid cells (more aggressive clustering) at low zoom, shrinking as the
  // viewer zooms in, until individual markers are shown at city-block scale.
  return 6 / Math.pow(2, zoom);
}

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

function zonesGeoJSON(zoneStats) {
  return {
    type: 'FeatureCollection',
    features: zoneStats.map(({ zone, count, nonCompliant }) => {
      const critical = nonCompliant > count * 0.15;
      return {
        type: 'Feature',
        properties: { name: zone.name, count, color: critical ? SEM.critical : '#28466a', fillColor: critical ? SEM.critical : SEM.normal, fillOpacity: critical ? 0.06 : 0.03 },
        geometry: geoCircle(zone.center, 5200),
      };
    }),
  };
}
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function BoxPopup({ box, orgName, onSelectBox }) {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong style={{ color: '#0d1826' }}>{box.id}</strong>
        <span style={{ color: BOX_STATUS_COLOR[box.status], fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>{box.status.replace('-', ' ')}</span>
      </div>
      {/* The popup lives inside the map's own overflow:hidden wrapper (kept
          for the map's rounded corners), so a marker near the container edge
          can have nowhere to flip to — this caps the content's own height
          and scrolls internally instead of ever being hard-clipped. */}
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: '#28466a', maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
        <Row label="QR Code" value={box.qrCode} />
        <Row label="Location" value={box.address} />
        <Row label="Zone" value={zoneById(box.zoneId)?.name || box.zoneId} />
        <Row label="Owner" value={orgName} />
        <Row label="Box Type" value={box.boxType} />
        <Row label="Compliance Score" value={`${box.complianceScore}/100`} />
        <Row label="Last Inspection" value={formatDate(box.lastInspection)} />
        <Row label="Next Inspection" value={formatDate(box.nextInspection)} />
        <Row label="Current Action" value={box.currentAction} />
        <Row label="Evidence Available" value={box.evidenceAvailable ? 'Yes' : 'No'} />
      </div>
      {onSelectBox && (
        <button
          onClick={() => onSelectBox(box)}
          style={{ marginTop: 8, width: '100%', borderRadius: 6, border: '1px solid rgba(45,212,208,0.4)', background: 'rgba(45,212,208,0.12)', color: '#0e8f8b', fontWeight: 700, fontSize: 11, padding: '6px 0', cursor: 'pointer' }}
        >
          View Full Record
        </button>
      )}
    </div>
  );
}

export default function DonationMap({ boxes, organizations = [], onSelectBox, height = 440, showZones = true, center, zoom = 9, playIntro = false, fitToData = false }) {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const orgName = (id) => organizations.find((o) => o.id === id)?.name || 'Unknown Organization';

  const clusters = useMemo(() => buildClusters(boxes, currentZoom), [boxes, currentZoom]);

  const zoneStats = useMemo(() => ZONES.map((z) => {
    const zBoxes = boxes.filter((b) => b.zoneId === z.id);
    const nonCompliant = zBoxes.filter((b) => b.status === 'non-compliant').length;
    return { zone: z, count: zBoxes.length, nonCompliant };
  }), [boxes]);

  function handleLoad(map) {
    mapRef.current = map;
    map.addSource('zones', { type: 'geojson', data: showZones ? zonesGeoJSON(zoneStats) : EMPTY_FC });
    map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': ['get', 'fillOpacity'] } });
    map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': ['get', 'color'], 'line-width': 1 } });

    const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'zone-hover-tip' });
    map.on('mousemove', 'zones-fill', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features[0];
      tooltip.setLngLat(e.lngLat).setHTML(`<span class="zone-label">${f.properties.name} · ${f.properties.count} boxes</span>`).addTo(map);
    });
    map.on('mouseleave', 'zones-fill', () => { map.getCanvas().style.cursor = ''; tooltip.remove(); });

    map.on('zoom', () => setCurrentZoom(map.getZoom()));
    map.on('moveend', () => setCurrentZoom(map.getZoom()));
    setReady(true);

    // A fixed zoom picked for one container width shows a sensible Emirate
    // view in a narrow card but pulls in neighboring countries in a wide,
    // full-width one (and vice versa). Fitting to the actual coordinates of
    // every box being shown is correct regardless of container size, and
    // directly satisfies "every registered box across the Emirate" rather
    // than an arbitrary fixed camera. When the cinematic intro is running,
    // this waits for that flight's own moveend so it doesn't cut it short.
    if (fitToData && boxes.length > 0) {
      const doFit = () => {
        const lngs = boxes.map((b) => b.location.lng);
        const lats = boxes.map((b) => b.location.lat);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, duration: 0, maxZoom: 12 },
        );
      };
      if (playIntro) map.once('moveend', doFit);
      else doFit();
    }
  }

  useEffect(() => {
    const map = mapRef.current;
    const src = map && ready && map.getSource('zones');
    if (src) src.setData(showZones ? zonesGeoJSON(zoneStats) : EMPTY_FC);
  }, [zoneStats, showZones, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = clusters.map((item) => {
      if (item.single) {
        const box = item.single;
        const el = boxMarkerEl(BOX_STATUS_COLOR[box.status], box.status === 'non-compliant');
        const marker = new maplibregl.Marker({ element: el }).setLngLat([box.location.lng, box.location.lat]).addTo(map);
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openReactPopup(map, [box.location.lng, box.location.lat], <BoxPopup box={box} orgName={orgName(box.organizationId)} onSelectBox={onSelectBox} />, { minWidth: '260px' });
        });
        return marker;
      }
      const el = clusterMarkerEl(item.count, item.color);
      const marker = new maplibregl.Marker({ element: el }).setLngLat([item.lng, item.lat]).addTo(map);
      el.addEventListener('click', () => map.flyTo({ center: [item.lng, item.lat], zoom: Math.min(map.getZoom() + 2.5, 16), duration: 600 }));
      return marker;
    });
    return () => markersRef.current.forEach((m) => m.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, ready]);

  const startCenter = center ? { lat: center[0], lng: center[1] } : ABU_DHABI;
  // z11 leaves OpenMapTiles' road/building data almost entirely unpopulated
  // (confirmed: 0 road features at z11, 626 at z12, 7,887 at z12.5) — 12.5 is
  // the lowest zoom that actually renders a full-looking city view.
  const introFlight = playIntro ? { from: DUBAI, to: startCenter, fromZoom: 12.5, toZoom: zoom, delay: 1900, duration: 2400 } : undefined;

  return (
    <div style={{ height, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--app-border)' }}>
      <MapLibreMap center={startCenter} zoom={zoom} onLoad={handleLoad} introFlight={introFlight} />
    </div>
  );
}
