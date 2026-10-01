import React, { useState } from 'react';
import { executeAdvisoryAction } from '../services/api';
import { ZONES } from '../services/donationSeed';

const PRIORITY_META = {
  critical:   { badge: 'bg-red-600 text-white font-bold px-1.5 py-0.5 rounded',     label: 'CRITICAL', tag: 'ACT NOW',  accent: '#dc2626' },
  high:       { badge: 'bg-orange-500 text-white font-bold px-1.5 py-0.5 rounded',  label: 'HIGH',     tag: 'ACT NOW',  accent: '#ea580c' },
  medium:     { badge: 'bg-amber-400 text-black font-bold px-1.5 py-0.5 rounded',   label: 'MEDIUM',   tag: 'REVIEW',   accent: '#d97706' },
  info:       { badge: 'bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded',    label: 'INFO',     tag: 'MONITOR',  accent: '#2563eb' },
  low:        { badge: 'bg-slate-400 text-white font-bold px-1.5 py-0.5 rounded',   label: 'LOW',      tag: 'MONITOR',  accent: '#64748b' },
};
const URGENT_PRIORITIES = new Set(['critical', 'high']);

const toEvidenceStr = (e) => {
  if (typeof e === 'string') return e;
  if (!e || typeof e !== 'object') return String(e);
  return e.detail || e.message || Object.entries(e).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ');
};

const toRecStr = (r) => {
  if (typeof r === 'string') return r;
  if (!r || typeof r !== 'object') return String(r);
  return r.action || r.recommendation || r.step || r.text || Object.entries(r).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ');
};

