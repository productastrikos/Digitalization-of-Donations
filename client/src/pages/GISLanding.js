import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import MapLibreMap from '../components/map/MapLibreMap';
import { openReactPopup } from '../components/map/reactPopup';
import { cityMarkerEl, buildingMarkerEl } from '../components/map/maplibreIcons';
import { buildLandingMapStyle } from '../services/mapStyle';
import { DUBAI } from '../services/donationSeed';

// Tuned the same way DUBAI already is (see donationSeed.js): the raw Abu
// Dhabi city coordinate sits at the coastal edge of the urban grid, mostly
// open Gulf water on one side at a close zoom. This sits nearer the middle
// of the island's built-up mass so the arrival shot is dense in every
// direction — confirmed live (every tile the frame needs loads; this is
// just about which tiles those end up being).
const ABU_DHABI_ARRIVAL = { lat: 24.4750, lng: 54.3600 };
const UAE_OVERVIEW_BOUNDS = [[51.5, 22.6], [56.4, 26.1]];
const UAE_OVERVIEW_CENTER = { lat: 24.0, lng: 53.9 };

// Shown briefly while transiting between the two cities — our own, correctly
// spelled labels rather than OpenStreetMap's place-name symbols (which can
// use inconsistent local spellings and aren't worth filtering by hand).
const TRANSIT_LANDMARKS = [
  { name: 'Jebel Ali', lat: 24.9857, lng: 55.0272, at: 0.3 },
  { name: 'Ghantoot', lat: 24.8345, lng: 54.902, at: 0.58 },
];

const PHASE_TEXT = [
  'Scanning United Arab Emirates — Regulatory Network',
  'Surveying Dubai',
  'Connecting to Abu Dhabi Regulatory Operations…',
  'Establishing secure connection to Abu Dhabi Regulatory Operations…',
];

