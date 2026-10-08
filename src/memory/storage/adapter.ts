export type StorageKind = 'indexeddb' | 'localstorage' | 'memory';

/** A small async key-value store. Values are plain JSON-compatible data. */
export interface KeyValueStore {
  readonly kind: StorageKind;
  /** Resolves to `undefined` when the key is missing. */
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export type StorageErrorKind = 'unavailable' | 'quota' | 'read' | 'write';

export class StorageError extends Error {
  override readonly name = 'StorageError';
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** The stored text exists but is not valid JSON. `raw` keeps it so it can be quarantined. */
export class CorruptValueError extends Error {
  override readonly name = 'CorruptValueError';
  constructor(
    readonly key: string,
    readonly raw: string,
  ) {
    super(`The saved value for "${key}" is not valid JSON.`);
  }
}
