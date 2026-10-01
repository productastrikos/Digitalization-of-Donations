import React from 'react';
import { Chart as ChartJS } from 'chart.js';
import { SEM, SEM_SOFT } from '../services/palette';
import { translateString, getActiveLang } from '../services/i18n';

/* ─── CSS-variable reader ─────────────────────────────────── */
export function getCSSVar(name) {
  if (typeof document === 'undefined') return '';
  const el = document.body || document.documentElement;
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/* ─── Snapshot of all chart colour tokens for the current theme ─ */
export function getChartTokens() {
  return {
    tooltipBg:     getCSSVar('--app-chart-tooltip-bg'),
    tooltipBorder: getCSSVar('--app-chart-tooltip-border'),
    tooltipTitle:  getCSSVar('--app-text'),
    tooltipBody:   getCSSVar('--app-text-muted'),
    gridColor:     getCSSVar('--app-chart-grid'),
    // Bright by default — the previous faint token read as illegible (near-
    // black) against the dark panels once font sizes dropped below ~11px.
    tickColor:     getCSSVar('--app-text'),
    tickMuted:     getCSSVar('--app-text-muted'),
    legendColor:   getCSSVar('--app-text'),
    success:       getCSSVar('--app-success'),
    warning:       getCSSVar('--app-warning'),
    danger:        getCSSVar('--app-danger'),
    info:          getCSSVar('--app-info'),
    accent:        getCSSVar('--app-accent'),
    accentBg:      getCSSVar('--app-accent-bg'),
    violet:        getCSSVar('--app-violet'),
    violetBg:      getCSSVar('--app-violet-bg'),
    successBar:    getCSSVar('--app-success-bar'),
    warningBar:    getCSSVar('--app-warning-bar'),
    dangerBar:     getCSSVar('--app-danger-bar'),
  };
}

/* ─── Standard Chart.js tooltip config ───────────────────── */
export function chartTooltip(extra = {}) {
  return {
    // Fixed (not theme-token-driven) colors — a tooltip is a floating
    // overlay, not part of the page's own background flow, so it only needs
    // to be internally legible. Reading CSS custom properties here was
    // occasionally resolving to an unexpected/empty value depending on
    // theme-toggle timing, producing a black-on-black tooltip in some
    // charts; fixed colors are legible against either the light or dark
    // page theme every time.
    backgroundColor: '#0d1826',
    borderColor:     '#33475e',
    borderWidth:     1,
    titleColor:      '#e6ecf5',
    bodyColor:       '#c5d3e5',
    footerColor:     '#e6ecf5',
    footerFont:      { weight: '600' },
    position:        'nearest',
    padding:         8,
    titleFont:       { weight: '600' },
    ...extra,
  };
}

/* Horizontal bar charts: pick the row by the cursor's Y position (Chart.js defaults to X for index mode) */
export const HBAR_INTERACTION = { mode: 'index', axis: 'y', intersect: false };

/* ─── Standard axis title config — 11px medium-weight muted slate ───
 * so axis labels stay legible without competing with the plotted data. */
export function axisTitle(text) {
  return { display: true, text, color: '#94a3b8', font: { size: 11, weight: '500' } };
}

/* ─── Standard subtle gridline for a chart's value axis ──────────── */
export function gridLine() {
  return { display: true, color: 'rgba(148,163,184,0.16)', lineWidth: 1, drawTicks: false };
}

/* ─── Standard Chart.js scales config ────────────────────── */
export function chartScales(overrides = {}) {
  return {
    x: { grid: { display: false }, ticks: { color: themeColor('--app-text'), font: { size: 9 } }, ...(overrides.x || {}) },
    y: { grid: { display: false }, ticks: { color: themeColor('--app-text'), font: { size: 9 } }, ...(overrides.y || {}) },
  };
}

/* ─── Dynamic palette — reads CSS vars on every access ───── */
function buildPalettes() {
  const t = getChartTokens();
  return {
    categorical: [SEM.info, SEM.normal, SEM.warning, SEM.analytic, SEM.critical, SEM.neutral, SEM.infoLight, '#64748b'],
    area: {
      cyan:    { border: SEM.info,  fill: SEM_SOFT.info },
      blue:    { border: SEM.info,  fill: SEM_SOFT.info },
      violet:  { border: SEM.analytic,  fill: SEM_SOFT.analytic },
      pink:    { border: SEM.analytic,  fill: SEM_SOFT.analytic },
      emerald: { border: SEM.normal,  fill: SEM_SOFT.normal },
      amber:   { border: SEM.warning,  fill: SEM_SOFT.warning },
      slate:   { border: t.tickMuted, fill: getCSSVar('--app-surface-soft') },
    },
  };
}

/* CHART_PALETTES — Proxy so every property access reads current theme */
export const CHART_PALETTES = new Proxy({}, {
  get(_, key) { return buildPalettes()[key]; },
});

const LABEL_BUILDERS = {
  '12H': (n) => Array.from({ length: n }, (_, i) => `${String(Math.round((i / Math.max(n - 1, 1)) * 12)).padStart(2, '0')}:00`),
  '24H': (n) => Array.from({ length: n }, (_, i) => `${String(Math.round((i / Math.max(n - 1, 1)) * 23)).padStart(2, '0')}:00`),
  '7D':  (n) => Array.from({ length: n }, (_, i) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7]),
  '30D': (n) => Array.from({ length: n }, (_, i) => `D${i + 1}`),
};

