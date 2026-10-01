import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { useData } from '../services/socket';
import { computeDomainKpis } from '../services/donationKpis';
import { buildKpiSeries, buildKpiNarrative } from '../services/kpiTrend';
import { formatKpiValue, formatKpiUnit } from '../services/kpiAdapter';
import Drawer, { DetailRow, DrawerSection } from './Drawer';
import { buildKpiSpecifics } from '../services/kpiSpecifics';
import { GenericBadge } from './StatusBadge';
import { chartTooltip, chartScales, areaGradient } from './chartUtils';
import { SEM } from '../services/palette';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const RAG_TONE = { healthy: 'green', 'on-track': 'cyan', attention: 'amber', critical: 'red' };

export default function KPIDetailDrawer() {
  const ctx = useData();
  const { activeKpiDrawer, closeKpiDrawer } = ctx;

  if (!activeKpiDrawer) return null;

  const domainKpis = computeDomainKpis(activeKpiDrawer.domain, ctx);
  const kpi = domainKpis.find((k) => k.id === activeKpiDrawer.kpiId);

  if (!kpi) return null;

  const specifics = buildKpiSpecifics(kpi.id, ctx);
  const series = buildKpiSeries(kpi);
  const narrative = buildKpiNarrative(kpi, series);

  const labels = [...series.historicalLabels, ...series.predictedLabels];
  const nHist = series.historicalLabels.length;

  const historicalData = [...series.historicalValues, ...Array(series.predictedValues.length).fill(null)];
  const forecastData = [
    ...Array(nHist - 1).fill(null),
    series.historicalValues[nHist - 1],
    ...series.predictedValues,
  ];

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Historical', data: historicalData, borderColor: SEM.info, backgroundColor: areaGradient(SEM.info),
        fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#3f6f9e', borderWidth: 2,
      },
      {
        label: 'Forecast', data: forecastData, borderColor: SEM.analytic, borderDash: [6, 4],
        fill: false, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#b8893a', borderWidth: 2, pointStyle: 'rectRot',
      },
    ],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', boxWidth: 8, usePointStyle: true, font: { size: 10 } } },
      tooltip: chartTooltip({
        callbacks: {
          title: (items) => {
            const idx = items[0].dataIndex;
            return `${labels[idx]}${idx >= nHist ? ' (Forecast)' : ''}`;
          },
          label: (ctx2) => {
            const v = ctx2.raw;
            if (v === null || v === undefined) return '';
            const unit = formatKpiUnit(kpi);
            return `${ctx2.dataset.label}: ${Math.round(v * 10) / 10}${unit ? ' ' + unit : ''}`;
          },
          afterBody: (items) => {
            const idx = items[0].dataIndex;
            if (idx === 0) return '';
            const seriesVals = [...series.historicalValues, ...series.predictedValues];
            const delta = Math.round((seriesVals[idx] - seriesVals[idx - 1]) * 10) / 10;
            return delta === 0 ? '' : `${delta > 0 ? '+' : ''}${delta} vs. previous point`;
          },
        },
      }),
    },
    scales: chartScales({
      x: { title: { display: true, text: 'Date', color: '#94a3b8', font: { size: 10 } } },
      y: { title: { display: true, text: formatKpiUnit(kpi) || 'Value', color: '#94a3b8', font: { size: 10 } } },
    }),
  };

  return (
    <Drawer open={true} onClose={closeKpiDrawer} title={kpi.name} subtitle={kpi.sourceEntity} width={460}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold" style={{ fontSize: 26, color: 'var(--app-text)' }}>{formatKpiValue(kpi)}</span>
          <span style={{ fontSize: 12, color: 'var(--app-text-faint)' }}>{formatKpiUnit(kpi)}</span>
        </div>
        <GenericBadge tone={RAG_TONE[kpi.status] || 'slate'}>{kpi.status.replace('-', ' ')}</GenericBadge>
      </div>

      <p className="text-[12px] mb-4" style={{ color: 'var(--app-text-muted)', lineHeight: 1.5 }}>{kpi.description}</p>

      <DrawerSection title="Metrics">
        <DetailRow label="Target" value={`${kpi.target.toLocaleString('en-US')} ${kpi.unit === 'AED' ? '' : kpi.unit}`.trim()} />
        <DetailRow label="Baseline" value={kpi.previousValue.toLocaleString('en-US')} />
        <DetailRow label="Threshold" value={<span style={{ textAlign: 'right', maxWidth: 240 }}>{kpi.threshold}</span>} />
        <DetailRow label="Source Entity" value={kpi.sourceEntity} />
      </DrawerSection>

      {specifics ? (
        specifics.blocks.map((block) => (
          <DrawerSection key={block.heading} title={block.heading}>
            {block.rows.length === 0 && <p className="text-[11px]" style={{ color: 'var(--app-text-faint)' }}>Nothing to show right now.</p>}
            <div className="space-y-2">
              {block.rows.map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span style={{ color: 'var(--app-text)' }}>{row.label}</span>
                    <span className="font-mono font-semibold shrink-0" style={{ color: 'var(--app-text)' }}>{row.value}</span>
                  </div>
                  {row.share !== undefined && (
                    <div className="h-1 mt-1 rounded-full overflow-hidden" style={{ background: 'var(--app-surface-raised)' }}>
                      <div className="h-full" style={{ width: `${Math.max(2, Math.round(row.share * 100))}%`, background: '#3f6f9e' }} />
                    </div>
                  )}
                  {row.note && <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--app-text-faint)' }}>{row.note}</div>}
                </div>
              ))}
            </div>
          </DrawerSection>
        ))
      ) : (
        <DrawerSection title="7-Day Trend & Forecast">
          <div style={{ height: 220 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--app-text-muted)', lineHeight: 1.5 }}>{narrative.forecastText}</p>
        </DrawerSection>
      )}

      <DrawerSection title="Operational Insights">
        <p className="text-[11.5px]" style={{ color: 'var(--app-text-muted)', lineHeight: 1.55 }}>
          {narrative.needsAttention ? narrative.insight : 'This metric is performing within its target range. No corrective action required at this time.'}
        </p>
      </DrawerSection>

      {!specifics && (
        <DrawerSection title="AI Advisory">
          <p className="text-[11.5px]" style={{ color: 'var(--app-text-muted)', lineHeight: 1.55 }}>{narrative.forecastText}</p>
        </DrawerSection>
      )}

      {narrative.needsAttention && narrative.roadmap.length > 0 && (
        <DrawerSection title="Recommended Roadmap">
          <div className="space-y-1.5">
            {narrative.roadmap.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-[11.5px]" style={{ color: 'var(--app-text-muted)' }}>
                <span className="rounded-full flex items-center justify-center shrink-0 font-mono font-bold"
                  style={{ width: 16, height: 16, fontSize: 9, marginTop: 1, background: 'var(--app-accent-bg)', color: 'var(--app-accent)' }}>
                  {i + 1}
                </span>
                <span style={{ lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
        </DrawerSection>
      )}
    </Drawer>
  );
}
