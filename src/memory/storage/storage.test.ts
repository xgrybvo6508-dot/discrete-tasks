import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { choosePrimary } from '../store';
import type { CorruptValueError, StorageError } from './adapter';
import { createFakeStorage, createFakeStore } from './fake';
import { openIndexedDbStore } from './indexeddb';
import { createLocalStore } from './local';

describe('localStorage adapter', () => {
  it('round-trips namespaced JSON values and removes them', async () => {
    const storage = createFakeStorage();
    storage.setItem('unrelated', '"keep"');
    const store = createLocalStore(storage);
    const value = { nested: ['one', 2] };

    await store.set('memory', value);
    expect(storage.getItem('dt:memory')).toBe(JSON.stringify(value));
    expect(await store.get('memory')).toEqual(value);
    expect(await store.keys()).toEqual(['memory']);

    await store.remove('memory');
    expect(await store.get('memory')).toBeUndefined();
    expect(storage.getItem('unrelated')).toBe('"keep"');
  });

  it('reports malformed JSON while preserving its exact raw text', async () => {
    const storage = createFakeStorage();
    storage.setItem('dt:memory', '{"unfinished":');
    const store = createLocalStore(storage);

    await expect(store.get('memory')).rejects.toEqual(
      expect.objectContaining<Partial<CorruptValueError>>({
        name: 'CorruptValueError',
        key: 'memory',
        raw: '{"unfinished":',
      }),
    );
    expect(storage.getItem('dt:memory')).toBe('{"unfinished":');
  });

  it('maps quota failures to a typed storage error', async () => {
    const store = createLocalStore(createFakeStorage(12));

    await expect(store.set('memory', { tooLarge: true })).rejects.toEqual(
      expect.objectContaining<Partial<StorageError>>({ kind: 'quota' }),
    );
  });
});

describe('IndexedDB adapter', () => {
  it('round-trips values, lists sorted keys and removes values', async () => {
    const factory = new IDBFactory();
    const store = await openIndexedDbStore(factory, 'memory-adapter-round-trip');
    const value = { attempts: [{ id: 'a1' }] };

    await store.set('z', value);
    await store.set('a', 2);
    expect(await store.get('z')).toEqual(value);
    expect(await store.keys()).toEqual(['a', 'z']);

    await store.remove('z');
    expect(await store.get('z')).toBeUndefined();
    expect(await store.keys()).toEqual(['a']);
  });

  it('reports unavailable IndexedDB', async () => {
    await expect(openIndexedDbStore(undefined)).rejects.toEqual(
      expect.objectContaining<Partial<StorageError>>({ kind: 'unavailable' }),
    );
  });
});

describe('primary storage selection', () => {
  it('uses IndexedDB when opening succeeds', async () => {
    const indexedDb = createFakeStore();
    const fallback = createFakeStore();

    await expect(choosePrimary(() => Promise.resolve(indexedDb), fallback)).resolves.toBe(
      indexedDb,
    );
  });

  it('falls back to local storage when IndexedDB opening fails', async () => {
    const fallback = createFakeStore();

    await expect(
      choosePrimary(() => Promise.reject(new Error('open failed')), fallback),
    ).resolves.toBe(fallback);
  });
});
