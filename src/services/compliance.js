// Compliance criteria model — the checklist every inspection is scored against.
// SIMULATED DEMONSTRATION DATA: the criteria and weights below are illustrative
// defaults, editable by an administrator on the Admin > Compliance Criteria tab.

export const DEFAULT_CRITERIA = [
  { id: 'CRT-01', title: 'Valid QR identification label', description: 'A readable DCD QR label is fixed to the box and matches the registry record.', weight: 15, mandatory: true, active: true },
  { id: 'CRT-02', title: 'Current DCD placement approval', description: 'The organization holds an unexpired approval for this exact placement.', weight: 20, mandatory: true, active: true },
  { id: 'CRT-03', title: 'Ownership matches registry', description: 'The operating organization is the registered owner of the box.', weight: 15, mandatory: true, active: true },
  { id: 'CRT-04', title: 'Placed at the approved location', description: 'Coordinates and address match the approved placement.', weight: 15, mandatory: true, active: true },
  { id: 'CRT-05', title: 'Physical condition and structural integrity', description: 'No damage affecting collection integrity or public safety.', weight: 10, mandatory: false, active: true },
  { id: 'CRT-06', title: 'Licensing / campaign documentation on site', description: 'Supporting documents can be produced by the operator on request.', weight: 10, mandatory: false, active: true },
  { id: 'CRT-07', title: 'Safe, unobstructed placement', description: 'The box does not obstruct pedestrian access or emergency egress.', weight: 10, mandatory: false, active: true },
  { id: 'CRT-08', title: 'Collection within approved scope', description: 'Observed collection activity matches the approved campaign.', weight: 5, mandatory: false, active: true },
];

export const DEFAULT_PASS_MARK = 80;

/**
 * scoreChecklist — weighted score of one inspection's checklist.
 * Only criteria that were actually assessed on that inspection count, so adding
 * a criterion later never rewrites the score of historical inspections.
 * An inspection fails if any mandatory criterion fails or the score is below the pass mark.
 */
export function scoreChecklist(results, criteria, passMark = DEFAULT_PASS_MARK) {
  const assessed = criteria.filter((c) => c.active && results && (results[c.id] === 'pass' || results[c.id] === 'fail'));
  const totalWeight = assessed.reduce((s, c) => s + c.weight, 0);
  const passedWeight = assessed.filter((c) => results[c.id] === 'pass').reduce((s, c) => s + c.weight, 0);
  const score = totalWeight ? Math.round((passedWeight / totalWeight) * 100) : 0;
  const mandatoryFailed = assessed.filter((c) => c.mandatory && results[c.id] === 'fail');
  const passed = assessed.length > 0 && mandatoryFailed.length === 0 && score >= passMark;
  return {
    score, passed, result: passed ? 'pass' : 'fail', mandatoryFailed,
    assessedCount: assessed.length, passedCount: assessed.filter((c) => results[c.id] === 'pass').length,
  };
}

/** generateChecklist — a checklist consistent with a target pass/fail outcome (seed + simulation). */
export function generateChecklist(result, criteria, rand) {
  const active = criteria.filter((c) => c.active);
  const out = {};
  active.forEach((c) => { out[c.id] = 'pass'; });
  if (result === 'fail') {
    const mandatory = active.filter((c) => c.mandatory);
    const pool = mandatory.length ? mandatory : active;
    out[pool[Math.floor(rand() * pool.length)].id] = 'fail';
    active.forEach((c) => { if (rand() < 0.18) out[c.id] = 'fail'; });
  } else {
    const optional = active.filter((c) => !c.mandatory);
    if (optional.length && rand() < 0.35) out[optional[Math.floor(rand() * optional.length)].id] = 'fail';
  }
  return out;
}

/** Criteria a disposal / demolition / release request can be justified with. */
export const DISPOSAL_CRITERIA_BY_TYPE = {
  Demolition: ['Structurally damaged beyond repair', 'Serious public-safety hazard', 'Management or legal order'],
  Disposal: ['Unclaimed beyond 30 days after notice', 'Organization license revoked or expired', 'Repeat or serious violation', 'Management or legal order'],
  Release: ['Ownership verified', 'Violation remediated', 'Penalties settled', 'Approved release instruction'],
};
export const DISPOSAL_TYPES = Object.keys(DISPOSAL_CRITERIA_BY_TYPE);
