import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { api } from '../../services/api.js';
import { socket } from '../../services/socket.js';

const quickAlerts = [
  { label: 'Medical Help', category: 'Medical', note: 'Medical help needed.' },
  { label: 'Fire / Smoke', category: 'Fire', note: 'Fire or smoke reported.' },
  { label: 'Crowd / Safety', category: 'Safety', note: 'Crowd or safety help needed.' },
  { label: 'Other', category: 'Other', note: '' }
];
const quickPhrases = [
  { phrase: 'Person fainted \u2014 need medical help', category: 'Medical' },
  { phrase: 'Fire / Smoke spotted', category: 'Fire' },
  { phrase: 'Crowd rush near gate', category: 'Safety', zone: 'Entry Gate' }
];
const updatedTime = alert => new Date(alert.updatedAt || alert.createdAt).getTime();

function localStorageKey(kind, groupCode) {
  return `groundlink-sos:${kind}:${encodeURIComponent(groupCode)}`;
}

function readLocalValue(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}

function writeLocalValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function readGroupAlerts(groupCode) {
  const value = readLocalValue(localStorageKey('alerts', groupCode), []);
  return Array.isArray(value) ? value : [];
}

function saveGroupAlerts(groupCode, alerts) {
  if (!groupCode) return false;
  return writeLocalValue(localStorageKey('alerts', groupCode), alerts);
}

function newLocalId(prefix) {
  const randomId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
}

function speechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function inferCategory(transcript, fallback) {
  const text = transcript.toLowerCase();
  if (/\bfire\b|smoke|burning/.test(text)) return 'Fire';
  if (/missing|lost child|separated/.test(text)) return 'Missing person';
  if (/crowd|crush|stampede|security|assault/.test(text)) return 'Safety';
  if (/medical|faint|unconscious|injur|bleed|breath|hurt/.test(text)) return 'Medical';
  return fallback;
}

function getUrgency(alert) {
  const severity = String(alert.severity || '');
  const score = Number(alert.score);
  if (severity.startsWith('P1') || score >= 8) return { label: 'URGENT', color: '#fff', background: '#c62828', border: '#ef5350', steps: ['Get a nearby helper to the person now.', 'Call local emergency help if someone is in danger.'] };
  if (severity.startsWith('P2') || score >= 5) return { label: 'HIGH', color: '#fff', background: '#e87516', border: '#f39b45', steps: ['Check that the person is safe and confirm the location.', 'Ask an organizer to send help.'] };
  return { label: 'NORMAL', color: '#352900', background: '#f1cf43', border: '#d7b942', steps: ['Confirm what help is needed.', 'Stay nearby and ask for more help if things change.'] };
}

function categoryLabel(category) {
  return ({ Medical: 'Medical Help', Fire: 'Fire / Smoke', Safety: 'Crowd / Safety', 'Missing person': 'Missing Person', Other: 'Other Emergency' })[category] || 'Emergency Help';
}

function formatEta(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d+)\s*(?:min|mins|minute|minutes)?$/i);
  return match ? `${match[1]} mins` : text;
}

function currentStatus(alert) {
  const savedLocally = alert.localSyncPending ? ' (saved on this device)' : '';
  if (alert.status === 'resolved' || alert.dispatch?.status === 'Resolved') return `Help completed${savedLocally}`;
  const helper = String(alert.dispatch?.volunteer || '').trim();
  const eta = formatEta(alert.dispatch?.eta);
  if (alert.dispatch?.status === 'Accepted - En Route') return `${helper || 'Your helper'} is on the way${eta ? ` — ${eta}` : ''}${savedLocally}`;
  if (helper) return `${helper} is assigned${eta ? ` — ${eta}` : ''}${savedLocally}`;
  return alert.localSyncPending ? 'SOS saved on this device — waiting to sync' : 'Waiting for volunteer';
}

function AlertSummary({ alert }) {
  const urgency = getUrgency(alert);
  const location = String(alert.zone || '').trim() || 'Location not shared';
  return <div style={{ display: 'grid', gap: 10, marginTop: 9, padding: '11px 12px', border: '1px solid #354333', borderRadius: 5, background: '#101610', color: '#dce5dc', fontSize: 9, lineHeight: 1.45 }}>
    <div><span style={{ display: 'inline-block', padding: '5px 9px', border: `1px solid ${urgency.border}`, borderRadius: 12, background: urgency.background, color: urgency.color, fontSize: 8, fontWeight: 900, letterSpacing: '.7px' }}>{urgency.label}</span></div>
    <div>
      <strong style={{ color: '#edf2eb', fontSize: 9 }}>What happened &amp; where</strong>
      <p style={{ margin: '4px 0 0', color: '#e2e9e1', fontSize: 10, fontWeight: 750 }}>{categoryLabel(alert.category)} — {location}</p>
      {alert.note && <p style={{ margin: '3px 0 0', color: '#aeb9ae', fontSize: 9 }}>{alert.note}</p>}
    </div>
    <div>
      <strong style={{ color: '#edf2eb', fontSize: 9 }}>What to do</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: 17, color: '#b9c2b9', fontSize: 9 }}>
        {urgency.steps.map((step, index) => <li key={`${alert.id}-simple-action-${index}`}>{step}</li>)}
      </ul>
    </div>
    <div>
      <strong style={{ color: '#edf2eb', fontSize: 9 }}>Current status</strong>
      <p role="status" aria-live="polite" style={{ margin: '4px 0 0', color: '#c6f08e', fontSize: 10, fontWeight: 750 }}>{currentStatus(alert)}</p>
    </div>
  </div>;
}

