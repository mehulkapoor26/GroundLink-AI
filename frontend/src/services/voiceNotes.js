import { socket } from './socket.js';
import { getPendingVoiceNotes, getVoiceNotes, updateVoiceNote } from './localDb.js';

const inFlight = new Map();
const broadcasting = new Set();
const activeUploads = new Map();
const makeId = () => globalThis.crypto?.randomUUID?.() || `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createVoiceNote({ blob, duration, group, sender }) {
  const id = makeId();
  const createdAt = new Date().toISOString();
  return {
    id,
    clientMessageId: id,
    clientId: id, // Kept as a compatibility alias for older cached messages.
    type: 'voice',
    groupCode: group?.code || 'LOCAL',
    groupName: group?.name || 'Local channel',
    channel: group?.code || 'LOCAL',
    localOnly: Boolean(group?.localOnly),
    sender: sender || 'Guest',
    audioId: `local:${id}`,
    audioBlob: blob,
    mimeType: blob.type || 'audio/webm',
    duration: Math.round(duration * 10) / 10,
    size: blob.size,
    createdAt,
    timestamp: createdAt,
    status: 'pending',
  };
}

async function performSync(note, onChange) {
  if (!note || note.status === 'synced' || note.localOnly) return note;
  if (globalThis.navigator?.onLine === false || typeof fetch !== 'function') {
    const pending = await updateVoiceNote(note.id, { status: 'pending' }) || { ...note, status: 'pending' };
    onChange?.(pending);
    return pending;
  }

  const clientMessageId = note.clientMessageId || note.clientId || note.id;
  const syncing = await updateVoiceNote(note.id, { clientMessageId, clientId: clientMessageId, status: 'syncing' }) || {
    ...note, clientMessageId, clientId: clientMessageId, status: 'syncing',
  };
  onChange?.(syncing);

  try {
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    if (controller) activeUploads.set(clientMessageId, controller);
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
    let response;
    try {
      response = await fetch('/api/voice/upload', {
        method: 'POST',
        ...(controller ? { signal: controller.signal } : {}),
        headers: {
          'Content-Type': syncing.mimeType || syncing.audioBlob.type || 'audio/webm',
          'X-GroundLink-User': syncing.sender || 'Guest',
          'X-GroundLink-Group': syncing.groupCode,
          'X-GroundLink-Duration': String(syncing.duration || 0),
          'X-GroundLink-Client-Message-Id': clientMessageId,
        },
        body: syncing.audioBlob,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
      activeUploads.delete(clientMessageId);
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Upload failed (${response.status})`);

    const synced = await updateVoiceNote(note.id, {
      ...result,
      id: note.id,
      clientMessageId,
      clientId: clientMessageId,
      remoteId: result.id,
      audioBlob: syncing.audioBlob,
      status: 'synced',
      broadcastPending: true,
      groupName: syncing.groupName,
      channel: syncing.channel,
    }) || {
      ...syncing, ...result, id: note.id, clientMessageId, clientId: clientMessageId,
      remoteId: result.id, audioBlob: syncing.audioBlob, status: 'synced', broadcastPending: true,
    };
    onChange?.(synced);
    return synced;
  } catch {
    // Includes network drops and tab reloads that abort an in-progress request.
    const pending = await updateVoiceNote(note.id, { status: 'pending' }) || { ...syncing, status: 'pending' };
    onChange?.(pending);
    return pending;
  }
}

export function syncVoiceNote(note, onChange) {
  if (!note) return Promise.resolve(note);
  const key = note.clientMessageId || note.clientId || note.id;
  if (inFlight.has(key)) return inFlight.get(key);
  const task = performSync(note, onChange).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

export async function syncPendingVoiceNotes(groupCode, onChange) {
  let pending = [];
  try { pending = await getPendingVoiceNotes(groupCode); }
  catch { return; }
  // getPendingVoiceNotes is chronological; await each request to preserve order.
  for (const note of pending) {
    try { await syncVoiceNote(note, onChange); }
    catch { /* Leave this note queued and continue with the remaining items. */ }
  }
}

export async function resetInterruptedVoiceNotes(groupCode, onChange) {
  let notes = [];
  try { notes = await getVoiceNotes(groupCode); }
  catch { return; }
  for (const note of notes) {
    if (note.status !== 'syncing') continue;
    const key = note.clientMessageId || note.clientId || note.id;
    activeUploads.get(key)?.abort();
    try {
      const pending = await updateVoiceNote(note.id, { status: 'pending' }) || { ...note, status: 'pending' };
      onChange?.(pending);
    } catch { /* The upload catch path will retry this status update. */ }
  }
}

export async function broadcastPendingVoiceNotes(groupCode, onChange) {
  if (!socket.connected) return;
  let notes = [];
  try { notes = await getVoiceNotes(groupCode); }
  catch { return; }
  for (const note of notes) {
    if (note.status !== 'synced' || !note.broadcastPending) continue;
    const clientMessageId = note.clientMessageId || note.clientId || note.id;
    if (broadcasting.has(clientMessageId)) continue;
    broadcasting.add(clientMessageId);
    const { audioBlob: _audioBlob, ...metadata } = note;
    try {
      const message = {
        ...metadata,
        id: note.remoteId || note.id,
        clientMessageId,
        clientId: clientMessageId,
      };
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Voice broadcast acknowledgement timed out')), 5000);
        try {
          socket.emit('voice:broadcast', message, result => {
            clearTimeout(timeout);
            result?.ok ? resolve() : reject(new Error(result?.error || 'Voice broadcast failed'));
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
      const broadcasted = await updateVoiceNote(note.id, { broadcastPending: false }) || { ...note, broadcastPending: false };
      onChange?.(broadcasted);
    } catch { return; }
    finally { broadcasting.delete(clientMessageId); }
  }
}
