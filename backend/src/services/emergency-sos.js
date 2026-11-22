import { createId } from '../utils/ids.js';
import { getStore, updateStore } from './storage.js';

export const SOS_CATEGORIES = ['Medical', 'Safety', 'Fire', 'Missing person', 'Other'];

const normalizeGroupCode = code => String(code || '').trim().toUpperCase();
const normalizeName = name => String(name || 'Guest').trim().slice(0, 32) || 'Guest';
const normalizeZone = zone => String(zone || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function classifySosSeverity(input = {}, zoneValue, textValue) {
  const values = input && typeof input === 'object'
    ? input
    : { category: input, zone: zoneValue, text: textValue };
  const category = String(values.category || '').trim().toLowerCase();
  const zone = String(values.zone || '').trim().toLowerCase();
  const text = String(values.transcript || values.text || '').trim().toLowerCase();
  const combined = `${category} ${zone} ${text}`;
  const baseScores = { medical: 4, safety: 4, fire: 8, 'missing person': 4, other: 3 };
  let score = baseScores[category] || 3;

  const criticalPatterns = [
    /not breathing|cannot breathe|can't breathe|cardiac arrest|heart attack|unconscious|unresponsive|severe bleeding|heavy bleeding|life threatening|crushed|trapped|stampede|\bfire\b|\bsmoke\b|weapon|seizure/i
  ];
  if (criticalPatterns.some(pattern => pattern.test(combined))) score = Math.max(score, 9);
  if (/not breathing|cardiac arrest|life threatening|crushed|stampede/i.test(combined)) score = 10;
  if (/injur|bleeding|faint|lost child|missing child|missing person|separated|assault|panic|crowd pressure|hurt|collision|crash/i.test(combined)) score += 2;
  if (/urgent|immediately|help now|need help/i.test(text)) score += 1;
  if (/gate|entrance|exit|stair|stage|platform|barricade|crowd|parking|road/i.test(zone)) score += 1;
  score = Math.max(1, Math.min(10, score));

  const severity = score >= 8 ? 'P1 Critical' : score >= 5 ? 'P2 High' : 'P3 Medium';
  const actionChecklist = severity === 'P1 Critical'
    ? [
        'Dispatch the nearest available volunteer immediately and contact local emergency responders if the situation is life-threatening.',
        'Keep the zone clear, share location updates, and confirm that help has reached the person.'
      ]
    : severity === 'P2 High'
      ? [
          'Acknowledge the SOS and assign an available volunteer with an ETA.',
          'Verify the reported zone and escalate if symptoms or risk worsen.'
        ]
      : [
          'Acknowledge the SOS and confirm the note and zone with the reporter.',
          'Monitor updates and dispatch support if the situation changes.'
        ];

  return { severity, score, actionChecklist };
}

export async function listSosAlerts(groupCode) {
  const code = normalizeGroupCode(groupCode);
  const store = await getStore();
  if (!store.groups.some(group => group.code === code)) return null;
  return (store.sosAlerts || [])
    .filter(alert => alert.groupCode === code)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSosAlert({ groupCode, category, note, zone, reporter, text, transcript }) {
  const code = normalizeGroupCode(groupCode);
  const normalizedCategory = String(category || '').trim();
  if (!SOS_CATEGORIES.includes(normalizedCategory)) return { error: 'Choose a valid SOS category' };
  const normalizedZone = String(zone || '').trim().slice(0, 80);
  const normalizedText = String(transcript || text || note || '').trim().slice(0, 300);
  const classification = classifySosSeverity({ category: normalizedCategory, zone: normalizedZone, text: normalizedText });
  const createdAt = new Date().toISOString();

  const alert = {
    id: createId(10),
    groupCode: code,
    category: normalizedCategory,
    note: String(note || normalizedText).trim().slice(0, 180),
    text: normalizedText,
    zone: normalizedZone,
    createdBy: normalizeName(reporter),
    ...classification,
    createdAt,
    updatedAt: createdAt,
    status: 'active',
    isCrowdSurge: false,
    surgeCount: 1,
    acknowledgements: []
  };

  const result = await updateStore(store => {
    if (!store.groups.some(group => group.code === code)) return null;
    store.sosAlerts ||= [];
    store.sosAlerts.push(alert);
    const zoneKey = normalizeZone(normalizedZone);
    if (!zoneKey) return { alert, surgeAlerts: [] };

    const now = Date.parse(createdAt);
    const zoneAlerts = store.sosAlerts.filter(item => {
      const created = Date.parse(item.createdAt);
      return item.groupCode === code && item.status === 'active' && normalizeZone(item.zone) === zoneKey &&
        Number.isFinite(created) && created >= now - 60_000 && created <= now;
    });
    if (zoneAlerts.length < 2) return { alert, surgeAlerts: [] };

    for (const zoneAlert of zoneAlerts) {
      zoneAlert.isCrowdSurge = true;
      zoneAlert.surgeCount = zoneAlerts.length;
      zoneAlert.updatedAt = createdAt;
    }
    return { alert, surgeAlerts: zoneAlerts.map(item => ({ ...item, acknowledgements: [...(item.acknowledgements || [])] })) };
  });
  return result || { error: 'Group not found' };
}

export async function updateSosAlert({ groupCode, alertId, action, actor }) {
  const code = normalizeGroupCode(groupCode);
  const name = normalizeName(actor);
  return updateStore(store => {
    if (!store.groups.some(group => group.code === code)) return { error: 'Group not found' };
    const alert = (store.sosAlerts || []).find(item => item.groupCode === code && item.id === alertId);
    if (!alert) return { error: 'SOS alert not found' };

    if (action === 'acknowledge') {
      if (alert.status !== 'active') return { error: 'Resolved SOS alerts cannot be acknowledged' };
      alert.acknowledgements ||= [];
      if (!alert.acknowledgements.some(item => item.name === name)) {
        alert.acknowledgements.push({ name, at: new Date().toISOString() });
        alert.updatedAt = new Date().toISOString();
      }
      return { alert };
    }

    if (action === 'resolve') {
      if (alert.status !== 'resolved') {
        alert.status = 'resolved';
        alert.resolvedBy = name;
        alert.resolvedAt = new Date().toISOString();
        alert.updatedAt = alert.resolvedAt;
        if (alert.dispatch) alert.dispatch.status = 'Resolved';
      }
      return { alert };
    }

    return { error: 'Unsupported SOS action' };
  });
}

export async function dispatchSosVolunteer({ groupCode, alertId, volunteer, volunteerId, eta, etaMinutes, dispatcher }) {
  const code = normalizeGroupCode(groupCode);
  const volunteerName = normalizeName(volunteer);
  const etaValue = String(eta ?? etaMinutes ?? '').trim().slice(0, 48);
  if (!etaValue) return { error: 'ETA is required' };

  return updateStore(store => {
    if (!store.groups.some(group => group.code === code)) return { error: 'Group not found' };
    const alert = (store.sosAlerts || []).find(item => item.groupCode === code && item.id === alertId);
    if (!alert) return { error: 'SOS alert not found' };
    if (alert.status !== 'active') return { error: 'Only active SOS alerts can be dispatched' };
    const assignedAt = new Date().toISOString();
    alert.dispatch = {
      volunteer: volunteerName,
      volunteerId: String(volunteerId || '').trim() || undefined,
      eta: etaValue,
      assignedBy: normalizeName(dispatcher),
      assignedAt,
      status: 'Dispatched'
    };
    alert.updatedAt = assignedAt;
    return { alert };
  });
}

export async function updateSosVolunteerStatus({ groupCode, alertId, status, actor, actorId }) {
  const code = normalizeGroupCode(groupCode);
  const name = normalizeName(actor);
  const allowedStatuses = ['Accepted - En Route', 'Resolved'];
  if (!allowedStatuses.includes(status)) return { error: 'Unsupported volunteer status' };

  return updateStore(store => {
    if (!store.groups.some(group => group.code === code)) return { error: 'Group not found' };
    const alert = (store.sosAlerts || []).find(item => item.groupCode === code && item.id === alertId);
    if (!alert) return { error: 'SOS alert not found' };
    if (!alert.dispatch) return { error: 'No volunteer has been dispatched to this SOS' };
    const isAssignedVolunteer = (actorId && alert.dispatch.volunteerId === actorId) || alert.dispatch.volunteer === name;
    if (!isAssignedVolunteer) return { error: 'Only the assigned volunteer can update this SOS' };
    if (alert.status === 'resolved' && status !== 'Resolved') return { error: 'Resolved SOS alerts cannot be updated' };

    const updatedAt = new Date().toISOString();
    alert.dispatch.status = status;
    alert.dispatch.updatedAt = updatedAt;
    alert.updatedAt = updatedAt;
    if (status === 'Resolved' && alert.status !== 'resolved') {
      alert.status = 'resolved';
      alert.resolvedBy = name;
      alert.resolvedAt = updatedAt;
    }
    return { alert };
  });
}
