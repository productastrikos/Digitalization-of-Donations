import React, { useEffect, useState } from 'react';
import { useI18n } from '../services/i18n';
import { SEM } from '../services/palette';

/**
 * InsightsCallout — "Key Insights" in the Attention Required style, one
 * insight at a time. It cycles by itself (pausing on hover), can be stepped
 * manually, opens the matching detail when clicked, and glows by what the
 * insight says: green when a measure improved, orange when it worsened,
 * red (pulsing) when it worsened sharply, blue when steady.
 *
 * items: [{ id, text, tone: 'red' | 'cyan' | 'slate', arrow, delta }]
 */
function glowFor(item) {
  const d = item.delta || 0;
  if (item.tone === 'red') return d >= 10 ? { color: SEM.critical, pulse: true, label: 'Worsening sharply' } : { color: SEM.warning, pulse: false, label: 'Worsening' };
  if (item.tone === 'cyan') return { color: SEM.normal, pulse: false, label: 'Improving' };
  return { color: SEM.info, pulse: false, label: 'Steady' };
}

export default function InsightsCallout({ title = 'Key Insights', items = [], onSelect, intervalMs = 4000 }) {
  const { t } = useI18n();
  const list = items.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || list.length < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), intervalMs);
    return () => clearInterval(id);
  }, [paused, list.length, intervalMs]);

  if (list.length === 0) return null;
  const safe = Math.min(index, list.length - 1);
  const item = list[safe];
  const g = glowFor(item);
  const go = (delta) => setIndex((i) => (i + delta + list.length) % list.length);

  return (
    <div
      className="flex items-stretch rounded-lg overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        background: `color-mix(in srgb, ${g.color} 9%, transparent)`,
        border: `1px solid color-mix(in srgb, ${g.color} 40%, transparent)`,
        transition: 'border-color 400ms ease, background 400ms ease',
      }}
    >
      <div style={{ width: 3, background: g.color, flexShrink: 0, transition: 'background 400ms ease' }} />

      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0" style={{ minWidth: 158, borderRight: `1px solid color-mix(in srgb, ${g.color} 40%, transparent)` }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={g.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0012 2z" />
        </svg>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', color: g.color, textTransform: 'uppercase' }}>{t(title)}</div>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: g.color, opacity: 0.85, textTransform: 'uppercase' }}>{t(g.label)}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect && onSelect(item)}
        className="flex-1 min-w-0 px-3 py-2 flex items-center gap-2.5 text-start"
        style={{ cursor: onSelect ? 'pointer' : 'default' }}
        title={onSelect ? t('Click for details') : undefined}
      >
        <span className="font-bold shrink-0" style={{ color: g.color, width: 16, textAlign: 'center' }}>{item.arrow}</span>
        <span key={item.id} className="animate-fade-in text-[12px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{item.text}</span>
        {onSelect && <span className="shrink-0 text-[10px] font-semibold ml-auto" style={{ color: g.color }}>{t('Click for details')} →</span>}
      </button>

      <div className="flex items-center gap-1 px-2.5 shrink-0" style={{ borderLeft: `1px solid color-mix(in srgb, ${g.color} 40%, transparent)` }}>
        <span className="text-[10px] font-mono mr-1" style={{ color: 'var(--app-text-faint)' }}>{safe + 1} / {list.length}</span>
        <button onClick={() => go(-1)} disabled={list.length < 2} className="icon-btn" style={{ width: 22, height: 22, opacity: list.length < 2 ? 0.35 : 1 }}>‹</button>
        <button onClick={() => go(1)} disabled={list.length < 2} className="icon-btn" style={{ width: 22, height: 22, opacity: list.length < 2 ? 0.35 : 1 }}>›</button>
      </div>
    </div>
  );
}
