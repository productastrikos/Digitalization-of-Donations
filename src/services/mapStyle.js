// Custom dark-navy MapLibre style over OpenFreeMap's free, keyless vector
// tiles (OpenMapTiles schema — https://tiles.openfreemap.org, unlimited,
// no API key). Layer paint rules are set directly here rather than a
// tile-wide filter/overlay, since raster tiles (the old Esri/HERE basemap)
// can't be recolored at all.
const NAME_FIELD = ['coalesce', ['get', 'name_en'], ['get', 'name']];

export const DUBAI_COORD = { lat: 25.2048, lng: 55.2708 };
export const ABU_DHABI_COORD = { lat: 24.4539, lng: 54.3773 };

export function buildDarkMapStyle() {
  return {
    version: 8,
    name: 'DCD Dark Navy',
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
    layers: [
      // A vivid "command-grid" look: near-black background so glowing blue
      // roads and cyan buildings read as light sources rather than tinted
      // shapes, matching the brief (bright glow on black, blue instead of
      // the reference's orange). Roads get a genuine glow via a wide,
      // blurred duplicate line underneath the crisp bright line on top —
      // the same technique used for the GIS-landing corridor line.
      { id: 'background', type: 'background', paint: { 'background-color': '#030810' } },

      { id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        paint: { 'fill-color': '#0e4a5c', 'fill-opacity': 0.6 } },
      { id: 'landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        paint: { 'fill-color': '#0e4a5c', 'fill-opacity': 0.42 } },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
        paint: { 'fill-color': '#0e4a5c', 'fill-opacity': 0.65 } },

      // Water was only a shade or two off the background (#0a2d47 vs
      // #050b14) — over open Gulf water with no roads/buildings to give the
      // frame any other texture, that read as a flat empty void rather than
      // sea. This is now a clearly blue, unmistakably "water" tone, with a
      // subtle lighter edge along the coastline for definition.
      { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
        paint: { 'line-color': '#1a5a85', 'line-width': 1 } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
        paint: { 'fill-color': '#113d5c' } },
      { id: 'water-shoreline', type: 'line', source: 'openmaptiles', 'source-layer': 'water',
        paint: { 'line-color': '#2a7ab0', 'line-width': 1, 'line-opacity': 0.6 } },

      { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building',
        paint: { 'fill-color': '#1593b0', 'fill-opacity': 0.95, 'fill-outline-color': '#5fe0ff' } },

      // Glow underlayers — wide, blurred, low-opacity copies of the road
      // geometry rendered before the crisp line, so the crisp line reads as
      // genuinely emitting light rather than just being a brighter color.
      // Every road class gets one now (not just secondary/major) and all
      // widths are pushed considerably bolder — the brief is a dense,
      // saturated "glowing grid" look, not a subtle basemap.
      { id: 'road-minor-glow', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'service', 'track', 'path', 'pedestrian'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2dd4f0', 'line-opacity': 0.3, 'line-blur': 2, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 18, 8] } },
      { id: 'road-secondary-glow', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2dd4f0', 'line-opacity': 0.4, 'line-blur': 4, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 18, 24] } },
      { id: 'road-major-glow', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#4de3ff', 'line-opacity': 0.5, 'line-blur': 5, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 8, 18, 36] } },

      { id: 'road-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'service', 'track', 'path', 'pedestrian'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#3fc4f0', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 18, 5] } },

      { id: 'road-secondary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#6fdcff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 18, 12] } },

      { id: 'road-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#b4f3ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3, 18, 20] } },

      { id: 'road-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name',
        minzoom: 13,
        layout: { 'text-field': NAME_FIELD, 'text-size': 10, 'symbol-placement': 'line', 'text-letter-spacing': 0.02 },
        paint: { 'text-color': '#cbd5e1', 'text-halo-color': '#050b14', 'text-halo-width': 1.1 } },

      { id: 'place-labels-town', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'town'], minzoom: 9,
        layout: { 'text-field': NAME_FIELD, 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.05 },
        paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#050b14', 'text-halo-width': 1.2 } },

      { id: 'place-labels-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'city'],
        layout: { 'text-field': NAME_FIELD, 'text-size': 14, 'text-transform': 'uppercase', 'text-letter-spacing': 0.06, 'text-font': ['Noto Sans Bold'] },
        paint: { 'text-color': '#f8fafc', 'text-halo-color': '#050b14', 'text-halo-width': 1.4 } },
    ],
  };
}

// Used only by the /gis-landing cinematic intro — a flatter, amber-on-black
// style (no glow layers on the basemap roads themselves; the animated route
// line in GISLanding.js carries the glow instead) matching a specific
// reference look. Every other map in the app keeps the blue style above.
export function buildLandingMapStyle() {
  return {
    version: 8,
    name: 'DCD Landing Amber',
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0a0d12' } },

      { id: 'landcover', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        paint: { 'fill-color': '#0f4c5a', 'fill-opacity': 0.22 } },
      { id: 'landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        paint: { 'fill-color': '#0f4c5a', 'fill-opacity': 0.16 } },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
        paint: { 'fill-color': '#0f4c5a', 'fill-opacity': 0.3 } },

      { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
        paint: { 'line-color': '#0b1a26', 'line-width': 1 } },
      // Deliberately darker than the land background (per spec) so the sea
      // and the Dubai/Abu Dhabi creeks read as a distinct, deep basin rather
      // than blending into open land.
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
        paint: { 'fill-color': '#0b1a26' } },

      { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building',
        maxzoom: 13,
        paint: { 'fill-color': '#0f4c5a', 'fill-opacity': 0.9, 'fill-outline-color': '#1b7a88' } },
      // 3D extrusion takes over from the flat fill once close enough to read
      // individual buildings — render_height is OpenMapTiles' building
      // height field, in meters.
      { id: 'building-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': '#0f4c5a',
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        } },

      { id: 'road-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['minor', 'service', 'track', 'path', 'pedestrian'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f5a300', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 18, 1.5] } },

      { id: 'road-secondary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f5a300', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 18, 5] } },

      { id: 'road-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f5a300', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 18, 8] } },

      { id: 'road-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name',
        minzoom: 14,
        layout: { 'text-field': NAME_FIELD, 'text-size': 10, 'symbol-placement': 'line', 'text-letter-spacing': 0.02 },
        paint: { 'text-color': '#8a94a0', 'text-halo-color': '#0a0d12', 'text-halo-width': 1.1 } },

      // Place labels are kept sparse and only at low zoom (the overview /
      // transit shots) — minimal clutter is explicit in the brief, and the
      // close-up city/building views carry enough visual interest on their
      // own without town- and suburb-level name spam.
      { id: 'place-labels-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'city'], maxzoom: 11,
        layout: { 'text-field': NAME_FIELD, 'text-size': 13, 'text-transform': 'uppercase', 'text-letter-spacing': 0.06, 'text-font': ['Noto Sans Bold'] },
        paint: { 'text-color': '#8a94a0', 'text-halo-color': '#0a0d12', 'text-halo-width': 1.4 } },
    ],
  };
}
