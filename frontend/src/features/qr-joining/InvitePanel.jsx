import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getShareOrigin } from '../../utils/shareOrigin.js';
export default function InvitePanel({ group }) {
  const [qr, setQr] = useState(''); const [copied, setCopied] = useState(false);
  const url = `${getShareOrigin()}/?join=${group.code}`;
  useEffect(() => { QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#111713', light: '#ffffff' } }).then(setQr); }, [url]);
  async function copy() { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return <div className="invite-panel"><div><div className="eyebrow">INVITE TEAMMATES</div><h3>Bring your team<br/>into the loop.</h3><p>Scan this code while connected to the same Wi-Fi or hotspot.</p><div className="invite-code"><span>GROUP CODE</span><strong>{group.code}</strong></div><button className="button button-secondary copy-button" onClick={copy}>{copied ? 'Copied invite link' : 'Copy invite link'} ↗</button></div><div className="qr-frame">{qr && <img src={qr} alt={`QR invite for ${group.name}`}/>}</div></div>;
}
