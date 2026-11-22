import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../services/socket.js';

const SIZE = 560;
const CENTER = SIZE / 2;
const ALERTS_PREFIX = 'groundlink-sos:alerts:';
const CHANNEL_NAME = 'groundlink_nav_channel';
const CARDINALS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = degrees => ((degrees % 360) + 360) % 360;
const radians = degrees => degrees * Math.PI / 180;
const shortestDelta = (from, to) => ((wrap(to) - wrap(from) + 540) % 360) - 180;

function haversineM(a, b) {
  const radius = 6_371_000;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(clamp(h, 0, 1)), Math.sqrt(clamp(1 - h, 0, 1)));
}

function bearingDeg(a, b) {
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLng = radians(b.lng - a.lng);
  return wrap(Math.atan2(
    Math.sin(dLng) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng),
  ) * 180 / Math.PI);
}

function cardinal(degrees) {
  return CARDINALS[Math.round(wrap(degrees) / 45) % CARDINALS.length];
}

function turnInstruction(heading, target) {
  const delta = shortestDelta(heading, target);
  if (Math.abs(delta) <= 22) return 'Go Straight';
  if (Math.abs(delta) >= 157.5) return 'Turn Back';
  return delta > 0 ? 'Turn Right' : 'Turn Left';
}

function numberFrom(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function normalizeAlert(input) {
  let alert = input?.detail ?? input ?? {};
  alert = alert.alert ?? alert.payload ?? alert.data ?? alert;
  if (!alert || typeof alert !== 'object') return null;

  const location = typeof alert.location === 'object' && alert.location ? alert.location : {};
  const coords = alert.coords || alert.position || alert.geolocation || {};
  const lat = numberFrom(alert.lat, alert.latitude, location.lat, location.latitude, coords.lat, coords.latitude);
  const lng = numberFrom(alert.lng, alert.lon, alert.longitude, location.lng, location.lon, coords.lng, coords.longitude);
  const hasGps = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const createdAt = alert.createdAt || alert.timestamp || alert.time || new Date().toISOString();
  const date = new Date(createdAt);
  const dispatchStatus = String(alert.dispatch?.status || '').toLowerCase();
  const status = alert.status === 'resolved' || dispatchStatus === 'resolved' ? 'resolved' : String(alert.status || 'active').toLowerCase();

  return {
    id: String(alert.id || alert.alertId || alert.localId || `sos-${createdAt}-${Math.random().toString(36).slice(2, 8)}`),
    sender: String(alert.sender || alert.createdBy || alert.name || alert.userName || 'SOS sender'),
    message: String(alert.note || alert.message || alert.text || alert.category || 'Emergency SOS'),
    createdAt,
    updatedAt: alert.updatedAt || createdAt,
    time: Number.isNaN(date.getTime()) ? String(createdAt) : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status,
    lat: hasGps ? lat : null,
    lng: hasGps ? lng : null,
  };
}

function readCachedAlerts() {
  if (typeof window === 'undefined') return [];
  const values = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(ALERTS_PREFIX)) continue;
      const cached = JSON.parse(window.localStorage.getItem(key) || '[]');
      if (Array.isArray(cached)) values.push(...cached);
    }
  } catch { /* A malformed local cache should not stop the locator. */ }

  const byId = new Map();
  values.map(normalizeAlert).filter(Boolean).forEach(alert => {
    if (!byId.has(alert.id) || Date.parse(alert.createdAt) >= Date.parse(byId.get(alert.id).createdAt)) {
      byId.set(alert.id, alert);
    }
  });
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function compassFromOrientation(event) {
  const webkit = numberFrom(event.webkitCompassHeading);
  if (webkit !== null) return wrap(webkit);
  const alpha = numberFrom(event.alpha);
  if (alpha === null) return null;
  const screenAngle = numberFrom(window.screen?.orientation?.angle, window.orientation) || 0;
  // Project the device's top edge using all three Euler angles so a tilted
  // phone still reports its facing direction. Relative events are useful as a
  // rotation cue when the browser does not provide an absolute compass.
  const alphaRad = radians(alpha);
  const beta = radians(numberFrom(event.beta) || 0);
  const gamma = radians(numberFrom(event.gamma) || 0);
  const projectedX = Math.sin(alphaRad) * Math.cos(gamma) + Math.cos(alphaRad) * Math.sin(beta) * Math.sin(gamma);
  const projectedY = Math.cos(alphaRad) * Math.cos(beta);
  const projectedHeading = Math.atan2(-projectedX, projectedY) * 180 / Math.PI;
  return wrap(projectedHeading + screenAngle);
}

