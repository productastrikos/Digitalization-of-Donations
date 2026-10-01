import maplibregl from 'maplibre-gl';
import { createRoot } from 'react-dom/client';

/**
 * openReactPopup — mounts real React content (with working onClick handlers,
 * not string HTML with inline attributes) into a MapLibre popup anchored at
 * lngLat. Returns the popup so the caller can .remove() it if needed.
 */
export function openReactPopup(map, lngLat, node, options = {}) {
  const container = document.createElement('div');
  const root = createRoot(container);
  root.render(node);

  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', ...options })
    .setLngLat(lngLat)
    .setDOMContent(container)
    .addTo(map);

  popup.on('close', () => {
    // Defer unmount past this tick so React doesn't warn about unmounting
    // a root while its own click handler is still on the call stack.
    setTimeout(() => root.unmount(), 0);
  });

  return popup;
}

/** A plain DOM element for a maplibregl.Marker — mirrors the old L.divIcon HTML. */
export function markerEl(html, { width, height } = {}) {
  const el = document.createElement('div');
  el.innerHTML = html;
  if (width) el.style.width = `${width}px`;
  if (height) el.style.height = `${height}px`;
  return el.firstElementChild;
}