const fmtImpact = (v) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v}%` : String(v));
const titleCase = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const ZONE_OPTS = ['All Zones', ...ZONES.map((z) => z.name)];

const ACTION_FORMS = {
  dispatch_crew: {
    title: 'Assign Inspection Sweep',
    color: 'cyan',
    fields: [
      { key: 'zone',     label: 'Target Zone',          type: 'select', opts: ZONE_OPTS },
      { key: 'unit',     label: 'Field Inspection Unit', type: 'select', opts: ['Unit 01', 'Unit 02', 'Unit 03', 'Unit 04', 'Unit 05', 'Unit 06', 'Unit 07'] },
      { key: 'priority', label: 'Assignment Priority',   type: 'select', opts: ['Immediate (< 4 hrs)', 'Priority (< 24 hrs)', 'Routine (< 7 days)'] },
      { key: 'notes',    label: 'Notes',                 type: 'textarea', placeholder: 'Special instructions…' },
    ],
  },
  optimize_routes: {
    title: 'Rebalance Field Assignments',
    color: 'emerald',
    fields: [
      { key: 'zones',  label: 'Target Zones',      type: 'select', opts: ZONE_OPTS },
      { key: 'mode',   label: 'Rebalance Mode',     type: 'select', opts: ['Reduce Travel Time', 'Even Caseload', 'Priority Coverage', 'Balanced'] },
      { key: 'window', label: 'Apply To Window',    type: 'select', opts: ['Current Shift', 'Next Shift', 'Next 7 Days'] },
      { key: 'notes',  label: 'Additional Notes',   type: 'textarea', placeholder: 'Any constraints or special requirements…' },
    ],
  },
  create_work_order: {
    title: 'Create Enforcement Order',
    color: 'purple',
    fields: [
      { key: 'title',    label: 'Order Title',      type: 'text',     placeholder: 'e.g. Compliance sweep — Mussafah Industrial Area' },
      { key: 'team',     label: 'Assigned Team',     type: 'select',   opts: ['Compliance & Inspections Division', 'Logistics Coordination Unit', 'Registry Administration', 'Management Review Board'] },
      { key: 'priority', label: 'Priority Level',    type: 'select',   opts: ['CRITICAL — Same day', 'HIGH — Within 48 hours', 'ROUTINE — Scheduled'] },
      { key: 'due',      label: 'Due Date',          type: 'text',     placeholder: 'e.g. 2026-09-22' },
      { key: 'desc',     label: 'Description',       type: 'textarea', placeholder: 'Describe the required action in detail…' },
    ],
  },
};

const COLOR_MAP = {
  cyan:    { ring: 'focus:ring-cyan-700/30',    btn: 'bg-cyan-600/15 border border-cyan-700/50 text-cyan-900 hover:bg-cyan-600/25' },
  emerald: { ring: 'focus:ring-emerald-700/30', btn: 'bg-emerald-600/15 border border-emerald-700/50 text-emerald-900 hover:bg-emerald-600/25' },
  purple:  { ring: 'focus:ring-purple-700/30',  btn: 'bg-purple-600/15 border border-purple-700/50 text-purple-900 hover:bg-purple-600/25' },
};

function AdvisorySection({ heading, items, expandedId, setExpandedId, executing, openForm }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2 px-0.5" style={{ color: 'rgba(255,255,255,0.92)' }}>{heading}</p>
      <div className="space-y-2">
        {items.map((advisory) => (
          <AdvisoryCard
            key={advisory.advisoryId}
            advisory={advisory}
            isExpanded={expandedId === advisory.advisoryId}
            onToggle={() => setExpandedId(expandedId === advisory.advisoryId ? null : advisory.advisoryId)}
            executing={executing}
            openForm={openForm}
          />
        ))}
      </div>
    </div>
  );
}

function AdvisoryCard({ advisory, isExpanded, onToggle, executing, openForm }) {
  const pm = PRIORITY_META[advisory.priority] || PRIORITY_META.low;
  const recs = Array.isArray(advisory.recommendations) ? advisory.recommendations : [];
  const impactEntries = advisory.impact ? Object.entries(advisory.impact).slice(0, 4) : [];

  return (
    <div className="rounded-xl overflow-hidden border transition-all duration-200 bg-white" style={{ borderColor: 'rgba(15,23,42,0.08)', borderLeftWidth: 4, borderLeftColor: pm.accent, boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <button className="w-full text-left px-3.5 pt-3 pb-2.5 group" onClick={onToggle}>
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[9.5px] tracking-wide ${pm.badge}`}>{pm.tag}</span>
            <span className="text-[10px] font-mono font-semibold text-slate-500">{advisory.advisoryId}</span>
            <span className="text-[10px] text-slate-400">· {titleCase(advisory.template)}</span>
          </div>
          <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform group-hover:text-slate-600 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-[13px] font-semibold leading-snug text-slate-900 pr-1">{advisory.title}</p>
        {advisory.rootCause?.primary && (
          <p className="text-[11px] leading-snug text-slate-600 mt-1 pr-1" style={{ display: isExpanded ? 'none' : '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {advisory.rootCause.primary}
          </p>
        )}
      </button>

      {isExpanded && (
        <div className="border-t divide-y" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
          {advisory.rootCause && (
            <div className="px-3.5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Root Cause</p>
              <div className="pl-2 border-l-4 space-y-1.5" style={{ borderColor: 'rgba(15,23,42,0.12)' }}>
                {advisory.rootCause.primary && (
                  <div><span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Primary · </span><span className="text-xs text-slate-700">{advisory.rootCause.primary}</span></div>
                )}
                {advisory.rootCause.contributing && (
                  <div><span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Contributing · </span><span className="text-xs text-slate-700">{advisory.rootCause.contributing}</span></div>
                )}
                {advisory.rootCause.systemic && (
                  <div><span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Systemic · </span><span className="text-xs text-slate-700">{advisory.rootCause.systemic}</span></div>
                )}
              </div>
            </div>
          )}

          {advisory.evidence?.length > 0 && (
            <div className="px-3.5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Evidence</p>
              <div className="space-y-1">
                {advisory.evidence.slice(0, 5).map((e, i) => (
                  <div key={i} className="flex items-start space-x-2">
                    <span className="text-[10px] text-slate-400 mt-0.5 shrink-0 tabular-nums">{i + 1}.</span>
                    <p className="text-xs text-slate-700 leading-snug">{toEvidenceStr(e)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recs.length > 0 && (
            <div className="px-3.5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recommendations</p>
              <div className="space-y-1.5">
                {recs.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-start space-x-2 pl-2 border-l-4" style={{ borderColor: 'rgba(15,23,42,0.12)' }}>
                    <p className="text-xs text-slate-700 leading-snug">{toRecStr(r)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {impactEntries.length > 0 && (
            <div className="px-3.5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Projected Impact</p>
              <div className="grid grid-cols-2 gap-1.5">
                {impactEntries.map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border rounded-lg px-2.5 py-2" style={{ borderColor: 'rgba(15,23,42,0.08)' }}>
                    <p className="text-sm font-bold leading-none text-slate-900">{fmtImpact(v)}</p>
                    <p className="text-[8px] text-slate-500 mt-1 leading-tight">{titleCase(k)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {advisory.actions?.length > 0 && (
            <div className="px-3.5 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Actions</p>
              <div className="space-y-1.5">
                {advisory.actions.map((action) => {
                  const aType = action.type || action;
                  const cfg = ACTION_FORMS[aType];
                  const aClr = cfg ? COLOR_MAP[cfg.color] : COLOR_MAP.cyan;
                  const isExec = executing === `${advisory.advisoryId}-${aType}`;
                  return (
                    <button
                      key={aType}
                      onClick={() => openForm(aType, advisory)}
                      disabled={isExec}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all disabled:opacity-50 flex items-center justify-between group/btn ${aClr?.btn || COLOR_MAP.cyan.btn}`}>
                      <span className="text-[10px] font-semibold">{cfg?.title || action.label || titleCase(aType)}</span>
                      <span className="text-[10px] opacity-50 font-bold group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all">›</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdvisoryPanel({ advisories = [], onClose }) {
  const [expandedId, setExpandedId] = useState(advisories[0]?.advisoryId || null);
  const [executing, setExecuting] = useState(null);
  const [actionForm, setActionForm] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const openForm = (actionType, advisory) => {
    const cfg = ACTION_FORMS[actionType];
    if (!cfg) return;
    const defaults = {};
    cfg.fields.forEach((f) => { defaults[f.key] = f.opts?.[0] ?? ''; });
    setActionForm({ actionType, advisoryId: advisory.advisoryId, advisoryTitle: advisory.title, formValues: defaults });
  };

  const submitForm = async () => {
    if (!actionForm) return;
    const key = `${actionForm.advisoryId}-${actionForm.actionType}`;
    setExecuting(key);
    try {
      await executeAdvisoryAction(actionForm.advisoryId, actionForm.actionType, actionForm.formValues);
    } finally {
      setExecuting(null);
      const cfg = ACTION_FORMS[actionForm.actionType];
      setSuccessMsg(`${cfg?.title || 'Action'} submitted successfully`);
      setActionForm(null);
      setTimeout(() => setSuccessMsg(null), 3200);
    }
  };

  const formClrKey = actionForm ? (ACTION_FORMS[actionForm.actionType]?.color || 'cyan') : 'cyan';
  const formClr = COLOR_MAP[formClrKey] || COLOR_MAP.cyan;

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {successMsg && (
        <div className="absolute top-14 left-2 right-2 z-50 bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-3 py-2 text-[10px] text-emerald-400 font-semibold shadow-xl">
          {successMsg}
        </div>
      )}

      <div className="px-4 py-3 border-b border-app-border flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-base font-semibold text-black">Operational Advisories</h3>
          <p className="text-xs text-black/60">{advisories.length} active recommendation{advisories.length === 1 ? '' : 's'}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {actionForm && (
        <div className="absolute inset-x-0 bottom-0 z-40 bg-app-darker flex flex-col border-t border-app-border" style={{ top: 53 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-app-border shrink-0">
            <div>
              <p className="text-[11px] font-bold text-black">{ACTION_FORMS[actionForm.actionType]?.title}</p>
              <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{actionForm.advisoryTitle}</p>
            </div>
            <button onClick={() => setActionForm(null)} className="text-slate-400 hover:text-white text-xl leading-none transition-colors w-7 h-7 flex items-center justify-center rounded hover:bg-white/10">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ACTION_FORMS[actionForm.actionType]?.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={actionForm.formValues[field.key] || ''}
                    onChange={(e) => setActionForm((f) => ({ ...f, formValues: { ...f.formValues, [field.key]: e.target.value } }))}
                    className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:ring-1 ${formClr.ring}`}>
                    {field.opts.map((o) => <option key={o} value={o} className="bg-slate-900 text-slate-200">{o}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={actionForm.formValues[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(e) => setActionForm((f) => ({ ...f, formValues: { ...f.formValues, [field.key]: e.target.value } }))}
                    className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-slate-200 placeholder-slate-400 resize-none focus:outline-none focus:ring-1 ${formClr.ring}`}
                  />
                ) : (
                  <input
                    type="text"
                    value={actionForm.formValues[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(e) => setActionForm((f) => ({ ...f, formValues: { ...f.formValues, [field.key]: e.target.value } }))}
                    className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 ${formClr.ring}`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="px-4 pb-4 pt-2 shrink-0 space-y-1.5 border-t border-app-border">
            <button
              onClick={submitForm}
              disabled={!!executing}
              className={`w-full py-2.5 text-[11px] font-bold rounded-lg border transition-colors disabled:opacity-50 ${formClr.btn}`}>
              {executing ? 'Submitting…' : `Submit ${ACTION_FORMS[actionForm.actionType]?.title || 'Action'}`}
            </button>
            <button onClick={() => setActionForm(null)} className="w-full py-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        <AdvisorySection
          heading="Requires Action Today"
          items={advisories.filter((a) => URGENT_PRIORITIES.has(a.priority))}
          {...{ expandedId, setExpandedId, executing, openForm }}
        />
        <AdvisorySection
          heading="Prioritised Advisories"
          items={advisories.filter((a) => !URGENT_PRIORITIES.has(a.priority))}
          {...{ expandedId, setExpandedId, executing, openForm }}
        />

        {advisories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-black">Advisory engine analyzing patterns…</p>
            <p className="text-[10px] text-black/50 mt-1">Recommendations will appear here when detected</p>
          </div>
        )}
      </div>
    </div>
  );
}
