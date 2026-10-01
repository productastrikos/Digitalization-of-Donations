// English / Arabic (RTL) support for the main navigation and the dashboard pages.
// SIMULATED / DRAFT: the Arabic strings below are a working draft prepared for the
// demonstration and must be reviewed by a native Arabic speaker before any real use.
// Strings without an entry fall back to English, so nothing ever disappears.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AR_EXTRA, AR_PATTERNS } from './i18nData';
import { AR_KPI, AR_GLOSSARY } from './i18nKpi';
import { AR_MORE } from './i18nMore';

const AR = {
  // navigation groups and items
  'Assets': 'الأصول', 'Operations': 'العمليات', 'Compliance': 'الامتثال', 'Insights & Admin': 'التحليلات والإدارة',
  'Executive': 'التنفيذي', 'GIS': 'الخريطة', 'Registry': 'السجل', 'Organizations': 'المؤسسات', 'Safekeeping': 'الحفظ',
  'Inspections': 'التفتيش', 'Logistics': 'اللوجستيات', 'Allocation': 'التوزيع', 'Enforcement': 'الإنفاذ',
  'Complaints': 'الشكاوى', 'Reports': 'التقارير', 'Admin': 'الإدارة',
  'Executive Overview': 'النظرة العامة التنفيذية', 'GIS Command Center': 'مركز القيادة الجغرافي',
  'Donation Box Registry': 'سجل صناديق التبرعات', 'Organizations & Ownership': 'المؤسسات والملكية',
  'Safekeeping & Inventory': 'الحفظ والمخزون', 'Inspections & Field Operations': 'التفتيش والعمليات الميدانية',
  'Displacement & Logistics': 'الإزالة واللوجستيات', 'Work Allocation': 'توزيع المهام',
  'Compliance & Enforcement': 'الامتثال والإنفاذ', 'Complaints & Alerts': 'الشكاوى والتنبيهات',
  'Reports & Analytics': 'التقارير والتحليلات', 'Administration & Audit': 'الإدارة والتدقيق',
  // top bar
  'DCD DONATION CONTROL': 'الرقابة على التبرعات', 'Search modules… (Ctrl+K)': 'ابحث في الوحدات… (Ctrl+K)',
  'SYSTEM OPERATIONAL': 'النظام يعمل', 'Advisory': 'الإرشادات', 'Notifications': 'الإشعارات', 'Theme': 'المظهر',
  'Sign Out': 'تسجيل الخروج', 'Sign out': 'تسجيل الخروج', 'Collapse sidebar': 'طيّ القائمة', 'Expand sidebar': 'توسيع القائمة',
  'Demo role (simulated)': 'الدور التجريبي (محاكاة)',
  // page titles and subtitles
  'Real-time regulatory monitoring and operational intelligence for donation box management across Abu Dhabi.': 'رصد تنظيمي فوري ومعلومات تشغيلية لإدارة صناديق التبرعات في أبوظبي.',
  'Live geographic surveillance of registered donation boxes and their operational compliance status.': 'متابعة جغرافية مباشرة لصناديق التبرعات المسجلة وحالة امتثالها التشغيلية.',
  'Operational management of field inspection scheduling, execution, and outcomes across Abu Dhabi.': 'إدارة تشغيلية لجدولة التفتيش الميداني وتنفيذه ونتائجه في أبوظبي.',
  'Centralized registry of all donation boxes under DCD monitoring across the Emirate of Abu Dhabi.': 'سجل مركزي لجميع صناديق التبرعات الخاضعة لرقابة الدائرة في إمارة أبوظبي.',
  'Regulatory oversight of licensed organizations authorized to operate donation collection boxes.': 'رقابة تنظيمية على المؤسسات المرخصة لتشغيل صناديق جمع التبرعات.',
  'Custody management for displaced donation boxes held at DCD safekeeping facilities.': 'إدارة عهدة صناديق التبرعات المُزالة المحفوظة في منشآت الحفظ التابعة للدائرة.',
  'End-to-end operational tracking of donation box removal, transport, and facility intake.': 'تتبع تشغيلي شامل لإزالة صناديق التبرعات ونقلها واستلامها في المنشآت.',
  'Enforcement command center tracking violation categories, severity, and regulatory resolution performance.': 'مركز قيادة الإنفاذ لتتبع فئات المخالفات وخطورتها وأداء المعالجة التنظيمية.',
  'Integrated intake center for public complaints, DMT alerts, and field-reported irregularities.': 'مركز استقبال متكامل لشكاوى الجمهور وتنبيهات دائرة البلديات والمخالفات المبلّغ عنها ميدانيًا.',
  'Assign field inspectors and logistics teams to open inspection, complaint, and displacement cases across Abu Dhabi.': 'إسناد المفتشين الميدانيين وفرق اللوجستيات إلى حالات التفتيش والشكاوى والإزالة المفتوحة في أبوظبي.',
  'Generate and export consolidated regulatory reports across all donation box control operations.': 'إنشاء وتصدير تقارير تنظيمية موحدة لجميع عمليات الرقابة على صناديق التبرعات.',
  'System configuration, user access management, and searchable audit history for the DCD Donation Control platform.': 'إعدادات النظام وإدارة صلاحيات المستخدمين وسجل تدقيق قابل للبحث لمنصة الرقابة على التبرعات.',
  'Export Report': 'تصدير التقرير', 'Zone': 'المنطقة', 'All Zones': 'جميع المناطق', 'Status': 'الحالة', 'Stage': 'المرحلة', 'Date Range': 'الفترة',
  // tabs
  'Map Monitoring': 'رصد الخريطة', 'Geographic Coverage': 'التغطية الجغرافية', 'Location Intelligence': 'ذكاء المواقع',
  'Inspection Planning': 'تخطيط التفتيش', 'Field Teams': 'الفرق الميدانية', 'Inspection History': 'سجل التفتيش',
  'Compliance Monitoring': 'متابعة الامتثال', 'Violations': 'المخالفات', 'Corrective Actions': 'الإجراءات التصحيحية',
  'Removal Operations': 'عمليات الإزالة', 'Transport Tracking': 'تتبع النقل', 'Logistics Assignments': 'مهام اللوجستيات',
  'Public Complaints': 'شكاوى الجمهور', 'DMT Alerts': 'تنبيهات دائرة البلديات', 'Escalations': 'التصعيدات',
  'Custody Management': 'إدارة العهدة', 'Storage Facilities': 'منشآت التخزين', 'Inventory Tracking': 'تتبع المخزون', 'Disposal & Release': 'الإتلاف والإفراج',
  // alerts / cards
  'ATTENTION REQUIRED': 'يتطلب الانتباه', 'RECENT ACTIVITY': 'النشاط الأخير', 'VIEW ALL': 'عرض الكل',
  'CRITICAL': 'حرج', 'WARNING': 'تحذير', 'NORMAL': 'طبيعي', 'VIEW DETAILS': 'عرض التفاصيل', 'Threshold': 'الحدود',
  'Key Insights': 'أبرز المؤشرات', 'Boxes': 'صناديق', 'Cases': 'حالات', 'Zones': 'مناطق',
  // executive KPIs
  'Total Registered Donation Boxes': 'إجمالي صناديق التبرعات المسجلة',
  'Measures overall registration coverage across monitored areas of the Emirate.': 'يقيس تغطية التسجيل الإجمالية في المناطق المرصودة بالإمارة.',
  'Overall Compliance Rate': 'معدل الامتثال الإجمالي',
  'Primary regulatory health indicator across all zones and organizations.': 'المؤشر التنظيمي الرئيسي لسلامة الامتثال في جميع المناطق والمؤسسات.',
  'Open Violations': 'المخالفات المفتوحة',
  'Primary enforcement backlog — opens the full violations register.': 'العمل المتراكم للإنفاذ — يفتح سجل المخالفات الكامل.',
  'Open Complaints / DMT Alerts': 'الشكاوى المفتوحة / تنبيهات دائرة البلديات',
  'SLA-tracked queue spanning public complaints and system-detected alerts.': 'قائمة انتظار خاضعة لاتفاقية مستوى الخدمة تشمل شكاوى الجمهور والتنبيهات المكتشفة آليًا.',
  'Boxes Awaiting Displacement': 'صناديق بانتظار الإزالة',
  'Reflects current backlog for field removal and transport operations.': 'يعكس الأعمال المتراكمة لعمليات الإزالة الميدانية والنقل.',
  'Inspections Due Today': 'عمليات التفتيش المستحقة اليوم',
  'Same-day field workload for inspection teams.': 'عبء العمل الميداني لفرق التفتيش خلال اليوم نفسه.',
  'Escalated Cases': 'الحالات المصعّدة',
  'Cases needing senior compliance review before closure.': 'حالات تحتاج إلى مراجعة امتثال أعلى قبل الإغلاق.',
  'Pending Reviews': 'المراجعات المعلقة',
  'Cases awaiting a compliance determination.': 'حالات بانتظار قرار الامتثال.',
  // insight sentences
  'increased by': 'ارتفع بنسبة', 'decreased by': 'انخفض بنسبة', 'held steady': 'ظل مستقرًا',
  'Overall compliance': 'الامتثال الإجمالي', 'Open violations': 'المخالفات المفتوحة', 'Pending displacement': 'الإزالة المعلقة', 'Escalated cases': 'الحالات المصعّدة',
  // lifecycle
  'Box Lifecycle': 'دورة حياة الصندوق', 'Identified to disposal or release, across all registered boxes': 'من الرصد حتى الإتلاف أو الإفراج، لجميع الصناديق المسجلة',
  'Identified': 'تم الرصد', 'Inspected': 'تم التفتيش', 'Violation': 'مخالفة', 'Displaced': 'تمت الإزالة', 'In Storage': 'في الحفظ', 'Disposed / Released': 'أُتلف / أُفرج عنه',
  'Registered or detected, not yet inspected': 'مسجّل أو مرصود ولم يُفتَّش بعد', 'Inspected; compliant or under inspection': 'تم تفتيشه؛ ملتزم أو قيد التفتيش',
  'Non-compliant; awaiting removal': 'غير ملتزم؛ بانتظار الإزالة', 'Removed and in transit to a facility': 'أُزيل وهو في الطريق إلى المنشأة',
  'Held in a DCD custody facility': 'محفوظ في منشأة عهدة تابعة للدائرة', 'Custody closed by an approved instruction': 'أُغلقت العهدة بتعليمات معتمدة',
  // common
  'Language': 'اللغة',
};