const waitFor = (map, evt) => new Promise((resolve) => map.once(evt, resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lerp = (a, b, t) => a + (b - a) * t;

function DestinationPopup({ transitioning, onEnter }) {
  return (
    <div style={{ width: 260, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a94a0' }}>Destination</div>
      <div style={{ marginTop: 2, fontSize: 14, fontWeight: 700, color: '#e6ecf5' }}>Abu Dhabi Regulatory Operations</div>
      <p style={{ marginTop: 6, fontSize: 11, lineHeight: 1.5, color: '#a9bdd6' }}>
        Step inside the building to open the Donation Control command center for the Emirate.
      </p>

      <div style={{ marginTop: 10, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a94a0' }}>System Coverage</div>
      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {['Donation Box Monitoring', 'Compliance', 'GIS', 'Inspections'].map((t) => (
          <span key={t} style={{ borderRadius: 4, padding: '2px 8px', fontSize: 10.5, background: '#101f30', border: '1px solid #3a2e10', color: '#d8c38a' }}>{t}</span>
        ))}
      </div>

      <button
        onClick={onEnter}
        disabled={transitioning}
        style={{
          marginTop: 12, display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderRadius: 6, padding: '9px 0', fontSize: 12.5, fontWeight: 600, cursor: transitioning ? 'default' : 'pointer',
          background: 'rgba(245,163,0,0.16)', border: '1px solid rgba(245,163,0,0.5)', color: '#ffc84a', opacity: transitioning ? 0.6 : 1,
        }}
      >
        {transitioning ? 'Entering the building…' : 'Enter Dashboard →'}
      </button>
    </div>
  );
}

export default function GISLanding({ onEnter }) {
  const [phase, setPhase] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const mapRef = useRef(null);
  const skippedRef = useRef(false);
  const landmarkElsRef = useRef({});
  const rafRef = useRef(null);
  const orbitRafRef = useRef(null);

  function handleSkip() {
    skippedRef.current = true;
    onEnter();
  }

  function handleEnter() {
    setTransitioning(true);
    setTimeout(() => onEnter(), 900);
  }

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (orbitRafRef.current) cancelAnimationFrame(orbitRafRef.current);
  }, []);

  async function runSequence(map) {
    // Step A — overview hold, with a slow bearing drift so it feels alive
    // rather than a static screenshot. fitBounds already happened in
    // handleLoad, before this runs (gated on the overview's own 'idle').
    await new Promise((resolve) => {
      const start = performance.now();
      const DURATION = 3000;
      function tick(now) {
        if (skippedRef.current) { resolve(); return; }
        const elapsed = now - start;
        map.setBearing(Math.min(1, elapsed / DURATION) * 12);
        if (elapsed >= DURATION) resolve();
        else rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    });
    if (skippedRef.current) return;

    // Step B — dive into Dubai.
    setPhase(1);
    map.flyTo({ center: [DUBAI.lng, DUBAI.lat], zoom: 12.5, pitch: 55, bearing: -20, curve: 1.4, duration: 3000, essential: true });
    await waitFor(map, 'idle');
    if (skippedRef.current) return;

    // Step C — travel to Abu Dhabi. A curve this wide makes MapLibre pull
    // the camera back and up mid-flight to cover the distance, which is what
    // actually reveals the whole coastline in transit — not a scripted wide
    // shot, just how a flight this long naturally plays out. A route line
    // grows alongside it (progressively extended GeoJSON, not a static
    // dashed line), with a couple of landmark labels fading in and out as
    // the camera passes them.
    setPhase(2);
    const ROUTE_DURATION = 5000;
    // Registered before flyTo starts, not after the animation loop below
    // finishes — both run for ~the same duration, so attaching this listener
    // afterwards risked the real 'moveend' already having fired and gone,
    // which left this awaiting an event that would never come again and
    // stalled the whole sequence right before arrival.
    const flightDone = waitFor(map, 'moveend');
    map.flyTo({ center: [ABU_DHABI_ARRIVAL.lng, ABU_DHABI_ARRIVAL.lat], zoom: 13, pitch: 60, bearing: 0, curve: 1.8, duration: ROUTE_DURATION, essential: true });
    await new Promise((resolve) => {
      const start = performance.now();
      function tick(now) {
        if (skippedRef.current) { resolve(); return; }
        const t = Math.min(1, (now - start) / ROUTE_DURATION);
        const lng = lerp(DUBAI.lng, ABU_DHABI_ARRIVAL.lng, t);
        const lat = lerp(DUBAI.lat, ABU_DHABI_ARRIVAL.lat, t);
        const src = map.getSource('transit-route');
        if (src) src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[DUBAI.lng, DUBAI.lat], [lng, lat]] } });
        TRANSIT_LANDMARKS.forEach((lm) => {
          const el = landmarkElsRef.current[lm.name];
          if (!el) return;
          const dist = Math.abs(t - lm.at);
          el.style.opacity = dist < 0.09 ? String(1 - dist / 0.09) : '0';
        });
        if (t >= 1) resolve();
        else rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    });
    if (skippedRef.current) return;
    await flightDone;
    if (skippedRef.current) return;

    // Step D — arrived. A slow continuous bearing orbit keeps the 3D
    // buildings feeling alive while the destination panel comes up.
    setPhase(3);
    const orbitTick = () => {
      map.setBearing((map.getBearing() + 0.04) % 360);
      orbitRafRef.current = requestAnimationFrame(orbitTick);
    };
    orbitRafRef.current = requestAnimationFrame(orbitTick);
    await wait(1200);
    if (skippedRef.current) return;
    setShowPanel(true);
  }

  function handleLoad(map) {
    mapRef.current = map;

    // This is a cinematic intro, not a working map — camera motion is fully
    // scripted, not user-driven.
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.keyboard.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();

    map.addSource('transit-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
    map.addLayer({ id: 'transit-route-glow', type: 'line', source: 'transit-route', paint: { 'line-color': '#f5a300', 'line-width': 10, 'line-blur': 6, 'line-opacity': 0.35 } });
    map.addLayer({ id: 'transit-route-line', type: 'line', source: 'transit-route', paint: { 'line-color': '#ffc84a', 'line-width': 2.2, 'line-opacity': 0.92 } });

    new maplibregl.Marker({ element: cityMarkerEl('DUBAI', '#f5a300') }).setLngLat([DUBAI.lng, DUBAI.lat]).addTo(map);
    const buildingEl = buildingMarkerEl('ABU DHABI');
    new maplibregl.Marker({ element: buildingEl }).setLngLat([ABU_DHABI_ARRIVAL.lng, ABU_DHABI_ARRIVAL.lat]).addTo(map);

    TRANSIT_LANDMARKS.forEach((lm) => {
      const el = document.createElement('div');
      el.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.06em;color:#f5a300;text-transform:uppercase;opacity:0;transition:opacity 250ms ease;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,0.85);white-space:nowrap;';
      el.textContent = lm.name;
      landmarkElsRef.current[lm.name] = el;
      new maplibregl.Marker({ element: el }).setLngLat([lm.lng, lm.lat]).addTo(map);
    });

    // Opens on the whole Emirate from above — fitBounds happens synchronously
    // here, before the very first paint, so the initial center/zoom props on
    // MapLibreMap are never actually what's seen on screen.
    map.fitBounds(UAE_OVERVIEW_BOUNDS, { pitch: 0, bearing: 0, duration: 0 });

    map.once('idle', () => runSequence(map));
  }

  useEffect(() => {
    const map = mapRef.current;
    if (showPanel && map) {
      openReactPopup(map, [ABU_DHABI_ARRIVAL.lng, ABU_DHABI_ARRIVAL.lat], <DestinationPopup transitioning={transitioning} onEnter={handleEnter} />, {
        closeButton: false, closeOnClick: false, className: 'poc-popup', offset: [0, -22],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPanel]);

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ background: '#0a0d12' }}>
      <MapLibreMap center={UAE_OVERVIEW_CENTER} zoom={5} scrollZoom={false} dragPan={false} onLoad={handleLoad} mapStyle={buildLandingMapStyle} />

      {/* header overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5" style={{ zIndex: 1000, background: 'linear-gradient(180deg, rgba(10,13,18,0.95), transparent)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-md" style={{ width: 36, height: 36, border: '1px solid rgba(245,163,0,0.4)', background: 'rgba(13,15,18,0.8)' }}>
            <svg className="w-4.5 h-4.5" style={{ color: '#f5a300' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e6ecf5' }}>DCD DONATION CONTROL</div>
            <div style={{ fontSize: 10.5, color: '#8a94a0' }}>United Arab Emirates — Regulatory Network</div>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{ fontSize: 10.5, fontWeight: 600, color: '#ffc84a', background: 'rgba(13,15,18,0.8)', border: '1px solid rgba(245,163,0,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: '#f5a300' }} />
            LIVE
          </div>
          <button
            onClick={handleSkip}
            className="rounded-md px-3 py-1.5 text-[11px] font-semibold"
            style={{ color: '#cbd5e1', background: 'rgba(13,15,18,0.8)', border: '1px solid rgba(203,213,225,0.25)' }}
          >
            Skip Intro →
          </button>
        </div>
      </div>

      {!showPanel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center" style={{ zIndex: 1000 }}>
          <div key={phase} className="pointer-events-auto flex items-center gap-2.5 rounded-md px-4 py-2.5 animate-fade-in" style={{ fontSize: 12, color: '#e6ecf5', background: 'rgba(13,15,18,0.9)', border: '1px solid rgba(245,163,0,0.3)', backdropFilter: 'blur(6px)' }}>
            <svg className="w-4 h-4" style={{ color: '#f5a300' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {PHASE_TEXT[phase]}
          </div>
        </div>
      )}

      {transitioning && <div className="absolute inset-0 animate-fade-in" style={{ zIndex: 1100, background: '#0a0d12' }} />}
    </div>
  );
}
