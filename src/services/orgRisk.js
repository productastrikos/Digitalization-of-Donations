// Risk, ownership, and licensing enrichment for the Organizations & Ownership
// page. Organizations in the base seed only carry registration/compliance
// fields; this module derives the additional signals (ownership status,
// license expiry, composite risk tier) needed by the action panel, chart,
// and activity feed — all from the same underlying organizations/violations
// arrays so every view on the page stays consistent.
import { daysAgo, daysFromNow, formatDate } from './donationSeed';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function ownershipStatusFor(org, unverifiedCount) {
  if (unverifiedCount > 0) return 'Unverified';
  return hashSeed(org.id + 'own') % 100 < 15 ? 'Pending' : 'Verified';
}

function licenseExpiryFor(org) {
  const seed = hashSeed(org.id + 'exp');
  if (org.registrationStatus === 'expired') return daysAgo(5 + (seed % 180));
  if (org.registrationStatus === 'suspended') return daysFromNow(5 + (seed % 60));
  return daysFromNow(5 + (seed % 380));
}

const RISK_TONE = { High: 'red', Medium: 'amber', Low: 'cyan' };

/**
 * buildOrgRiskProfiles — one enriched record per organization carrying
 * ownershipStatus, licenseExpiryDate, daysToExpiry, riskTier (High/Medium/
 * Low/null), and primaryReason (the single most severe contributing factor).
 * riskTier is null for organizations that aren't flagged at all.
 */
export function buildOrgRiskProfiles(organizations, violations) {
  return organizations.map((org) => {
    const unverifiedCount = violations.filter((v) => v.organizationId === org.id && v.category === 'Incorrect Ownership' && v.status !== 'resolved').length;
    const ownershipStatus = ownershipStatusFor(org, unverifiedCount);
    const licenseExpiryDate = licenseExpiryFor(org);
    const daysToExpiry = Math.ceil((new Date(licenseExpiryDate).getTime() - Date.now()) / 86400000);

    const factors = [];
    if (org.openViolations >= 8) factors.push({ points: 3, reason: `${org.openViolations} open violations` });
    else if (org.openViolations >= 5) factors.push({ points: 2, reason: `${org.openViolations} open violations` });
    else if (org.openViolations >= 3) factors.push({ points: 1, reason: `${org.openViolations} open violations` });

    if (org.complianceScore < 75) factors.push({ points: 2, reason: `Compliance score ${org.complianceScore} — below threshold` });
    else if (org.complianceScore < 90) factors.push({ points: 1, reason: `Compliance score ${org.complianceScore} — below target` });

    if (ownershipStatus === 'Unverified') factors.push({ points: 2, reason: `Ownership unverified — ${unverifiedCount} box${unverifiedCount === 1 ? '' : 'es'}` });
    else if (ownershipStatus === 'Pending') factors.push({ points: 1, reason: 'Ownership verification pending' });

    if (org.registrationStatus === 'active') {
      if (daysToExpiry <= 15) factors.push({ points: 2, reason: `License expires in ${Math.max(0, daysToExpiry)} days` });
      else if (daysToExpiry <= 30) factors.push({ points: 1, reason: `License expires in ${daysToExpiry} days` });
    }

    const totalPoints = factors.reduce((s, f) => s + f.points, 0);
    const riskTier = totalPoints >= 4 ? 'High' : totalPoints >= 2 ? 'Medium' : totalPoints >= 1 ? 'Low' : null;
    const primaryReason = factors.length ? [...factors].sort((a, b) => b.points - a.points)[0].reason : 'No outstanding issues';

    return {
      ...org, ownershipStatus, licenseExpiryDate, daysToExpiry, unverifiedBoxCount: unverifiedCount,
      riskTier, riskTone: riskTier ? RISK_TONE[riskTier] : 'slate', primaryReason, riskPoints: totalPoints,
    };
  });
}

const TIER_RANK = { High: 0, Medium: 1, Low: 2 };

export function buildFlaggedOrganizations(profiles) {
  return profiles
    .filter((p) => p.riskTier)
    .sort((a, b) => (TIER_RANK[a.riskTier] - TIER_RANK[b.riskTier]) || (b.riskPoints - a.riskPoints) || (b.openViolations - a.openViolations));
}

const ACTIVITY_DOT = { critical: 'red', warning: 'amber', positive: 'cyan' };

/**
 * buildOrgActivityFeed — a deterministic, plausible recent-activity feed tied
 * to each organization's computed risk/ownership state, since the platform's
 * global audit log is box-level and doesn't carry an organization reference.
 */
export function buildOrgActivityFeed(profiles) {
  const events = [];
  profiles.forEach((p) => {
    const seed = hashSeed(p.id + 'activity');
    if (p.riskTier === 'High') {
      events.push({ id: `${p.id}-crit`, org: p.name, type: 'critical', text: `Moved to CRITICAL — ${p.openViolations} open violation${p.openViolations === 1 ? '' : 's'} logged`, timestamp: daysAgo(seed % 6) });
    } else if (p.riskTier === 'Medium') {
      events.push({ id: `${p.id}-warn`, org: p.name, type: 'warning', text: `Flagged WARNING — compliance score ${p.complianceScore}`, timestamp: daysAgo(1 + (seed % 8)) });
    }
    if (p.ownershipStatus === 'Verified' && seed % 5 === 0) {
      events.push({ id: `${p.id}-own-verified`, org: p.name, type: 'positive', text: 'Ownership verified — registry updated', timestamp: daysAgo(seed % 10) });
    }
    if (p.registrationStatus === 'active' && seed % 7 === 0) {
      events.push({ id: `${p.id}-renewed`, org: p.name, type: 'positive', text: 'License renewed', timestamp: daysAgo(2 + (seed % 12)) });
    }
    if (p.registrationStatus === 'active' && p.daysToExpiry > 0 && p.daysToExpiry <= 30) {
      events.push({ id: `${p.id}-expiry`, org: p.name, type: 'warning', text: `License renewal reminder sent — expires in ${p.daysToExpiry} days`, timestamp: daysAgo(seed % 4) });
    }
  });
  return events
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((e) => ({ ...e, tone: ACTIVITY_DOT[e.type] }));
}

export { formatDate, RISK_TONE };
