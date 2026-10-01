// Live, plain-language situation summaries for the bottom of every page.
// Each builder reads the same shared data the page itself renders, so the
// paragraph recomputes whenever the data changes (simulation ticks, user
// actions, other tabs). Every summary answers: what is going on, what is
// happening, and how to look at it. Returns { en, ar }.
import { zoneName } from './donationSeed';
import { buildMapDataQuality, buildGeoAreas } from './geoCoverage';
import { buildZoneIntelligence } from './locationIntelligence';
import { ROLES } from './access';

const n = (v) => Number(v).toLocaleString('en-US');
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

function topKey(items, keyFn) {
  const m = {};
  items.forEach((i) => { const k = keyFn(i); if (k != null) m[k] = (m[k] || 0) + 1; });
  const e = Object.entries(m).sort((a, b) => b[1] - a[1]);
  return e.length ? { key: e[0][0], count: e[0][1] } : null;
}

// Arabic zone / category names come from the shared dictionary via `tr`.
export function buildPageSummary(page, d, tr) {
  const { boxes, organizations, inspections, violations, displacements, inventory, complaints, cashDiscrepancies, disposalRequests, auditLog, inspectors, criteria, passMark } = d;
  const zn = (id) => zoneName(id);
  const tabbed = buildTabSummary(page, d, tr);
  if (tabbed) return tabbed;

  switch (page) {
    case 'executive': {
      const total = boxes.length;
      const rate = pct(boxes.filter((b) => b.status === 'compliant').length, total);
      const gap = Math.round((95 - rate) * 10) / 10;
      const open = violations.filter((v) => v.status !== 'resolved');
      const crit = open.filter((v) => v.severity === 'critical').length;
      const overdue = inspections.filter((i) => i.status === 'overdue').length;
      const pendDisp = boxes.filter((b) => b.status === 'pending-displacement').length;
      const cash = cashDiscrepancies.filter((c) => c.status !== 'closed').length;
      const top = topKey(boxes.filter((b) => b.status === 'non-compliant'), (b) => b.zoneId);
      return {
        en: `Overall compliance is ${rate}% against the 95% target, ${gap > 0 ? `${gap} points short` : 'on or above target'}. ${n(open.length)} violations are open (${n(crit)} critical), ${n(overdue)} inspections are overdue, ${n(pendDisp)} boxes are waiting for removal and ${n(cash)} cash discrepancy cases are open. ${top ? `Non-compliance is most concentrated in ${zn(top.key)} (${top.count} boxes), so that is the best place to start: ` : ''}clear the critical violations first, then the overdue inspections, then assign removal teams to boxes already approved for displacement.`,
        ar: `يبلغ الامتثال الإجمالي ${rate}% مقابل هدف 95%، ${gap > 0 ? `بفارق ${gap} نقطة` : 'وهو ضمن الهدف أو أعلى'}. توجد ${n(open.length)} مخالفة مفتوحة (${n(crit)} حرجة) و${n(overdue)} عملية تفتيش متأخرة و${n(pendDisp)} صندوقًا بانتظار الإزالة و${n(cash)} حالة فرق نقدي مفتوحة. ${top ? `يتركّز عدم الامتثال في ${tr(zn(top.key))} (${top.count} صندوق)، لذا فهي أفضل نقطة للبدء: ` : ''}عالج المخالفات الحرجة أولًا، ثم التفتيش المتأخر، ثم كلّف فرق الإزالة بالصناديق المعتمدة للإزالة.`,
      };
    }
    case 'gis-map': {
      const total = boxes.length;
      const by = (s) => boxes.filter((b) => b.status === s).length;
      const dueSoon = boxes.filter((b) => new Date(b.nextInspection).getTime() < Date.now()).length;
      const dense = topKey(boxes, (b) => b.zoneId);
      const bad = topKey(boxes.filter((b) => b.status === 'non-compliant'), (b) => b.zoneId);
      return {
        en: `The map plots ${n(total)} registered boxes: ${n(by('compliant'))} compliant (${pct(by('compliant'), total)}%), ${n(by('non-compliant'))} non-compliant, ${n(by('under-inspection'))} under inspection and ${n(by('pending-displacement'))} awaiting removal, with ${n(dueSoon)} past their next-inspection date. ${dense ? `${zn(dense.key)} is the densest zone (${dense.count} boxes)` : ''}${bad ? (dense && bad.key === dense.key ? ` and it also has the most non-compliant boxes (${bad.count})` : ` and ${zn(bad.key)} has the most non-compliant boxes (${bad.count})`) : ''}. Use the status and zone filters to isolate red and orange markers, click a marker to open the box record, and look for clusters where non-compliance overlaps overdue inspections.`,
        ar: `تعرض الخريطة ${n(total)} صندوقًا مسجلًا: ${n(by('compliant'))} ملتزمًا (${pct(by('compliant'), total)}%) و${n(by('non-compliant'))} غير ملتزم و${n(by('under-inspection'))} قيد التفتيش و${n(by('pending-displacement'))} بانتظار الإزالة، منها ${n(dueSoon)} تجاوزت موعد التفتيش القادم. ${dense ? `${tr(zn(dense.key))} هي الأكثر كثافة (${dense.count} صندوق)` : ''}${bad ? (dense && bad.key === dense.key ? ` وهي أيضًا الأكثر صناديق غير ملتزمة (${bad.count})` : ` وتضم ${tr(zn(bad.key))} أكبر عدد من الصناديق غير الملتزمة (${bad.count})`) : ''}. استخدم مرشحات الحالة والمنطقة لعزل العلامات الحمراء والبرتقالية، وانقر على أي علامة لفتح سجل الصندوق، وابحث عن التجمعات التي يتقاطع فيها عدم الامتثال مع التفتيش المتأخر.`,
      };
    }
    case 'gis-coverage': {
      const q = buildMapDataQuality(boxes);
      const areas = buildGeoAreas(boxes, complaints);
      const partial = areas.filter((a) => a.surveyStatus === 'Partial').length;
      const pend = areas.filter((a) => a.surveyStatus === 'Pending').length;
      const worst = [...areas].sort((a, b) => a.coveragePercentage - b.coveragePercentage)[0];
      return {
        en: `${q.verifiedPct}% of ${n(q.total)} registered locations are verified; ${n(q.requiresValidation)} need attention (${q.pending} pending validation, ${q.missing} missing coordinates, ${q.duplicate} duplicates, ${q.outside} outside their zone). ${areas.length - partial - pend} of ${areas.length} zones are fully surveyed, ${partial} are partial and ${pend} pending${worst ? `, with ${zn(worst.id)} the weakest at ${worst.coveragePercentage}% coverage` : ''}. Open Map Data Quality to review, resolve or verify each location — the counts update as you go — and send a field team to the weakest zones first.`,
        ar: `تم التحقق من ${q.verifiedPct}% من ${n(q.total)} موقعًا مسجلًا؛ ويحتاج ${n(q.requiresValidation)} إلى انتباه (${q.pending} بانتظار التحقق و${q.missing} بلا إحداثيات و${q.duplicate} مكررًا و${q.outside} خارج المنطقة). تم مسح ${areas.length - partial - pend} من ${areas.length} منطقة بالكامل، و${partial} جزئيًا و${pend} معلّقًا${worst ? `، وأضعفها ${tr(zn(worst.id))} بتغطية ${worst.coveragePercentage}%` : ''}. افتح جودة بيانات الخريطة لمراجعة كل موقع أو حله أو التحقق منه — وتتحدث الأرقام فورًا — وأرسل فريقًا ميدانيًا إلى أضعف المناطق أولًا.`,
      };
    }
    case 'gis-intelligence': {
      const zones = buildZoneIntelligence(boxes, complaints, inspections);
      const avg = zones.length ? Math.round((zones.reduce((s, z) => s + z.riskScore, 0) / zones.length) * 10) / 10 : 0;
      const hi = zones.filter((z) => z.riskCategory === 'High' || z.riskCategory === 'Critical');
      const top = [...zones].sort((a, b) => b.riskScore - a.riskScore)[0];
      const sum = (f) => zones.reduce((s, z) => s + z.riskFactors[f], 0);
      const drivers = [['non-compliance', 'عدم الامتثال', sum('nonComplianceScore')], ['complaint activity', 'نشاط الشكاوى', sum('complaintScore')], ['inspection backlog', 'تراكم التفتيش', sum('inspectionBacklogScore')]].sort((a, b) => b[2] - a[2]);
      return {
        en: `The composite risk score averages ${avg} across ${zones.length} zones and ${hi.length} zone${hi.length === 1 ? ' is' : 's are'} rated High or Critical${top ? `, led by ${top.name} at ${top.riskScore}` : ''}. The biggest contributor is ${drivers[0][0]}, ahead of ${drivers[1][0]} and ${drivers[2][0]}. This score is a demonstration construct built from those three inputs, not a prediction: click a driver to filter the action list, open a zone to see the records behind its score, then assign a team or create an inspection task for the highest-risk areas.`,
        ar: `يبلغ متوسط درجة المخاطر المركبة ${avg} عبر ${zones.length} منطقة، وتصنَّف ${hi.length} منطقة بمخاطر عالية أو حرجة${top ? `، في مقدمتها ${tr(top.name)} بدرجة ${top.riskScore}` : ''}. أكبر مساهم هو ${drivers[0][1]}، يليه ${drivers[1][1]} ثم ${drivers[2][1]}. هذه الدرجة مؤشر توضيحي مبني على هذه المدخلات الثلاثة وليست تنبؤًا: انقر على أحد المحركات لتصفية قائمة الإجراءات، وافتح منطقة لرؤية السجلات وراء درجتها، ثم كلّف فريقًا أو أنشئ مهمة تفتيش لأعلى المناطق مخاطر.`,
      };
    }
    case 'registry': {
      const total = boxes.length;
      const by = (s) => boxes.filter((b) => b.status === s).length;
      const needs = boxes.filter((b) => b.complianceScore < 75 || b.currentAction !== 'Routine Monitoring').length;
      const overdue = boxes.filter((b) => new Date(b.nextInspection).getTime() < Date.now()).length;
      const low = boxes.filter((b) => b.complianceScore < 50).length;
      const cashBoxes = boxes.filter((b) => b.donationType === 'Cash').length;
      return {
        en: `The registry holds ${n(total)} boxes (${n(cashBoxes)} cash, ${n(total - cashBoxes)} in-kind): ${n(by('compliant'))} compliant, ${n(by('non-compliant'))} non-compliant, ${n(by('safekeeping'))} in safekeeping and ${n(by('unknown'))} unverified. ${n(needs)} need action, ${n(low)} score below 50 and ${n(overdue)} are past their next inspection. Use “Needs Action” with “Score (Lowest First)” to work from the worst boxes down; open any record for its QR identity, owner, inspection and violation history, value ledger and full timeline.`,
        ar: `يضم السجل ${n(total)} صندوقًا (${n(cashBoxes)} نقدي و${n(total - cashBoxes)} عيني): ${n(by('compliant'))} ملتزم و${n(by('non-compliant'))} غير ملتزم و${n(by('safekeeping'))} في الحفظ و${n(by('unknown'))} غير موثّق. يحتاج ${n(needs)} منها إلى إجراء، و${n(low)} بدرجة أقل من 50، و${n(overdue)} تجاوزت موعد التفتيش القادم. استخدم «يتطلب إجراء» مع «الدرجة (الأدنى أولًا)» للعمل من أسوأ الصناديق تنازليًا، وافتح أي سجل لرؤية هويته عبر QR ومالكه وسجل التفتيش والمخالفات وسجل القيمة والجدول الزمني الكامل.`,
      };
    }
    case 'organizations': {
      const withV = organizations.filter((o) => o.openViolations > 0);
      const avg = organizations.length ? Math.round(organizations.reduce((s, o) => s + o.complianceScore, 0) / organizations.length) : 0;
      const bad = organizations.filter((o) => o.registrationStatus === 'suspended' || o.registrationStatus === 'expired').length;
      const worst = [...organizations].sort((a, b) => b.openViolations - a.openViolations)[0];
      const active = organizations.filter((o) => o.registrationStatus === 'active').length;
      return {
        en: `${organizations.length} organizations are licensed: ${active} active and ${bad} suspended or expired. ${withV.length} carry open violations and the average compliance score is ${avg}${worst ? `; ${worst.name} has the most open violations (${worst.openViolations})` : ''}. Review the flagged list from the highest risk down, check ownership and licence expiry on each profile, and escalate repeat offenders for registration review before their next renewal.`,
        ar: `يوجد ${organizations.length} مؤسسة مرخصة: ${active} نشطة و${bad} موقوفة أو منتهية. تحمل ${withV.length} منها مخالفات مفتوحة، ومتوسط درجة الامتثال ${avg}${worst ? `؛ وأكثرها مخالفات مفتوحة ${tr(worst.name)} (${worst.openViolations})` : ''}. راجع قائمة المؤسسات المصنّفة من الأعلى مخاطر إلى الأدنى، وتحقق من الملكية وانتهاء الترخيص في كل ملف، وصعّد المخالفين المتكررين لمراجعة التسجيل قبل تجديدهم القادم.`,
      };
    }
    case 'safekeeping': {
      const inCust = inventory.filter((i) => i.custodyStatus === 'stored' || i.custodyStatus === 'awaiting-instruction');
      const awaiting = inventory.filter((i) => i.custodyStatus === 'awaiting-instruction');
      const oldest = awaiting.length ? Math.max(...awaiting.map((i) => daysSince(i.dateReceived))) : 0;
      const value = inCust.reduce((s, i) => s + i.value, 0);
      const openCash = cashDiscrepancies.filter((c) => c.status !== 'closed');
      const variance = openCash.reduce((s, c) => s + Math.abs(c.variance), 0);
      const pend = disposalRequests.filter((r) => r.status === 'pending').length;
      const appr = disposalRequests.filter((r) => r.status === 'approved').length;
      return {
        en: `${n(inCust.length)} items are in custody worth about AED ${n(value)}; ${n(awaiting.length)} are waiting for a management instruction (the oldest for ${oldest} days). ${n(openCash.length)} cash discrepancy cases are open with AED ${n(variance)} in dispute, and ${pend} disposal request${pend === 1 ? '' : 's'} await${pend === 1 ? 's' : ''} approval while ${appr} ${appr === 1 ? 'is' : 'are'} approved but not yet executed. Clear the oldest awaiting items first, work the discrepancy cases through verify → investigate → resolve (misappropriation and high-value cases need Administrator sign-off), and execute only approved disposals.`,
        ar: `يوجد ${n(inCust.length)} عنصرًا في العهدة بقيمة تقارب ${n(value)} درهم؛ ${n(awaiting.length)} منها بانتظار تعليمات الإدارة (أقدمها منذ ${oldest} يومًا). وتوجد ${n(openCash.length)} حالة فرق نقدي مفتوحة بقيمة ${n(variance)} درهم محل نزاع، و${pend} طلب إتلاف بانتظار الاعتماد و${appr} معتمدة ولم تُنفَّذ بعد. عالج أقدم العناصر المنتظرة أولًا، ومرّر حالات الفروقات عبر التحقق ثم التحقيق ثم الحل (حالات الاختلاس والقيم المرتفعة تتطلب اعتماد مسؤول النظام)، ولا تنفّذ إلا الإتلاف المعتمد.`,
      };
    }
    case 'inspections': {
      const c = (s) => inspections.filter((i) => i.status === s).length;
      const done = inspections.filter((i) => i.status === 'completed');
      const pass = done.length ? pct(done.filter((i) => i.complianceResult === 'pass').length, done.length) : 0;
      const zone = topKey(inspections.filter((i) => i.status === 'overdue'), (i) => i.zoneId);
      const free = (inspectors || []).filter((i) => i.availability === 'Available').length;
      return {
        en: `${n(inspections.length)} inspections are on record: ${n(c('completed'))} completed (${pass}% passed), ${n(c('pending'))} pending, ${n(c('overdue'))} overdue and ${n(c('escalated'))} escalated. ${zone ? `Overdue work is concentrated in ${zn(zone.key)} (${zone.count}). ` : ''}${free} inspector${free === 1 ? ' is' : 's are'} currently available. Work the escalated and overdue cases first, reassign them to available inspectors near the zone, and make sure completed inspections carry evidence and a scored checklist so the box status stays trustworthy.`,
        ar: `يوجد ${n(inspections.length)} عملية تفتيش مسجلة: ${n(c('completed'))} مكتملة (نجح ${pass}%) و${n(c('pending'))} معلّقة و${n(c('overdue'))} متأخرة و${n(c('escalated'))} مصعّدة. ${zone ? `يتركّز التأخير في ${tr(zn(zone.key))} (${zone.count}). ` : ''}يتوفر حاليًا ${free} مفتشًا. عالج الحالات المصعّدة والمتأخرة أولًا، وأعد تكليفها إلى المفتشين المتاحين قرب المنطقة، وتأكد من أن التفتيشات المكتملة تحمل أدلة وقائمة تحقق مُقيَّمة ليبقى وضع الصندوق موثوقًا.`,
      };
    }
    case 'displacement': {
      const c = (s) => displacements.filter((x) => x.status === s).length;
      const urgent = displacements.filter((x) => x.status === 'pending' && x.priority === 'urgent').length;
      const vehicles = new Set(displacements.filter((x) => x.status !== 'completed').map((x) => x.vehicle)).size;
      const team = topKey(displacements.filter((x) => x.status !== 'completed'), (x) => x.assignedTeam);
      return {
        en: `${c('pending')} removals are waiting for a team, ${c('assigned')} are assigned, ${c('in-transit')} boxes are on the road and ${c('completed')} have been completed, using ${vehicles} vehicles. ${urgent} pending removals are urgent${team ? ` and ${team.key} carries the heaviest active load (${team.count})` : ''}. Assign urgent removals first, keep transport moving so boxes reach the safekeeping facility, and confirm each intake so custody and inventory records are created without gaps.`,
        ar: `${c('pending')} عملية إزالة بانتظار فريق و${c('assigned')} مكلّفة و${c('in-transit')} صندوقًا في الطريق و${c('completed')} مكتملة، باستخدام ${vehicles} مركبات. منها ${urgent} عاجلة معلّقة${team ? ` ويحمل ${tr(team.key)} أكبر حمل نشط (${team.count})` : ''}. كلّف عمليات الإزالة العاجلة أولًا، وحافظ على انسيابية النقل حتى تصل الصناديق إلى منشأة الحفظ، وأكّد كل استلام لتُنشأ سجلات العهدة والمخزون دون ثغرات.`,
      };
    }
    case 'allocation': {
      const openInsp = inspections.filter((i) => i.status === 'overdue' || i.status === 'escalated').length;
      const openCmp = complaints.filter((x) => x.status !== 'resolved' && (x.severity === 'critical' || x.severity === 'high')).length;
      const pendD = displacements.filter((x) => x.status === 'pending').length;
      const avail = (inspectors || []).filter((i) => i.availability === 'Available').length;
      const off = (inspectors || []).filter((i) => i.availability === 'Off Duty').length;
      return {
        en: `${n(openInsp + openCmp + pendD)} cases need allocation: ${n(openInsp)} overdue or escalated inspections, ${n(openCmp)} critical or high-severity complaints and ${n(pendD)} removals without a team. ${avail} of ${(inspectors || []).length} inspectors ${avail === 1 ? 'is' : 'are'} available and ${off} ${off === 1 ? 'is' : 'are'} off duty. Open the most critical case first, pick a person or team ranked by zone match and availability, and reassign when workload is uneven so no inspector carries a disproportionate share.`,
        ar: `توجد ${n(openInsp + openCmp + pendD)} حالة تحتاج إلى توزيع: ${n(openInsp)} تفتيش متأخر أو مصعّد و${n(openCmp)} شكوى حرجة أو عالية الخطورة و${n(pendD)} عملية إزالة بلا فريق. يتوفر ${avail} من ${(inspectors || []).length} مفتشين، و${off} خارج الدوام. افتح أكثر الحالات حرجًا أولًا، واختر شخصًا أو فريقًا مرتبًا حسب ملاءمة المنطقة والتوفر، وأعد التكليف عند اختلال العبء حتى لا يتحمل مفتش حصة غير متناسبة.`,
      };
    }
    case 'compliance': {
      const open = violations.filter((v) => v.status !== 'resolved');
      const crit = open.filter((v) => v.severity === 'critical').length;
      const high = open.filter((v) => v.severity === 'high').length;
      const review = violations.filter((v) => v.status === 'under-review').length;
      const cat = topKey(open, (v) => v.category);
      const zone = topKey(open, (v) => v.zoneId);
      const age = open.length ? Math.round(open.reduce((s, v) => s + daysSince(v.dateIdentified), 0) / open.length) : 0;
      return {
        en: `${n(open.length)} violations are unresolved (${n(crit)} critical, ${n(high)} high), ${n(review)} of them under compliance review, with an average age of ${age} days. ${cat ? `“${cat.key}” is the most common category (${cat.count})` : ''}${zone ? ` and ${zn(zone.key)} has the most open cases (${zone.count})` : ''}. Resolve critical and high-severity cases first, move reviewed cases to a decision, trigger removal for confirmed non-compliant boxes, and watch repeat offenders for escalation.`,
        ar: `توجد ${n(open.length)} مخالفة غير محلولة (${n(crit)} حرجة و${n(high)} عالية)، منها ${n(review)} قيد مراجعة الامتثال، بمتوسط عمر ${age} يومًا. ${cat ? `«${tr(cat.key)}» هي الفئة الأكثر شيوعًا (${cat.count})` : ''}${zone ? ` وتضم ${tr(zn(zone.key))} أكبر عدد من الحالات المفتوحة (${zone.count})` : ''}. عالج الحالات الحرجة وعالية الخطورة أولًا، وانقل الحالات المراجَعة إلى قرار، وابدأ الإزالة للصناديق غير الملتزمة المؤكدة، وراقب المخالفين المتكررين للتصعيد.`,
      };
    }
    case 'complaints': {
      const open = complaints.filter((x) => x.status !== 'resolved');
      const crit = open.filter((x) => x.severity === 'critical' || x.severity === 'high').length;
      const dmt = open.filter((x) => x.source === 'DMT Alert').length;
      const unassigned = complaints.filter((x) => x.status === 'open').length;
      const oldest = open.length ? Math.max(...open.map((x) => daysSince(x.dateReceived))) : 0;
      const src = topKey(open, (x) => x.source);
      return {
        en: `${n(open.length)} complaints and alerts are open: ${n(crit)} critical or high severity, ${n(dmt)} from DMT alerts and ${n(unassigned)} still unassigned; the oldest has been open ${oldest} days${src ? ` and “${src.key}” is the busiest channel (${src.count})` : ''}. Triage critical items first, turn DMT alerts into an inspection or violation straight from the alert so the record stays linked, and close resolved cases promptly to keep the response-time metric healthy.`,
        ar: `يوجد ${n(open.length)} شكوى وتنبيه مفتوح: ${n(crit)} حرجة أو عالية الخطورة و${n(dmt)} من تنبيهات دائرة البلديات و${n(unassigned)} لم تُكلَّف بعد؛ وأقدمها مفتوحة منذ ${oldest} يومًا${src ? ` و«${tr(src.key)}» هي القناة الأكثر نشاطًا (${src.count})` : ''}. رتّب الحالات الحرجة أولًا، وحوّل تنبيهات دائرة البلديات إلى تفتيش أو مخالفة مباشرة من التنبيه ليبقى السجل مرتبطًا، وأغلق الحالات المحلولة سريعًا للحفاظ على مؤشر زمن الاستجابة.`,
      };
    }
    case 'reports': {
      return {
        en: `Nine reports are available and each one is generated from the live data (${n(boxes.length)} boxes, ${n(violations.length)} violations, ${n(inspections.length)} inspections, ${n(cashDiscrepancies.length)} cash cases and ${n(auditLog.length)} audit entries right now), so an export always matches what the dashboards show. Choose the date range and zone above, use PDF for circulation, Excel or CSV for analysis, and the Cash Reconciliation and audit exports when a review needs a complete trail. Every file is stamped as simulated demonstration data.`,
        ar: `تتوفر تسعة تقارير، ويُنشأ كل منها من البيانات الحية (${n(boxes.length)} صندوقًا و${n(violations.length)} مخالفة و${n(inspections.length)} تفتيشًا و${n(cashDiscrepancies.length)} حالة نقدية و${n(auditLog.length)} إدخال تدقيق حاليًا)، لذا يطابق أي تصدير ما تعرضه اللوحات. اختر الفترة والمنطقة أعلاه، واستخدم PDF للتعميم وExcel أو CSV للتحليل، وتصديرَي مطابقة النقد والتدقيق عندما تحتاج المراجعة إلى مسار كامل. يحمل كل ملف علامة بيانات تجريبية محاكاة.`,
      };
    }
    case 'admin': {
      const day = auditLog.filter((a) => Date.now() - new Date(a.timestamp).getTime() < 86400000).length;
      const src = topKey(auditLog, (a) => a.source);
      const active = (criteria || []).filter((c) => c.active).length;
      const admin = cashDiscrepancies.filter((c) => c.requiresAdminSignoff && c.status !== 'closed').length;
      return {
        en: `The audit log holds ${n(auditLog.length)} entries, ${n(day)} of them in the last 24 hours${src ? `, mostly from ${src.key}` : ''}. ${active} compliance criteria are active with a pass mark of ${passMark}, and ${admin} cash discrepancy case${admin === 1 ? '' : 's'} await Administrator sign-off. Filter the log by user, entity, action and date to trace any change back to who made it, review pending sign-offs, and change criteria only when the impact on future inspection scores is understood — past scores never change.`,
        ar: `يضم سجل التدقيق ${n(auditLog.length)} إدخالًا، منها ${n(day)} خلال آخر 24 ساعة${src ? `، معظمها من ${tr(src.key)}` : ''}. يوجد ${active} معيار امتثال نشط بدرجة نجاح ${passMark}، و${admin} حالة فرق نقدي بانتظار اعتماد مسؤول النظام. صفِّ السجل حسب المستخدم والكيان والإجراء والتاريخ لتتبع أي تغيير إلى من أجراه، وراجع الاعتمادات المعلقة، ولا تغيّر المعايير إلا بعد فهم أثرها على درجات التفتيش المستقبلية — فالدرجات السابقة لا تتغير أبدًا.`,
      };
    }
    default:
      return null;
  }
}

