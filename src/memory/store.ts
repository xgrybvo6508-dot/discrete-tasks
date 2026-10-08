import { err, ok, type Result } from '../lib/result';
import type { Clock } from '../lib/time';
import { migrate } from './migrate';
import { emptyMemory, type Memory } from './schema';
import { CorruptValueError, type KeyValueStore } from './storage/adapter';

export const MEMORY_KEY = 'memory';
export const BACKUP_KEY = 'memory-backup';
export const CORRUPT_PREFIX = 'memory-corrupt-';
export const SAVE_DEBOUNCE_MS = 500;

export type StoreErrorKind = 'read' | 'write' | 'quarantine' | 'backup';

const USER_MESSAGES: Readonly<Record<StoreErrorKind, string>> = {
  read: 'Saved progress could not be loaded. You can keep practising, but progress is not saved.',
  write: 'Progress could not be saved on this device. Export your memory to keep a copy.',
  quarantine:
    'Saved data could not be read and could not be copied to a safe place. Progress is not saved, so the old data stays untouched.',
  backup: 'A backup of your current memory could not be written, so nothing was changed.',
};

export class MemoryStoreError extends Error {
  override readonly name = 'MemoryStoreError';
  readonly userMessage: string;
  constructor(
    readonly kind: StoreErrorKind,
    options?: { cause?: unknown },
  ) {
    super(USER_MESSAGES[kind], options);
    this.userMessage = USER_MESSAGES[kind];
  }
}

export interface LoadNotice {
  readonly kind: 'quarantined';
  /** localStorage key (without the `dt:` prefix) or primary-store key of the kept copy. */
  readonly key: string;
  readonly message: string;
}

export const QUARANTINE_MESSAGE =
  'Saved data could not be read. A copy was kept. You can export it.';

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface StoreDeps {
  /** IndexedDB, or localStorage when IndexedDB is unavailable. */
  readonly primary: KeyValueStore;
  /** localStorage: holds the backup and quarantined copies. */
  readonly local: KeyValueStore;
  readonly clock: Clock;
  readonly scheduler?: Scheduler;
  readonly debounceMs?: number;
  /** `navigator.storage.persist`, requested once on the first save. */
  readonly persist?: () => Promise<boolean>;
  /** Subscribes to "page hidden"; returns an unsubscribe function. */
  readonly onHidden?: (flush: () => void) => () => void;
  readonly onSaveError?: (error: MemoryStoreError) => void;
}

export interface MemoryStore {
  load(): Promise<Result<{ memory: Memory; notice: LoadNotice | null }, MemoryStoreError>>;
  get(): Memory;
  update(fn: (memory: Memory) => Memory): Memory;
  replace(memory: Memory): void;
  flush(): Promise<Result<void, MemoryStoreError>>;
  backup(): Promise<Result<void, MemoryStoreError>>;
  dispose(): void;
}

const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** Tries IndexedDB first and falls back to localStorage if it cannot be opened. */
export async function choosePrimary(
  openIndexedDb: () => Promise<KeyValueStore>,
  fallback: KeyValueStore,
): Promise<KeyValueStore> {
  try {
    return await openIndexedDb();
  } catch {
    return fallback;
  }
}

export function createMemoryStore(deps: StoreDeps): MemoryStore {
  const { primary, local, clock } = deps;
  const scheduler = deps.scheduler ?? defaultScheduler;
  const debounceMs = deps.debounceMs ?? SAVE_DEBOUNCE_MS;
  let memory = emptyMemory(clock.now());
  let dirty = false;
  let saveBlocked = false;
  let timer: unknown = null;
  let persistAsked = false;
  const unsubscribe = deps.onHidden?.(() => void flush());

  /** Writes to localStorage, or to the primary store if localStorage is full. */
  async function keepCopy(key: string, value: unknown): Promise<boolean> {
    for (const target of [local, primary]) {
      try {
        await target.set(key, value);
        return true;
      } catch {
        // Try the next place.
      }
    }
    return false;
  }

  async function quarantine(raw: unknown): Promise<string | null> {
    const key = `${CORRUPT_PREFIX}${clock.now()}`;
    return (await keepCopy(key, raw)) ? key : null;
  }

  async function readRaw(): Promise<{ raw: unknown; corrupt: boolean }> {
    try {
      let raw = await primary.get(MEMORY_KEY);
      if (raw === undefined && primary !== local) raw = await local.get(MEMORY_KEY);
      return { raw, corrupt: false };
    } catch (e) {
      if (e instanceof CorruptValueError) return { raw: e.raw, corrupt: true };
      throw e;
    }
  }

  async function load(): ReturnType<MemoryStore['load']> {
    const now = clock.now();
    let read: { raw: unknown; corrupt: boolean };
    try {
      read = await readRaw();
    } catch (e) {
      saveBlocked = true;
      memory = emptyMemory(now);
      return err(new MemoryStoreError('read', { cause: e }));
    }
    const migrated = read.corrupt ? null : migrate(read.raw, now);
    if (migrated?.ok) {
      memory = migrated.value;
      return ok({ memory, notice: null });
    }
    memory = emptyMemory(now);
    const key = await quarantine(read.raw);
    if (key === null) {
      saveBlocked = true;
      return err(new MemoryStoreError('quarantine'));
    }
    return ok({ memory, notice: { kind: 'quarantined', key, message: QUARANTINE_MESSAGE } });
  }

  function schedule(): void {
    dirty = true;
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = scheduler.setTimeout(() => {
      timer = null;
      void flush().then((r) => {
        if (!r.ok) deps.onSaveError?.(r.error);
      });
    }, debounceMs);
  }

  async function flush(): Promise<Result<void, MemoryStoreError>> {
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }
    if (!dirty || saveBlocked) return ok(undefined);
    const snapshot = memory;
    try {
      await primary.set(MEMORY_KEY, snapshot);
      if (memory === snapshot) dirty = false;
    } catch (e) {
      return err(new MemoryStoreError('write', { cause: e }));
    }
    if (!persistAsked && deps.persist) {
      persistAsked = true;
      void deps.persist().catch(() => false);
    }
    return ok(undefined);
  }

  return {
    load,
    get: () => memory,
    update(fn) {
      memory = { ...fn(memory), updatedAt: clock.now() };
      schedule();
      return memory;
    },
    replace(next) {
      memory = { ...next, updatedAt: clock.now() };
      schedule();
    },
    flush,
    async backup() {
      return (await keepCopy(BACKUP_KEY, memory))
        ? ok(undefined)
        : err(new MemoryStoreError('backup'));
    },
    dispose() {
      if (timer !== null) scheduler.clearTimeout(timer);
      timer = null;
      unsubscribe?.();
    },
  };
}
