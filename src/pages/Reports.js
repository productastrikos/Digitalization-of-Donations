import React, { useState } from 'react';
import { useData } from '../services/socket';
import PageHeader, { FilterSelect } from '../components/PageHeader';
import { ZONES } from '../services/donationSeed';
import { useAuth } from '../services/access';
import { buildReport, exportReport, DISCLAIMER } from '../services/reportExport';
import PageSummary from '../components/PageSummary';

const REPORTS = [
  { id: 'RPT-01', name: 'Donation Box Compliance Report', description: 'Full compliance status breakdown across all registered donation boxes.' },
  { id: 'RPT-02', name: 'Geographic Coverage Report', description: 'Zone-by-zone registration density and monitoring coverage analysis.' },
  { id: 'RPT-03', name: 'Inspection Performance Report', description: 'Field inspection throughput, SLA adherence, and inspector performance.' },
  { id: 'RPT-04', name: 'Violation Resolution Report', description: 'Violation caseload, severity trends, and resolution timelines.' },
  { id: 'RPT-05', name: 'Displacement Activity Report', description: 'Logistics operations summary including removal and transport metrics.' },
  { id: 'RPT-06', name: 'Safekeeping Inventory Report', description: 'Custody facility inventory, valuation, and disposition status.' },
  { id: 'RPT-07', name: 'Organization Compliance Report', description: 'Licensed organization performance and violation exposure summary.' },
  { id: 'RPT-08', name: 'Monthly Regulatory Summary', description: 'Consolidated executive summary across all operational modules.' },
  { id: 'RPT-09', name: 'Cash Reconciliation Report', description: 'Expected vs. actual value at every custody handoff, by box and zone, with discrepancy case status.' },
];

export default function Reports() {
  const ctx = useData();
  const { lastSync } = ctx;
  const { can } = useAuth();
  const [dateRange, setDateRange] = useState('30d');
  const [zone, setZone] = useState('all');
  const [generating, setGenerating] = useState(null);

  function runExport(reportId, format) {
    setGenerating();
    // yield once so the busy state paints before the (synchronous) file build
    setTimeout(() => {
      try { exportReport(format, buildReport(reportId, ctx, { zone, range: dateRange })); } finally { setGenerating(null); }
    }, 40);
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Generate and export consolidated regulatory reports across all donation box control operations."
        lastUpdated={lastSync}
        filters={
          <>
            <FilterSelect label="Date Range" value={dateRange} onChange={setDateRange} options={[
              { label: 'Last 30 Days', value: '30d' }, { label: 'Last Quarter', value: 'q' }, { label: 'Year to Date', value: 'ytd' },
            ]} />
            <FilterSelect label="Zone" value={zone} onChange={setZone} options={[{ label: 'All Zones', value: 'all' }, ...ZONES.map((z) => ({ label: z.name, value: z.id }))]} />
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {REPORTS.map((r) => (
          <div key={r.id} className="bg-app-panel border border-app-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border">
              <h3 className="text-sm font-bold" style={{ color: 'var(--app-text)' }}>{r.name}</h3>
              <p className="text-[10.5px] mt-1" style={{ color: 'var(--app-text-faint)' }}>{r.description}</p>
            </div>
            <div className="p-3 flex items-center gap-2">
              {['pdf', 'excel', 'csv'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => runExport(r.id, fmt)}
                  disabled={!can('report.export') || generating !== null}
                  title={can('report.export') ? undefined : 'Your role cannot export reports'}
                  className="app-control-btn flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-medium uppercase"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  {generating === `${r.id}-${fmt}` ? '…' : fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-4 py-3 text-[11px]" style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--app-text-faint)' }}>
        Exports are generated from the platform's current data, filtered by the date range and zone above. {DISCLAIMER} Every file carries this notice.</div>

      <PageSummary page="reports" />
    </div>
  );
}
