import React from 'react';

/**
 * Horizontal chip-and-arrow workflow strip (e.g. Inspection Assigned → … → Closure Verification).
 * Pass `activeIndex` to highlight the current stage (e.g. a live case tracker) — steps up to and
 * including it render as reached, later ones as pending.
 */
export function WorkflowStrip({ steps, glow = false, activeIndex }) {
  const hasActive = activeIndex !== undefined && activeIndex !== null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, idx) => {
        const reached = hasActive && idx <= activeIndex;
        const isCurrent = hasActive && idx === activeIndex;
        let chipStyle;
        if (hasActive) {
          chipStyle = reached
            ? {
                background: isCurrent ? 'var(--app-accent-bg)' : 'rgba(63,178,127,0.12)',
                border: `1px solid ${isCurrent ? 'var(--app-accent)' : 'var(--app-success)'}`,
                color: isCurrent ? 'var(--app-accent)' : 'var(--app-success)',
                fontWeight: 700,
                boxShadow: isCurrent ? '0 0 8px var(--app-accent-bg)' : 'none',
              }
            : { background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' };
        } else if (glow) {
          chipStyle = { background: 'var(--app-surface-soft)', border: '1px solid rgba(56,189,248,0.55)', color: 'var(--app-text-muted)', boxShadow: '0 0 8px rgba(56,189,248,0.45), 0 0 2px rgba(56,189,248,0.6)' };
        } else {
          chipStyle = { background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' };
        }
        return (
          <React.Fragment key={step}>
            <div className="rounded-md px-2.5 py-1.5 text-[11px] font-medium" style={chipStyle}>
              {step}
            </div>
            {idx < steps.length - 1 && (
              <svg className="w-3.5 h-3.5 shrink-0" style={{ color: hasActive ? (reached ? 'var(--app-success)' : 'var(--app-text-faint)') : glow ? '#38bdf8' : 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Vertical numbered/checked timeline (audit trail, chain of custody) */
export function VerticalTimeline({ steps }) {
  return (
    <div>
      {steps.map((step, idx) => (
        <div key={step.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            {step.done ? (
              <svg className="w-4 h-4" style={{ color: 'var(--app-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-4 h-4" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2} /></svg>
            )}
            {idx < steps.length - 1 && (
              <div className="mt-0.5" style={{ width: 1, minHeight: 24, flex: 1, background: step.done ? 'var(--app-success-border)' : 'var(--app-border)' }} />
            )}
          </div>
          <div className="pb-4">
            <div className="text-[11.5px] font-medium" style={{ color: step.done ? 'var(--app-text)' : 'var(--app-text-faint)' }}>{step.label}</div>
            {step.date && <div className="text-[10.5px]" style={{ color: 'var(--app-text-faint)' }}>{step.date}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