/* ─── Standardised timeframe presets ──────────────────────────
 * Only 12H / 24H / 7D / 30D are permitted across the application.
 * Each preset is paired to the *kind* of metric whose health is
 * actually affected on that horizon:
 *   realtime → fast-moving operational telemetry (intra-day shifts)
 *   ops      → daily operational KPIs (collection, fleet, intake)
 *   trend    → medium-term performance & ESG trends
 */
export const TIMEFRAME_OPTIONS = {
  // Realtime / intra-day operations (e.g. WTE power output, fleet activity)
  realtime:    [
    { value: '12H', label: '12H', points: 12, dataWindow: 12 },
    { value: '24H', label: '24H', points: 24, dataWindow: null },
  ],
  // Daily operations rolling into the week (collection coverage, vehicle activity)
  ops:         [
    { value: '24H', label: '24H', points: 24, dataWindow: null },
    { value: '7D',  label: '7D',  points: 7,  dataWindow: null },
  ],
  // Medium-term trends (citizen feedback, weekly intake, recycling rate)
  trend:       [
    { value: '7D',  label: '7D',  points: 7,  dataWindow: 7  },
    { value: '30D', label: '30D', points: 30, dataWindow: null },
  ],
  // Strategic / ESG indicators (carbon, landfill capacity, sustainability)
  strategic:   [
    { value: '30D', label: '30D', points: 30, dataWindow: null },
  ],
  // Aliases — keep older imports working with sensible defaults
  intradayOps: [
    { value: '12H', label: '12H', points: 12, dataWindow: 12 },
    { value: '24H', label: '24H', points: 24, dataWindow: null },
  ],
  dailyOps: [
    { value: '24H', label: '24H', points: 24, dataWindow: null },
    { value: '7D',  label: '7D',  points: 7,  dataWindow: null },
  ],
  weekly: [
    { value: '7D',  label: '7D',  points: 7,  dataWindow: 7  },
    { value: '30D', label: '30D', points: 30, dataWindow: null },
  ],
  monthly: [
    { value: '7D',  label: '7D',  points: 7,  dataWindow: 7  },
    { value: '30D', label: '30D', points: 30, dataWindow: null },
  ],
};

/**
 * Pill-style timeframe selector matching the dashboard card header style.
 * Background, borders and text colours all derive from the active theme
 * tokens so the control reads the same in light and dark mode.
 */
export function ChartTimeframeControl({ options, value, onChange }) {
  if (!options || options.length < 2) return null;
  return (
    <div
      className="app-timeframe-control inline-flex items-center"
      role="tablist"
      aria-label="Time range"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`app-timeframe-btn ${active ? 'is-active' : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function getTimeframeOption(options, value) {
  return options.find((opt) => opt.value === value) || options[0];
}

export function buildTimeframeLabels(timeframe, points) {
  return (LABEL_BUILDERS[timeframe] || LABEL_BUILDERS['24H'])(points);
}

export function resampleSeries(base, points) {
  if (!Array.isArray(base) || base.length === 0) return [];
  if (base.length === points) return base;
  if (points === 1) return [base[base.length - 1]];
  return Array.from({ length: points }, (_, i) => {
    const pos = (i / (points - 1)) * (base.length - 1);
    const lo  = Math.floor(pos);
    const hi  = Math.min(base.length - 1, Math.ceil(pos));
    const mix = pos - lo;
    return parseFloat((base[lo] + (base[hi] - base[lo]) * mix).toFixed(2));
  });
}


/* Scriptable colour: Chart.js evaluates it on every draw, so axis text follows
   the theme at paint time. A value read at render time is one theme behind
   after a toggle (the body's data-theme is applied in an effect, after render). */
export const themeColor = (name) => () => getCSSVar(name);

/* Soft top-to-bottom fade for line/area fills — reads clean on dark panels
   (a flat low-alpha fill over navy turns muddy brown/olive). */
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
export const areaGradient = (color, top = 0.38) => (ctx) => {
  const { chart } = ctx;
  const area = chart.chartArea;
  if (!area) return hexA(color, top * 0.6);
  const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, hexA(color, top));
  g.addColorStop(1, hexA(color, 0.02));
  return g;
};

/* Chart text lives on a canvas, so the DOM translator can't reach it. This
   plugin translates category labels, dataset names and axis titles at update
   time while Arabic is active, and restores the English source otherwise. */
function swapText(state, key, current, translate) {
  if (!state[key] || state[key].out !== current) state[key] = { src: current, out: current };
  const rec = state[key];
  rec.out = getActiveLang() === 'ar' ? translate(rec.src) : rec.src;
  return rec.out;
}
const i18nChartPlugin = {
  id: 'dcdI18n',
  beforeUpdate(chart) {
    const st = chart.$dcdI18n || (chart.$dcdI18n = {});
    const d = chart.data;
    if (Array.isArray(d.labels)) d.labels = swapText(st, 'labels', d.labels, (a) => a.map((x) => (typeof x === 'string' ? translateString(x) : x)));
    (d.datasets || []).forEach((ds, i) => { if (typeof ds.label === 'string') ds.label = swapText(st, 'ds' + i, ds.label, translateString); });
    const scales = chart.options && chart.options.scales;
    if (scales) Object.keys(scales).forEach((id) => { const ti = scales[id] && scales[id].title; if (ti && typeof ti.text === 'string') ti.text = swapText(st, 'sc' + id, ti.text, translateString); });
  },
};
ChartJS.register(i18nChartPlugin);
if (typeof window !== 'undefined') {
  window.addEventListener('dcd-lang', () => Object.values(ChartJS.instances || {}).forEach((c) => c.update('none')));
}
