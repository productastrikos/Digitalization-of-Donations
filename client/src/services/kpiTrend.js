import { Rng } from './donationSeed';
import { LOWER_IS_BETTER } from './donationKpis';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h || 1;
}

function shortDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Synthesizes a plausible 7-day historical trend ending EXACTLY at the KPI's
 * current live value, anchored near its baseline ~7 days ago, plus a damped
 * 3-day forward projection continuing the most recent slope. The historical
 * shape is deterministic per KPI id (stable across re-renders) but the final
 * point always reflects the live value, so the chart updates in real time as
 * the underlying simulation mutates the dataset.
 */
export function buildKpiSeries(kpi) {
  const rng = new Rng(hashSeed(kpi.id));
  const days = 7;
  const start = kpi.previousValue;
  const end = kpi.value;
  const span = Math.abs(end - start) || Math.max(Math.abs(end), 1);

  const historical = [];
  for (let i = 0; i < days; i++) {
    const t = i / (days - 1);
    const base = start + (end - start) * t;
    const noise = (rng.next() - 0.5) * span * 0.1;
    historical.push(i === days - 1 ? end : Math.max(0, base + noise));
  }

  const recentSlope = (historical[days - 1] - historical[days - 3]) / 2;
  const predicted = [];
  let last = historical[days - 1];
  for (let i = 1; i <= 3; i++) {
    last = Math.max(0, last + recentSlope * Math.pow(0.82, i - 1));
    predicted.push(last);
  }

  const today = new Date();
  const historicalDates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i)); return d;
  });
  const predictedDates = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() + i + 1); return d;
  });

  const totalChange = predicted[predicted.length - 1] - historical[days - 1];
  const pctChange = historical[days - 1] !== 0 ? (totalChange / Math.abs(historical[days - 1])) * 100 : 0;
  const direction = Math.abs(pctChange) < 0.5 ? 'flat' : pctChange > 0 ? 'up' : 'down';
  const isFavourable = direction === 'flat' ? null : LOWER_IS_BETTER.has(kpi.id) ? direction === 'down' : direction === 'up';

  return {
    historicalValues: historical,
    predictedValues: predicted,
    historicalLabels: historicalDates.map(shortDate),
    predictedLabels: predictedDates.map(shortDate),
    direction,
    pctChange: Math.round(Math.abs(pctChange) * 10) / 10,
    isFavourable,
  };
}

const DOMAIN_ROADMAPS = {
  registry: [
    'Prioritize outstanding registrations from organizations with the largest unregistered box counts.',
    'Cross-reference field survey data to identify unregistered boxes for onboarding.',
  ],
  compliance: [
    'Direct field units to the zones contributing most to the current gap before the next audit cycle.',
    'Review repeat-offender organizations for potential registration review or suspension.',
  ],
  inspections: [
    'Reallocate field capacity toward zones with the highest overdue concentration.',
    'Escalate cases open beyond SLA to the Compliance & Inspections Division for review.',
  ],
  displacement: [
    'Confirm transport and facility capacity ahead of the next removal cycle.',
    'Prioritize urgent-priority displacement orders awaiting team assignment.',
  ],
  safekeeping: [
    'Convene a disposition review for items awaiting instruction beyond 15 days.',
    'Validate facility capacity against the current intake pace to avoid overflow.',
  ],
  complaints: [
    'Assign unassigned critical and high-severity cases within the current shift.',
    'Review recurring complaint locations for a proactive inspection sweep.',
  ],
  organizations: [
    'Engage organizations with declining compliance scores before their next renewal.',
    'Flag unverified ownership records for registry reconciliation.',
  ],
};

function domainFromKpiId(id) {
  if (id.includes('registered') || id.includes('registry')) return 'registry';
  if (id.includes('inspection')) return 'inspections';
  if (id.includes('violation') || id.includes('compliance')) return 'compliance';
  if (id.includes('displacement') || id.includes('transit') || id.includes('removal') || id.includes('vehicle') || id.includes('logistics')) return 'displacement';
  if (id.includes('safekeeping') || id.includes('inventory') || id.includes('custody') || id.includes('storage')) return 'safekeeping';
  if (id.includes('complaint') || id.includes('alert') || id.includes('response') || id.includes('sla')) return 'complaints';
  if (id.includes('org')) return 'organizations';
  return 'compliance';
}

export function buildKpiNarrative(kpi, series) {
  const { direction, pctChange, isFavourable } = series;
  const dirWord = direction === 'flat' ? 'remain stable' : direction === 'up' ? 'increase' : 'decrease';
  const forecastText = direction === 'flat'
    ? `${kpi.name} is projected to remain broadly stable over the next 3 days, holding close to its current level.`
    : `${kpi.name} is projected to ${dirWord} by approximately ${pctChange}% over the next 3 days based on the current trend line${isFavourable === false ? ', moving further from the regulatory target' : isFavourable ? ', moving toward the regulatory target' : ''}.`;

  const needsAttention = kpi.status === 'critical' || kpi.status === 'attention';

  const gapToTarget = kpi.target ? Math.round(Math.abs(kpi.target - kpi.value) * 10) / 10 : null;
  const insight = `Currently tracking as ${kpi.status.replace('-', ' ')} against a threshold of "${kpi.threshold}". ${kpi.context} ${gapToTarget != null ? `The current gap to target is ${gapToTarget.toLocaleString('en-US')} ${kpi.unit === 'AED' ? 'AED' : kpi.unit}.` : ''}`.trim();

  const roadmap = needsAttention ? DOMAIN_ROADMAPS[domainFromKpiId(kpi.id)] || [] : [];

  return { forecastText, insight, roadmap, needsAttention };
}
