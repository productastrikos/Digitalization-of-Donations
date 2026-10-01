// DOM-element builders for maplibregl.Marker — the MapLibre equivalent of the
// old Leaflet L.divIcon helpers, same visual language, no Leaflet dependency.

export function boxMarkerEl(color, pulsing = false) {
  const el = document.createElement('div');
  el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #0a1220;cursor:pointer;${
    pulsing ? 'box-shadow:0 0 0 0 rgba(226,84,74,0.6);animation:marker-pulse 1.8s infinite;' : 'box-shadow:0 1px 3px rgba(0,0,0,0.6);'
  }`;
  return el;
}

export function clusterMarkerEl(count, color) {
  const size = count > 100 ? 44 : count > 25 ? 38 : 32;
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    background:rgba(16,31,48,0.92);border:2px solid ${color};color:#e6ecf5;font-weight:700;font-family:monospace;font-size:${count > 100 ? 12 : 11}px;cursor:pointer;`;
  el.textContent = String(count);
  return el;
}

export function cityMarkerEl(label, color) {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;';
  el.innerHTML = `
    <div style="width:13px;height:13px;border-radius:50%;background:${color};border:2px solid #050b16;animation:marker-pulse 2s infinite;"></div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:#e6ecf5;background:rgba(10,18,32,0.85);border:1px solid #1d3550;padding:2px 7px;border-radius:3px;white-space:nowrap;">${label}</div>`;
  return el;
}

export function transitParticleEl() {
  const el = document.createElement('div');
  el.style.cssText = 'width:9px;height:9px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px 3px rgba(59,130,246,0.75);pointer-events:none;';
  return el;
}

/**
 * buildingMarkerEl — the Abu Dhabi destination marker: a landmark-tower glyph
 * in a pulsing amber halo, matching the landing page's amber route/road
 * theme. The glyph stays gold (brand identity).
 */
export function buildingMarkerEl(label) {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;';
  el.innerHTML = `
    <div class="building-pin-glow" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(245,163,0,0.35) 0%,rgba(245,163,0,0.08) 65%,transparent 75%);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="7" y="3" width="10" height="18" rx="1" fill="#c9a24b" stroke="#0a1220" stroke-width="1"/>
        <rect x="9.2" y="5.6" width="2" height="2" fill="#0a1220"/>
        <rect x="12.8" y="5.6" width="2" height="2" fill="#0a1220"/>
        <rect x="9.2" y="9.2" width="2" height="2" fill="#0a1220"/>
        <rect x="12.8" y="9.2" width="2" height="2" fill="#0a1220"/>
        <rect x="9.2" y="12.8" width="2" height="2" fill="#0a1220"/>
        <rect x="12.8" y="12.8" width="2" height="2" fill="#0a1220"/>
        <rect x="10.4" y="16.6" width="3.2" height="4.4" fill="#0a1220"/>
        <rect x="3.5" y="11" width="3.5" height="10" fill="#a9832f" stroke="#0a1220" stroke-width="1"/>
        <rect x="17" y="8.5" width="3.5" height="12.5" fill="#a9832f" stroke="#0a1220" stroke-width="1"/>
      </svg>
    </div>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:#e6ecf5;background:rgba(10,18,32,0.85);border:1px solid #2a4a78;padding:2px 7px;border-radius:3px;white-space:nowrap;">${label}</div>`;
  return el;
}

/** A closed geodesic-ish circle polygon in GeoJSON, for zone/risk fill layers. */
export function geoCircle(center, radiusMeters, points = 64) {
  const coords = [];
  const distanceX = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110540;
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([center.lng + distanceX * Math.cos(theta), center.lat + distanceY * Math.sin(theta)]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}
