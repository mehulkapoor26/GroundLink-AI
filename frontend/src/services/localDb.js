const DB_NAME = 'groundlink-local';
const DB_VERSION = 2;

function openDb() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('voiceNotes')) db.createObjectStore('voiceNotes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local storage'));
  });
}

function runTransaction(stores, mode, operation) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    try { result = operation(tx); }
    catch (error) { db.close(); reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Local storage operation failed')); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Local storage operation was cancelled')); };
  }));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local storage request failed'));
  });
}

export function mergeMessages(...lists) {
  const merged = new Map();
  for (const message of lists.flat()) {
    const key = message.clientMessageId || message.clientId || message.id;
    const previous = merged.get(key);
    merged.set(key, previous
      ? { ...previous, ...message, id: previous.id, audioBlob: message.audioBlob || previous.audioBlob }
      : message);
  }
  return [...merged.values()].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

export async function cacheMessage(message) {
  if (!globalThis.indexedDB || !message?.id) return;
  await runTransaction(['messages'], 'readwrite', tx => tx.objectStore('messages').put(message));
}

export async function getCachedMessages(groupCode) {
  if (!globalThis.indexedDB) return [];
  const db = await openDb();
  try {
    const tx = db.transaction(['messages', 'voiceNotes'], 'readonly');
    const [messages, voiceNotes] = await Promise.all([
      requestResult(tx.objectStore('messages').getAll()),
      requestResult(tx.objectStore('voiceNotes').getAll()),
    ]);
    return mergeMessages(messages, voiceNotes)
      .filter(message => message.groupCode === groupCode)
      .map(message => message.type === 'voice' && !message.status ? { ...message, status: 'synced' } : message);
  } finally { db.close(); }
}

export async function saveVoiceNote(note) {
  if (!note?.id || !note?.audioBlob) throw new Error('A voice note needs an id and audio recording');
  const record = { ...note, type: 'voice', timestamp: note.timestamp || note.createdAt || new Date().toISOString() };
  await runTransaction(['messages', 'voiceNotes'], 'readwrite', tx => {
    tx.objectStore('voiceNotes').put(record);
    tx.objectStore('messages').put(record);
  });
  return record;
}

export async function updateVoiceNote(id, updates) {
  const db = await openDb();
  try {
    const tx = db.transaction(['messages', 'voiceNotes'], 'readwrite');
    const store = tx.objectStore('voiceNotes');
    const notes = await requestResult(store.getAll());
    const current = notes.find(note => note.id === id || note.clientMessageId === id || note.clientId === id);
    if (!current) return null;
    const updated = { ...current, ...updates };
    store.put(updated);
    tx.objectStore('messages').put(updated);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not update voice note'));
      tx.onabort = () => reject(tx.error || new Error('Voice note update was cancelled'));
    });
    return updated;
  } finally { db.close(); }
}

export async function getVoiceNotes(groupCode) {
  if (!globalThis.indexedDB) return [];
  const db = await openDb();
  try {
    const notes = await requestResult(db.transaction('voiceNotes').objectStore('voiceNotes').getAll());
    return notes.filter(note => !groupCode || note.groupCode === groupCode)
      .sort((a, b) => String(a.timestamp || a.createdAt || '').localeCompare(String(b.timestamp || b.createdAt || '')));
  } finally { db.close(); }
}

export async function getVoiceNote(id) {
  if (!globalThis.indexedDB || !id) return null;
  const db = await openDb();
  try {
    const notes = await requestResult(db.transaction('voiceNotes').objectStore('voiceNotes').getAll());
    return notes.find(note => note.id === id || note.clientMessageId === id || note.clientId === id) || null;
  } finally { db.close(); }
}

export async function getPendingVoiceNotes(groupCode) {
  return (await getVoiceNotes(groupCode))
    .filter(note => !note.localOnly && note.status !== 'synced')
    .sort((a, b) => String(a.timestamp || a.createdAt || '').localeCompare(String(b.timestamp || b.createdAt || '')));
}

export async function cacheGroup(group) {
  if (!globalThis.indexedDB || !group?.id) return;
  await runTransaction(['groups'], 'readwrite', tx => tx.objectStore('groups').put(group));
}

export async function getCachedGroup(groupId) {
  if (!globalThis.indexedDB || !groupId) return null;
  const db = await openDb();
  try {
    const groups = await requestResult(db.transaction('groups').objectStore('groups').getAll());
    return groups.find(group => String(group.id) === String(groupId)) || null;
  }
  finally { db.close(); }
}

export async function getCachedGroupByCode(code) {
  if (!globalThis.indexedDB || !code) return null;
  const db = await openDb();
  try {
    const groups = await requestResult(db.transaction('groups').objectStore('groups').getAll());
    return groups.find(group => String(group.code).toUpperCase() === String(code).toUpperCase()) || null;
  } finally { db.close(); }
}
