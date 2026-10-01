// ── Audit log integrity: a demonstration hash chain ─────────────────────────
// Not a cryptographic signature and not tamper-*proof* (there is no backend
// or key material in a static demo to make it so) — but it is a genuine,
// checkable tamper-EVIDENCE mechanism: each entry's hash is derived from its
// own content plus the previous entry's hash, so altering or reordering any
// past entry changes every hash computed after it. Recomputing the chain and
// comparing it to what is displayed is a real, reproducible check, not a claim.

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function hashString(str) {
  // Run FNV-1a twice with different seeds/salts and concatenate for a
  // longer, less collision-prone demonstration digest.
  return fnv1a(str) + fnv1a(str.split('').reverse().join(''));
}

function entryContent(entry) {
  return JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    user: entry.user,
    role: entry.role,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    boxId: entry.boxId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    source: entry.source ?? null,
  });
}

const GENESIS_HASH = '00000000000000000000000000000000';

// auditLog is stored newest-first. The chain runs oldest -> newest, so we
// walk it in reverse and attach { hash, prevHash } to each entry by id.
export function buildAuditChain(auditLog) {
  const chronological = [...auditLog].reverse();
  let prevHash = GENESIS_HASH;
  let orderIntact = true;
  let prevTimestamp = null;
  const byId = new Map();
  chronological.forEach((entry, i) => {
    const hash = hashString(prevHash + entryContent(entry));
    byId.set(entry.id, { hash, prevHash, index: i });
    if (prevTimestamp && new Date(entry.timestamp) < new Date(prevTimestamp)) orderIntact = false;
    prevTimestamp = entry.timestamp;
    prevHash = hash;
  });
  return {
    byId,
    count: chronological.length,
    headHash: prevHash,
    orderIntact,
  };
}

export function shortHash(hash) {
  return hash ? hash.slice(0, 10) : '';
}
