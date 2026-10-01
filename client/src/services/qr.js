import QRCode from 'qrcode';

/** The URL encoded in every box's QR code: opens that box's registry record. */
export function boxQrUrl(boxId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/registry?box=${encodeURIComponent(boxId)}`;
}

export function qrDataUrl(text, width = 220) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width, color: { dark: '#0d1826', light: '#ffffff' } });
}

/** Resolve whatever a scanner or a person typed (URL, box ID or QR code) to a box. */
export function findBoxFromScan(input, boxes) {
  const raw = (input || '').trim();
  if (!raw) return null;
  let candidate = raw;
  try {
    const url = new URL(raw);
    candidate = url.searchParams.get('box') || raw;
  } catch (e) { /* not a URL */ }
  const upper = candidate.toUpperCase();
  const idMatch = upper.match(/DCD-\d{5}/);
  const qrMatch = upper.match(/QR-\d{5}/);
  if (idMatch) return boxes.find((b) => b.id === idMatch[0]) || null;
  if (qrMatch) return boxes.find((b) => b.qrCode === qrMatch[0]) || null;
  return boxes.find((b) => b.id === upper || b.qrCode === upper) || null;
}
