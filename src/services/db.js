/**
 * IndexedDB local para a fila offline do Boleia Certa.
 * Partilhável entre main thread e Service Worker.
 */

export const OFFLINE_DB_NAME = 'boleia-offline';
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_WRITE_STORE = 'offline_write_queue';

/**
 * @returns {Promise<IDBDatabase>}
 */
export function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB.'));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_WRITE_STORE)) {
        db.createObjectStore(OFFLINE_WRITE_STORE, { keyPath: 'idempotency_key' });
      }
    };
  });
}

/**
 * @template T
 * @param {IDBDatabase} db
 * @param {'readonly' | 'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest | Promise<T>} work
 * @returns {Promise<T>}
 */
function withStore(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_WRITE_STORE, mode);
    const store = tx.objectStore(OFFLINE_WRITE_STORE);
    let reqOrPromise;
    try {
      reqOrPromise = work(store);
    } catch (err) {
      reject(err);
      return;
    }

    if (reqOrPromise && typeof reqOrPromise.then === 'function') {
      reqOrPromise.then(resolve, reject);
      tx.onerror = () => reject(tx.error);
      return;
    }

    const request = /** @type {IDBRequest} */ (reqOrPromise);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * @param {object} item
 * @returns {Promise<string>} idempotency_key
 */
export async function putQueueItem(item) {
  if (!item?.idempotency_key) {
    throw new Error('idempotency_key é obrigatório.');
  }
  const db = await openOfflineDb();
  try {
    await withStore(db, 'readwrite', (store) => store.put(item));
    return item.idempotency_key;
  } finally {
    db.close();
  }
}

/**
 * @returns {Promise<object[]>}
 */
export async function listQueueItems() {
  const db = await openOfflineDb();
  try {
    const rows = await withStore(db, 'readonly', (store) => store.getAll());
    return Array.isArray(rows) ? rows : [];
  } finally {
    db.close();
  }
}

/**
 * @param {string} idempotencyKey
 * @returns {Promise<void>}
 */
export async function removeQueueItem(idempotencyKey) {
  if (!idempotencyKey) return;
  const db = await openOfflineDb();
  try {
    await withStore(db, 'readwrite', (store) => store.delete(idempotencyKey));
  } finally {
    db.close();
  }
}

/**
 * @returns {Promise<void>}
 */
export async function clearQueue() {
  const db = await openOfflineDb();
  try {
    await withStore(db, 'readwrite', (store) => store.clear());
  } finally {
    db.close();
  }
}
