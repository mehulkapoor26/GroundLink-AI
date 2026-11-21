const DB_NAME = 'groundlink-local';
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('messages', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function cacheMessage(message) {
  if (!('indexedDB' in window)) return;
  const db = await openDb();
  await new Promise((resolve, reject) => { const request = db.transaction('messages', 'readwrite').objectStore('messages').put(message); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
  db.close();
}
export async function getCachedMessages(groupCode) {
  if (!('indexedDB' in window)) return [];
  const db = await openDb();
  const messages = await new Promise((resolve, reject) => { const request = db.transaction('messages').objectStore('messages').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  db.close();
  return messages.filter(message => message.groupCode === groupCode).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
