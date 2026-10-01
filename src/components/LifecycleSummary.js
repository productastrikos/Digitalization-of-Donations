import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../services/socket';
import { LIFECYCLE_STAGES, buildLifecycleIndex, summarizeLifecycle } from '../services/boxLifecycle';
import { useI18n } from '../services/i18n';

/** Where every registered box sits in the single lifecycle flow. Derived from the live records. */
export default function LifecycleSummary({ boxes }) {
  const { inventory, displacements } = useData();
  const navigate = useNavigate();
  const { t } = useI18n();
  const index = useMemo(() => buildLifecycleIndex({ inventory, displacements }), [inventory, displacements]);
  const counts = useMemo(() => summarizeLifecycle(boxes, index), [boxes, index]);
  const total = boxes.length || 1;

  return (
    <div className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{t('Box Lifecycle')}</h3>
        <span className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{t('Identified to disposal or release, across all registered boxes')}</span>
      </div>
      <div className="p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {LIFECYCLE_STAGES.map((stage, i) => (
          <button
            key={stage.key}
            onClick={() => navigate(`/registry?stage=${stage.key}`)}
            className="text-start rounded-lg p-3 transition-colors hover:bg-white/[0.04]"
            style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', borderTop: `3px solid ${stage.color}` }}
            title={t(stage.hint)}
          >
            <div className="text-[10px] font-semibold uppercase flex items-center justify-between" style={{ color: 'var(--app-text-faint)', letterSpacing: '0.06em' }}>
              <span>{i + 1}. {t(stage.label)}</span>
            </div>
            <div className="font-bold leading-none mt-1.5" style={{ color: 'var(--app-text)', fontSize: 24 }}>{counts[stage.key].toLocaleString()}</div>
            <div className="text-[10.5px] mt-1" style={{ color: 'var(--app-text-faint)' }}>{((counts[stage.key] / total) * 100).toFixed(1)}%</div>
          </button>
        ))}
      </div>
    </div>
  );
}
