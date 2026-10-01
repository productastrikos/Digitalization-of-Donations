import React from 'react';
import { useI18n } from '../services/i18n';

export default function PageHeader({ title, subtitle, actions, filters }) {
  const { t } = useI18n();
  return (
    <div className="mb-1">
      <div className="page-header-block flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t(title)}</h1>
          <p className="page-subtitle max-w-2xl">{t(subtitle)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {actions ?? (
            <button className="app-control-btn flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {t('Export Report')}
            </button>
          )}
        </div>
      </div>
      {filters && <div className="flex flex-wrap items-center gap-2 -mt-2 mb-4">{filters}</div>}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }) {
  const { t } = useI18n();
  return (
    <label className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>
      {t(label)}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md px-2 py-1 text-[11px] focus:outline-none"
        style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
      </select>
    </label>
  );
}
