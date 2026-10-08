import { CorruptValueError, StorageError, type KeyValueStore } from './adapter';

export const LOCAL_PREFIX = 'dt:';

function isQuotaError(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
}

/** localStorage-backed store. Keys are namespaced, e.g. `memory` is saved as `dt:memory`. */
export function createLocalStore(storage: Storage, prefix = LOCAL_PREFIX): KeyValueStore {
  const full = (key: string): string => `${prefix}${key}`;
  return {
    kind: 'localstorage',
    get(key) {
      let raw: string | null;
      try {
        raw = storage.getItem(full(key));
      } catch (e) {
        return Promise.reject(
          new StorageError('read', 'Could not read from local storage.', { cause: e }),
        );
      }
      if (raw === null) return Promise.resolve(undefined);
      try {
        return Promise.resolve(JSON.parse(raw) as unknown);
      } catch {
        return Promise.reject(new CorruptValueError(key, raw));
      }
    },
    set(key, value) {
      try {
        storage.setItem(full(key), JSON.stringify(value));
        return Promise.resolve();
      } catch (e) {
        const kind = isQuotaError(e) ? 'quota' : 'write';
        return Promise.reject(
          new StorageError(kind, 'Could not save to local storage.', { cause: e }),
        );
      }
    },
    remove(key) {
      try {
        storage.removeItem(full(key));
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(
          new StorageError('write', 'Could not remove from local storage.', { cause: e }),
        );
      }
    },
    keys() {
      const out: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith(prefix)) out.push(k.slice(prefix.length));
      }
      return Promise.resolve(out.sort());
    },
  };
}
