import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { api } from '../../services/api.js';
import { socket } from '../../services/socket.js';

const categories = ['Medical', 'Safety', 'Fire', 'Missing person', 'Other'];
const alertTime = alert => new Date(alert.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const updatedTime = alert => new Date(alert.updatedAt || alert.createdAt).getTime();

function mergeAlerts(current, incoming) {
  const byId = new Map(current.map(alert => [alert.id, alert]));
  for (const alert of incoming) {
    const previous = byId.get(alert.id);
    if (!previous || updatedTime(alert) >= updatedTime(previous)) byId.set(alert.id, alert);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function storedName() {
  try { return sessionStorage.getItem('groundlink-name') || `Guest ${Math.floor(10 + Math.random() * 89)}`; }
  catch { return 'Guest'; }
}

export default function EmergencySOSPanel({ group, onMembers }) {
  const name = useRef(storedName());
  const [alerts, setAlerts] = useState([]);
  const [category, setCategory] = useState('Medical');
  const [note, setNote] = useState('');
  const [zone, setZone] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [loading, setLoading] = useState(Boolean(group));
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  useEffect(() => {
    if (!group?.code) {
      setAlerts([]);
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    const receiveAlert = alert => {
      if (alert?.groupCode === group.code) setAlerts(current => mergeAlerts(current, [alert]));
    };
    const joinGroup = () => socket.emit('group:join', { code: group.code, name: name.current }, result => {
      if (!mounted) return;
      if (result?.ok) {
        name.current = result.member.name;
        try { sessionStorage.setItem('groundlink-name', result.member.name); } catch { /* Session storage is optional. */ }
        setError('');
      } else setError(result?.error || 'Unable to join this group');
    });
    const onConnect = () => { setConnected(true); joinGroup(); };
    const onDisconnect = () => setConnected(false);
    const onMemberUpdate = list => onMembers?.(list.length);

    setAlerts([]);
    setLoading(true);
    setError('');
    socket.on('sos:created', receiveAlert);
    socket.on('sos:updated', receiveAlert);
    socket.on('members:update', onMemberUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) {
      setConnected(true);
      joinGroup();
    } else socket.connect();

    api(`/emergency-sos/${encodeURIComponent(group.code)}`)
      .then(result => { if (mounted) setAlerts(current => mergeAlerts(current, result)); })
      .catch(requestError => { if (mounted) setError(requestError.message || 'Unable to load SOS alerts'); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => {
      mounted = false;
      socket.off('sos:created', receiveAlert);
      socket.off('sos:updated', receiveAlert);
      socket.off('members:update', onMemberUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [group?.code, onMembers]);

  const activeAlerts = useMemo(() => alerts.filter(alert => alert.status === 'active'), [alerts]);
  const resolvedAlerts = useMemo(() => alerts.filter(alert => alert.status === 'resolved'), [alerts]);

  function requestSos(event) {
    event.preventDefault();
    setError('');
    setConfirming(true);
  }

  function sendSos() {
    if (!socket.connected) { setError('Reconnect to the group network before sending an SOS'); return; }
    setPendingAction('create');
    socket.emit('sos:create', { category, note, zone }, result => {
      setPendingAction('');
      if (!result?.ok) { setError(result?.error || 'SOS alert could not be sent'); return; }
      setAlerts(current => mergeAlerts(current, [result.alert]));
      setNote('');
      setZone('');
      setConfirming(false);
      setError('');
    });
  }

  function updateAlert(action, alertId) {
    if (!socket.connected) { setError('Reconnect to the group network before updating an SOS'); return; }
    setError('');
    setPendingAction(`${alertId}:${action}`);
    socket.emit(`sos:${action}`, { alertId }, result => {
      setPendingAction('');
      if (!result?.ok) { setError(result?.error || 'SOS alert could not be updated'); return; }
      setAlerts(current => mergeAlerts(current, [result.alert]));
    });
  }

  if (!group) return <section className="sos-panel sos-gate"><div className="sos-eyebrow">GROUP REQUIRED</div><h2>Join or create a group to use Emergency SOS</h2><p>SOS alerts are shared with members of your active group on the local network.</p></section>;

  return <section className="sos-panel" aria-labelledby="sos-title">
    <div className="sos-panel-heading">
      <div><div className="sos-eyebrow">URGENT GROUP RESPONSE</div><h2 id="sos-title">Emergency SOS</h2><p>Alerts for <strong>{group.name}</strong></p></div>
      <div className={`sos-connection ${connected ? 'is-online' : ''}`}><span/>{connected ? 'Group connected' : 'Reconnecting'}</div>
    </div>

    <form className="sos-trigger-form" onSubmit={requestSos}>
      <div className="sos-form-heading"><div><h3>Send an SOS alert</h3><p>Group members will receive this alert immediately.</p></div><span className="sos-required">CONFIRMATION REQUIRED</span></div>
      <div className="sos-fields">
        <label> CATEGORY
          <select value={category} onChange={event => setCategory(event.target.value)}>
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label> ZONE <span>(optional)</span>
          <input value={zone} onChange={event => setZone(event.target.value)} placeholder="e.g. North entrance" maxLength={80}/>
        </label>
        <label className="sos-note-field"> SHORT NOTE <span>(optional)</span>
          <input value={note} onChange={event => setNote(event.target.value)} placeholder="Briefly describe what help is needed" maxLength={180}/>
        </label>
      </div>
      <div className="sos-trigger-footer"><span>Only send this for an urgent situation.</span><button className="sos-trigger-button" type="submit">Review SOS</button></div>
    </form>

    {error && <div className="sos-error" role="alert">{error}</div>}

    <div className="sos-alerts-section">
      <div className="sos-list-heading"><div><div className="sos-eyebrow">LIVE RESPONSE</div><h3>Active alerts <span>{activeAlerts.length}</span></h3></div></div>
      {loading && <p className="sos-empty">Loading group alerts…</p>}
      {!loading && activeAlerts.length === 0 && <p className="sos-empty">No active SOS alerts for this group.</p>}
      <div className="sos-alert-list">
        {activeAlerts.map(alert => {
          const acknowledgedByMe = (alert.acknowledgements || []).some(item => item.name === name.current);
          const acknowledging = pendingAction === `${alert.id}:acknowledge`;
          const resolving = pendingAction === `${alert.id}:resolve`;
          return <article className="sos-alert-card is-active" key={alert.id}>
            <div className="sos-alert-top"><div><span className="sos-status active">ACTIVE</span><strong>{alert.category}</strong></div><time>{alertTime(alert)}</time></div>
            <p className="sos-alert-reporter">Triggered by <strong>{alert.createdBy}</strong>{alert.zone && <> · <strong>{alert.zone}</strong></>}</p>
            {alert.note && <p className="sos-alert-note">{alert.note}</p>}
            {(alert.acknowledgements || []).length > 0 && <p className="sos-acknowledgements">Acknowledged by {(alert.acknowledgements || []).map(item => item.name).join(', ')}</p>}
            <div className="sos-alert-actions">
              <button type="button" className="sos-ack-button" onClick={() => updateAlert('acknowledge', alert.id)} disabled={!connected || acknowledgedByMe || Boolean(pendingAction)}>{acknowledging ? 'Acknowledging…' : acknowledgedByMe ? 'Acknowledged' : 'Acknowledge'}</button>
              <button type="button" className="sos-resolve-button" onClick={() => updateAlert('resolve', alert.id)} disabled={!connected || Boolean(pendingAction)}>{resolving ? 'Resolving…' : 'Resolve'}</button>
            </div>
          </article>;
        })}
      </div>
    </div>

    <div className="sos-alerts-section resolved-section">
      <div className="sos-list-heading"><div><div className="sos-eyebrow">COMPLETED</div><h3>Resolved alerts <span>{resolvedAlerts.length}</span></h3></div></div>
      {resolvedAlerts.length === 0 && <p className="sos-empty">Resolved alerts will appear here.</p>}
      <div className="sos-alert-list">
        {resolvedAlerts.map(alert => <article className="sos-alert-card is-resolved" key={alert.id}>
          <div className="sos-alert-top"><div><span className="sos-status resolved">RESOLVED</span><strong>{alert.category}</strong></div><time>{alertTime(alert)}</time></div>
          <p className="sos-alert-reporter">Triggered by <strong>{alert.createdBy}</strong>{alert.zone && <> · <strong>{alert.zone}</strong></>}</p>
          {alert.note && <p className="sos-alert-note">{alert.note}</p>}
          <p className="sos-acknowledgements">Resolved by {alert.resolvedBy || 'Group member'}{alert.resolvedAt && ` · ${new Date(alert.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</p>
        </article>)}
      </div>
    </div>

    {confirming && <Modal title="Confirm emergency SOS" onClose={() => setConfirming(false)}>
      <p className="modal-copy">This will notify everyone in <strong>{group.name}</strong>. Send this alert only if urgent help is needed.</p>
      <div className="sos-confirm-summary"><strong>{category}</strong>{zone && <span>Zone: {zone}</span>}{note && <span>{note}</span>}</div>
      <div className="sos-confirm-actions"><button className="button button-secondary" type="button" onClick={() => setConfirming(false)}>Cancel</button><button className="sos-trigger-button" type="button" onClick={sendSos} disabled={pendingAction === 'create' || !connected}>{pendingAction === 'create' ? 'Sending…' : 'Send SOS now'}</button></div>
    </Modal>}
  </section>;
}
