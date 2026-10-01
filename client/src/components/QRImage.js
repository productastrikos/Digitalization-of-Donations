import React, { useEffect, useState } from 'react';
import { qrDataUrl } from '../services/qr';

export default function QRImage({ value, size = 120, className = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    qrDataUrl(value, size * 2).then((url) => { if (alive) setSrc(url); }).catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [value, size]);
  return (
    <div className={className} style={{ width: size, height: size, background: '#fff', borderRadius: 4, padding: 2, flexShrink: 0 }}>
      {src ? <img src={src} alt={`QR code for ${value}`} width={size - 4} height={size - 4} style={{ display: 'block' }} /> : null}
    </div>
  );
}
