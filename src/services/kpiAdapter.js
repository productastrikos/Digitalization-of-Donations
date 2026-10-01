// Adapts a KPI metadata object (see donationKpis.js) into the props expected
// by the shared <KPICard/> component, so every page renders KPIs identically.
import { formatCurrency } from './donationSeed';
import { LOWER_IS_BETTER } from './donationKpis';

export function formatKpiValue(kpi) {
  switch (kpi.format) {
    case 'percent': return `${kpi.value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
    case 'currency': return formatCurrency(kpi.value);
    case 'hours': return `${kpi.value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
    case 'days': return `${kpi.value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
    default: return kpi.value.toLocaleString('en-US');
  }
}

export function formatKpiUnit(kpi) {
  if (kpi.format === 'percent') return '%';
  if (kpi.format === 'hours') return 'hrs';
  if (kpi.format === 'days') return 'days';
  if (kpi.format === 'currency') return '';
  return kpi.unit;
}

const RAG_MAP = { healthy: 'normal', 'on-track': 'normal', attention: 'warning', critical: 'critical' };
export function kpiStatusToRag(kpi) { return RAG_MAP[kpi.status] || 'normal'; }

export function kpiToCardProps(kpi, { onClick } = {}) {
  return {
    label: kpi.name,
    description: kpi.context,
    value: formatKpiValue(kpi),
    unit: formatKpiUnit(kpi),
    rag: kpiStatusToRag(kpi),
    trend: kpi.trend,
    trendGood: kpi.trend === 0 ? undefined : LOWER_IS_BETTER.has(kpi.id) ? kpi.trend < 0 : kpi.trend > 0,
    sourceEntity: kpi.sourceEntity,
    threshold: kpi.threshold,
    onClick,
  };
}
