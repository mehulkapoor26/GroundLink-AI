import { createId } from '../utils/ids.js';
import { getStore, updateStore } from './storage.js';

export const SOS_CATEGORIES = ['Medical', 'Safety', 'Fire', 'Missing person', 'Other'];

const normalizeGroupCode = code => String(code || '').trim().toUpperCase();
const normalizeName = name => String(name || 'Guest').trim().slice(0, 32) || 'Guest';

export async function listSosAlerts(groupCode) {
  const code = normalizeGroupCode(groupCode);
  const store = await getStore();
  if (!store.groups.some(group => group.code === code)) return null;
  return (store.sosAlerts || [])
    .filter(alert => alert.groupCode === code)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSosAlert({ groupCode, category, note, zone, reporter }) {
  const code = normalizeGroupCode(groupCode);
  const normalizedCategory = String(category || '').trim();
  if (!SOS_CATEGORIES.includes(normalizedCategory)) return { error: 'Choose a valid SOS category' };

  const alert = {
    id: createId(10),
    groupCode: code,
    category: normalizedCategory,
    note: String(note || '').trim().slice(0, 180),
    zone: String(zone || '').trim().slice(0, 80),
    createdBy: normalizeName(reporter),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    acknowledgements: []
  };

  const saved = await updateStore(store => {
    if (!store.groups.some(group => group.code === code)) return false;
    store.sosAlerts ||= [];
    store.sosAlerts.push(alert);
    return true;
  });
  return saved ? { alert } : { error: 'Group not found' };
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
      }
      return { alert };
    }

    return { error: 'Unsupported SOS action' };
  });
}