Object.keys(AR_EXTRA).forEach((k) => { if (!(k in AR)) AR[k] = AR_EXTRA[k]; });
Object.keys(AR_KPI).forEach((k) => { if (!(k in AR)) AR[k] = AR_KPI[k]; });
Object.keys(AR_MORE).forEach((k) => { if (!(k in AR)) AR[k] = AR_MORE[k]; });

// Read by the Chart.js translation plugin (canvas text is not reachable by the DOM translator).
// Case-insensitive index so "By compliance status" matches "By Compliance Status".
const ARL = {};
Object.keys(AR).forEach((k) => { const l = k.toLowerCase(); if (!(l in ARL)) ARL[l] = AR[k]; });

let activeLang = 'en';
export const getActiveLang = () => activeLang;

/* ── Translation engine ───────────────────────────────────────────────────
   Translates a string, keeping numbers, dates, scores, IDs and codes as-is:
   exact dictionary hit → number-bearing patterns → "Label (n)" → compound
   strings split on ' — ', ' · ' and ', ' (each part translated on its own). */
function translateCore(core) {
  if (AR[core]) return AR[core];
  const lower = core.toLowerCase();
  if (ARL[lower]) return ARL[lower];
  for (const [re, fn] of AR_PATTERNS) {
    const m = core.match(re);
    if (m) return fn(m);
  }
  const lead = core.match(/^([·—–-]\s+)(.+)$/);
  if (lead) { const r = translateCore(lead[2]); return r === lead[2] ? core : lead[1] + r; }
  const counted = core.match(/^(.*\S)\s*\(([^()]*)\)$/);
  if (counted) { const base = translateCore(counted[1]); if (base !== counted[1]) return `${base} (${counted[2]})`; }
  const numLead = core.match(/^(\d[\d,.]*%?)\s+(.+)$/);
  if (numLead) { const r = translateCore(numLead[2]); if (r !== numLead[2]) return `${numLead[1]} ${r}`; }
  const numTail = core.match(/^(.+?)\s+(\d[\d,.]*%?)$/);
  if (numTail) { const r = translateCore(numTail[1]); if (r !== numTail[1]) return `${r} ${numTail[2]}`; }
  for (const sep of [' — ', ' · ', ', ']) {
    if (core.includes(sep)) {
      const parts = core.split(sep);
      const out = parts.map(translateCore);
      if (out.some((p, i) => p !== parts[i])) return out.join(sep === ', ' ? '، ' : sep);
    }
  }
  // Threshold chips ("≥ 95% registration coverage", "≤ 2.5 days") — only for strings that carry a number/comparator.
  if (/[\d≥≤<>]/.test(core)) {
    let g = core;
    AR_GLOSSARY.forEach(([re, rep]) => { g = g.replace(re, rep); });
    // LRI…PDI keeps numbers and comparators in their written order inside the Arabic words.
    if (g !== core) return `\u2066${g}\u2069`;
  }
  return core;
}

