import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { api } from '../../services/api.js';
import { cacheGroup, getCachedGroupByCode } from '../../services/localDb.js';

export default function GroupActions({ onJoined }) {
  const [mode, setMode] = useState(''); const [name, setName] = useState(''); const [code, setCode] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const group = mode === 'create' ? await api('/groups', { method: 'POST', body: JSON.stringify({ name }) }) : await api(`/groups/${encodeURIComponent(code)}/join`, { method: 'POST', body: JSON.stringify({}) });
      onJoined(group); setMode(''); setName(''); setCode('');
    } catch (e) {
      if (mode === 'join') {
        const savedGroup = await getCachedGroupByCode(code).catch(() => null);
        if (savedGroup) { onJoined(savedGroup); setMode(''); setCode(''); }
        else setError(e.message || 'Group is unavailable offline.');
      } else {
        const localId = globalThis.crypto?.randomUUID?.() || `local-${Date.now()}`;
        const localCode = `LOCAL-${localId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`;
        const localGroup = { id: localId, code: localCode, name: name.trim(), localOnly: true };
        try {
          await cacheGroup(localGroup);
          onJoined(localGroup); setMode(''); setName('');
        } catch { setError('Could not save a local channel in this browser.'); }
      }
    } finally { setBusy(false); }
  }
  return <><div className="action-row"><button className="button button-primary" onClick={() => setMode('create')}>＋ Create a group</button><button className="button button-secondary" onClick={() => setMode('join')}>Join with code <span>↗</span></button></div>{mode && <Modal title={mode === 'create' ? 'Create a group' : 'Join a group'} onClose={() => setMode('')}><p className="modal-copy">{mode === 'create' ? 'Start a private space for nearby coordination.' : 'Enter the invite code shared by your group coordinator.'}</p><form onSubmit={submit}><label>{mode === 'create' ? 'GROUP NAME' : 'INVITE CODE'}</label><input autoFocus value={mode === 'create' ? name : code} onChange={e => mode === 'create' ? setName(e.target.value) : setCode(e.target.value.toUpperCase())} placeholder={mode === 'create' ? 'e.g. North Field Team' : 'e.g. A1B2C3D4'} required maxLength={mode === 'create' ? 60 : 16}/>{error && <div className="form-error">{error}</div>}<button className="button button-primary modal-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'create' ? 'Create group' : 'Join group'}</button></form></Modal>}</>;
}
