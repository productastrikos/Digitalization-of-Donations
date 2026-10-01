import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../services/socket';
import AlertPanel from './AlertPanel';
import AdvisoryPanel from './AdvisoryPanel';
import { useAuth, ROLES, ROLE_KEYS, PAGE_PERMISSION } from '../services/access';
import { useI18n } from '../services/i18n';

/* ─── Navigation config ────────────────────────────────────
   Single source of truth for the sidebar, Ctrl+K search and the top-bar title.
   label      → short text shown in the sidebar (never truncates)
   fullLabel  → original page name: tooltip, top-bar title, search
────────────────────────────────────────────────────────── */
const NAV_GROUPS = [
  { id: 'overview',   label: '' },
  { id: 'assets',     label: 'Assets' },
  { id: 'operations', label: 'Operations' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'insights',   label: 'Insights & Admin' },
];

const NAV_ITEMS = [
  { label: 'Executive', fullLabel: 'Executive Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4', path: '/', group: 'overview' },
  { label: 'GIS', fullLabel: 'GIS Command Center', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', path: '/gis', group: 'overview' },
  { label: 'Registry', fullLabel: 'Donation Box Registry', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', path: '/registry', group: 'assets' },
  { label: 'Organizations', fullLabel: 'Organizations & Ownership', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', path: '/organizations', group: 'assets' },
  { label: 'Safekeeping', fullLabel: 'Safekeeping & Inventory', icon: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M3 7l9 4 9-4', path: '/safekeeping', group: 'assets' },
  { label: 'Inspections', fullLabel: 'Inspections & Field Operations', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', path: '/inspections', group: 'operations' },
  { label: 'Logistics', fullLabel: 'Displacement & Logistics', icon: 'M1 17h2M1 9h18M13 3H1v14h12V3zM13 5h4l3 6H13V5z', path: '/displacement', group: 'operations' },
  { label: 'Allocation', fullLabel: 'Work Allocation', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M12 12l2 2 4-4', path: '/work-allocation', group: 'operations' },
  { label: 'Enforcement', fullLabel: 'Compliance & Enforcement', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', path: '/compliance', group: 'compliance' },
  { label: 'Complaints', fullLabel: 'Complaints & Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', path: '/complaints', group: 'compliance' },
  { label: 'Reports', fullLabel: 'Reports & Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', path: '/reports', group: 'insights' },
  { label: 'Admin', fullLabel: 'Administration & Audit', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z', path: '/admin', group: 'insights' },
];

const NAV_BY_GROUP = NAV_GROUPS.map((g) => ({ ...g, items: NAV_ITEMS.filter((n) => n.group === g.id) }));

function isPathActive(itemPath, pathname) {
  return itemPath === '/' ? pathname === '/' : pathname === itemPath || pathname.startsWith(itemPath + '/');
}

const SEARCH_INDEX = NAV_ITEMS.map((n) => ({
  label: n.fullLabel,
  path: n.path,
  breadcrumb: [NAV_GROUPS.find((g) => g.id === n.group).label, n.fullLabel].filter(Boolean),
}));

const LS_COLLAPSED = 'dcd.sidebar.collapsed';
const LS_GROUPS_LEGACY = 'dcd.sidebar.openGroups';
function lsGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
function lsSet(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } }


function SvgIcon({ d, size = 'w-4 h-4', strokeWidth = 1.6 }) {
  return (
    <svg className={`${size} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={d} />
    </svg>
  );
}

export default function Layout({ children, user, onLogout, onSwitchRole, theme = 'dark', onThemeToggle }) {
  const { can, roleKey } = useAuth();
  const { lang, setLang, t } = useI18n();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { alerts, advisories, acknowledgeAlert, alertPanelOpen, openAlertPanel, closeAlertPanel } = useData();
  const showAlerts = alertPanelOpen;
  const [showAdvisory, setShowAdvisory] = useState(false);
  const [showProfile,  setShowProfile]  = useState(false);
  const [collapsed,    setCollapsed]    = useState(() => lsGet(LS_COLLAPSED) === '1');
  const [isMobile,     setIsMobile]     = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [tip,          setTip]          = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showSearch,   setShowSearch]   = useState(false);
  const profileRef   = React.useRef(null);
  const searchRef    = useRef(null);
  const searchInputRef = useRef(null);

  // Icon-only rail applies to desktop; on mobile the sidebar is always a full-width overlay drawer.
  const railMode = collapsed && !isMobile;
  const sidebarOpen = !railMode;

  const visibleGroups = useMemo(
    () => NAV_BY_GROUP.map((g) => ({ ...g, items: g.items.filter((i) => can(PAGE_PERMISSION[i.path])) })).filter((g) => g.items.length > 0),
    [can],
  );

  const activeItem = useMemo(() => {
    const matches = NAV_ITEMS.filter((n) => isPathActive(n.path, location.pathname));
    return matches.sort((a, b) => b.path.length - a.path.length)[0] || NAV_ITEMS[0];
  }, [location.pathname]);
  useEffect(() => { lsSet(LS_COLLAPSED, collapsed ? '1' : '0'); }, [collapsed]);
  // Group open/closed state was removed; drop the value older builds stored.
  useEffect(() => { try { window.localStorage.removeItem(LS_GROUPS_LEGACY); } catch (e) { /* storage unavailable */ } }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => { setIsMobile(e.matches); if (!e.matches) setDrawerOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => { setDrawerOpen(false); setTip(null); }, [location.pathname]);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onEsc = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [drawerOpen]);

  function toggleSidebar() {
    if (isMobile) setDrawerOpen((o) => !o); else setCollapsed((c) => !c);
  }
  function showTip(e, text, sub) {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, sub, top: r.top + r.height / 2, left: r.right + 10 });
  }
  const hideTip = () => setTip(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!showSearch) return undefined;
    const onDocClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showSearch]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/).filter(Boolean);
    const scored = SEARCH_INDEX.filter((item) => can(PAGE_PERMISSION[item.path.split('?')[0]])).map(item => {
      const haystack = [item.label, ...(item.breadcrumb || [])].join(' ').toLowerCase();
      const matchCount = words.filter(w => haystack.includes(w)).length;
      return { item, matchCount };
    }).filter(({ matchCount }) => matchCount > 0);
    scored.sort((a, b) => {
      const aLabel = a.item.label.toLowerCase().includes(q) ? 1 : 0;
      const bLabel = b.item.label.toLowerCase().includes(q) ? 1 : 0;
      if (bLabel !== aLabel) return bLabel - aLabel;
      return b.matchCount - a.matchCount;
    });
    return scored.slice(0, 10).map(({ item }) => item);
  }, [searchQuery, can]);

  useEffect(() => {
    if (!showProfile) return undefined;
    const onDocClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setShowProfile(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [showProfile]);

  const unacknowledgedAlerts = alerts?.filter(a => !a.acknowledged)?.length || 0;
  const criticalAlerts       = alerts?.filter(a => a.type === 'critical' && !a.acknowledged)?.length || 0;

  return (
    <div className={`theme-${theme} h-screen w-screen flex overflow-hidden bg-app-darker`}>

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      {isMobile && drawerOpen && (
        <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 390 }} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        className={`flex flex-col shrink-0 overflow-hidden bg-app-dark border-r border-app-border ${isMobile ? 'fixed inset-y-0 left-0' : 'relative transition-all duration-200'}`}
        style={isMobile ? {
          width: 264, zIndex: 400,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          visibility: drawerOpen ? 'visible' : 'hidden',
          transition: `transform .2s ease, visibility 0s linear ${drawerOpen ? '0s' : '.2s'}`,
        } : { width: railMode ? 68 : 'var(--app-sidebar-w, 244px)' }}
      >
        <div
          className={`flex items-center shrink-0 border-b border-app-border ${sidebarOpen ? 'gap-2.5 px-3.5' : 'justify-center'}`}
          style={{ height: 'var(--app-header-h, 62px)' }}
        >
          <Link to="/" aria-label="DCD Donation Control - home" className="flex items-center gap-2.5 min-w-0">
            <span style={{
              width: 34, height: 34, borderRadius: 6, flexShrink: 0,
              background: 'linear-gradient(135deg,#0d1826 0%,#16293c 100%)',
              border: '1px solid rgba(201,162,75,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
            }}>
              <svg className="w-5 h-5" style={{ color: '#c9a24b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4" />
              </svg>
            </span>
            {sidebarOpen && (
              <span className="text-[12.5px] font-extrabold leading-tight tracking-tight" style={{ color: 'var(--app-text)' }}>{t('DCD DONATION CONTROL')}</span>
            )}
          </Link>
          {isMobile && (
            <button type="button" className="icon-btn ml-auto" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto overflow-x-hidden py-1.5">
          {visibleGroups.map((group, gi) => (
            <div key={group.id} className={gi > 0 ? 'mt-0.5' : ''}>
              {sidebarOpen ? (
                group.label && <div id={`nav-group-${group.id}`} className="nav-group-label">{t(group.label)}</div>
              ) : (
                gi > 0 && <div className="mx-4 my-1.5" style={{ borderTop: '1px solid var(--app-border)' }} />
              )}
              <ul aria-labelledby={sidebarOpen && group.label ? `nav-group-${group.id}` : undefined} className="px-2 space-y-px">
                {group.items.map((item) => {
                  const active = item.path === activeItem.path;
                  const railProps = !sidebarOpen ? {
                    'aria-label': t(item.fullLabel),
                    onMouseEnter: (e) => showTip(e, t(item.fullLabel)),
                    onFocus: (e) => showTip(e, t(item.fullLabel)),
                    onMouseLeave: hideTip,
                    onBlur: hideTip,
                    style: { justifyContent: 'center', padding: '9px 0' },
                  } : { title: item.label !== item.fullLabel ? t(item.fullLabel) : undefined };
                  return (
                    <li key={item.path}>
                      <Link to={item.path} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} {...railProps}>
                        <SvgIcon d={item.icon} />
                        {sidebarOpen && <span>{t(item.label)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={`shrink-0 border-t border-app-border flex items-center ${sidebarOpen ? 'gap-2.5 px-3.5 py-2' : 'flex-col gap-1.5 py-2.5'}`}>
          <div
            className="w-7 h-7 rounded-lg bg-app-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            tabIndex={0}
            title={sidebarOpen ? `${user?.fullName || 'User'} - ${user?.role?.replace('_', ' ') || ''}` : undefined}
            aria-label={`${user?.fullName || 'User'}, ${user?.role?.replace('_', ' ') || ''}`}
            onMouseEnter={!sidebarOpen ? (e) => showTip(e, user?.fullName, user?.role?.replace('_', ' ')) : undefined}
            onFocus={!sidebarOpen ? (e) => showTip(e, user?.fullName, user?.role?.replace('_', ' ')) : undefined}
            onMouseLeave={hideTip}
            onBlur={hideTip}
          >
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1 text-xs font-semibold truncate" style={{ color: 'var(--app-text)' }} title={user?.role?.replace('_', ' ')}>
              {user?.fullName}
            </div>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sign out"
              title={sidebarOpen ? 'Sign out' : undefined}
              onMouseEnter={!sidebarOpen ? (e) => showTip(e, 'Sign out') : undefined}
              onMouseLeave={hideTip}
              onFocus={!sidebarOpen ? (e) => showTip(e, 'Sign out') : undefined}
              onBlur={hideTip}
              className="icon-btn shrink-0"
              style={{ width: 28, height: 28 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {tip && (
        <div role="tooltip" className="fixed pointer-events-none rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold"
          style={{ top: tip.top, left: tip.left, transform: 'translateY(-50%)', zIndex: 600, background: '#0d1826', color: '#e6ecf5', border: '1px solid #33475e', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {tip.text}
          {tip.sub && <div className="text-[10px] font-normal capitalize" style={{ color: '#c5d3e5' }}>{tip.sub}</div>}
        </div>
      )}

      {/* ── MAIN AREA ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── TOPBAR ──────────────────────────────────────────── */}
        <header
          className="shrink-0 flex items-center gap-3 px-4 border-b border-app-border"
          style={{ height: 'var(--app-header-h, 62px)', background: 'var(--app-chrome-bg)' }}
        >
          <button
            type="button"
            onClick={toggleSidebar}
            className="icon-btn"
            title={isMobile ? 'Open menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isMobile ? 'Open menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={isMobile ? drawerOpen : !collapsed}
            aria-controls="app-sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex flex-col ml-1 min-w-0 max-w-[10rem] sm:max-w-none">
            {!sidebarOpen || isMobile ? (
              <span className="text-[11px] font-bold tracking-widest truncate" style={{ color: 'var(--app-text)', letterSpacing: '0.10em' }}>{t('DCD DONATION CONTROL')}</span>
            ) : null}
            <span
              className={`truncate ${!sidebarOpen || isMobile ? 'text-[9px]' : 'text-[13px] font-semibold'}`}
              style={{ color: !sidebarOpen || isMobile ? 'var(--app-text-faint)' : 'var(--app-text)' }}
            >
              {t(activeItem.fullLabel)}
            </span>
          </div>

          <div className="header-search flex-1 max-w-xs ml-3" ref={searchRef} style={{ position: 'relative' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('Search modules… (Ctrl+K)')}
              aria-label="Search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); e.target.blur(); }
                if (e.key === 'Enter' && searchResults.length > 0) {
                  navigate(searchResults[0].path);
                  setShowSearch(false);
                  setSearchQuery('');
                  e.target.blur();
                }
              }}
            />
            {showSearch && searchQuery.trim() && (
              <div className="search-dropdown">
                {searchResults.length === 0 ? (
                  <div className="search-dropdown-empty">No results for "{searchQuery}"</div>
                ) : searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    className="search-dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(item.path);
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="sdi-icon" style={{ color: 'var(--app-accent)', fontWeight: 700, fontSize: 10 }}>{item.label.charAt(0)}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="sdi-label">{item.label}</div>
                      <div className="sdi-desc">{item.breadcrumb.join(' › ')}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <div className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10.5px] font-semibold md:flex"
            style={{ background: 'var(--app-success-bg)', color: 'var(--app-success)', border: '1px solid var(--app-success-border)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--app-success)' }} />
            {t('SYSTEM OPERATIONAL')}
          </div>

          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="icon-btn"
            style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 700 }}
            title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            aria-label={lang === 'ar' ? 'Switch to English' : 'Switch to Arabic'}
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>

          <button onClick={onThemeToggle} className="icon-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="-1 -1 26 26">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1012 21a8.962 8.962 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => { setShowAdvisory(!showAdvisory); closeAlertPanel(); }}
            className={`app-advisory-btn ${showAdvisory ? 'active' : ''}`}
            title="Operational Advisory"
            aria-label="Operational Advisory"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>{t('Advisory')}</span>
          </button>

          <button
            onClick={() => { if (showAlerts) closeAlertPanel(); else openAlertPanel(); setShowAdvisory(false); }}
            className={`icon-btn relative ${showAlerts ? 'active' : ''}`}
            title="DMT Alerts & Complaints"
            aria-label="Notifications"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unacknowledgedAlerts > 0 && (
              <span
                className={`absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[9px] flex items-center justify-center font-bold px-0.5 ${criticalAlerts > 0 ? 'animate-pulse' : ''}`}
                style={{ background: criticalAlerts > 0 ? 'var(--app-danger)' : 'var(--app-warning)', color: 'var(--app-on-color)' }}
              >
                {unacknowledgedAlerts}
              </span>
            )}
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              className="profile-trigger"
              onClick={() => setShowProfile((s) => !s)}
              aria-haspopup="menu"
              aria-expanded={showProfile}
              title={user?.fullName || 'Account'}
            >
              {user?.fullName?.charAt(0) || 'U'}
            </button>
            {showProfile && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-header">
                  <div className="avatar">{user?.fullName?.charAt(0) || 'U'}</div>
                  <div className="min-w-0">
                    <div className="name truncate">{user?.fullName || 'Account'}</div>
                    <div className="status">Online</div>
                  </div>
                </div>
                <div className="profile-menu-section">
                  <button className="profile-menu-item" role="menuitem" onClick={() => { setShowProfile(false); openAlertPanel(); setShowAdvisory(false); }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    Notifications
                  </button>
                  <button className="profile-menu-item" role="menuitem" onClick={() => { setShowProfile(false); onThemeToggle && onThemeToggle(); }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    Theme
                  </button>
                </div>
                {onSwitchRole && (
                  <div className="profile-menu-section" role="group" aria-label="Demonstration role">
                    <div style={{ padding: '4px 12px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--app-text-faint)' }}>Demo role (simulated)</div>
                    {ROLE_KEYS.map((k) => (
                      <button
                        key={k} className="profile-menu-item" role="menuitemradio" aria-checked={k === roleKey}
                        onClick={() => { setShowProfile(false); onSwitchRole(k); }}
                        style={k === roleKey ? { color: 'var(--app-accent)', fontWeight: 700 } : undefined}
                      >
                        {ROLES[k].label}
                      </button>
                    ))}
                  </div>
                )}
                {onLogout && (
                  <div className="profile-menu-section">
                    <button className="profile-menu-item danger" role="menuitem" onClick={() => { setShowProfile(false); onLogout(); }}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ── CONTENT ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          <main className={`h-full ${location.pathname === '/gis' ? 'overflow-y-auto' : 'overflow-auto p-4'}`}>
            {children}
          </main>
        </div>
      </div>

      {showAlerts && (
        <div className="w-80 overflow-hidden animate-slide-up border-l border-app-border bg-app-darker"
          style={{ position: 'fixed', top: 'var(--app-header-h, 62px)', right: 0, bottom: 0, zIndex: 200 }}>
          <AlertPanel alerts={alerts} onAcknowledge={acknowledgeAlert} onClose={closeAlertPanel} />
        </div>
      )}

      {showAdvisory && (
        <div className="app-advisory-panel w-96 overflow-hidden animate-slide-up border-2 border-app-border"
          style={{ position: 'fixed', top: 'var(--app-header-h, 62px)', right: 0, bottom: 0, zIndex: 200 }}>
          <AdvisoryPanel advisories={advisories} onClose={() => setShowAdvisory(false)} />
        </div>
      )}
    </div>
  );
}
