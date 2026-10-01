import React, { useState } from 'react';
import dcdEmblem from '../assets/dcd-emblem.png';
import astrikosLogo from '../assets/astrikos-logo.png';
import abuDhabiSkyline from '../assets/abu-dhabi-skyline.jpg';

const STATUS_ROWS = [
  ['Authentication Services', 'Operational'],
  ['Donation Box Registry', 'Connected'],
  ['Field Data Synchronization', 'Live'],
];

const DEFAULT_ROLE_KEY = 'compliance_officer';
const DEFAULT_ROLE = { demoName: 'Compliance Officer 02', label: 'Compliance Officer' };

export default function Login({ onLogin }) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const asUser = (employee) => ({ fullName: DEFAULT_ROLE.demoName, role: DEFAULT_ROLE.label, roleKey: DEFAULT_ROLE_KEY, employeeId: employee });

  function submit(e) {
    e.preventDefault();
    setError('');
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter both Employee ID / Email and Password to continue.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(asUser(employeeId.trim()));
    }, 800);
  }

  function demoLogin() {
    setEmployeeId('DCD-EMP-20481');
    setPassword('demo-access');
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin(asUser('DCD-EMP-20481'));
    }, 600);
  }

  return (
    <div id="login-page" className="h-screen w-full flex overflow-hidden relative" style={{ background: '#0a1220' }}>
      {/* Chrome/Edge fill the field with a white/yellow box on autofill or a
          saved-password match, overriding our dark background outright — this
          pushes the field's own background back in via an inset box-shadow,
          the standard way to neutralize that browser-native autofill style. */}
      <style>{`
        #login-page input:-webkit-autofill,
        #login-page input:-webkit-autofill:hover,
        #login-page input:-webkit-autofill:focus,
        #login-page input:-webkit-autofill:active {
          -webkit-text-fill-color: #e6ecf5;
          -webkit-box-shadow: 0 0 0px 1000px #101f30 inset;
          box-shadow: 0 0 0px 1000px #101f30 inset;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: #e6ecf5;
        }
      `}</style>
      {/* Full-bleed background photo behind both panels — one continuous
          image across the whole screen, not just the left panel, dimmed low
          enough to read as texture behind the dark page rather than a photo. */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: `url(${abuDhabiSkyline})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.18,
        }}
      />
      {/* ── Left panel: branding & description ─────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden shrink-0" style={{ width: '44%', padding: '48px 56px' }}>
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.16 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="loginGrid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#28466a" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGrid)" />
        </svg>

        <div className="relative z-10">
          <div className="flex flex-col items-start gap-3">
            <img src={astrikosLogo} alt="Astrikos" style={{ width: 168, height: 'auto', objectFit: 'contain' }} />
            <div className="flex items-center justify-center rounded-md shrink-0" style={{ background: '#ffffff', padding: '10px 14px' }}>
              <img src={dcdEmblem} alt="Department of Community Development" style={{ width: 108, height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
          <div className="mt-5" style={{ height: 1, background: '#1d3550' }} />
        </div>

        <div className="relative z-10">
          <h1 className="font-bold leading-tight" style={{ color: '#e6ecf5', fontSize: 30 }}>Digitalization of Donations</h1>
          <p className="mt-2 uppercase tracking-widest" style={{ color: '#7d93b0', fontSize: 10.5, letterSpacing: '0.14em' }}>
            DCD Donation Box Regulatory Platform
          </p>

          <p className="mt-10 uppercase tracking-widest font-semibold" style={{ color: '#2dd4d0', fontSize: 10, letterSpacing: '0.14em' }}>
            Abu Dhabi Department of Community Development
          </p>
          <h2 className="mt-2 font-bold leading-snug" style={{ color: '#e6ecf5', fontSize: 26 }}>
            Unified oversight for every registered donation box.
          </h2>
          <p className="mt-3" style={{ color: '#a9bdd6', fontSize: 12.5, lineHeight: 1.65, maxWidth: 400 }}>
            Monitor registration, compliance, inspections, and enforcement across the Emirate through one
            connected regulatory platform — from field detection to safekeeping and disposal.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5" style={{ color: '#7d93b0', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em' }}>
            {['REGISTRY', 'COMPLIANCE', 'INSPECTIONS', 'ENFORCEMENT'].map((w, i) => (
              <React.Fragment key={w}>
                {i > 0 && <span style={{ opacity: 0.5 }}>•</span>}
                <span>{w}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-1.5" style={{ color: '#7d93b0', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: '#3fb27f' }} />
          Site systems nominal
        </div>
      </div>

      {/* ── Right panel: sign-in ─────────────────────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-end overflow-y-auto">
        <svg className="absolute inset-0 w-full h-full lg:hidden" style={{ opacity: 0.16 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="loginGridMobile" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#28466a" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGridMobile)" />
        </svg>

        <div className="relative z-10 w-full px-4 py-10 lg:pr-20 lg:pl-4 flex justify-center lg:justify-end" style={{ maxWidth: '100%' }}>
        <div className="w-full" style={{ maxWidth: 380 }}>
          <div className="mb-6 lg:hidden flex flex-col items-center text-center">
            <div className="flex flex-col items-center gap-2.5">
              <img src={astrikosLogo} alt="Astrikos" style={{ width: 126, height: 'auto', objectFit: 'contain' }} />
              <div className="flex items-center justify-center rounded-md shrink-0" style={{ background: '#ffffff', padding: '7px 10px' }}>
                <img src={dcdEmblem} alt="Department of Community Development" style={{ width: 78, height: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
            </div>
            <h1 className="mt-3 font-bold" style={{ color: '#e6ecf5', fontSize: 17 }}>Digitalization of Donations</h1>
          </div>

          <div className="mb-5">
            <span className="flex items-center gap-1.5 uppercase tracking-widest font-semibold" style={{ color: '#2dd4d0', fontSize: 10, letterSpacing: '0.14em' }}>
              <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: '#2dd4d0' }} />
              Secure Access
            </span>
            <h2 className="mt-2 font-bold" style={{ color: '#e6ecf5', fontSize: 24 }}>Regulatory Operations Console</h2>
            <p className="mt-1.5" style={{ color: '#7d93b0', fontSize: 12 }}>Sign in to access the Digitalization of Donations platform.</p>
          </div>

          <form onSubmit={submit}>
            <div className="mb-3.5">
              <label className="mb-1 block" style={{ fontSize: 11, fontWeight: 500, color: '#a9bdd6' }}>Email / Employee ID</label>
              <div className="flex items-center gap-2 rounded-md px-2.5 py-2" style={{ background: '#101f30', border: '1px solid #1d3550' }}>
                <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#5b7290' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <input
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. DCD-EMP-20481"
                  className="w-full bg-transparent focus:outline-none"
                  style={{ fontSize: 12.5, color: '#e6ecf5' }}
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <label style={{ fontSize: 11, fontWeight: 500, color: '#a9bdd6' }}>Password</label>
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="uppercase font-semibold" style={{ fontSize: 9.5, letterSpacing: '0.06em', color: '#5b7290' }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-md px-2.5 py-2" style={{ background: '#101f30', border: '1px solid #1d3550' }}>
                <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#5b7290' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full bg-transparent focus:outline-none"
                  style={{ fontSize: 12.5, color: '#e6ecf5' }}
                />
              </div>
            </div>

            {error && (
              <div className="mb-3 rounded-md px-2.5 py-2" style={{ fontSize: 11, background: 'rgba(226,84,74,0.1)', border: '1px solid rgba(226,84,74,0.4)', color: '#e2544a' }}>
                {error}
              </div>
            )}

            <div className="mb-4 flex items-center justify-between" style={{ fontSize: 11 }}>
              <label className="flex items-center gap-1.5" style={{ color: '#a9bdd6' }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: '#2dd4d0' }} />
                Remember me
              </label>
              <button type="button" style={{ color: '#5b7290' }} onMouseOver={(e) => (e.target.style.color = '#2dd4d0')} onMouseOut={(e) => (e.target.style.color = '#5b7290')}>
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md font-semibold"
              style={{ padding: '10px 0', fontSize: 12.5, background: 'rgba(45,212,208,0.15)', border: '1px solid rgba(45,212,208,0.4)', color: '#2dd4d0', opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}
            >
              {loading ? 'Authenticating…' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={demoLogin}
              disabled={loading}
              className="mt-2 w-full rounded-md font-medium"
              style={{ padding: '8px 0', fontSize: 11.5, background: '#101f30', border: '1px solid #1d3550', color: '#a9bdd6', opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}
            >
              Need demo access? Continue with a demonstration account
            </button>
          </form>

          <div className="mt-5 rounded-md px-3.5 py-3" style={{ background: 'rgba(13,24,38,0.6)', border: '1px solid #1d3550' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="uppercase font-semibold" style={{ fontSize: 9.5, letterSpacing: '0.1em', color: '#5b7290' }}>Platform Status</span>
              <span className="font-semibold" style={{ fontSize: 9.5, color: '#3fb27f' }}>OPERATIONAL</span>
            </div>
            <div className="space-y-1">
              {STATUS_ROWS.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between" style={{ fontSize: 10.5 }}>
                  <span style={{ color: '#7d93b0' }}>{label}</span>
                  <span style={{ color: '#a9bdd6' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-center" style={{ fontSize: 9.5, color: '#5b7290' }}>ENV: DEMO — representative demonstration data only.</p>
        </div>
        </div>
      </div>
    </div>
  );
}
