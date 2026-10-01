import React, { useMemo } from 'react';
import { useData } from '../services/socket';
import { useI18n } from '../services/i18n';
import { buildPageSummary } from '../services/pageSummaries';

/**
 * PageSummary — a short, live paragraph at the bottom of every page: what is
 * going on, what is happening and how to look at it. It is derived from the
 * same shared data the page renders, so it changes as the data changes.
 */
export default function PageSummary({ page }) {
  const d = useData();
  const { lang, t } = useI18n();
  const { boxes, organizations, inspections, violations, displacements, inventory, complaints, cashDiscrepancies, disposalRequests, auditLog, inspectors, criteria, passMark } = d;

  const summary = useMemo(
    () => buildPageSummary(page, { boxes, organizations, inspections, violations, displacements, inventory, complaints, cashDiscrepancies, disposalRequests, auditLog, inspectors, criteria, passMark }, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, lang, boxes, organizations, inspections, violations, displacements, inventory, complaints, cashDiscrepancies, disposalRequests, auditLog, inspectors, criteria, passMark],
  );
  if (!summary) return null;

  return (
    <section
      aria-label={t('Situation Summary')}
      className="flex items-stretch rounded-lg overflow-hidden"
      style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)' }}
    >
      <div style={{ width: 3, background: '#8b5cf6', flexShrink: 0 }} />
      <div className="px-4 py-3 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: '#8b5cf6', textTransform: 'uppercase' }}>{t('Situation Summary')}</span>
          <span className="flex items-center gap-1" style={{ fontSize: 9, color: 'var(--app-text-faint)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success)' }} />
            {t('Live')}
          </span>
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--app-text-muted)' }}>{lang === 'ar' ? summary.ar : summary.en}</p>
      </div>
    </section>
  );
}
