// Role-based access control. SIMULATED: roles and the demo user directory are
// illustrative; a production build would take identity and roles from DCD SSO.
import { createContext, useContext } from 'react';

export const PAGE_PERMISSION = {
  '/': 'page.dashboard',
  '/gis': 'page.gis',
  '/registry': 'page.registry',
  '/organizations': 'page.organizations',
  '/safekeeping': 'page.safekeeping',
  '/inspections': 'page.inspections',
  '/displacement': 'page.displacement',
  '/work-allocation': 'page.allocation',
  '/compliance': 'page.compliance',
  '/complaints': 'page.complaints',
  '/reports': 'page.reports',
  '/admin': 'page.admin',
};

const ALL_PAGES = Object.values(PAGE_PERMISSION);
const WITHOUT_ADMIN = ALL_PAGES.filter((p) => p !== 'page.admin');

export const ROLES = {
  administrator: {
    label: 'System Administrator', demoName: 'System Administrator', perms: ['*'],
    summary: 'Full access, including configuration and user administration.',
  },
  director: {
    label: 'Director, Compliance & Inspections', demoName: 'Director, Compliance & Inspections',
    perms: [...ALL_PAGES, 'disposal.approve', 'criteria.edit', 'audit.view', 'audit.export', 'report.export', 'qr.print', 'discrepancy.review'],
    summary: 'Approves or rejects disposal and demolition requests; defines compliance criteria; reviews cash discrepancy cases.',
  },
  compliance_officer: {
    label: 'Compliance Officer', demoName: 'Compliance Officer 02',
    perms: [...WITHOUT_ADMIN, 'inspection.conduct', 'evidence.upload', 'disposal.request', 'report.export', 'qr.print', 'discrepancy.review'],
    summary: 'Runs inspections, attaches evidence, raises disposal requests, and reviews cash discrepancy cases. Cannot approve disposals or sign off misappropriation findings.',
  },
  field_inspector: {
    label: 'Field Inspector', demoName: 'Ahmed Al Mansoori',
    perms: ['page.dashboard', 'page.registry', 'page.gis', 'page.inspections', 'page.complaints', 'inspection.conduct', 'evidence.upload', 'qr.print'],
    summary: 'Field work only: registry, inspections and evidence capture.',
  },
  logistics_coordinator: {
    label: 'Logistics Coordinator', demoName: 'Logistics Coordinator',
    perms: ['page.dashboard', 'page.registry', 'page.displacement', 'page.safekeeping', 'page.allocation', 'disposal.request', 'disposal.execute', 'qr.print'],
    summary: 'Transport and custody; executes disposals only after they are approved.',
  },
  auditor: {
    label: 'Auditor (read-only)', demoName: 'Internal Auditor',
    perms: [...ALL_PAGES, 'audit.view', 'audit.export', 'report.export'],
    summary: 'Read-only access to every page, the audit log and exports.',
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

export function roleCan(roleKey, permission) {
  const role = ROLES[roleKey];
  if (!role) return false;
  return role.perms.includes('*') || role.perms.includes(permission);
}

export function canOpenPath(roleKey, pathname) {
  const key = Object.keys(PAGE_PERMISSION).filter((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')))
    .sort((a, b) => b.length - a.length)[0];
  return key ? roleCan(roleKey, PAGE_PERMISSION[key]) : true;
}

export const AuthContext = createContext({ user: null, roleKey: 'compliance_officer', can: () => true });
export const useAuth = () => useContext(AuthContext);