export { daysSince };

// ── Tab-level summaries: each tab of a tabbed page gets its own paragraph ──
function buildTabSummary(page, d, tr) {
  const { boxes, inspections, violations, displacements, inventory, complaints, cashDiscrepancies, disposalRequests, auditLog, inspectors, criteria, passMark } = d;
  const zn = (id) => zoneName(id);
  const ins = inspectors || [];

  switch (page) {
    // ── Safekeeping ──────────────────────────────────────────────────────
    case 'safekeeping-custody': {
      const aw = inventory.filter((i) => i.custodyStatus === 'awaiting-instruction');
      const value = aw.reduce((sum, i) => sum + i.value, 0);
      const oldest = aw.length ? Math.max(...aw.map((i) => daysSince(i.dateReceived))) : 0;
      const over = aw.filter((i) => daysSince(i.dateReceived) > 15).length;
      const top = topKey(aw, (i) => i.facility);
      return {
        en: `${n(aw.length)} items are waiting for a management instruction, worth AED ${n(value)}; ${n(over)} have waited more than 15 days and the oldest ${oldest} days.${top ? ` ${top.key} holds the most (${top.count}).` : ''} Open the oldest record first to review its chain of custody, then raise a release, disposal or demolition request so it moves into the approval queue instead of ageing in storage.`,
        ar: `يوجد ${n(aw.length)} عنصرًا بانتظار تعليمات الإدارة بقيمة ${n(value)} درهم؛ ${n(over)} منها انتظرت أكثر من 15 يومًا وأقدمها ${oldest} يومًا.${top ? ` وتحتفظ ${tr(top.key)} بالعدد الأكبر (${top.count}).` : ''} افتح أقدم سجل أولًا لمراجعة سلسلة العهدة، ثم ارفع طلب إفراج أو إتلاف أو هدم ليدخل قائمة الاعتماد بدل أن يتقادم في التخزين.`,
      };
    }
    case 'safekeeping-facilities': {
      const byF = {};
      inventory.forEach((i) => { const f = byF[i.facility] || (byF[i.facility] = { n: 0, v: 0, bad: 0 }); f.n += 1; f.v += i.value; if (i.condition === 'Damaged') f.bad += 1; });
      const rows = Object.entries(byF).sort((a, b) => b[1].n - a[1].n);
      const busiest = rows[0];
      const damaged = rows.reduce((sum, r) => sum + r[1].bad, 0);
      return {
        en: `Custody is spread over ${rows.length} facilities holding ${n(inventory.length)} items in total.${busiest ? ` ${busiest[0]} carries the heaviest load (${busiest[1].n} items, AED ${n(busiest[1].v)}).` : ''} ${damaged} items are in damaged condition across all sites. Compare each facility's load and condition mix, and when one runs hot route new intakes to a quieter site and schedule a disposition review for its damaged or long-held items.`,
        ar: `تتوزع العهدة على ${rows.length} منشآت تضم ${n(inventory.length)} عنصرًا.${busiest ? ` وتحمل ${tr(busiest[0])} أكبر حمل (${busiest[1].n} عنصرًا، ${n(busiest[1].v)} درهم).` : ''} يوجد ${damaged} عنصرًا بحالة تالفة عبر جميع المواقع. قارن حمل كل منشأة وتوزيع حالة عناصرها، وعندما ترتفع أحمال إحداها وجّه الاستلامات الجديدة إلى موقع أقل ازدحامًا وحدد مراجعة تصرف لعناصرها التالفة أو طويلة الاحتجاز.`,
      };
    }
    case 'safekeeping-inventory': {
      const c = (st) => inventory.filter((i) => i.custodyStatus === st).length;
      const cat = topKey(inventory, (i) => i.contentCategory);
      const cashLike = inventory.filter((i) => i.valueLedger).length;
      const mismatch = inventory.filter((i) => i.discrepancyStatus === 'under-review' || i.discrepancyStatus === 'discrepancy-confirmed').length;
      return {
        en: `The inventory lists ${n(inventory.length)} records: ${c('stored')} stored, ${c('awaiting-instruction')} awaiting instruction, ${c('released')} released and ${c('disposed')} disposed.${cat ? ` ${cat.key} is the most common content type (${cat.count}).` : ''} ${cashLike} cash or mixed-collection items carry a value ledger and ${mismatch} of them show a reconciliation issue. Filter by custody status to isolate what is still in your hands, and open a record to trace who handled it at every step.`,
        ar: `يسرد المخزون ${n(inventory.length)} سجلًا: ${c('stored')} محفوظًا و${c('awaiting-instruction')} بانتظار التعليمات و${c('released')} مُفرَجًا عنه و${c('disposed')} مُتلَفًا.${cat ? ` ونوع المحتوى الأكثر شيوعًا هو ${tr(cat.key)} (${cat.count}).` : ''} يحمل ${cashLike} عنصرًا نقديًا أو مختلطًا سجل قيمة، ويظهر في ${mismatch} منها إشكال مطابقة. صفِّ حسب حالة العهدة لعزل ما لا يزال بعهدتك، وافتح سجلًا لتتبع من تعامل معه في كل خطوة.`,
      };
    }
    case 'safekeeping-disposal': {
      const c = (st) => disposalRequests.filter((r) => r.status === st).length;
      const pend = disposalRequests.filter((r) => r.status === 'pending');
      const oldest = pend.length ? Math.max(...pend.map((r) => daysSince(r.requestedAt))) : 0;
      return {
        en: `${c('pending')} disposal, demolition or release requests are waiting for a decision${pend.length ? ` (the oldest for ${oldest} days)` : ''}, ${c('approved')} are approved but not yet executed, ${c('rejected')} were rejected and ${c('executed')} have been carried out. Nothing leaves custody without an approved instruction and the approver must differ from the requester. Decide the oldest pending requests first, then have the Logistics Coordinator execute the approved ones so custody closes cleanly in the audit trail.`,
        ar: `يوجد ${c('pending')} طلب إتلاف أو هدم أو إفراج بانتظار قرار${pend.length ? ` (أقدمها منذ ${oldest} يومًا)` : ''}، و${c('approved')} معتمدة ولم تُنفَّذ بعد، و${c('rejected')} مرفوضة، و${c('executed')} نُفِّذت. لا يخرج شيء من العهدة دون تعليمات معتمدة، ويجب أن يختلف المعتمِد عن مقدّم الطلب. اتخذ قرارًا بشأن أقدم الطلبات المعلقة أولًا، ثم اطلب من منسق اللوجستيات تنفيذ المعتمد منها لتُغلق العهدة بشكل سليم في مسار التدقيق.`,
      };
    }
    case 'safekeeping-reconciliation': {
      const open = cashDiscrepancies.filter((x) => x.status !== 'closed');
      const variance = open.reduce((sum, x) => sum + Math.abs(x.variance), 0);
      const admin = open.filter((x) => x.requiresAdminSignoff).length;
      const mis = cashDiscrepancies.filter((x) => x.resolutionType === 'misappropriation').length;
      const big = [...open].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))[0];
      return {
        en: `${cashDiscrepancies.length} cash discrepancy cases exist and ${open.length} are still open with AED ${n(variance)} in dispute${big ? `; the largest is ${big.id} on ${big.boxId} (AED ${n(Math.abs(big.variance))})` : ''}. ${admin} open case${admin === 1 ? ' needs' : 's need'} Administrator sign-off and ${mis} ${mis === 1 ? 'has' : 'have'} been confirmed as misappropriation. Work each case in order — verify with a recount, open an investigation, then resolve as explained, written off or misappropriation — and note that high-value and misappropriation cases can only be closed by an Administrator.`,
        ar: `توجد ${cashDiscrepancies.length} حالة فرق نقدي، منها ${open.length} لا تزال مفتوحة بقيمة ${n(variance)} درهم محل نزاع${big ? `؛ وأكبرها ${big.id} على ${big.boxId} (${n(Math.abs(big.variance))} درهم)` : ''}. ${admin} من الحالات المفتوحة تتطلب اعتماد مسؤول النظام و${mis} ثبت أنها اختلاس. عالج كل حالة بالترتيب — تحقق بإعادة العدّ، افتح تحقيقًا، ثم حلّها كمبرَّرة أو مشطوبة أو اختلاس — مع العلم أن الحالات عالية القيمة وحالات الاختلاس لا يغلقها إلا مسؤول النظام.`,
      };
    }

    // ── Inspections ──────────────────────────────────────────────────────
    case 'inspections-planning': {
      const queue = inspections.filter((i) => ['pending', 'overdue', 'escalated'].includes(i.status));
      const overdue = queue.filter((i) => i.status === 'overdue').length;
      const esc = queue.filter((i) => i.status === 'escalated').length;
      const week = queue.filter((i) => i.status === 'pending' && new Date(i.scheduledDate).getTime() - Date.now() < 7 * 86400000).length;
      const free = ins.filter((i) => i.availability === 'Available').length;
      return {
        en: `The planning queue holds ${n(queue.length)} inspections: ${n(overdue)} overdue, ${n(esc)} escalated and ${n(week)} more due within a week, with ${free} inspector${free === 1 ? '' : 's'} free to take work. Start with the escalated and overdue cases, reassign them to available inspectors close to the zone, and create tasks for zones with no inspection scheduled so the queue never falls behind the field capacity.`,
        ar: `تضم قائمة التخطيط ${n(queue.length)} عملية تفتيش: ${n(overdue)} متأخرة و${n(esc)} مصعّدة و${n(week)} أخرى مستحقة خلال أسبوع، مع ${free} مفتشين متاحين لاستلام العمل. ابدأ بالحالات المصعّدة والمتأخرة، وأعد تكليفها إلى المفتشين المتاحين القريبين من المنطقة، وأنشئ مهامًا للمناطق التي لا يوجد فيها تفتيش مجدول حتى لا تتخلف القائمة عن الطاقة الميدانية.`,
      };
    }
    case 'inspections-teams': {
      const load = {};
      inspections.filter((i) => i.status !== 'completed').forEach((i) => { load[i.inspectorId] = (load[i.inspectorId] || 0) + 1; });
      const ranked = ins.map((x) => ({ x, n: load[x.id] || 0 })).sort((a, b) => b.n - a.n);
      const hi = ranked[0]; const lo = [...ranked].reverse().find((r) => r.x.availability === 'Available') || ranked[ranked.length - 1];
      const c = (a) => ins.filter((i) => i.availability === a).length;
      return {
        en: `${ins.length} inspectors are deployed: ${c('On Field')} on the field, ${c('Available')} available and ${c('Off Duty')} off duty.${hi ? ` ${hi.x.name} carries the heaviest open caseload (${hi.n})` : ''}${lo && hi && lo.x.id !== hi.x.id ? ` while ${lo.x.name} has the most spare capacity (${lo.n})` : ''}. Rebalance from the busiest inspector to available ones in the same zone, and keep at least one inspector free per region so urgent complaints can be answered the same day.`,
        ar: `يوجد ${ins.length} مفتشين منتشرين: ${c('On Field')} في الميدان و${c('Available')} متاحون و${c('Off Duty')} خارج الدوام.${hi ? ` ويحمل ${tr(hi.x.name)} أكبر عبء مفتوح (${hi.n})` : ''}${lo && hi && lo.x.id !== hi.x.id ? ` بينما لدى ${tr(lo.x.name)} أكبر طاقة فائضة (${lo.n})` : ''}. أعد التوازن من أكثر المفتشين انشغالًا إلى المتاحين في المنطقة نفسها، وأبقِ مفتشًا واحدًا على الأقل متاحًا في كل إقليم لتتم الاستجابة للشكاوى العاجلة في اليوم نفسه.`,
      };
    }
    case 'inspections-history': {
      const done = inspections.filter((i) => i.status === 'completed');
      const passN = done.filter((i) => i.complianceResult === 'pass').length;
      const recent = done.filter((i) => daysSince(i.scheduledDate) <= 30).length;
      const evid = done.reduce((sum, i) => sum + (i.evidence || []).length, 0);
      const noEvid = done.filter((i) => !(i.evidence || []).length).length;
      return {
        en: `${n(done.length)} inspections have been completed (${recent} in the last 30 days): ${n(passN)} passed (${pct(passN, done.length)}%) and ${n(done.length - passN)} failed, with ${n(evid)} evidence items attached and ${n(noEvid)} inspections carrying none. Review failed inspections for follow-up violations, and chase the ones without evidence — a result without a photo, time and inspector identity is hard to defend at audit.`,
        ar: `اكتملت ${n(done.length)} عملية تفتيش (${recent} منها خلال آخر 30 يومًا): نجح ${n(passN)} (${pct(passN, done.length)}%) وأخفق ${n(done.length - passN)}، مع ${n(evid)} دليلًا مرفقًا و${n(noEvid)} عملية بلا أي دليل. راجع التفتيشات المخفقة لمتابعة المخالفات الناتجة، وتابع التي بلا أدلة — فالنتيجة دون صورة ووقت وهوية المفتش يصعب الدفاع عنها عند التدقيق.`,
      };
    }

    // ── Enforcement ──────────────────────────────────────────────────────
    case 'compliance-monitoring': {
      const total = boxes.length;
      const rate = pct(boxes.filter((b) => b.status === 'compliant').length, total);
      const nc = boxes.filter((b) => b.status === 'non-compliant').length;
      const open = violations.filter((v) => v.status !== 'resolved');
      const crit = open.filter((v) => v.severity === 'critical').length;
      const cat = topKey(open, (v) => v.category);
      return {
        en: `Compliance is ${rate}% against the 95% target (${Math.round((95 - rate) * 10) / 10} points to close) with ${n(nc)} non-compliant boxes and ${n(open.length)} open violations, ${crit} of them critical.${cat ? ` “${cat.key}” drives the most open cases (${cat.count}).` : ''} Read the gauge and trend for direction, use the severity and category charts to see what is driving the gap, and move to the Violations tab to act on the critical cases first.`,
        ar: `الامتثال ${rate}% مقابل هدف 95% (يلزم سدّ ${Math.round((95 - rate) * 10) / 10} نقطة) مع ${n(nc)} صندوقًا غير ملتزم و${n(open.length)} مخالفة مفتوحة، منها ${crit} حرجة.${cat ? ` وتقود «${tr(cat.key)}» أكبر عدد من الحالات المفتوحة (${cat.count}).` : ''} اقرأ المؤشر والاتجاه لمعرفة الوجهة، واستخدم مخططات الخطورة والفئة لمعرفة ما يقود الفجوة، ثم انتقل إلى تبويب المخالفات للتعامل مع الحالات الحرجة أولًا.`,
      };
    }
    case 'compliance-violations': {
      const open = violations.filter((v) => v.status !== 'resolved');
      const oldest = open.length ? Math.max(...open.map((v) => daysSince(v.dateIdentified))) : 0;
      const c = (st) => violations.filter((v) => v.status === st).length;
      const crit = open.filter((v) => v.severity === 'critical').length;
      return {
        en: `The register holds ${n(violations.length)} violations: ${n(c('open'))} open, ${n(c('under-review'))} under review and ${n(c('resolved'))} resolved. ${crit} unresolved cases are critical and the oldest has been open ${oldest} days. Filter by severity and zone to isolate the worst, open a record to see the box, organization and evidence behind it, and move each case forward — review, confirm, approve removal — rather than letting it sit open.`,
        ar: `يضم السجل ${n(violations.length)} مخالفة: ${n(c('open'))} مفتوحة و${n(c('under-review'))} قيد المراجعة و${n(c('resolved'))} محلولة. منها ${crit} حالة حرجة غير محلولة وأقدمها مفتوحة منذ ${oldest} يومًا. صفِّ حسب الخطورة والمنطقة لعزل الأسوأ، وافتح سجلًا لرؤية الصندوق والمؤسسة والأدلة وراءه، وحرّك كل حالة إلى الأمام — مراجعة، تأكيد، اعتماد الإزالة — بدل تركها مفتوحة.`,
      };
    }
    case 'compliance-actions': {
      const stale = violations.filter((v) => v.status === 'open' && daysSince(v.dateIdentified) > 30).length;
      const ready = violations.filter((v) => v.status === 'under-review').length;
      const removal = boxes.filter((b) => b.status === 'pending-displacement').length;
      const pendReq = disposalRequests.filter((r) => r.status === 'pending').length;
      return {
        en: `${n(stale)} open violations have gone more than 30 days without action, ${n(ready)} are under review and ready for a decision, ${n(removal)} boxes are approved for removal and waiting for a team and ${pendReq} disposal request${pendReq === 1 ? ' is' : 's are'} awaiting approval. Corrective action is only real when it closes a record: decide the reviewed cases, assign removal for confirmed non-compliant boxes, and clear the stale cases before they turn into escalations.`,
        ar: `${n(stale)} مخالفة مفتوحة مرّ عليها أكثر من 30 يومًا دون إجراء، و${n(ready)} قيد المراجعة وجاهزة للقرار، و${n(removal)} صندوقًا معتمدًا للإزالة بانتظار فريق، و${pendReq} طلب إتلاف بانتظار الاعتماد. لا يكون الإجراء التصحيحي حقيقيًا إلا عندما يغلق سجلًا: اتخذ قرارًا بشأن الحالات المراجَعة، وكلّف الإزالة للصناديق غير الملتزمة المؤكدة، وأغلق الحالات المتقادمة قبل أن تتحول إلى تصعيدات.`,
      };
    }

    // ── Logistics ────────────────────────────────────────────────────────
    case 'displacement-removal': {
      const c = (st) => displacements.filter((x) => x.status === st).length;
      const urgent = displacements.filter((x) => x.status === 'pending' && x.priority === 'urgent').length;
      const rec = displacements.filter((x) => x.status === 'completed' && daysSince(x.scheduledDate) <= 30).length;
      return {
        en: `${n(displacements.length)} removal operations are on record: ${c('pending')} pending (${urgent} urgent), ${c('assigned')} assigned, ${c('in-transit')} in transit and ${c('completed')} completed, ${rec} of them in the last 30 days. Assign the urgent pending removals first, follow each operation through collection, transport and facility intake, and watch that every completed removal produces a custody record so no box disappears between pickup and storage.`,
        ar: `توجد ${n(displacements.length)} عملية إزالة مسجلة: ${c('pending')} معلقة (${urgent} عاجلة) و${c('assigned')} مكلّفة و${c('in-transit')} قيد النقل و${c('completed')} مكتملة، منها ${rec} خلال آخر 30 يومًا. كلّف عمليات الإزالة العاجلة المعلقة أولًا، وتابع كل عملية عبر الاستلام والنقل وقبول المنشأة، وتأكد أن كل إزالة مكتملة تنتج سجل عهدة حتى لا يختفي صندوق بين الاستلام والتخزين.`,
      };
    }
    case 'displacement-transport': {
      const road = displacements.filter((x) => x.status === 'in-transit');
      const asg = displacements.filter((x) => x.status === 'assigned').length;
      const vehicles = new Set(road.map((x) => x.vehicle)).size;
      const dest = topKey(road, (x) => x.destinationFacility);
      return {
        en: `${road.length} box${road.length === 1 ? ' is' : 'es are'} on the road now using ${vehicles} vehicle${vehicles === 1 ? '' : 's'}, with ${asg} more assigned and about to move.${dest ? ` Most are heading to ${dest.key} (${dest.count}).` : ''} Use the progress bars to spot shipments that have stalled, confirm arrival at the facility as soon as a box lands so intake and inventory are created, and rebalance destinations if one facility is taking a disproportionate share.`,
        ar: `يوجد ${road.length} صندوقًا في الطريق الآن باستخدام ${vehicles} مركبات، و${asg} أخرى مكلّفة وعلى وشك الانطلاق.${dest ? ` ومعظمها متجه إلى ${tr(dest.key)} (${dest.count}).` : ''} استخدم أشرطة التقدم لرصد الشحنات المتوقفة، وأكّد الوصول إلى المنشأة فور وصول الصندوق لإنشاء الاستلام والمخزون، وأعد توزيع الوجهات إذا كانت منشأة واحدة تستقبل حصة غير متناسبة.`,
      };
    }
    case 'displacement-assignments': {
      const active = displacements.filter((x) => x.status !== 'completed');
      const teams = {};
      active.forEach((x) => { teams[x.assignedTeam] = (teams[x.assignedTeam] || 0) + 1; });
      const ranked = Object.entries(teams).sort((a, b) => b[1] - a[1]);
      const vehicles = new Set(active.map((x) => x.vehicle)).size;
      const unassigned = displacements.filter((x) => x.status === 'pending').length;
      return {
        en: `${active.length} active jobs are spread across ${ranked.length} logistics teams and ${vehicles} vehicles.${ranked[0] ? ` ${ranked[0][0]} is the busiest (${ranked[0][1]} jobs)` : ''}${ranked.length > 1 ? ` and ${ranked[ranked.length - 1][0]} the lightest (${ranked[ranked.length - 1][1]})` : ''}, and ${unassigned} removal${unassigned === 1 ? ' is' : 's are'} still waiting for a team. Move work from the busiest team to the lightest, keep vehicle allocation matched to team load, and assign the waiting removals before their scheduled date.`,
        ar: `توجد ${active.length} مهمة نشطة موزعة على ${ranked.length} فرق لوجستية و${vehicles} مركبات.${ranked[0] ? ` أكثرها انشغالًا ${tr(ranked[0][0])} (${ranked[0][1]} مهمة)` : ''}${ranked.length > 1 ? ` وأخفّها ${tr(ranked[ranked.length - 1][0])} (${ranked[ranked.length - 1][1]})` : ''}، ولا تزال ${unassigned} عملية إزالة بانتظار فريق. انقل العمل من أكثر الفرق انشغالًا إلى أخفّها، وطابق تخصيص المركبات مع حمل الفرق، وكلّف عمليات الإزالة المنتظرة قبل موعدها المجدول.`,
      };
    }

    // ── Complaints ───────────────────────────────────────────────────────
    case 'complaints-public': {
      const pub = complaints.filter((x) => x.source === 'Public Complaint');
      const open = pub.filter((x) => x.status !== 'resolved');
      const hi = open.filter((x) => x.severity === 'critical' || x.severity === 'high').length;
      const oldest = open.length ? Math.max(...open.map((x) => daysSince(x.dateReceived))) : 0;
      const zone = topKey(open, (x) => x.zoneId);
      return {
        en: `${n(pub.length)} public complaints are on file: ${n(open.length)} still open (${hi} critical or high severity) and ${pub.length - open.length} resolved; the oldest open one is ${oldest} days old.${zone ? ` ${zn(zone.key)} generates the most (${zone.count}).` : ''} Follow each complaint through location identified, box matched and inspection assigned; repeated complaints about one place are a signal to inspect proactively rather than case by case.`,
        ar: `يوجد ${n(pub.length)} شكوى من الجمهور: ${n(open.length)} لا تزال مفتوحة (${hi} حرجة أو عالية الخطورة) و${pub.length - open.length} محلولة؛ وأقدم شكوى مفتوحة عمرها ${oldest} يومًا.${zone ? ` وتولّد ${tr(zn(zone.key))} العدد الأكبر (${zone.count}).` : ''} تابع كل شكوى عبر تحديد الموقع ومطابقة الصندوق وتكليف التفتيش؛ وتكرار الشكاوى عن مكان واحد إشارة إلى ضرورة التفتيش الاستباقي بدل التعامل حالة بحالة.`,
      };
    }
    case 'complaints-dmt': {
      const dmt = complaints.filter((x) => x.source === 'DMT Alert');
      const open = dmt.filter((x) => x.status !== 'resolved');
      const linkedI = dmt.filter((x) => x.linkedInspectionId).length;
      const linkedV = dmt.filter((x) => x.linkedViolationId).length;
      const unlinked = open.filter((x) => !x.linkedInspectionId && !x.linkedViolationId).length;
      return {
        en: `${n(dmt.length)} DMT alerts are on file (simulated, not a live integration): ${n(open.length)} open, ${linkedI} already turned into an inspection and ${linkedV} into a violation, while ${unlinked} open alert${unlinked === 1 ? ' has' : 's have'} no follow-up yet. Open an alert to see its location and time, then create an inspection or violation from it so the resulting records stay linked to the alert and show up in the box's own history.`,
        ar: `يوجد ${n(dmt.length)} تنبيهًا من دائرة البلديات (محاكاة وليس تكاملًا حيًا): ${n(open.length)} مفتوحة، و${linkedI} تحولت إلى تفتيش و${linkedV} إلى مخالفة، بينما لا يوجد لـ${unlinked} تنبيهًا مفتوحًا أي متابعة بعد. افتح التنبيه لرؤية موقعه ووقته، ثم أنشئ منه تفتيشًا أو مخالفة لتبقى السجلات الناتجة مرتبطة بالتنبيه وتظهر في سجل الصندوق نفسه.`,
      };
    }
    case 'complaints-escalations': {
      const esc = complaints.filter((x) => (x.severity === 'critical' || x.severity === 'high') && x.status !== 'resolved');
      const oldest = esc.length ? Math.max(...esc.map((x) => daysSince(x.dateReceived))) : 0;
      const unassigned = esc.filter((x) => x.status === 'open').length;
      const zone = topKey(esc, (x) => x.zoneId);
      return {
        en: `${n(esc.length)} critical or high-severity cases are in the escalation queue, ${unassigned} of them not yet assigned and the oldest open for ${oldest} days.${zone ? ` ${zn(zone.key)} has the most (${zone.count}).` : ''} Anything older than three days needs a named owner today: assign the unassigned cases, dispatch an inspection where the box is known, and escalate to the Compliance & Inspections Division if a case is approaching its service limit.`,
        ar: `يوجد ${n(esc.length)} حالة حرجة أو عالية الخطورة في قائمة التصعيد، منها ${unassigned} لم تُكلَّف بعد وأقدمها مفتوحة منذ ${oldest} يومًا.${zone ? ` وتضم ${tr(zn(zone.key))} العدد الأكبر (${zone.count}).` : ''} أي حالة تجاوزت ثلاثة أيام تحتاج إلى مسؤول معيّن اليوم: كلّف الحالات غير المكلّفة، وأرسل تفتيشًا حيث يُعرف الصندوق، وصعّد إلى قسم الامتثال والتفتيش إذا اقتربت حالة من حد الخدمة.`,
      };
    }

    // ── Admin ────────────────────────────────────────────────────────────
    case 'admin-access': {
      const roles = Object.values(ROLES);
      return {
        en: `Access is governed by ${roles.length} simulated roles (${roles.map((r) => r.label).join(', ')}). Duties are separated by design: officers request, the Director approves, the Logistics Coordinator executes, and only an Administrator can sign off misappropriation findings or close high-value cash cases. Review the role matrix before granting access, keep the Auditor read-only, and check the integration health panel whenever data looks stale.`,
        ar: `تُدار الصلاحيات عبر ${roles.length} أدوار محاكاة (${roles.map((r) => tr(r.label)).join('، ')}). فصل المهام مقصود: الموظفون يطلبون، والمدير يعتمد، ومنسق اللوجستيات ينفّذ، ولا يعتمد نتائج الاختلاس أو يغلق حالات النقد عالية القيمة إلا مسؤول النظام. راجع مصفوفة الأدوار قبل منح الصلاحيات، وأبقِ المدقق للقراءة فقط، وافحص لوحة سلامة التكامل كلما بدت البيانات قديمة.`,
      };
    }
    case 'admin-audit': {
      const day = auditLog.filter((a) => Date.now() - new Date(a.timestamp).getTime() < 86400000).length;
      const src = topKey(auditLog, (a) => a.source);
      const usr = topKey(auditLog, (a) => a.user);
      return {
        en: `The audit log holds ${n(auditLog.length)} entries, ${n(day)} in the last 24 hours${src ? `, mostly from ${src.key}` : ''}${usr ? ` and most often by ${usr.key}` : ''}. Each entry records who acted, when, on which record and what changed. Filter by user, entity, action and date range to reconstruct any case end to end, open an entry to compare its before and after state, and export the filtered result when a review needs evidence.`,
        ar: `يضم سجل التدقيق ${n(auditLog.length)} إدخالًا، منها ${n(day)} خلال آخر 24 ساعة${src ? `، معظمها من ${tr(src.key)}` : ''}${usr ? ` وأكثرها بواسطة ${tr(usr.key)}` : ''}. يسجل كل إدخال من قام بالإجراء ومتى وعلى أي سجل وما الذي تغيّر. صفِّ حسب المستخدم والكيان والإجراء والفترة لإعادة بناء أي حالة من البداية إلى النهاية، وافتح إدخالًا لمقارنة حالته قبل التغيير وبعده، وصدّر النتيجة المصفّاة عندما تحتاج المراجعة إلى دليل.`,
      };
    }
    case 'admin-criteria': {
      const list = criteria || [];
      const active = list.filter((c) => c.active);
      const mandatory = active.filter((c) => c.mandatory).length;
      const weight = active.reduce((sum, c) => sum + c.weight, 0);
      return {
        en: `${active.length} of ${list.length} compliance criteria are active (${mandatory} mandatory) with a total weight of ${weight} and a pass mark of ${passMark}. An inspection fails if any mandatory criterion fails or the weighted score is below the pass mark. Change a weight or pass mark only after considering how many boxes it would flip; retiring a criterion never rewrites past scores, it only applies to inspections recorded from now on.`,
        ar: `${active.length} من ${list.length} معيار امتثال نشط (${mandatory} إلزامي) بوزن إجمالي ${weight} ودرجة نجاح ${passMark}. يخفق التفتيش إذا أخفق أي معيار إلزامي أو كانت الدرجة المرجّحة أقل من درجة النجاح. لا تغيّر وزنًا أو درجة نجاح إلا بعد تقدير عدد الصناديق التي سيقلب حالتها؛ وإيقاف معيار لا يعيد كتابة الدرجات السابقة بل يسري على التفتيشات المسجلة من الآن فصاعدًا.`,
      };
    }
    default:
      return null;
  }
}
