import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth, ROLES } from '../services/access';

export default function AccessDenied() {
  const { roleKey } = useAuth();
  const role = ROLES[roleKey];
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl p-6 text-center" style={{ background: 'var(--app-panel)', border: '1px solid var(--app-border)' }}>
        <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: 'var(--app-danger-bg)', color: 'var(--app-danger)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-[15px] font-bold" style={{ color: 'var(--app-text)' }}>Access restricted</h2>
        <p className="text-[12px] mt-1.5" style={{ color: 'var(--app-text-muted)', lineHeight: 1.55 }}>
          The <strong>{role?.label || 'current'}</strong> role does not include this page. Ask a system administrator if you need access.
        </p>
        <Link to="/" className="app-control-btn inline-block mt-4 px-4 py-2 text-[11.5px] font-semibold">Back to Executive Overview</Link>
      </div>
    </div>
  );
}
