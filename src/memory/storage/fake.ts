import { StorageError, type KeyValueStore } from './adapter';

export type FakeOp = 'get' | 'set' | 'remove' | 'keys';

export interface FakeStore extends KeyValueStore {
  /** Direct access to the stored data, for assertions. */
  readonly data: Map<string, unknown>;
  /** Operations that reject until removed from this set. */
  readonly failing: Set<FakeOp>;
}

/** In-memory KeyValueStore for tests. Values are cloned, like real persistence. */
export function createFakeStore(initial: Record<string, unknown> = {}): FakeStore {
  const data = new Map<string, unknown>(
    Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]),
  );
  const failing = new Set<FakeOp>();
  // Throwing inside the executor rejects the promise.
  const run = <T>(op: FakeOp, fn: () => T): Promise<T> =>
    new Promise((resolve) => {
      if (failing.has(op)) {
        throw new StorageError(
          op === 'get' || op === 'keys' ? 'read' : 'write',
          `fake ${op} failed`,
        );
      }
      resolve(fn());
    });
  return {
    kind: 'memory',
    data,
    failing,
    get: (key) => run('get', () => structuredClone(data.get(key))),
    set: (key, value) =>
      run('set', () => {
        data.set(key, structuredClone(value));
      }),
    remove: (key) =>
      run('remove', () => {
        data.delete(key);
      }),
    keys: () => run('keys', () => [...data.keys()].sort()),
  };
}

/** A minimal Web Storage implementation for tests. `quota` limits total characters. */
export function createFakeStorage(quota = Infinity): Storage {
  const map = new Map<string, string>();
  const size = (m: Map<string, string>): number =>
    [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      const next = new Map(map).set(key, String(value));
      if (size(next) > quota) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      map.set(key, String(value));
    },
  };
}