function distanceLabel(meters) {
  return `${Math.round(meters).toLocaleString()} m`;
}

export default function CampusVectorNav() {
  const [position, setPosition] = useState(null);
  const positionRef = useRef(null);
  const lastGpsFix = useRef(null);
  const compassAt = useRef(0);
  const headingRef = useRef(0);
  const [targetHeading, setTargetHeading] = useState(0);
  const [heading, setHeading] = useState(0);
  const [headingSource, setHeadingSource] = useState('Waiting for compass or movement');
  const [gpsStatus, setGpsStatus] = useState('Waiting for GPS permission');
  const [alerts, setAlerts] = useState(readCachedAlerts);
  const [selectedId, setSelectedId] = useState(() => readCachedAlerts()[0]?.id || '');
  const [compassPermission, setCompassPermission] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const selectedRef = useRef(selectedId);
  const userSetHeadingAt = useRef(0);
  const inactiveAlertIds = useRef(new Set());

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { positionRef.current = position; }, [position]);

  const updateHeading = useCallback((value, source) => {
    const next = wrap(value);
    setTargetHeading(next);
    setHeadingSource(source);
  }, []);

  // Smoothly animate the shortest turn, including crossings through north.
  useEffect(() => {
    let frame = 0;
    const animate = () => {
      const current = headingRef.current;
      const delta = shortestDelta(current, targetHeading);
      const next = Math.abs(delta) < 0.25 ? wrap(targetHeading) : wrap(current + delta * 0.18);
      headingRef.current = next;
      setHeading(next);
      if (Math.abs(delta) >= 0.25) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetHeading]);

  // Track GPS continuously; use course only after a meaningful displacement.
  useEffect(() => {
    if (!navigator.geolocation?.watchPosition) {
      setGpsStatus('GPS is not available in this browser');
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(fix => {
      const next = { lat: fix.coords.latitude, lng: fix.coords.longitude };
      const previous = lastGpsFix.current;
      lastGpsFix.current = next;
      positionRef.current = next;
      setPosition(next);
      setGpsStatus(`Live GPS · ±${Math.round(fix.coords.accuracy || 0)} m`);

      if (Date.now() - compassAt.current < 3_000) return;
      const course = numberFrom(fix.coords.heading);
      if (course !== null && (fix.coords.speed == null || fix.coords.speed > 0.4)) {
        updateHeading(course, 'GPS movement');
      } else if (previous && haversineM(previous, next) > Math.max(4, (fix.coords.accuracy || 10) * 0.45)) {
        updateHeading(bearingDeg(previous, next), 'GPS movement');
      }
    }, error => {
      setGpsStatus(error.code === 1 ? 'Allow location to show your live position' : 'Waiting for a GPS fix');
    }, { enableHighAccuracy: true, maximumAge: 1_000, timeout: 12_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [updateHeading]);

  // Phone compass plus laptop trackpad/wheel/keyboard heading fallback.
  useEffect(() => {
    const Orientation = window.DeviceOrientationEvent;
    if (typeof Orientation?.requestPermission === 'function') setCompassPermission(true);
    const onOrientation = event => {
      const next = compassFromOrientation(event);
      if (next === null) return;
      compassAt.current = Date.now();
      updateHeading(next, 'Device compass');
    };
    const onWheel = event => {
      if (Math.abs(event.deltaX) < 1 && Math.abs(event.deltaY) < 1) return;
      userSetHeadingAt.current = Date.now();
      updateHeading(headingRef.current + (event.deltaX || event.deltaY) * 0.22, 'Trackpad / wheel');
    };
    const onKeyDown = event => {
      if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (event.key === 'ArrowLeft' || key === 'q') {
        userSetHeadingAt.current = Date.now();
        updateHeading(headingRef.current - 15, 'Keyboard');
      } else if (event.key === 'ArrowRight' || key === 'e') {
        userSetHeadingAt.current = Date.now();
        updateHeading(headingRef.current + 15, 'Keyboard');
      }
    };
    window.addEventListener('deviceorientationabsolute', onOrientation, true);
    window.addEventListener('deviceorientation', onOrientation, true);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrientation, true);
      window.removeEventListener('deviceorientation', onOrientation, true);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [updateHeading]);

  const receiveAlert = useCallback(incoming => {
    const alert = normalizeAlert(incoming);
    if (!alert) return;
    if (alert.status !== 'active') inactiveAlertIds.current.add(alert.id);
    else inactiveAlertIds.current.delete(alert.id);
    setAlerts(current => {
      const next = [alert, ...current.filter(item => item.id !== alert.id)]
        .filter(item => item.status === 'active')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      return next;
    });
    setSelectedId(current => current || alert.id);
    if (selectedRef.current === alert.id && positionRef.current && alert.lat !== null && alert.lng !== null) {
      updateHeading(bearingDeg(positionRef.current, alert), 'Facing selected SOS');
    }
  }, [updateHeading]);

  useEffect(() => {
    const syncStorage = () => {
      const stored = readCachedAlerts();
      setAlerts(current => {
        const byId = new Map(current.map(alert => [alert.id, alert]));
        stored.forEach(alert => {
          const previous = byId.get(alert.id);
          if (!previous || Date.parse(alert.updatedAt) >= Date.parse(previous.updatedAt)) byId.set(alert.id, alert);
        });
        return [...byId.values()]
          .filter(alert => alert.status === 'active' && !inactiveAlertIds.current.has(alert.id))
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      });
      setSelectedId(current => stored.some(alert => alert.id === current && alert.status === 'active') ? current : (stored.find(alert => alert.status === 'active')?.id || current));
    };
    const onCustom = event => receiveAlert(event.detail);
    let channel;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = event => {
        const message = event.data;
        if (['sos', 'sos-alert', 'groundlink:sos-alert'].includes(message?.type)) {
          receiveAlert(message.payload || message.alert || message.data || message);
        }
      };
    }
    window.addEventListener('groundlink:sos-alert', onCustom);
    window.addEventListener('storage', syncStorage);
    socket.on('sos:created', receiveAlert);
    socket.on('sos:updated', receiveAlert);
    socket.on('sos:dispatch', receiveAlert);
    const poll = window.setInterval(syncStorage, 800);
    syncStorage();
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('groundlink:sos-alert', onCustom);
      window.removeEventListener('storage', syncStorage);
      socket.off('sos:created', receiveAlert);
      socket.off('sos:updated', receiveAlert);
      socket.off('sos:dispatch', receiveAlert);
      channel?.close();
    };
  }, [receiveAlert]);

  const activeAlerts = useMemo(() => alerts.filter(alert => alert.status === 'active'), [alerts]);
  const selected = activeAlerts.find(alert => alert.id === selectedId) || activeAlerts[0] || null;
  const metrics = useMemo(() => activeAlerts.map(alert => {
    if (!position || alert.lat === null || alert.lng === null) return { alert, distance: null, bearing: null, direction: null };
    const distance = haversineM(position, alert);
    const bearing = bearingDeg(position, alert);
    return { alert, distance, bearing, direction: cardinal(bearing) };
  }), [activeAlerts, position]);
  const selectedMetric = metrics.find(item => item.alert.id === selected?.id) || null;
  const furthest = Math.max(120, ...metrics.map(item => item.distance || 0));
  const metersPerPixel = furthest / (CENTER - 52) * mapScale;
  const pointFor = alert => {
    if (!position || alert.lat === null || alert.lng === null) return null;
    const distance = haversineM(position, alert);
    const bearing = radians(bearingDeg(position, alert));
    const radius = Math.min(distance / metersPerPixel, CENTER - 40);
    return { x: CENTER + Math.sin(bearing) * radius, y: CENTER - Math.cos(bearing) * radius };
  };

  async function enableCompass() {
    try {
      const permission = await window.DeviceOrientationEvent.requestPermission();
      setCompassPermission(false);
      if (permission !== 'granted') setHeadingSource('Compass permission denied');
    } catch { setHeadingSource('Compass permission unavailable'); }
  }

  return (
    <section style={styles.panel} aria-label="Live SOS locator">
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>GROUNDLINK · LIVE LOCATOR</div>
          <h2 style={styles.title}>SOS Direction Tracker</h2>
          <div style={styles.status}>{gpsStatus} <span>·</span> {headingSource}</div>
        </div>
        <div style={styles.headerActions}>
          <label style={styles.zoomLabel}>RADAR RANGE
            <select value={mapScale} onChange={event => setMapScale(Number(event.target.value))} style={styles.select}>
              <option value="0.5">Near</option><option value="1">Standard</option><option value="2">Wide</option>
            </select>
          </label>
          {compassPermission && <button type="button" onClick={enableCompass} style={styles.button}>Enable Compass</button>}
        </div>
      </header>

      <div style={styles.summary}>
        {selected && selectedMetric?.distance !== null && selectedMetric?.distance !== undefined ? <>
          <div><span style={styles.instruction}>{turnInstruction(heading, selectedMetric.bearing)}</span><span style={styles.to}> to {selected.sender}</span></div>
          <div style={styles.summaryMetrics}><strong>{distanceLabel(selectedMetric.distance)}</strong><span>{selectedMetric.direction}</span></div>
        </> : <div style={styles.emptySummary}>{selected ? `${selected.sender} has not shared GPS coordinates` : 'Waiting for active SOS alerts from connected peers'}</div>}
      </div>

      <div style={styles.radarWrap}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={styles.radar} role="img" aria-label="Live relative SOS locator radar">
          <defs>
            <radialGradient id="radarGround" cx="50%" cy="45%" r="70%"><stop offset="0%" stopColor="#f9fbf5"/><stop offset="100%" stopColor="#e8efe6"/></radialGradient>
          </defs>
          <rect width={SIZE} height={SIZE} fill="url(#radarGround)" />
          {[0.25, 0.5, 0.75, 1].map(factor => <g key={factor}>
            <circle cx={CENTER} cy={CENTER} r={(CENTER - 40) * factor} fill="none" stroke="#cbd8ce" strokeWidth="1.2" />
            <text x={CENTER + 6} y={CENTER - (CENTER - 40) * factor + 13} fill="#65776b" fontSize="10">{Math.round((furthest * factor) / 25) * 25} m</text>
          </g>)}
          <line x1={CENTER} y1="28" x2={CENTER} y2={SIZE - 28} stroke="#dbe3dc" strokeWidth="1" />
          <line x1="28" y1={CENTER} x2={SIZE - 28} y2={CENTER} stroke="#dbe3dc" strokeWidth="1" />
          <text x={CENTER} y="23" textAnchor="middle" fill="#43574a" fontSize="11" fontWeight="800">N</text>

          {selected && pointFor(selected) && <line x1={CENTER} y1={CENTER} x2={pointFor(selected).x} y2={pointFor(selected).y} stroke="#d4463f" strokeWidth="3" strokeDasharray="7 5" />}

          {metrics.map(({ alert }) => {
            const point = pointFor(alert);
            if (!point) return null;
            const isSelected = alert.id === selected?.id;
            return <g key={alert.id} onClick={() => setSelectedId(alert.id)} role="button" tabIndex="0" aria-label={`Track ${alert.sender}`} style={{ cursor: 'pointer' }}>
              {isSelected && <circle cx={point.x} cy={point.y} r="19" fill="rgba(207,58,47,.14)" />}
              <circle cx={point.x} cy={point.y} r={isSelected ? 9 : 7} fill="#c9342d" stroke="#fff" strokeWidth="3" />
              <text x={point.x + 12} y={point.y + 4} fill="#8e2723" fontSize="11" fontWeight="800">{alert.sender}</text>
            </g>;
          })}

          <g transform={`translate(${CENTER} ${CENTER}) rotate(${heading})`}>
            <path d="M0 -72 L-37 -7 A72 72 0 0 0 37 -7 Z" fill="rgba(30,112,73,.18)" stroke="rgba(30,112,73,.45)" strokeWidth="1.5" />
            <path d="M0 -30 L-12 -2 L0 -9 L12 -2 Z" fill="#16734a" stroke="#fff" strokeWidth="2" />
            <circle r="11" fill="#16734a" stroke="#fff" strokeWidth="3" />
            <circle r="3" fill="#fff" />
          </g>
        </svg>
      </div>

      <div style={styles.listHeader}><strong>Active SOS senders</strong><span>{activeAlerts.length}</span></div>
      {activeAlerts.length ? <div style={styles.list} aria-live="polite">
        {metrics.map(({ alert, distance, direction }) => <button type="button" key={alert.id} onClick={() => setSelectedId(alert.id)} style={listItemStyle(alert.id === selected?.id)}>
          <span style={styles.pinDot} />
          <span style={styles.alertBody}><strong>{alert.sender}</strong><span>{alert.message}</span><small>{alert.time}</small></span>
          <span style={styles.distance}>{distance === null ? 'GPS unavailable' : <><strong>{distanceLabel(distance)}</strong><small>{direction}</small></>}</span>
        </button>)}
      </div> : <div style={styles.emptyList}>SOS alerts from connected peers will appear here automatically.</div>}
      <footer style={styles.footer}>Offline locator · GPS coordinates are required to plot a sender · Arrow keys / Q and E rotate · Trackpad or wheel adjusts heading</footer>
    </section>
  );
}

const styles = {
  panel: { marginTop: 14, padding: 16, border: '1px solid #d8e0d8', borderRadius: 16, background: '#fff', color: '#26342b', boxShadow: '0 8px 28px rgba(32,45,34,.09)' },
  header: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 12 },
  eyebrow: { color: '#718273', fontSize: 9, fontWeight: 800, letterSpacing: '1.5px' },
  title: { margin: '4px 0 2px', color: '#263a2d', fontSize: 21, letterSpacing: '-.4px' },
  status: { color: '#718073', fontSize: 11 },
  headerActions: { display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 8 },
  zoomLabel: { display: 'grid', gap: 4, color: '#718073', fontSize: 8, fontWeight: 800, letterSpacing: '.7px' },
  select: { minWidth: 120, padding: '8px 10px', border: '1px solid #d6dfd6', borderRadius: 8, background: '#fff', color: '#2d4032', fontSize: 11 },
  button: { minHeight: 34, padding: '0 11px', border: '1px solid #a9c1aa', borderRadius: 8, background: '#edf5ec', color: '#285b3d', fontSize: 10, fontWeight: 750, cursor: 'pointer' },
  summary: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 13px', marginBottom: 10, border: '1px solid #dce6dc', borderRadius: 10, background: '#f4f8f2' },
  instruction: { color: '#176f48', fontSize: 13, fontWeight: 850 },
  to: { color: '#627365', fontSize: 11 },
  summaryMetrics: { display: 'flex', gap: 12, alignItems: 'baseline', color: '#596c5d', fontSize: 11 },
  emptySummary: { color: '#647568', fontSize: 11 },
  radarWrap: { width: '100%', maxWidth: 560, margin: '0 auto', overflow: 'hidden', border: '1px solid #d5dfd6', borderRadius: 14, background: '#edf3ec' },
  radar: { display: 'block', width: '100%', height: 'auto' },
  listHeader: { display: 'flex', justifyContent: 'space-between', margin: '13px 2px 7px', color: '#425647', fontSize: 11 },
  list: { display: 'grid', gap: 6 },
  emptyList: { padding: '15px 12px', border: '1px dashed #cbd8cc', borderRadius: 10, color: '#758477', textAlign: 'center', fontSize: 11 },
  pinDot: { width: 10, height: 10, flex: '0 0 auto', borderRadius: '50%', background: '#c9342d', boxShadow: '0 0 0 4px #fbe9e7' },
  alertBody: { display: 'grid', minWidth: 0, flex: 1, gap: 2, textAlign: 'left' },
  distance: { display: 'grid', flex: '0 0 auto', gap: 2, color: '#8e302a', textAlign: 'right', fontSize: 10 },
  footer: { marginTop: 10, color: '#879287', fontSize: 9, lineHeight: 1.5 },
};

function listItemStyle(selected) {
  return {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '10px 11px',
    border: `1px solid ${selected ? '#e4aaa5' : '#e0e6e0'}`, borderRadius: 10,
    background: selected ? '#fff8f7' : '#fff', color: '#344438', cursor: 'pointer', textAlign: 'left',
  };
}
