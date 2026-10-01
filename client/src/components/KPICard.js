import React from 'react';
import { useI18n } from '../services/i18n';
import { createPortal } from 'react-dom';

/* ─── SVG Icon library (line-art, 24×24 viewBox) ──────────────────────────
   Fixed, modest size by default so every icon sits cleanly inside its host
   container (KPI icon box, nav item, etc.) instead of overflowing it. */
const Ico = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
    strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
    {children}
  </svg>
);
export const IcoAlert      = () => <Ico><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></Ico>;
export const IcoRoute      = () => <Ico><path d="M3 15l4-4 4 4"/><path d="M7 11v8"/><path d="M21 9l-4 4-4-4"/><path d="M17 13V5"/></Ico>;
export const IcoBarChart   = () => <Ico><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Ico>;
export const IcoClock      = () => <Ico><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ico>;
export const IcoCheck      = () => <Ico><polyline points="20 6 9 17 4 12"/></Ico>;
export const IcoShield     = () => <Ico><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></Ico>;
export const IcoPin        = () => <Ico><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></Ico>;
export const IcoCalendar   = () => <Ico><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ico>;
export const IcoTruck      = () => <Ico><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></Ico>;
export const IcoPeople     = () => <Ico><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></Ico>;
export const IcoWrench     = () => <Ico><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></Ico>;
export const IcoLock       = () => <Ico><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></Ico>;
export const IcoScale      = () => <Ico><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 7l7-4 7 4"/><path d="M5 20h14"/><polyline points="5 11 5 7 19 7 19 11"/><path d="M5 11a3 3 0 006 0M13 11a3 3 0 006 0"/></Ico>;
export const IcoPhone      = () => <Ico><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></Ico>;
export const IcoBox        = () => <Ico><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></Ico>;
export const IcoDollar     = () => <Ico><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></Ico>;
export const IcoTrendUp    = () => <Ico><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></Ico>;
export const IcoHourglass  = () => <Ico><path d="M5 22h14M5 2h14"/><path d="M17 22v-4.17a2 2 0 00-.59-1.42L12 12l-4.41 4.41A2 2 0 007 17.83V22"/><path d="M7 2v4.17a2 2 0 00.59 1.42L12 12l4.41-4.41A2 2 0 0017 6.17V2"/></Ico>;
export const IcoBolt       = () => <Ico><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Ico>;
export const IcoClipboard  = () => <Ico><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></Ico>;
export const IcoTrendDown  = () => <Ico><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></Ico>;
export const IcoFuel       = () => <Ico><path d="M3 22V10l4-8h8l4 8v12"/><line x1="3" y1="10" x2="19" y2="10"/><path d="M15 22v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4"/><path d="M19 10h1a2 2 0 012 2v2a2 2 0 01-2 2h-1"/></Ico>;
export const IcoLink       = () => <Ico><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></Ico>;
export const IcoSignal     = () => <Ico><path d="M2 20h.01M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></Ico>;
export const IcoGlobe      = () => <Ico><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></Ico>;

const THRESHOLD_COLORS = { Green: '#3fb27f', Amber: '#e0a83e', Red: '#e2544a' };

/** Splits a threshold string like "Green ≤ 40 · Amber 41-90 · Red > 90" into
 *  colour-coded segments; falls back to plain text when it doesn't match the
 *  Green/Amber/Red convention (e.g. "Higher is better · tracked cumulatively"). */
function parseThreshold(str) {
  if (!str) return null;
  const parts = str.split('·').map((s) => s.trim()).filter(Boolean);
  const parsed = parts.map((p) => {
    const match = p.match(/^(Green|Amber|Red)\s+(.*)$/);
    return match ? { color: THRESHOLD_COLORS[match[1]], text: match[2] } : { color: null, text: p };
  });
  return parsed.some((p) => p.color) ? parsed : [{ color: null, text: str }];
}

export function deriveRag(color) {
  if (!color) return 'normal';
  if (color.includes('red'))                                                        return 'critical';
  if (color.includes('amber') || color.includes('yellow') || color.includes('orange')) return 'warning';
  return 'normal';
}

/**
 * KPICard — enterprise-grade stat tile (3-column layout)
 *
 * Props:
 *   label       — card title text (shown top-left alongside icon)
 *   description — one-sentence operational context, shown under the label
 *   value       — main displayed value
 *   unit        — optional unit string appended to value
 *   icon        — emoji or JSX node shown in icon box
 *   color       — Tailwind text-* class (used to derive rag if rag prop not given)
 *   rag         — explicit rag key ('normal' | 'warning' | 'critical')
 *   trend       — percent change number (positive = up, negative = down)
 *   trendGood   — override: is this trend direction favourable? (defaults to isPos)
 *   subValues   — array of { label, value } for secondary metrics row (target, baseline, etc.)
 *   sourceEntity— system of record for this KPI
 *   threshold   — one-line RAG threshold definition, rendered visibly on the card
 *   onClick     — makes the "VIEW DETAILS" action clickable (drill-down)
 */
