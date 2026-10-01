import React from 'react';
import { useI18n } from '../services/i18n';

export default function Tabs({ tabs, active, onChange }) {
  const { t: tr } = useI18n();
  return (
    <div className="flex items-center gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--app-border)' }}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="px-3 py-2 whitespace-nowrap font-semibold transition-colors"
            style={{
              fontSize: 12,
              color: isActive ? 'var(--app-accent)' : 'var(--app-text-faint)',
              borderBottom: isActive ? '2px solid var(--app-accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tr(t.label)}
          </button>
        );
      })}
    </div>
  );
}
