import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { SocketProvider, useData } from './services/socket';
import { AuthContext, useAuth, roleCan, canOpenPath, ROLES } from './services/access';
import AccessDenied from './components/AccessDenied';
import { LanguageProvider } from './services/i18n';
import { Chart as ChartJS } from 'chart.js';
import Login from './pages/Login';
import GISLanding from './pages/GISLanding';
import Dashboard from './pages/Dashboard';
import WorkAllocation from './pages/WorkAllocation';
import Registry from './pages/Registry';
import GISMonitoring from './pages/GISMonitoring';
import Inspections from './pages/Inspections';
import Compliance from './pages/Compliance';
import Displacement from './pages/Displacement';
import Safekeeping from './pages/Safekeeping';
import Complaints from './pages/Complaints';
import Organizations from './pages/Organizations';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Layout from './components/Layout';
import ToastStack from './components/ToastStack';
import KPIDetailDrawer from './components/KPIDetailDrawer';

ChartJS.defaults.font.family = "'Inter', 'Noto Sans Arabic', sans-serif";
ChartJS.defaults.interaction.mode = 'index';
ChartJS.defaults.interaction.intersect = false;
ChartJS.defaults.plugins.tooltip.enabled = true;

function RouteGuard({ children }) {
  const { pathname } = useLocation();
  const { roleKey } = useAuth();
  return canOpenPath(roleKey, pathname) ? children : <AccessDenied />;
}

// A real, working client-side control: an inactive session signs itself out
// automatically. It warns once, then logs the user out and records the
// auto-logout to the audit trail so it's visible as a genuine security event,
// not merely described as one.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;

function useIdleLogout(user, onLogout, pushToast, logAudit) {
  useEffect(() => {
    if (!user) return undefined;
    let warnTimer;
    let logoutTimer;
    const reset = () => {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      warnTimer = setTimeout(() => {
        pushToast({ level: 'warning', title: 'Session expiring', message: 'You will be signed out in 60 seconds due to inactivity. Move the mouse or press a key to stay signed in.' });
      }, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
      logoutTimer = setTimeout(() => {
        logAudit({ entityType: 'Security', entityId: user.roleKey, action: `Session auto-signed-out after ${IDLE_TIMEOUT_MS / 60000} minutes of inactivity`, before: { status: 'Active' }, after: { status: 'Signed out' }, source: 'Session Timeout' });
        onLogout();
      }, IDLE_TIMEOUT_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const onActivity = () => reset();
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    reset();
    return () => {
      clearTimeout(warnTimer);
      clearTimeout(logoutTimer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [user, onLogout, pushToast, logAudit]);
}

function AppShell({ user, onLogout, onSwitchRole, theme, onThemeToggle }) {
  const { setActor, pushToast, logAudit } = useData();
  useEffect(() => { setActor(user); }, [user, setActor]);
  useIdleLogout(user, onLogout, pushToast, logAudit);
  const auth = useMemo(() => ({ user, roleKey: user.roleKey, can: (permission) => roleCan(user.roleKey, permission) }), [user]);
  return (
    <AuthContext.Provider value={auth}>
    <Layout user={user} onLogout={onLogout} onSwitchRole={onSwitchRole} theme={theme} onThemeToggle={onThemeToggle}>
      <RouteGuard>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/work-allocation" element={<WorkAllocation />} />
        <Route path="/registry"      element={<Registry />} />
        <Route path="/gis"           element={<GISMonitoring />} />
        <Route path="/inspections"   element={<Inspections />} />
        <Route path="/compliance"    element={<Compliance />} />
        <Route path="/displacement"  element={<Displacement />} />
        <Route path="/safekeeping"   element={<Safekeeping />} />
        <Route path="/complaints"    element={<Complaints />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/reports"       element={<Reports />} />
        <Route path="/admin"         element={<Admin />} />
        <Route path="*"              element={<Navigate to="/" />} />
      </Routes>
      </RouteGuard>
      <ToastStack />
      <KPIDetailDrawer />
    </Layout>
    </AuthContext.Provider>
  );
}

function AppRoutes({ user, setUser, hasEnteredOps, setHasEnteredOps, theme, onThemeToggle }) {
  const navigate = useNavigate();
  const shellUser = useMemo(() => (user ? { roleKey: 'compliance_officer', ...user } : null), [user]);

  function handleLogin(userInfo) {
    setUser(userInfo);
    navigate('/gis-landing');
  }

  function handleLogout() {
    setUser(null);
    setHasEnteredOps(false);
    navigate('/login');
  }

  function handleSwitchRole(roleKey) {
    setUser((u) => ({ ...u, roleKey, role: ROLES[roleKey].label, fullName: ROLES[roleKey].demoName }));
    navigate('/');
  }

  function handleEnterOps() {
    setHasEnteredOps(true);
    navigate('/');
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/gis-landing" /> : <Login onLogin={handleLogin} />} />
      <Route
        path="/gis-landing"
        element={!user ? <Navigate to="/login" /> : <GISLanding onEnter={handleEnterOps} />}
      />
      <Route
        path="/*"
        element={
          !user ? <Navigate to="/login" /> :
            !hasEnteredOps ? <Navigate to="/gis-landing" /> :
              <AppShell user={shellUser} onLogout={handleLogout} onSwitchRole={handleSwitchRole} theme={theme} onThemeToggle={onThemeToggle} />
        }
      />
    </Routes>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });
  const [user, setUser] = useState(null);
  const [hasEnteredOps, setHasEnteredOps] = useState(false);

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('app_theme', theme);
    // Charts read theme colours at paint time; repaint them now that the theme is applied.
    Object.values(ChartJS.instances || {}).forEach((chart) => chart.update('none'));
  }, [theme]);

  const handleThemeToggle = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <LanguageProvider>
    <SocketProvider>
      <Router>
        <AppRoutes
          user={user} setUser={setUser}
          hasEnteredOps={hasEnteredOps} setHasEnteredOps={setHasEnteredOps}
          theme={theme} onThemeToggle={handleThemeToggle}
        />
      </Router>
    </SocketProvider>
    </LanguageProvider>
  );
}

export default App;