function mergeAlerts(current, incoming) {
  const byId = new Map(current.map(alert => [alert.id, alert]));
  for (const alert of incoming) {
    const previous = byId.get(alert.id);
    if (!previous || updatedTime(alert) >= updatedTime(previous)) byId.set(alert.id, alert);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function updateCachedAlerts(setAlerts, groupCode, updater) {
  setAlerts(current => {
    const next = typeof updater === 'function' ? updater(current) : updater;
    saveGroupAlerts(groupCode, next);
    return next;
  });
}

function storedName() {
  try { return sessionStorage.getItem('groundlink-name') || `Guest ${Math.floor(10 + Math.random() * 89)}`; }
  catch { return 'Guest'; }
}

export default function EmergencySOSPanel({ group, onMembers }) {
  const name = useRef(storedName());
  const [alerts, setAlerts] = useState([]);
  const [role, setRole] = useState('Attendee');
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [volunteerLabel, setVolunteerLabel] = useState(name.current);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [alarmNotice, setAlarmNotice] = useState('');
  const [volunteerPopupQueue, setVolunteerPopupQueue] = useState([]);
  const [dispatchSelections, setDispatchSelections] = useState({});
  const [category, setCategory] = useState('Medical');
  const [note, setNote] = useState('');
  const [zone, setZone] = useState('');
  const [locationHighlighted, setLocationHighlighted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [networkOnline, setNetworkOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const [loading, setLoading] = useState(Boolean(group));
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [listening, setListening] = useState(false);
  const [speechPreview, setSpeechPreview] = useState('');
  const [voiceFailed, setVoiceFailed] = useState(() => !speechRecognitionConstructor());
  const [speechFallback, setSpeechFallback] = useState(() => speechRecognitionConstructor()
    ? ''
    : 'Voice isn’t available on this device. Type a note or choose an emergency card.');
  const recognitionRef = useRef(null);
  const speechTranscriptRef = useRef('');
  const speechErrorRef = useRef('');
  const locationInputRef = useRef(null);
  const noteInputRef = useRef(null);
  const roleRef = useRef(role);
  const volunteerLabelRef = useRef(volunteerLabel);
  const soundEnabledRef = useRef(soundEnabled);
  const audioContextRef = useRef(null);
  const alertsRef = useRef(alerts);
  const notifiedAssignmentsRef = useRef(new Map());
  const dismissedAssignmentsRef = useRef(new Set());
  const alarmIntervalRef = useRef(null);
  const speechDelayRef = useRef(null);
  const testSpeechDelayRef = useRef(null);
  const alarmGenerationRef = useRef(0);
  const activeAlarmRef = useRef(null);
  const alarmOscillatorsRef = useRef(new Set());
  const outboxMemoryRef = useRef({});
  const outboxBusyRef = useRef(false);
  const flushOutboxRef = useRef(null);
  const joinedGroupRef = useRef('');
  const flushGenerationRef = useRef(0);
  const actionTimersRef = useRef(new Map());

  const connectionReady = connected && networkOnline && socket.connected &&
    (typeof navigator === 'undefined' || navigator.onLine !== false);
  const offlineQuickMode = !connectionReady || voiceFailed;
  roleRef.current = role;
  volunteerLabelRef.current = volunteerLabel;
  soundEnabledRef.current = soundEnabled;
  alertsRef.current = alerts;

  function prepareAlertAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      let context = audioContextRef.current;
      if (!context || context.state === 'closed') context = new AudioContextClass();
      audioContextRef.current = context;
      context.onstatechange = () => setAudioUnlocked(context.state === 'running');
      setAudioUnlocked(context.state === 'running');
      return context;
    } catch { return null; }
  }

  async function playAlarmCycle(alert, key, { test = false } = {}) {
    if ((!soundEnabledRef.current && !test) || typeof window === 'undefined') return false;
    const generation = alarmGenerationRef.current;
    try {
      if (!test && !isAlarmEligible(alert, key)) return false;
      const audioCtx = prepareAlertAudio();
      if (!audioCtx) return false;
      await audioCtx.resume();
      if (generation !== alarmGenerationRef.current) return false;
      const unlocked = audioCtx.state === 'running';
      setAudioUnlocked(unlocked);
      if (!unlocked || !soundEnabledRef.current || (!test && !isAlarmEligible(alert, key))) return false;

      const startAt = audioCtx.currentTime + 0.02;
      const duration = 1.2;
      const sweep = [
        { time: 0, frequency: 720 },
        { time: 0.4, frequency: 1180 },
        { time: 0.8, frequency: 720 },
        { time: duration, frequency: 1180 }
      ];
      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.0001, startAt);
      masterGain.gain.linearRampToValueAtTime(0.78, startAt + 0.08);
      masterGain.gain.setValueAtTime(0.78, startAt + duration - 0.16);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      masterGain.connect(audioCtx.destination);

      [
        { type: 'sawtooth', level: 0.32, detune: -5 },
        { type: 'triangle', level: 0.24, detune: 5 }
      ].forEach(tone => {
        const oscillator = audioCtx.createOscillator();
        const toneGain = audioCtx.createGain();
        oscillator.type = tone.type;
        oscillator.detune.setValueAtTime(tone.detune, startAt);
        oscillator.frequency.setValueAtTime(sweep[0].frequency, startAt);
        sweep.slice(1).forEach(point => {
          oscillator.frequency.linearRampToValueAtTime(point.frequency, startAt + point.time);
        });
        toneGain.gain.setValueAtTime(tone.level, startAt);
        oscillator.connect(toneGain);
        toneGain.connect(masterGain);
        alarmOscillatorsRef.current.add(oscillator);
        oscillator.onended = () => {
          alarmOscillatorsRef.current.delete(oscillator);
          try { oscillator.disconnect(); toneGain.disconnect(); } catch { /* Audio cleanup is best effort. */ }
        };
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.02);
      });

      const speechTimer = setTimeout(() => {
        if (generation !== alarmGenerationRef.current) return;
        if (test) {
          speakEmergency(alert, key, true, generation);
          return;
        }
        const currentAlert = alertsRef.current.find(item => item.id === alert.id);
        if (currentAlert && assignmentKey(currentAlert) === key) speakEmergency(currentAlert, key, false, generation);
        else if (isAlarmEligible(alert, key)) speakEmergency(alert, key, false, generation);
      }, Math.ceil((duration + 0.04) * 1000) + 2000);
      if (test) {
        if (testSpeechDelayRef.current) clearTimeout(testSpeechDelayRef.current);
        testSpeechDelayRef.current = speechTimer;
      } else {
        if (speechDelayRef.current) clearTimeout(speechDelayRef.current);
        speechDelayRef.current = speechTimer;
      }
      return true;
    } catch (audioError) {
      setAudioUnlocked(audioContextRef.current?.state === 'running');
      console.warn('[Emergency SOS] Siren playback failed; using the local speech fallback if available.', audioError);
      return false;
    }
  }

  async function testEmergencySiren() {
    soundEnabledRef.current = true;
    setSoundEnabled(true);
    const testAlert = { id: 'sos-siren-test', category: 'Other', zone: '', status: 'active' };
    const played = await playAlarmCycle(testAlert, 'sos-siren-test', { test: true });
    setAlarmNotice(played ? 'Test siren: voice will follow after a 2-second pause.' : 'Sound is blocked. Click Test Emergency Siren again to unlock it.');
  }

  function assignmentTimestamp(alert) {
    return String(alert?.dispatch?.assignedAt || alert?.updatedAt || alert?.createdAt || '');
  }

  function assignmentKey(alert) {
    return alert?.id ? `${alert.id}:${assignmentTimestamp(alert)}` : '';
  }

  function isAssignedToActiveVolunteer(alert) {
    const dispatch = alert?.dispatch || {};
    return Boolean(dispatch.volunteerId && dispatch.volunteerId === socket.id) ||
      String(dispatch.volunteer || '').trim().toLowerCase() === volunteerLabelRef.current.trim().toLowerCase();
  }

  function isAcknowledgedByActiveVolunteer(alert) {
    const activeName = volunteerLabelRef.current.trim().toLowerCase();
    return (alert?.acknowledgements || []).some(item => String(item.name || '').trim().toLowerCase() === activeName);
  }

  function isAlarmEligible(alert, key) {
    const status = alert?.dispatch?.status;
    return roleRef.current === 'Volunteer' && alert?.status === 'active' &&
      isAssignedToActiveVolunteer(alert) && assignmentKey(alert) === key &&
      status !== 'Accepted - En Route' && status !== 'Resolved' &&
      !isAcknowledgedByActiveVolunteer(alert) && !dismissedAssignmentsRef.current.has(key);
  }

  function stopVolunteerAlarm() {
    alarmGenerationRef.current += 1;
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    if (speechDelayRef.current) clearTimeout(speechDelayRef.current);
    if (testSpeechDelayRef.current) clearTimeout(testSpeechDelayRef.current);
    alarmIntervalRef.current = null;
    speechDelayRef.current = null;
    testSpeechDelayRef.current = null;
    activeAlarmRef.current = null;
    for (const oscillator of alarmOscillatorsRef.current) {
      try { oscillator.stop(); oscillator.disconnect(); } catch { /* Audio may already have stopped. */ }
    }
    alarmOscillatorsRef.current.clear();
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    } catch { /* Speech is an optional alert aid. */ }
  }

  async function playSpeechFallbackTone(generation = alarmGenerationRef.current) {
    try {
      const audioCtx = prepareAlertAudio();
      if (!audioCtx) return;
      await audioCtx.resume();
      if (generation !== alarmGenerationRef.current || audioCtx.state !== 'running') return;
      const startAt = audioCtx.currentTime + 0.02;
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(980, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.38);
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      alarmOscillatorsRef.current.add(oscillator);
      oscillator.onended = () => {
        alarmOscillatorsRef.current.delete(oscillator);
        try { oscillator.disconnect(); gain.disconnect(); } catch { /* Audio cleanup is best effort. */ }
      };
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.4);
    } catch (fallbackError) {
      console.warn('[Emergency SOS] Local speech fallback tone failed.', fallbackError);
    }
  }

  function speakEmergency(alert, key, test = false, generation = alarmGenerationRef.current) {
    if (generation !== alarmGenerationRef.current) return;
    if (!test && !isAlarmEligible(alert, key)) return;
    try {
      const synthesis = window.speechSynthesis;
      const Utterance = window.SpeechSynthesisUtterance;
      if (!synthesis || !Utterance) {
        void playSpeechFallbackTone(generation);
        return;
      }
      const category = categoryLabel(alert.category);
      const message = `Emergency! ${category}${alert.zone ? ` at ${alert.zone}` : ''}`;
      const utterance = new Utterance(message);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1;
      utterance.onerror = event => {
        if (event?.error === 'canceled' || event?.error === 'interrupted') return;
        if (generation === alarmGenerationRef.current && (test || isAlarmEligible(alert, key))) void playSpeechFallbackTone(generation);
      };
      const voices = synthesis.getVoices?.() || [];
      const englishVoice = voices.find(voice => voice.localService && /^en(?:[-_]|$)/i.test(voice.lang || ''));
      if (englishVoice) utterance.voice = englishVoice;
      synthesis.cancel();
      synthesis.resume();
      synthesis.speak(utterance);
    } catch (speechError) {
      console.warn('[Emergency SOS] Speech synthesis failed; playing a local fallback tone.', speechError);
      void playSpeechFallbackTone(generation);
    }
  }

  function runVolunteerAlarmCycle(alert, key) {
    if (!isAlarmEligible(alert, key)) {
      stopVolunteerAlarm();
      return;
    }
    activeAlarmRef.current = { alertId: alert.id, key };
    void playAlarmCycle(alert, key);
  }

  function startVolunteerAlarm(alert, key) {
    if (!isAlarmEligible(alert, key)) return;
    stopVolunteerAlarm();
    runVolunteerAlarmCycle(alert, key);
    alarmIntervalRef.current = setInterval(() => {
      const currentAlert = alertsRef.current.find(item => item.id === alert.id);
      if (!currentAlert || !isAlarmEligible(currentAlert, key)) {
        stopVolunteerAlarm();
        return;
      }
      runVolunteerAlarmCycle(currentAlert, key);
    }, 30000);
  }

  function notifyVolunteer(alert, source) {
    if (roleRef.current !== 'Volunteer' || source !== 'sos:dispatch' || !alert?.id) return;
    if (!isAssignedToActiveVolunteer(alert)) return;
    const timestamp = assignmentTimestamp(alert);
    const key = assignmentKey(alert);
    const dispatchStatus = alert.dispatch?.status;
    const alreadyResponded = dispatchStatus === 'Accepted - En Route' || dispatchStatus === 'Resolved' ||
      alert.status !== 'active' || isAcknowledgedByActiveVolunteer(alert) || dismissedAssignmentsRef.current.has(key);
    if (alreadyResponded) {
      if (timestamp) notifiedAssignmentsRef.current.set(alert.id, timestamp);
      const message = `[Emergency SOS] Alarm skipped for ${alert.id}: assignment was already responded to or acknowledged.`;
      console.info(message, { alertId: alert.id, assignmentTimestamp: timestamp });
      setAlarmNotice('Alarm skipped: this assignment was already acknowledged or responded to.');
      return;
    }
    if (!timestamp) return;
    if (notifiedAssignmentsRef.current.get(alert.id) === timestamp) {
      const message = `[Emergency SOS] Alarm skipped for ${alert.id}: this assignment was already notified.`;
      console.info(message, { alertId: alert.id, assignmentTimestamp: timestamp });
      setAlarmNotice('Alarm skipped: this assignment was already notified.');
      return;
    }
    notifiedAssignmentsRef.current.set(alert.id, timestamp);
    setVolunteerPopupQueue([alert]);
    if (soundEnabledRef.current) {
      startVolunteerAlarm(alert, key);
      const message = `[Emergency SOS] New assignment ${alert.id} triggered the 30-second alarm loop.`;
      console.info(message, { alertId: alert.id, assignmentTimestamp: timestamp });
      setAlarmNotice(`Alarm active: ${categoryLabel(alert.category)}. Repeats every 30 seconds until you respond.`);
    } else {
      console.info(`[Emergency SOS] New assignment ${alert.id} received while sound is muted; alarm loop not started.`, { alertId: alert.id, assignmentTimestamp: timestamp });
      setAlarmNotice('New assignment received; sound is muted.');
    }
    try {
      if (soundEnabledRef.current && typeof navigator !== 'undefined') navigator.vibrate?.([300, 120, 300, 120, 400]);
    } catch { /* Vibration is optional on this device. */ }
  }

  function startPendingVolunteerAlarm() {
    if (roleRef.current !== 'Volunteer' || !soundEnabledRef.current) return;
    const alert = alertsRef.current.find(item => isAlarmEligible(item, assignmentKey(item)));
    if (!alert) return;
    const key = assignmentKey(alert);
    if (activeAlarmRef.current?.key === key && alarmIntervalRef.current) return;
    setVolunteerPopupQueue([alert]);
    startVolunteerAlarm(alert, key);
    const message = `[Emergency SOS] Volunteer view opened with unacknowledged assignment ${alert.id}; starting the 30-second alarm loop.`;
    console.info(message, { alertId: alert.id, assignmentTimestamp: assignmentTimestamp(alert) });
    setAlarmNotice(`Alarm active: ${categoryLabel(alert.category)}. Repeats every 30 seconds until you respond.`);
  }

  function dismissVolunteerPopup(mute = false) {
    const alert = volunteerPopupQueue[0];
    const key = assignmentKey(alert);
    if (key) dismissedAssignmentsRef.current.add(key);
    stopVolunteerAlarm();
    setVolunteerPopupQueue([]);
    if (mute) {
      setSoundEnabled(false);
      soundEnabledRef.current = false;
      setAlarmNotice('Alarm muted and stopped for this assignment.');
    }
  }

  function acknowledgeVolunteerPopup() {
    const alert = volunteerPopupQueue[0];
    if (!alert) return;
    const key = assignmentKey(alert);
    if (key) dismissedAssignmentsRef.current.add(key);
    stopVolunteerAlarm();
    setVolunteerPopupQueue([]);
    setAlarmNotice('Alarm stopped: assignment acknowledged.');
    const acknowledgedAt = new Date().toISOString();
    queueSosAction('sos:acknowledge', { alertId: alert.id }, {
      optimisticUpdate: current => current.map(item => item.id === alert.id ? {
        ...item,
        acknowledgements: [...(item.acknowledgements || []), { name: volunteerLabelRef.current, at: acknowledgedAt }],
        localSyncPending: true,
        updatedAt: acknowledgedAt
      } : item)
    });
  }

  function respondToVolunteerPopup(status) {
    const alert = volunteerPopupQueue[0];
    if (!alert) return;
    const assignedToMe = alert.dispatch && (
      Boolean(alert.dispatch.volunteerId && alert.dispatch.volunteerId === socket.id) ||
      String(alert.dispatch.volunteer || '').trim().toLowerCase() === volunteerLabel.trim().toLowerCase()
    );
    if (!alert.dispatch) {
      const dispatchedAt = new Date().toISOString();
      queueSosAction('sos:dispatch', { alertId: alert.id, volunteer: volunteerLabel, eta: '5 min' }, {
        optimisticUpdate: current => current.map(item => item.id === alert.id ? {
          ...item,
          dispatch: { volunteer: volunteerLabel, eta: '5 min', status: 'Dispatched', dispatchedAt },
          localSyncPending: true,
          updatedAt: dispatchedAt
        } : item)
      });
    } else if (!assignedToMe) {
      setError(`This alert is assigned to ${alert.dispatch.volunteer || 'another volunteer'}.`);
      return;
    }
    updateVolunteerStatus(alert.id, status);
    dismissVolunteerPopup();
  }

  function toggleAlertSound() {
    const nextEnabled = !soundEnabledRef.current;
    soundEnabledRef.current = nextEnabled;
    setSoundEnabled(nextEnabled);
    if (nextEnabled) {
      prepareAlertAudio();
      const alert = volunteerPopupQueue[0];
      if (alert && isAlarmEligible(alert, assignmentKey(alert))) startVolunteerAlarm(alert, assignmentKey(alert));
    } else dismissVolunteerPopup(true);
  }

  function clearActionTimer(actionId) {
    const timer = actionTimersRef.current.get(actionId);
    if (timer) clearTimeout(timer);
    actionTimersRef.current.delete(actionId);
  }

  function clearAllActionTimers() {
    for (const timer of actionTimersRef.current.values()) clearTimeout(timer);
    actionTimersRef.current.clear();
  }

  function startActionTimer(actionId, pendingLabel = actionId) {
    clearActionTimer(actionId);
    const timer = setTimeout(() => {
      actionTimersRef.current.delete(actionId);
      setPendingAction(current => current === pendingLabel ? '' : current);
    }, 1500);
    actionTimersRef.current.set(actionId, timer);
  }

  function readOutbox(groupCode) {
    if (Object.prototype.hasOwnProperty.call(outboxMemoryRef.current, groupCode)) {
      return outboxMemoryRef.current[groupCode];
    }
    const key = localStorageKey('outbox', groupCode);
    const stored = readLocalValue(key, null);
    outboxMemoryRef.current[groupCode] = Array.isArray(stored) ? stored : [];
    return outboxMemoryRef.current[groupCode];
  }

  function writeOutbox(groupCode, queue) {
    outboxMemoryRef.current[groupCode] = queue;
    return writeLocalValue(localStorageKey('outbox', groupCode), queue);
  }

  function queueSosAction(event, payload, { localAlert, localAlertId, optimisticUpdate } = {}) {
    const groupCode = group?.code;
    if (!groupCode) return null;
    const action = {
      queueId: newLocalId('sos-action'),
      event,
      payload,
      pendingLabel: event === 'sos:create'
        ? 'create'
        : event === 'sos:dispatch'
          ? `${payload.alertId}:dispatch`
          : `${payload.alertId}:volunteer:${payload.status}`,
      localAlertId: localAlertId || localAlert?.id || '',
      queuedAt: new Date().toISOString()
    };
    const saved = writeOutbox(groupCode, [...readOutbox(groupCode), action]);
    if (localAlert) {
      updateCachedAlerts(setAlerts, groupCode, current => mergeAlerts(current, [localAlert]));
    } else if (optimisticUpdate) {
      updateCachedAlerts(setAlerts, groupCode, optimisticUpdate);
    }
    setPendingAction(connectionReady ? action.pendingLabel : '');
    if (connectionReady) startActionTimer(action.queueId, action.pendingLabel);
    if (!saved) setError('This browser could not save the SOS outbox. Keep this page open until it reconnects.');
    if (connectionReady) flushOutboxRef.current?.();
    return action;
  }

  useEffect(() => {
    let unlocked = false;
    const unlockAudio = async () => {
      if (unlocked) return;
      unlocked = true;
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
      const context = prepareAlertAudio();
      if (context) {
        try {
          await context.resume();
          setAudioUnlocked(context.state === 'running');
        } catch { setAudioUnlocked(false); }
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
    window.addEventListener('keydown', unlockAudio, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
    };
  }, []);

  useEffect(() => {
    if (role === 'Volunteer') startPendingVolunteerAlarm();
  }, [alerts, role, volunteerLabel, soundEnabled]);

  useEffect(() => () => {
    clearAllActionTimers();
    stopVolunteerAlarm();
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort?.(); } catch { /* The browser may already have ended capture. */ }
    }
    recognitionRef.current = null;
    const context = audioContextRef.current;
    if (context && context.state !== 'closed') {
      try { context.close().catch(() => {}); } catch { /* Audio cleanup is best effort. */ }
    }
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setNetworkOnline(true);
      if (!socket.connected) socket.connect();
      else flushOutboxRef.current?.();
    };
    const onOffline = () => setNetworkOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!group?.code) {
      setAlerts([]);
      setLoading(false);
      clearAllActionTimers();
      joinedGroupRef.current = '';
      flushOutboxRef.current = null;
      return undefined;
    }

    const groupCode = group.code;
    let mounted = true;
    const networkIsAvailable = () => typeof navigator === 'undefined' || navigator.onLine !== false;
    const readQueue = () => readOutbox(groupCode);
    const writeQueue = queue => writeOutbox(groupCode, queue);

    const flushOutbox = () => {
      if (!mounted || !socket.connected || !networkIsAvailable() || joinedGroupRef.current !== groupCode || outboxBusyRef.current) return;
      outboxBusyRef.current = true;
      const generation = flushGenerationRef.current;
      const sendNext = () => {
        if (!mounted || generation !== flushGenerationRef.current) return;
        if (!socket.connected || !networkIsAvailable() || joinedGroupRef.current !== groupCode) {
          outboxBusyRef.current = false;
          setPendingAction('');
          return;
        }
        const queue = readQueue();
        const action = queue[0];
        if (!action) {
          outboxBusyRef.current = false;
          setPendingAction('');
          return;
        }
        const pendingLabel = action.pendingLabel || action.queueId;
        setPendingAction(pendingLabel);
        startActionTimer(action.queueId, pendingLabel);
        socket.emit(action.event, action.payload, result => {
          if (!mounted) return;
          let shouldContinue = false;
          try {
            const currentQueue = readQueue();
            if (!result?.ok) {
              setError(result?.error || 'A saved SOS action is waiting to sync');
              outboxBusyRef.current = false;
              return;
            }

            let remaining = currentQueue.filter(item => item.queueId !== action.queueId);
            if (action.event === 'sos:create' && action.localAlertId && result.alert?.id) {
              remaining = remaining.map(item => item.payload?.alertId === action.localAlertId
                ? { ...item, payload: { ...item.payload, alertId: result.alert.id } }
                : item);
            }
            writeQueue(remaining);
            if (result.alert) {
              const hasMoreForAlert = remaining.some(item =>
                item.payload?.alertId === result.alert.id || item.localAlertId === result.alert.id ||
                (action.localAlertId && (item.payload?.alertId === action.localAlertId || item.localAlertId === action.localAlertId))
              );
              const savedAlert = { ...result.alert, localSyncPending: hasMoreForAlert };
              updateCachedAlerts(setAlerts, groupCode, current => {
                const withoutLocalCopy = action.event === 'sos:create' && action.localAlertId
                  ? current.filter(item => item.id !== action.localAlertId)
                  : current;
                return mergeAlerts(withoutLocalCopy, [savedAlert]);
              });
            }
            setError('');
            shouldContinue = true;
          } catch (actionError) {
            setError(actionError?.message || 'A saved SOS action is waiting to sync');
            outboxBusyRef.current = false;
          } finally {
            clearActionTimer(action.queueId);
            setPendingAction(current => current === pendingLabel ? '' : current);
            if (shouldContinue && generation === flushGenerationRef.current) sendNext();
          }
        });
      };
      sendNext();
    };
    flushOutboxRef.current = flushOutbox;

    const receiveAlert = (alert, source) => {
      if (alert?.groupCode !== groupCode) return;
      updateCachedAlerts(setAlerts, groupCode, current => mergeAlerts(current, [alert]));
      setVolunteerPopupQueue(current => current.map(item => item.id === alert.id ? alert : item));
      if (activeAlarmRef.current?.alertId === alert.id && (
        alert.status !== 'active' || alert.dispatch?.status === 'Accepted - En Route' ||
        alert.dispatch?.status === 'Resolved' || isAcknowledgedByActiveVolunteer(alert)
      )) stopVolunteerAlarm();
      notifyVolunteer(alert, source);
    };
    const onSosCreated = alert => receiveAlert(alert, 'sos:created');
    const onSosUpdated = alert => receiveAlert(alert, 'sos:updated');
    const onSosDispatch = alert => receiveAlert(alert, 'sos:dispatch');
    const onVolunteerUpdate = alert => receiveAlert(alert, 'sos:volunteer_update');
    const joinGroup = () => socket.emit('group:join', { code: groupCode, name: name.current }, result => {
      if (!mounted) return;
      if (result?.ok) {
        joinedGroupRef.current = groupCode;
        name.current = result.member.name;
        setVolunteerLabel(result.member.name);
        try { sessionStorage.setItem('groundlink-name', result.member.name); } catch { /* Session storage is optional. */ }
        setError('');
        flushOutbox();
      } else setError(result?.error || 'Unable to join this group');
    });
    const onConnect = () => { setConnected(true); joinGroup(); };
    const onDisconnect = () => {
      setConnected(false);
      joinedGroupRef.current = '';
      outboxBusyRef.current = false;
      flushGenerationRef.current += 1;
      clearAllActionTimers();
      setPendingAction('');
    };
    const onMemberUpdate = list => {
      setOnlineMembers(list);
      onMembers?.(list.length);
      flushOutbox();
    };

    const cachedAlerts = readGroupAlerts(groupCode);
    setAlerts(cachedAlerts);
    setOnlineMembers([]);
    setConnected(socket.connected);
    setNetworkOnline(networkIsAvailable());
    setLoading(networkIsAvailable());
    setError('');
    socket.on('sos:created', onSosCreated);
    socket.on('sos:updated', onSosUpdated);
    socket.on('sos:dispatch', onSosDispatch);
    socket.on('sos:volunteer_update', onVolunteerUpdate);
    socket.on('members:update', onMemberUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) {
      setConnected(true);
      joinGroup();
    } else socket.connect();

    if (networkIsAvailable()) {
      api(`/emergency-sos/${encodeURIComponent(groupCode)}`)
        .then(result => {
          if (mounted) updateCachedAlerts(setAlerts, groupCode, current => mergeAlerts(current, result));
        })
        .catch(requestError => { if (mounted) setError(requestError.message || 'Unable to load SOS alerts'); })
        .finally(() => { if (mounted) setLoading(false); });
    } else setLoading(false);

    return () => {
      mounted = false;
      stopVolunteerAlarm();
      if (flushOutboxRef.current === flushOutbox) flushOutboxRef.current = null;
      if (joinedGroupRef.current === groupCode) joinedGroupRef.current = '';
      outboxBusyRef.current = false;
      flushGenerationRef.current += 1;
      clearAllActionTimers();
      socket.off('sos:created', onSosCreated);
      socket.off('sos:updated', onSosUpdated);
      socket.off('sos:dispatch', onSosDispatch);
      socket.off('sos:volunteer_update', onVolunteerUpdate);
      socket.off('members:update', onMemberUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [group?.code, onMembers]);

  const activeAlerts = useMemo(() => alerts.filter(alert => alert.status === 'active'), [alerts]);
  const crowdSurgeAlert = activeAlerts.find(alert => alert.isCrowdSurge);
  const ownAlerts = alerts.filter(alert => String(alert.createdBy || '').trim().toLowerCase() === name.current.toLowerCase());
  const assignedAlerts = alerts.filter(alert => alert.dispatch && (
    Boolean(alert.dispatch.volunteerId && alert.dispatch.volunteerId === socket.id) ||
    String(alert.dispatch.volunteer || '').trim().toLowerCase() === volunteerLabel.trim().toLowerCase()
  ));
  const visibleAlerts = role === 'Attendee' ? ownAlerts : role === 'Volunteer' ? assignedAlerts : activeAlerts;
  const visibleActiveAlerts = visibleAlerts.filter(alert => alert.status === 'active');
  const visibleResolvedAlerts = visibleAlerts.filter(alert => alert.status === 'resolved');

  function requestSos(event) {
    event.preventDefault();
    setError('');
    setConfirming(true);
  }

  function startVoiceCapture(event) {
    event.preventDefault();
    const Recognition = speechRecognitionConstructor();
    if (!Recognition || !networkOnline) {
      setVoiceFailed(true);
      setSpeechFallback('Offline Quick-SOS Active. Choose a quick phrase below or type a note.');
      return;
    }
    if (recognitionRef.current) return;

    try {
      const recognition = new Recognition();
      speechTranscriptRef.current = '';
      speechErrorRef.current = '';
      setSpeechPreview('');
      recognition.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-IN') : 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = resultEvent => {
        const transcript = Array.from(resultEvent.results)
          .map(result => result[0]?.transcript || '')
          .join(' ')
          .trim();
        speechTranscriptRef.current = transcript;
        setSpeechPreview(transcript);
      };
      recognition.onerror = errorEvent => {
        setListening(false);
        setVoiceFailed(true);
        const message = errorEvent.error === 'not-allowed' || errorEvent.error === 'service-not-allowed'
          ? 'Offline Quick-SOS Active. Allow microphone access or choose a quick phrase below.'
          : errorEvent.error === 'no-speech'
            ? 'Offline Quick-SOS Active. No words heard; choose a quick phrase below.'
            : errorEvent.error === 'network' || (typeof navigator !== 'undefined' && navigator.onLine === false)
              ? 'Offline Quick-SOS Active. Voice needs a network connection; choose a quick phrase below.'
              : 'Offline Quick-SOS Active. Voice is unavailable; choose a quick phrase below.';
        speechErrorRef.current = message;
        setSpeechFallback(message);
        recognitionRef.current = null;
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
        const transcript = speechTranscriptRef.current.trim().slice(0, 180);
        setSpeechPreview('');
        if (!transcript) {
          setVoiceFailed(true);
          setSpeechFallback(speechErrorRef.current || 'No words heard yet. Try again or choose an emergency card.');
          return;
        }
        setVoiceFailed(false);
        setCategory(current => inferCategory(transcript, current));
        setNote(transcript);
        setSpeechFallback('Voice note ready. Review it before sending.');
        setConfirming(true);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setSpeechFallback('Keep holding while you speak. Release to review the SOS before sending.');
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceFailed(true);
      setSpeechFallback('Offline Quick-SOS Active. Voice could not start; choose a quick phrase below.');
    }
  }

  function stopVoiceCapture(event) {
    event?.preventDefault?.();
    if (!recognitionRef.current) return;
    setSpeechFallback('Finishing your voice note…');
    try { recognitionRef.current.stop(); }
    catch {
      recognitionRef.current = null;
      setListening(false);
      setSpeechFallback('Voice input stopped. Type a note or choose an emergency card.');
    }
  }

  function toggleVoiceCapture(event) {
    if (recognitionRef.current) stopVoiceCapture(event);
    else startVoiceCapture(event);
  }

  function triggerQuickChip(quickAlert) {
    setCategory(quickAlert.category);
    setNote(quickAlert.note);
    setZone('');
    setLocationHighlighted(quickAlert.category !== 'Other');
    setSpeechPreview('');
    setSpeechFallback(speechRecognitionConstructor() ? '' : 'Voice isn’t available on this device. Type a note or choose an emergency card.');
    setError('');
    setTimeout(() => {
      if (quickAlert.category === 'Other') noteInputRef.current?.focus();
      else locationInputRef.current?.focus();
    }, 0);
  }

  async function changeRole(nextRole) {
    roleRef.current = nextRole;
    if (nextRole !== 'Volunteer') stopVolunteerAlarm();
    if (nextRole !== 'Attendee') {
      setConfirming(false);
      const recognition = recognitionRef.current;
      if (recognition) {
        recognitionRef.current = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try { recognition.abort?.(); } catch { /* The browser may already have ended capture. */ }
      }
      setListening(false);
      setSpeechPreview('');
    }
    setRole(nextRole);
    if (nextRole === 'Volunteer') {
      const audioContext = prepareAlertAudio();
      if (audioContext) {
        try {
          await audioContext.resume();
          setAudioUnlocked(audioContext.state === 'running');
        } catch (audioError) {
          setAudioUnlocked(false);
          console.warn('[Emergency SOS] Audio could not be unlocked from the Volunteer tab click.', audioError);
        }
      }
      startPendingVolunteerAlarm();
    }
  }

  function getDispatchSelection(alertId) {
    const selection = dispatchSelections[alertId] || {};
    const volunteerId = onlineMembers.some(member => member.id === selection.volunteerId)
      ? selection.volunteerId
      : onlineMembers[0]?.id || '';
    return { volunteerId, eta: selection.eta ?? '5' };
  }

  function setDispatchSelection(alertId, patch) {
    setDispatchSelections(current => ({
      ...current,
      [alertId]: { ...(current[alertId] || {}), ...patch }
    }));
  }

  function saveVolunteerLabel() {
    const label = volunteerLabel.trim().slice(0, 32);
    if (!label) { setError('Enter a volunteer name or label first'); return; }
    if (!socket.connected) { setError('Reconnect to the group network before saving your volunteer label'); return; }
    socket.emit('group:join', { code: group.code, name: label }, result => {
      if (!result?.ok) { setError(result?.error || 'Volunteer label could not be saved'); return; }
      name.current = result.member.name;
      setVolunteerLabel(result.member.name);
      try { sessionStorage.setItem('groundlink-name', result.member.name); } catch { /* Session storage is optional. */ }
      setError('');
    });
  }

  function dispatchVolunteer(alertId) {
    try {
      const selection = getDispatchSelection(alertId);
      const volunteer = onlineMembers.find(member => member.id === selection.volunteerId)?.name || '';
      const eta = Number(selection.eta);
      if (!alertId || !volunteer || !Number.isFinite(eta) || eta < 1 || eta > 1440) {
        setError('Choose an SOS, a volunteer, and an ETA before sending');
        return;
      }
      setError('');
      const dispatchedAt = new Date().toISOString();
      queueSosAction('sos:dispatch', {
        alertId,
        volunteer,
        eta: `${eta} min`
      }, {
        optimisticUpdate: current => current.map(alert => alert.id === alertId ? {
          ...alert,
          dispatch: { volunteer, eta: `${eta} min`, status: 'Dispatched', dispatchedAt },
          localSyncPending: true,
          updatedAt: dispatchedAt
        } : alert)
      });
    } catch (actionError) {
      setError(actionError?.message || 'Volunteer dispatch could not be saved');
    } finally {
      if (!connectionReady) setPendingAction('');
    }
  }

  function updateVolunteerStatus(alertId, status) {
    const targetAlert = alertsRef.current.find(alert => alert.id === alertId);
    const key = assignmentKey(targetAlert);
    if (key) dismissedAssignmentsRef.current.add(key);
    stopVolunteerAlarm();
    setVolunteerPopupQueue(current => current.filter(alert => alert.id !== alertId));
    setAlarmNotice(status === 'Resolved' ? 'Alarm stopped: emergency marked resolved.' : 'Alarm stopped: volunteer is on the way.');
    try {
      setError('');
      const updatedAt = new Date().toISOString();
      queueSosAction('sos:volunteer_update', { alertId, status }, {
        optimisticUpdate: current => current.map(alert => alert.id === alertId ? {
          ...alert,
          dispatch: { ...(alert.dispatch || {}), volunteer: alert.dispatch?.volunteer || volunteerLabel, status },
          status: status === 'Resolved' ? 'resolved' : alert.status,
          resolvedBy: status === 'Resolved' ? volunteerLabel : alert.resolvedBy,
          resolvedAt: status === 'Resolved' ? updatedAt : alert.resolvedAt,
          localSyncPending: true,
          updatedAt
        } : alert)
      });
    } catch (actionError) {
      setError(actionError?.message || 'Volunteer update could not be saved');
    } finally {
      if (!connectionReady) setPendingAction('');
    }
  }

  function sendSos(payload = { category, note, zone }) {
    try {
      const createdAt = new Date().toISOString();
      const localAlert = {
        id: newLocalId('local-sos'),
        groupCode: group.code,
        category: payload.category,
        note: payload.note || '',
        text: payload.note || '',
        zone: payload.zone || '',
        createdBy: name.current,
        status: 'active',
        severity: 'P2 High',
        score: 5,
        createdAt,
        updatedAt: createdAt,
        localSyncPending: true
      };
      setError('');
      queueSosAction('sos:create', payload, { localAlert });
      setNote('');
      setZone('');
      setConfirming(false);
      setSpeechFallback('');
    } catch (actionError) {
      setError(actionError?.message || 'SOS alert could not be saved');
    } finally {
      if (!connectionReady) setPendingAction('');
    }
  }

  function triggerQuickPhrase(item) {
    const payload = { category: item.category, note: item.phrase, zone: item.zone || zone };
    setCategory(item.category);
    sendSos(payload);
  }

  if (!group) return <section className="sos-panel sos-gate"><div className="sos-eyebrow">GROUP REQUIRED</div><h2>Join or create a group to use Emergency SOS</h2><p>SOS alerts are shared with members of your active group on the local network.</p></section>;

  return <section className="sos-panel" aria-labelledby="sos-title">
    <div className="sos-panel-heading">
      <div><div className="sos-eyebrow">URGENT GROUP RESPONSE</div><h2 id="sos-title">Emergency SOS</h2><p>Alerts for <strong>{group.name}</strong></p></div>
      <div className={`sos-connection ${connectionReady ? 'is-online' : 'is-offline'}`} style={!connectionReady ? { color: '#ffd27b', background: '#332719', borderColor: '#a9752f' } : undefined} role="status" aria-live="polite"><span/>{connectionReady ? 'Local Network Live' : 'Offline Mode \u2014 Saved Locally'}</div>
    </div>

    <div role="group" aria-label="SOS demo role" style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', margin: '12px 20px 0', padding: 5, border: '1px solid #29332b', borderRadius: 6, background: '#090e0a' }}>
      <span style={{ padding: '0 7px', color: '#7f8c80', fontSize: 8, fontWeight: 800, letterSpacing: '.9px' }}>ROLE</span>
      {[
        { value: 'Attendee', label: 'I Need Help' },
        { value: 'Volunteer', label: 'Volunteer' },
        { value: 'Host Command', label: 'Organizer' }
      ].map(item => <button key={item.value} type="button" aria-pressed={role === item.value} onClick={() => changeRole(item.value)} style={{ minHeight: 29, padding: '0 10px', border: `1px solid ${role === item.value ? '#526d3b' : 'transparent'}`, borderRadius: 4, background: role === item.value ? '#1a2818' : 'transparent', color: role === item.value ? '#c9f58d' : '#9aa69b', fontSize: 9, fontWeight: 750, cursor: 'pointer' }}>{item.label}</button>)}
      {role === 'Volunteer' && <button type="button" aria-pressed={soundEnabled} onClick={toggleAlertSound} style={{ minHeight: 29, marginLeft: 'auto', padding: '0 10px', border: '1px solid #53664a', borderRadius: 4, background: soundEnabled ? '#1a2818' : '#332719', color: soundEnabled ? '#c9f58d' : '#ffd27b', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>{soundEnabled ? 'Sound On' : 'Muted'}</button>}
      {role === 'Volunteer' && <button type="button" onClick={testEmergencySiren} style={{ minHeight: 29, padding: '0 10px', border: '1px solid #a9752f', borderRadius: 4, background: '#49351c', color: '#fff0cb', fontSize: 9, fontWeight: 850, cursor: 'pointer' }}>Test Emergency Siren</button>}
      {role === 'Volunteer' && <span role="status" aria-live="polite" style={{ padding: '0 6px', color: audioUnlocked && audioContextRef.current?.state === 'running' ? '#9be279' : '#ffd27b', fontSize: 8, fontWeight: 800 }}>{audioUnlocked && audioContextRef.current?.state === 'running' ? 'Sound Unlocked' : 'Click "Test Emergency Siren" Once to Enable Sound'}</span>}
    </div>

    {role === 'Volunteer' && alarmNotice && <p role="status" aria-live="polite" style={{ margin: '8px 20px 0', color: '#c8d7c9', fontSize: 9 }}>{alarmNotice}</p>}

    {role === 'Volunteer' && volunteerPopupQueue[0] && <div role="alert" aria-live="assertive" style={{ position: 'relative', zIndex: 2, display: 'grid', gap: 10, margin: '14px 20px 0', padding: 16, border: '2px solid #ffcc52', borderLeft: '7px solid #ff5a38', borderRadius: 8, background: 'linear-gradient(120deg,#351b18,#211914)', color: '#fff1d2', boxShadow: '0 8px 28px #0009' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <strong style={{ color: '#ffcf58', fontSize: 12, letterSpacing: '.5px' }}>EMERGENCY ALERT</strong>
        <button type="button" onClick={() => dismissVolunteerPopup(true)} style={{ minHeight: 32, padding: '0 10px', border: '1px solid #a9752f', borderRadius: 5, background: '#49351c', color: '#fff0cb', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>Dismiss / Mute</button>
      </div>
      <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>{categoryLabel(volunteerPopupQueue[0].category)}</h3>
      <p style={{ margin: 0, color: '#ffdfa0', fontSize: 12, fontWeight: 750 }}>{volunteerPopupQueue[0].zone || 'Location not shared'} <span style={{ color: '#c3ad8e' }}>· ETA: {formatEta(volunteerPopupQueue[0].dispatch?.eta) || 'Not set'}</span></p>
      {volunteerPopupQueue[0].note && <p style={{ margin: 0, color: '#ecd8bd', fontSize: 10 }}>{volunteerPopupQueue[0].note}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 9 }}>
        <button type="button" className="sos-ack-button" onClick={acknowledgeVolunteerPopup} style={{ minHeight: 46, fontSize: 11, fontWeight: 900 }}>Acknowledge</button>
        <button type="button" className="sos-ack-button" onClick={() => respondToVolunteerPopup('Accepted - En Route')} style={{ minHeight: 46, fontSize: 11, fontWeight: 900 }}>On My Way</button>
        <button type="button" className="sos-resolve-button" onClick={() => respondToVolunteerPopup('Resolved')} style={{ minHeight: 46, fontSize: 11, fontWeight: 900 }}>Done / Resolved</button>
      </div>
    </div>}

    {role === 'Volunteer' && <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap', margin: '10px 20px 0', padding: 12, border: '1px solid #344333', borderRadius: 6, background: '#101610' }}>
      <label style={{ display: 'grid', flex: '1 1 190px', gap: 5, color: '#a7b0a7', fontSize: 8, fontWeight: 750 }}>Your Name
        <input value={volunteerLabel} onChange={event => setVolunteerLabel(event.target.value)} maxLength={32} placeholder="e.g. First Aid Team A" style={{ height: 34, minWidth: 0, padding: '0 9px', border: '1px solid #303a32', borderRadius: 4, background: '#090e0a', color: '#e3ebe4', fontSize: 9 }}/>
      </label>
      <button className="sos-ack-button" type="button" onClick={saveVolunteerLabel} disabled={!connectionReady}>Save Name</button>
    </div>}

        {crowdSurgeAlert && <div role="alert" aria-live="assertive" style={{ margin: '14px 20px 0', padding: '14px 16px', border: '1px solid #a94f36', borderLeft: '5px solid #ff7048', borderRadius: 6, background: 'linear-gradient(105deg,#3a1e17,#211712)', color: '#ffe1d2' }}>Multiple alerts in {crowdSurgeAlert.zone || 'your area'} — Please move to a safe open area.</div>}

    {role === 'Attendee' && <form className="sos-trigger-form" onSubmit={requestSos}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#edf2eb', fontSize: 14 }}>Need help?</h3>
          <p style={{ margin: '5px 0 0', color: '#9ca99d', fontSize: 9 }}>Choose a card or tell us what happened.</p>
        </div>
        <button type="submit" className="sos-trigger-button" style={{ width: '100%', minHeight: 58, border: '1px solid #ff6a55', borderRadius: 7, background: 'linear-gradient(110deg,#d93531,#ae211f)', color: '#fff', fontSize: 15, fontWeight: 900, letterSpacing: '.6px', boxShadow: '0 6px 18px #8d211f55', cursor: 'pointer' }}>TAP FOR EMERGENCY HELP</button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 9 }}>
          {quickAlerts.map(item => {
            const selected = category === item.category;
            const palette = item.category === 'Medical'
              ? { border: '#4d8a58', background: '#183522', color: '#c8f2cb' }
              : item.category === 'Fire'
                ? { border: '#a85a32', background: '#392317', color: '#ffd1b1' }
                : { border: '#6960a0', background: '#272343', color: '#d7d2ff' };
            return <button key={item.label} type="button" aria-pressed={selected} onClick={() => triggerQuickChip(item)} style={{ minHeight: 66, padding: '11px 12px', border: `2px solid ${selected ? palette.border : '#303a32'}`, borderRadius: 7, background: selected ? palette.background : '#111611', color: selected ? palette.color : '#dce5dc', fontSize: 11, fontWeight: 850, cursor: 'pointer', textAlign: 'left', boxShadow: selected ? `0 0 0 2px ${palette.border}33` : 'none' }}>{item.label}</button>;
          })}
        </div>
      </div>
      <div className="sos-fields" style={{ marginTop: 14 }}>
        <label className="sos-note-field"> WHERE ARE YOU?
          <input ref={locationInputRef} list="sos-location-options" value={zone} onChange={event => { setZone(event.target.value); setLocationHighlighted(false); }} placeholder="Choose a place or type your own" maxLength={80} style={locationHighlighted ? { border: '2px solid #d7ef73', boxShadow: '0 0 0 3px #bbff4a33' } : undefined}/>
          <datalist id="sos-location-options">
            <option value="Main Stage"/>
            <option value="Entry Gate"/>
            <option value="Cafeteria"/>
            <option value="North Gate"/>
            <option value="Parking Area"/>
          </datalist>
        </label>
        <label className="sos-note-field"> WHAT HAPPENED? <span>(optional)</span>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
            <input ref={noteInputRef} value={note} onChange={event => setNote(event.target.value)} placeholder={category === 'Other' ? 'Describe your emergency' : 'Add a few words, or speak'} maxLength={180} style={{ flex: 1, minWidth: 0 }}/>
            <button type="button" aria-pressed={listening} onClick={toggleVoiceCapture} style={{ flex: '0 0 auto', minHeight: 36, padding: '0 11px', border: `1px solid ${listening ? '#d69b45' : '#526d3b'}`, borderRadius: 5, background: listening ? '#332719' : '#182319', color: listening ? '#ffe0a0' : '#c9f58d', fontSize: 9, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>{listening ? 'Stop Speaking' : 'Speak Your Emergency'}</button>
          </div>
        </label>
      </div>
      {speechPreview && <p aria-live="polite" style={{ margin: '8px 0 0', color: '#e0e8df', fontSize: 9 }}>Heard: {speechPreview}</p>}
      {speechFallback && <p role="status" style={{ margin: '8px 0 0', color: '#9ca99d', fontSize: 9, lineHeight: 1.5 }}>{speechFallback}</p>}
      {offlineQuickMode && <div role="status" style={{ display: 'grid', gap: 9, marginTop: 12, padding: 12, border: '1px solid #a9752f', borderRadius: 6, background: '#332719', color: '#ffe2a7' }}>
        <div><strong style={{ display: 'block', fontSize: 12 }}>Offline Quick-SOS Active</strong><span style={{ display: 'block', marginTop: 4, fontSize: 9 }}>Tap a phrase to save the alert on this device and sync it when the group reconnects.</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 7 }}>
          {quickPhrases.map(item => <button key={item.phrase} type="button" onClick={() => triggerQuickPhrase(item)} style={{ minHeight: 42, padding: '8px 10px', border: '1px solid #a9752f', borderRadius: 5, background: '#49351c', color: '#fff0cb', fontSize: 10, fontWeight: 800, textAlign: 'left', cursor: 'pointer' }}>{item.phrase}</button>)}
        </div>
      </div>}
      <p style={{ margin: '10px 0 0', color: '#8e9a90', fontSize: 8 }}>We’ll ask you to confirm before sharing this with your group.</p>
    </form>}

    {error && <div className="sos-error" role="alert">{error}</div>}

    <div className="sos-alerts-section">
      <div className="sos-list-heading"><div><div className="sos-eyebrow">{role === 'Attendee' ? 'YOUR REQUESTS' : role === 'Volunteer' ? 'YOUR ASSIGNMENTS' : 'GROUP ALERTS'}</div><h3>{role === 'Attendee' ? 'My help status' : role === 'Volunteer' ? 'Assigned emergencies' : 'Incoming emergencies'} <span>{visibleActiveAlerts.length}</span></h3></div></div>
      {loading && <p className="sos-empty">Loading group alerts…</p>}
      {!loading && visibleActiveAlerts.length === 0 && <p className="sos-empty">{role === 'Attendee' ? 'You have no active SOS alerts.' : role === 'Volunteer' ? 'No active emergencies are assigned to you.' : 'No active incoming emergencies.'}</p>}
      <div className="sos-alert-list">
        {visibleActiveAlerts.map(alert => {
          const assignedToMe = role === 'Volunteer' && alert.dispatch && (
            Boolean(alert.dispatch.volunteerId && alert.dispatch.volunteerId === socket.id) ||
            String(alert.dispatch.volunteer || '').trim().toLowerCase() === volunteerLabel.trim().toLowerCase()
          );
          const acceptingDispatch = pendingAction === `${alert.id}:volunteer:Accepted - En Route`;
          const resolvingDispatch = pendingAction === `${alert.id}:volunteer:Resolved`;
          const dispatchPending = pendingAction === `${alert.id}:dispatch`;
          const dispatchSelection = getDispatchSelection(alert.id);
          return <article className={`sos-alert-card is-active ${assignedToMe ? 'is-assigned-to-me' : ''}`} key={alert.id} style={assignedToMe ? { borderColor: '#8bbf55', boxShadow: '0 0 0 1px #8bbf5540' } : undefined}>
                        <AlertSummary alert={alert}/>
            {role === 'Host Command' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px,1fr) minmax(90px,.55fr)', gap: 8, alignItems: 'end', marginTop: 12, paddingTop: 10, borderTop: '1px solid #354333' }}>
              <label style={{ display: 'grid', gap: 5, color: '#a7b0a7', fontSize: 8, fontWeight: 750 }}>ONLINE VOLUNTEER
                <select value={dispatchSelection.volunteerId} onChange={event => setDispatchSelection(alert.id, { volunteerId: event.target.value })} disabled={!onlineMembers.length} style={{ height: 36, minWidth: 0, padding: '0 8px', border: '1px solid #303a32', borderRadius: 4, background: '#090e0a', color: '#e3ebe4', fontSize: 9 }}>
                  {!onlineMembers.length && <option value="">No volunteers online</option>}
                  {onlineMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5, color: '#a7b0a7', fontSize: 8, fontWeight: 750 }}>ETA (MIN)
                <input type="number" min="1" max="1440" value={dispatchSelection.eta} onChange={event => setDispatchSelection(alert.id, { eta: event.target.value })} style={{ height: 36, minWidth: 0, padding: '0 8px', border: '1px solid #303a32', borderRadius: 4, background: '#090e0a', color: '#e3ebe4', fontSize: 9 }}/>
              </label>
              <button type="button" className="sos-trigger-button" onClick={() => dispatchVolunteer(alert.id)} disabled={!dispatchSelection.volunteerId || !dispatchSelection.eta || dispatchPending} style={{ gridColumn: '1/-1', minHeight: 44, fontSize: 11 }}>{dispatchPending ? 'Sending…' : 'Send Volunteer'}</button>
            </div>}
            {role === 'Volunteer' && assignedToMe && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 13 }}>
              <button type="button" className="sos-ack-button" onClick={() => updateVolunteerStatus(alert.id, 'Accepted - En Route')} disabled={alert.dispatch?.status === 'Accepted - En Route' || Boolean(pendingAction && connectionReady)} style={{ minHeight: 44, fontSize: 10, fontWeight: 850 }}>{acceptingDispatch ? 'Updating…' : 'On My Way'}</button>
              <button type="button" className="sos-resolve-button" onClick={() => updateVolunteerStatus(alert.id, 'Resolved')} disabled={Boolean(pendingAction && connectionReady)} style={{ minHeight: 44, fontSize: 10, fontWeight: 850 }}>{resolvingDispatch ? 'Saving…' : 'Done / Resolved'}</button>
            </div>}
          </article>;
        })}
      </div>
    </div>

    {role !== 'Host Command' && visibleResolvedAlerts.length > 0 && <div className="sos-alerts-section resolved-section">
      <div className="sos-list-heading"><div><div className="sos-eyebrow">COMPLETED</div><h3>{role === 'Attendee' ? 'My resolved SOS' : 'Resolved assignments'} <span>{visibleResolvedAlerts.length}</span></h3></div></div>
      <div className="sos-alert-list">
        {visibleResolvedAlerts.map(alert => {
          const assignedToMe = role === 'Volunteer' && alert.dispatch && (
            Boolean(alert.dispatch.volunteerId && alert.dispatch.volunteerId === socket.id) ||
            String(alert.dispatch.volunteer || '').trim().toLowerCase() === volunteerLabel.trim().toLowerCase()
          );
          return <article className={`sos-alert-card is-resolved ${assignedToMe ? 'is-assigned-to-me' : ''}`} key={alert.id} style={assignedToMe ? { borderColor: '#8bbf55', boxShadow: '0 0 0 1px #8bbf5540' } : undefined}>
                    <AlertSummary alert={alert}/>
        </article>;
        })}
      </div>
    </div>}

    {confirming && <Modal title="Send help now?" onClose={() => setConfirming(false)}>
      <p className="modal-copy">We’ll send this help request to the organizers and volunteers in <strong>{group.name}</strong>.</p>
      <div className="sos-confirm-summary"><strong>{category}</strong>{zone && <span>Zone: {zone}</span>}{note && <span>{note}</span>}</div>
      <div className="sos-confirm-actions"><button className="button button-secondary" type="button" onClick={() => setConfirming(false)}>Go Back</button><button className="sos-trigger-button" type="button" onClick={() => sendSos({ category, note, zone })} disabled={Boolean(pendingAction && connectionReady)}>{pendingAction && connectionReady ? 'Saving' : 'Yes, Send Help Now'}</button></div>
    </Modal>}
  </section>;
}
