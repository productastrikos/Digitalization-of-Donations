import React, { useEffect, useState } from 'react';
import Drawer from './Drawer';
import QRImage from './QRImage';
import { boxQrUrl, qrDataUrl } from '../services/qr';
import { zoneName } from '../services/donationSeed';

const MAX_LABELS = 96;

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Printable A4 label sheet: one QR label per box, linking to its registry record. */
export default function QRLabelSheet({ open, onClose, boxes, title = 'QR label sheet' }) {
  const [busy, setBusy] = useState(false);
  const labelBoxes = boxes.slice(0, MAX_LABELS);

  useEffect(() => { if (!open) setBusy(false); }, [open]);

  async function printSheet() {
    setBusy(true);
    try {
      const urls = await Promise.all(labelBoxes.map((b) => qrDataUrl(boxQrUrl(b.id), 260)));
      const cells = labelBoxes.map((b, i) => `
        <div class="label">
          <img src="${urls[i]}" alt="" />
          <div class="meta">
            <div class="id">${escapeHtml(b.id)}</div>
            <div>${escapeHtml(b.qrCode)}</div>
            <div class="zone">${escapeHtml(zoneName(b.zoneId))}</div>
            <div class="brand">DCD Donation Control</div>
          </div>
        </div>`).join('');
      const w = window.open('', '_blank');
      if (!w) { setBusy(false); return; }
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #0d1826; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
          .label { display: flex; align-items: center; gap: 3mm; border: 1px dashed #94a3b8; padding: 3mm; break-inside: avoid; height: 34mm; box-sizing: border-box; }
          .label img { width: 26mm; height: 26mm; }
          .meta { font-size: 8pt; line-height: 1.35; min-width: 0; }
          .id { font-weight: 700; font-size: 11pt; }
          .zone { color: #475569; }
          .brand { margin-top: 1mm; font-size: 6.5pt; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
          .note { font-size: 7pt; color: #64748b; margin-top: 4mm; }
        </style></head><body>
        <div class="grid">${cells}</div>
        <div class="note">Simulated demonstration labels. Each QR opens the box record in the DCD registry (${escapeHtml(boxQrUrl('DCD-XXXXX'))}).</div>
        </body></html>`);
      w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 350);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle={`${labelBoxes.length} label${labelBoxes.length === 1 ? '' : 's'} on this sheet`} width={520}>
      <p className="text-[11.5px] mb-3" style={{ color: 'var(--app-text-muted)', lineHeight: 1.55 }}>
        Each label carries a QR code that opens the box's registry record, plus its Box ID, QR code and zone. Labels print three per row on A4.
        {boxes.length > MAX_LABELS && ` Showing the first ${MAX_LABELS} of ${boxes.length.toLocaleString()} filtered boxes; narrow the filter to print the rest.`}
      </p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {labelBoxes.slice(0, 6).map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-md p-2" style={{ background: 'var(--app-surface-soft)', border: '1px dashed var(--app-border)' }}>
            <QRImage value={boxQrUrl(b.id)} size={64} />
            <div className="min-w-0 text-[10.5px]">
              <div className="font-bold font-mono" style={{ color: 'var(--app-text)' }}>{b.id}</div>
              <div style={{ color: 'var(--app-text-faint)' }}>{b.qrCode}</div>
              <div className="truncate" style={{ color: 'var(--app-text-faint)' }}>{zoneName(b.zoneId)}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={printSheet} disabled={busy || labelBoxes.length === 0} className="app-control-btn w-full py-2 text-[12px] font-semibold" style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Preparing labels…' : `Print ${labelBoxes.length} label${labelBoxes.length === 1 ? '' : 's'}`}
      </button>
    </Drawer>
  );
}
