import { StorageError, type KeyValueStore } from './adapter';

export const DB_NAME = 'discrete-tasks';
export const DB_VERSION = 1;
export const STORE_NAME = 'kv';
const OPEN_TIMEOUT_MS = 3000;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new StorageError('read', 'A storage request failed.', { cause: req.error }));
  });
}

function transaction(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, mode);
    } catch (e) {
      reject(new StorageError('write', 'Could not start a storage transaction.', { cause: e }));
      return;
    }
    const fail = (): void => {
      const quota = tx.error?.name === 'QuotaExceededError';
      reject(
        new StorageError(quota ? 'quota' : 'write', 'Could not save to IndexedDB.', {
          cause: tx.error,
        }),
      );
    };
    tx.oncomplete = () => resolve();
    tx.onerror = fail;
    tx.onabort = fail;
    run(tx.objectStore(STORE_NAME));
  });
}

function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new StorageError('unavailable', 'IndexedDB did not open in time.')),
      OPEN_TIMEOUT_MS,
    );
    const done = (): void => clearTimeout(timer);
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(name, DB_VERSION);
    } catch (e) {
      done();
      reject(new StorageError('unavailable', 'IndexedDB is not available.', { cause: e }));
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME))
        req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      done();
      resolve(req.result);
    };
    req.onerror = () => {
      done();
      reject(
        new StorageError('unavailable', 'IndexedDB could not be opened.', { cause: req.error }),
      );
    };
    req.onblocked = () => {
      done();
      reject(new StorageError('unavailable', 'IndexedDB is blocked by another tab.'));
    };
  });
}

/** Opens the `discrete-tasks` database (store `kv`). Rejects if IndexedDB is unusable. */
export async function openIndexedDbStore(
  factory: IDBFactory | undefined = globalThis.indexedDB,
  name = DB_NAME,
): Promise<KeyValueStore> {
  if (!factory) throw new StorageError('unavailable', 'IndexedDB is not available.');
  const db = await openDb(factory, name);
  return {
    kind: 'indexeddb',
    async get(key) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const value: unknown = await request(tx.objectStore(STORE_NAME).get(key));
      return value;
    },
    set: (key, value) => transaction(db, 'readwrite', (s) => s.put(value, key)),
    remove: (key) => transaction(db, 'readwrite', (s) => s.delete(key)),
    async keys() {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const keys = await request(tx.objectStore(STORE_NAME).getAllKeys());
      return keys.filter((k): k is string => typeof k === 'string').sort();
    },
  };
}
