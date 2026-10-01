import React from 'react';
import { createPortal } from 'react-dom';

// Rendered through a portal into <body>: a page section with a transform/animation
// becomes the containing block for `position: fixed`, which used to make drawers
// open offset and pre-scrolled (sized to the whole page instead of the viewport).
export default function Drawer({ open, onClose, title, subtitle, children, width = 480 }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 1500 }}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative h-full flex flex-col animate-slide-in-right"
        style={{ width, maxWidth: '100%', background: 'var(--app-panel)', borderInlineStart: '1px solid var(--app-border)', boxShadow: 'var(--app-shadow-lg)' }}
      >
        <div className="flex items-start justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--app-border)' }}>
          <div>
            <h2 className="text-[14px] font-bold" style={{ color: 'var(--app-text)' }}>{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px]" style={{ color: 'var(--app-text-faint)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="icon-btn" style={{ width: 28, height: 28 }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 text-[12px]" style={{ borderBottom: '1px solid var(--app-border-soft)' }}>
      <span style={{ color: 'var(--app-text-faint)' }}>{label}</span>
      <span className="font-medium text-right" style={{ color: 'var(--app-text)' }}>{value}</span>
    </div>
  );
}

export function DrawerSection({ title, children }) {
  return (
    <div className="mb-4">
      <h4 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-faint)' }}>{title}</h4>
      {children}
    </div>
  );
}
