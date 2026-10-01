import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildDarkMapStyle } from '../../services/mapStyle';

/**
 * MapLibreMap — the shared base map for every GIS view in the app (replaces
 * the old Leaflet + Esri/HERE raster setup). Callers get the live
 * maplibregl.Map instance via onLoad(map) and add their own markers/layers
 * imperatively, the same way they previously composed <Marker>/<Circle>
 * children — MapLibre just doesn't have a React-children API for that.
 *
 * introFlight, when given, plays once per mount: the camera opens on Dubai,
 * pauses briefly, then flies itself to the target center/zoom. It never
 * replays on a re-render because it's gated by a ref, not state.
 */
export default function MapLibreMap({
  center, zoom = 9, pitch = 0, bearing = 0, minZoom, maxZoom, scrollZoom = true, dragPan = true,
  onLoad, className, style, introFlight, mapStyle,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const introTimeoutRef = useRef(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    const startCenter = introFlight ? introFlight.from : center;
    const startZoom = introFlight ? (introFlight.fromZoom ?? 11) : zoom;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: (mapStyle || buildDarkMapStyle)(),
      center: [startCenter.lng, startCenter.lat],
      zoom: startZoom,
      pitch, bearing,
      minZoom, maxZoom,
      attributionControl: false,
      // A larger tile cache means tiles already seen earlier in a cinematic
      // flight (e.g. the overview before diving into a city) don't get
      // evicted and re-fetched on the way back past them, and a short fade
      // means a tile that does arrive late pops in immediately instead of
      // cross-fading in a way that can look like a flicker mid-flight.
      maxTileCacheSize: 500,
      fadeDuration: 80,
    });
    mapRef.current = map;

    if (!scrollZoom) map.scrollZoom.disable();
    if (!dragPan) map.dragPan.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({
      compact: true,
      customAttribution: '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors',
    }), 'bottom-right');

    // MapLibre sizes its WebGL canvas from the container's box at construction
    // time. If that box isn't fully settled yet (route transition, flex
    // layout still resolving, fonts still loading), the canvas locks onto a
    // too-small viewport and only ever renders/loads tiles for that corner —
    // the rest of the (correctly full-size) container just shows empty
    // background, which reads as the map "fading" or missing most of itself.
    // A ResizeObserver catches every later layout change and keeps the GL
    // canvas's internal resolution in sync with its actual on-screen size.
    // Calling map.resize() unconditionally on every observer callback — even
    // when the size hasn't actually changed — made MapLibre recompute its
    // tile cover and abort in-flight tile requests (visible as
    // net::ERR_ABORTED) on every single firing, which could cancel real
    // tiles mid-fetch before they ever got the chance to complete. Guarding
    // on an actual size change makes this a one-time correction instead of a
    // standing disruption.
    let lastWidth = 0;
    let lastHeight = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (Math.abs(width - lastWidth) < 1 && Math.abs(height - lastHeight) < 1) return;
      lastWidth = width;
      lastHeight = height;
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    map.on('load', () => {
      onLoadRef.current && onLoadRef.current(map);
      if (introFlight) {
        // Wait for the opening view's own tiles to actually finish loading
        // ('idle') before starting the dwell timer — starting from a fixed
        // point after 'load' risked flying off before the start city had
        // rendered, leaving both ends of the flight looking sparse/empty.
        map.once('idle', () => {
          introTimeoutRef.current = setTimeout(() => {
            map.flyTo({
              center: [introFlight.to.lng, introFlight.to.lat],
              zoom: introFlight.toZoom ?? zoom,
              duration: introFlight.duration ?? 3000,
              essential: true,
            });
          }, introFlight.delay ?? 1000);
        });
      }
    });

    return () => {
      if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current);
      resizeObserver.disconnect();
      map.remove();
    };
    // Intentionally mount-once: center/zoom/introFlight are the map's initial
    // state, not reactive props — re-creating the map on every prop change
    // would also replay the intro flight, which is exactly what we don't want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
}
