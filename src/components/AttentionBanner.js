import React, { useMemo, useState } from 'react';
import { useData } from '../services/socket';
import { zoneName } from '../services/donationSeed';
import { useI18n } from '../services/i18n';

const SEVERITY_META = {
  critical: { label: 'CRITICAL', color: 'var(--app-danger)', bar: 'var(--app-danger)', bg: 'var(--app-danger-bg)', border: 'var(--app-danger-border)' },
  warning: { label: 'WARNING', color: 'var(--app-warning)', bar: 'var(--app-warning)', bg: 'var(--app-warning-bg)', border: 'var(--app-warning-border)' },
  info: { label: 'ADVISORY', color: 'var(--app-info)', bar: 'var(--app-info)', bg: 'var(--app-info-bg)', border: 'var(--app-info-border)' },
};

/**
 * AttentionBanner — a single-item, paginated callout for the most urgent
 * unacknowledged alerts, styled as "ATTENTION REQUIRED". Falls back to the
 * most recent audit/activity entries (shown as neutral "RECENT ACTIVITY")
 * when there is nothing outstanding, and disappears entirely once every
 * item has been stepped through or dismissed.
 */
export default function AttentionBanner() {
  const { alerts, auditLog, acknowledgeAlert, openAlertPanel } = useData();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(() => new Set());

  const items = useMemo(() => {
    const openAlerts = alerts
      .filter((a) => !a.acknowledged && !dismissed.has(`alert-${a.alertId}`))
      .sort((a, b) => (a.type === b.type ? new Date(b.createdAt) - new Date(a.createdAt) : a.type === 'critical' ? -1 : b.type === 'critical' ? 1 : a.type === 'warning' ? -1 : 1))
      .map((a) => ({
        key: `alert-${a.alertId}`, requiresAttention: true, severity: a.type,
        title: a.title, message: a.message,
        meta: `${zoneName(a.zone) || a.zone || 'Abu Dhabi'} · ${a.assetId || '—'}`,
        timestamp: a.createdAt, alertId: a.alertId,
      }));

    const activity = auditLog.slice(0, 6)
      .filter((e) => !dismissed.has(`activity-${e.id}`))
      .map((e) => ({
        key: `activity-${e.id}`, requiresAttention: false, severity: 'info',
        title: e.action, message: `${e.user} · ${e.source}`, meta: null, timestamp: e.timestamp,
      }));

    return openAlerts.length > 0 ? openAlerts : activity;
  }, [alerts, auditLog, dismissed]);

  if (items.length === 0) return null;

  const safeIndex = Math.min(index, items.length - 1);
  const item = items[safeIndex];
  const meta = SEVERITY_META[item.severity] || SEVERITY_META.info;

  function go(delta) {
    setIndex((i) => (i + delta + items.length) % items.length);
  }

  function dismissCurrent() {
    if (item.alertId) acknowledgeAlert(item.alertId);
    setDismissed((prev) => new Set(prev).add(item.key));
    setIndex((i) => (items.length <= 1 ? 0 : i % Math.max(1, items.length - 1)));
  }

  return (
    <div
      className="flex items-stretch rounded-lg overflow-hidden"
      style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      <div style={{ width: 3, background: meta.bar, flexShrink: 0 }} />

      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0" style={{ minWidth: 158, borderRight: `1px solid ${meta.border}` }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><circle cx="12" cy="17" r="0.5" fill={meta.color} />
        </svg>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', color: meta.color }}>
            {t(item.requiresAttention ? 'ATTENTION REQUIRED' : 'RECENT ACTIVITY')}
          </div>
          {item.requiresAttention && (
            <div style={{ fontSize: 8.5, fontWeight: 700, color: meta.color, opacity: 0.85 }}>{meta.label}</div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 px-3 py-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--app-text)' }}>{item.title}</div>
          <div className="text-[10.5px] truncate" style={{ color: 'var(--app-text-muted)' }}>
            {item.message}{item.meta ? ` · ${item.meta}` : ''}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 px-2.5 shrink-0" style={{ borderLeft: `1px solid ${meta.border}` }}>
        <span className="text-[10px] font-mono mr-1" style={{ color: 'var(--app-text-faint)' }}>{safeIndex + 1} / {items.length}</span>
        <button onClick={() => go(-1)} disabled={items.length < 2} className="icon-btn" style={{ width: 22, height: 22, opacity: items.length < 2 ? 0.35 : 1 }}>‹</button>
        <button onClick={() => go(1)} disabled={items.length < 2} className="icon-btn" style={{ width: 22, height: 22, opacity: items.length < 2 ? 0.35 : 1 }}>›</button>
        <button onClick={openAlertPanel} className="app-control-btn px-2 py-1 text-[10px] font-semibold ml-1">{t('VIEW ALL')}</button>
        <button onClick={dismissCurrent} title="Dismiss" style={{ color: 'var(--app-text-faint)', marginLeft: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