export function translateString(text) {
  if (typeof text !== 'string') return text;
  const core = text.trim();
  if (!core) return text;
  const out = translateCore(core);
  if (out === core) return text;
  const at = text.indexOf(core);
  return text.slice(0, at) + out + text.slice(at + core.length);
}

/* DOM translator: every page/drawer/table is translated in place while Arabic
   is active (and restored when switching back), so no screen can be missed. */
const TR_ATTRS = ['placeholder', 'title', 'aria-label'];
const textOrig = new WeakMap();
const attrOrig = new WeakMap();

function skipNode(node) {
  const p = node.parentElement;
  if (!p) return true;
  const tag = p.tagName;
  return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT' || !!p.closest('[data-no-translate], .maplibregl-map');
}
function trText(node) {
  if (skipNode(node)) return;
  const cur = node.nodeValue;
  const rec = textOrig.get(node);
  if (rec && cur === rec.translated) return;
  const tr = translateString(cur);
  if (tr !== cur) { textOrig.set(node, { original: cur, translated: tr }); node.nodeValue = tr; } else if (rec) textOrig.delete(node);
}
function trAttrs(el) {
  if (!el.getAttribute) return;
  let rec = attrOrig.get(el);
  TR_ATTRS.forEach((a) => {
    const cur = el.getAttribute(a);
    if (cur == null) return;
    if (rec && rec[a] && rec[a].translated === cur) return;
    const tr = translateString(cur);
    if (tr !== cur) { if (!rec) { rec = {}; attrOrig.set(el, rec); } rec[a] = { original: cur, translated: tr }; el.setAttribute(a, tr); }
  });
}
function trTree(root) {
  if (root.nodeType === 3) { trText(root); return; }
  if (root.nodeType !== 1) return;
  trAttrs(root);
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(trAttrs);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = w.nextNode();
  while (n) { trText(n); n = w.nextNode(); }
}
function restoreTree(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = w.nextNode();
  while (n) { const rec = textOrig.get(n); if (rec && n.nodeValue === rec.translated) n.nodeValue = rec.original; textOrig.delete(n); n = w.nextNode(); }
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach((el) => {
    const rec = attrOrig.get(el);
    if (!rec) return;
    Object.keys(rec).forEach((a) => { if (el.getAttribute(a) === rec[a].translated) el.setAttribute(a, rec[a].original); });
    attrOrig.delete(el);
  });
}
function startDomTranslator() {
  trTree(document.body);
  const obs = new MutationObserver((records) => {
    records.forEach((r) => {
      if (r.type === 'characterData') trText(r.target);
      else if (r.type === 'attributes') trAttrs(r.target);
      else r.addedNodes.forEach((n) => trTree(n));
    });
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TR_ATTRS });
  return () => { obs.disconnect(); restoreTree(document.body); };
}

const STORAGE_KEY = 'dcd.lang';
const I18nContext = createContext({ lang: 'en', dir: 'ltr', setLang: () => {}, t: (s) => s, tf: (s) => s });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return window.localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'; } catch (e) { return 'en'; }
  });
  // Arabic changes the language only — the layout (sidebar, content, alignment) stays left-to-right.
  const dir = 'ltr';
  activeLang = lang;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
  }, [lang, dir]);

  useEffect(() => (lang === 'ar' ? startDomTranslator() : undefined), [lang]);
  useEffect(() => { window.dispatchEvent(new Event('dcd-lang')); }, [lang]);

  const setLang = useCallback((next) => setLangState(next === 'ar' ? 'ar' : 'en'), []);
  const t = useCallback((text) => (lang === 'ar' ? translateString(text) : text), [lang]);
  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