export default function KPICard({ label, description, value, unit, icon, color, rag: ragProp, trend, trendGood, onClick, subValues, sourceEntity, threshold }) {
  const hasTrend = trend !== null && trend !== undefined && trend !== 0;
  const isPos    = trendGood !== undefined ? trendGood : (trend || 0) >= 0;
  const rag      = ragProp || deriveRag(color);
  const [showInfo, setShowInfo] = React.useState(false);
  const [infoPos, setInfoPos] = React.useState(null);
  const { t } = useI18n();
  const hasInfo = Boolean(description || sourceEntity);
  const thresholdParts = parseThreshold(threshold);

  const ragStyles = {
    normal:   { color: '#22c55e', dot: '#16a34a', label: 'NORMAL'   },
    warning:  { color: '#f59e0b', dot: '#d97706', label: 'WARNING'  },
    critical: { color: '#ef4444', dot: '#dc2626', label: 'CRITICAL' },
  }[rag] || { color: '#22c55e', dot: '#16a34a', label: 'NORMAL' };

  return (
    <div
      className="kpi-card"
      style={{
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
        padding: '11px 13px 9px',
        overflow: 'hidden',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/* ── Row 1: icon + label + trend badge ───────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
        <div
          className="rounded-lg flex items-center justify-center leading-none cwm-kpi-icon"
          style={{ width: '22px', height: '22px', fontSize: '0.85rem', flexShrink: 0, color: '#38bdf8' }}
        >
          {icon || '▣'}
        </div>
        <p
          className="font-semibold leading-tight flex-1"
          style={{ color: 'var(--app-text-muted)', fontSize: '10.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {t(label)}
        </p>
        {hasInfo && (
          <span
            className="kpi-info-btn"
            style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, opacity: 0.55, cursor: 'help' }}
            onMouseEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const w = 248;
              setInfoPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left - 8, window.innerWidth - w - 12)), w });
              setShowInfo(true);
            }}
            onMouseLeave={() => setShowInfo(false)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--app-text-faint)' }}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4m0-4h.01" />
            </svg>
            {showInfo && infoPos && createPortal(
              <div role="tooltip" style={{
                position: 'fixed', top: infoPos.top, left: infoPos.left, zIndex: 1700, width: infoPos.w, pointerEvents: 'none', userSelect: 'none',
                background: 'var(--app-panel)', border: '1px solid var(--app-border)', borderRadius: '8px',
                padding: '9px 10px', fontSize: '10px', lineHeight: 1.45, color: 'var(--app-text-muted)',
                boxShadow: 'var(--app-shadow-lg)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, whiteSpace: 'normal',
              }}>
                {description && <p style={{ marginBottom: sourceEntity ? 5 : 0 }}>{description}</p>}
                {sourceEntity && (
                  <p style={{ color: 'var(--app-text-faint)', borderTop: description ? '1px solid var(--app-border)' : 'none', paddingTop: description ? 5 : 0 }}>
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>Source: </span>{sourceEntity}
                  </p>
                )}
              </div>,
              document.body,
            )}
          </span>
        )}
        {hasTrend && (
          <span
            className="kpi-trend-badge font-semibold flex items-center leading-tight gap-0.5"
            style={{
              fontSize: '9px',
              color:      isPos ? '#22c55e' : '#ef4444',
              background: isPos ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              padding: '1px 5px',
              borderRadius: '4px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '7px' }}>{isPos ? '▲' : '▼'}</span>
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </span>
        )}
      </div>

      {/* ── Row 2: large value ──────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, marginTop: '6px', display: 'flex', alignItems: 'baseline', gap: '3px' }}>
        <span
          className="font-bold leading-none tracking-tight"
          style={{ color: 'var(--app-text)', fontSize: 'clamp(1.3rem, 2.2vw, 1.65rem)' }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ color: 'var(--app-text-faint)', fontSize: '0.7rem', fontWeight: 500 }}>{t(unit)}</span>
        )}
      </div>

      {/* ── Row 2.5: short description, below the value ──────────────────── */}
      {description && (
        <p
          className="leading-snug"
          style={{
            fontSize: '9.5px', color: 'var(--app-text-faint)', marginTop: '5px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {t(description)}
        </p>
      )}

      {/* ── Row 3: sub-values ───────────────────────────────────────────── */}
      {subValues && subValues.length > 0 && (
        <div style={{ display: 'flex', gap: '14px', marginTop: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
          {subValues.map((sv, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '8px', color: 'var(--app-text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sv.label}</span>
              <span style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 600 }}>{sv.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Row: visible threshold — what makes this metric critical/warning/normal ── */}
      {thresholdParts && (
        <div style={{ marginTop: '7px', flexShrink: 0 }}>
          <div style={{ fontSize: '7.5px', color: 'var(--app-text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
            {t('Threshold')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
            {thresholdParts.map((p, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: 'var(--app-text-muted)' }}>
                {p.color && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />}
                {p.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="kpi-card-divider" style={{ height: '1px', background: 'var(--app-border)', margin: '8px 0 6px', flexShrink: 0 }} />

      {/* ── Row 4: RAG badge left, detail action right ──────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span className={rag !== 'normal' ? 'kpi-blink' : undefined} style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: ragStyles.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ragStyles.dot, display: 'inline-block', flexShrink: 0 }} />
          {t(ragStyles.label)}
        </span>
        {onClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), onClick())}
            aria-label={`Details for ${label}`}
            title={`Details for ${label}`}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '9px', fontWeight: 700, color: '#22d3ee',
              textDecoration: 'underline', textUnderlineOffset: '2px',
              cursor: 'pointer', letterSpacing: '0.04em', lineHeight: 1,
            }}
          >
            {t('VIEW DETAILS')}
          </button>
        )}
      </div>
    </div>
  );
}

