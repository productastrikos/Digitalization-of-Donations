import React, { useEffect } from 'react';
import { useData } from '../services/socket';

const STYLES = {
  info: { border: 'rgba(45,212,208,0.4)', color: '#2dd4d0' },
  success: { border: 'rgba(63,178,127,0.4)', color: '#3fb27f' },
  warning: { border: 'rgba(224,168,62,0.4)', color: '#e0a83e' },
  critical: { border: 'rgba(226,84,74,0.4)', color: '#e2544a' },
};

function ToastItem({ toast, onDismiss }) {
  const style = STYLES[toast.level] || STYLES.info;
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div
      className="pointer-events-auto animate-slide-up rounded-lg px-3 py-2.5 shadow-xl"
      style={{ background: 'var(--app-panel)', border: `1px solid ${style.border}`, backdropFilter: 'blur(6px)' }}
    >
      <div className="flex items-start gap-2">
        <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: style.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold" style={{ color: 'var(--app-text)' }}>{toast.title}</div>
          <div className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--app-text-muted)' }}>{toast.message}</div>
        </div>
        <button onClick={() => onDismiss(toast.id)} style={{ color: 'var(--app-text-faint)' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

export default function ToastStack() {
  const { toasts, dismissToast } = useData();
  if (!toasts || toasts.length === 0) return null;
  return (
    // Bottom-right, not top-right: every page keeps its own summary/status
    // panels in that top-right corner (Operational Status Summary, Coverage
    // Status, Priority Geographic Actions, …) — a top-anchored toast sat
    // directly on top of them.
    <div className="toast-stack fixed right-3 md:right-4 flex flex-col-reverse gap-2 max-w-[calc(100vw-1.5rem)]" style={{ zIndex: 400, width: 320, bottom: 16 }}>
      {toasts.slice(0, 3).map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />)}
    </div>
  );
}
