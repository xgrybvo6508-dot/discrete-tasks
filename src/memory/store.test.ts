import { describe, expect, it, vi } from 'vitest';
import { createFakeClock } from '../lib/time';
import { emptyMemory } from './schema';
import {
  CORRUPT_PREFIX,
  createMemoryStore,
  MEMORY_KEY,
  QUARANTINE_MESSAGE,
  SAVE_DEBOUNCE_MS,
} from './store';
import { createFakeStorage, createFakeStore } from './storage/fake';
import { createLocalStore } from './storage/local';
import { createFakeScheduler, settle, T0 } from './testing';

describe('MemoryStore saving', () => {
  it('debounces updates and writes only the latest memory', async () => {
    const primary = createFakeStore();
    const scheduler = createFakeScheduler();
    const clock = createFakeClock(T0);
    const store = createMemoryStore({
      primary,
      local: createFakeStore(),
      clock,
      scheduler,
    });

    store.update((memory) => ({ ...memory, lastExportAt: 1 }));
    clock.advance(100);
    store.update((memory) => ({ ...memory, lastExportAt: 2 }));

    expect(scheduler.pending()).toEqual([SAVE_DEBOUNCE_MS]);
    expect(primary.data.has(MEMORY_KEY)).toBe(false);

    scheduler.runAll();
    await settle();

    expect(primary.data.get(MEMORY_KEY)).toEqual(store.get());
    expect(store.get().lastExportAt).toBe(2);
  });

  it('flushes immediately, cancels the debounce and does not rewrite clean data', async () => {
    const primary = createFakeStore();
    const set = vi.spyOn(primary, 'set');
    const scheduler = createFakeScheduler();
    const store = createMemoryStore({
      primary,
      local: createFakeStore(),
      clock: createFakeClock(T0),
      scheduler,
    });

    store.update((memory) => ({ ...memory, lastExportAt: T0 }));
    await expect(store.flush()).resolves.toEqual({ ok: true, value: undefined });

    expect(scheduler.pending()).toEqual([]);
    expect(set).toHaveBeenCalledTimes(1);
    await store.flush();
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('requests persistent storage once, after the first successful save', async () => {
    const primary = createFakeStore();
    const persist = vi.fn(() => Promise.resolve(true));
    const store = createMemoryStore({
      primary,
      local: createFakeStore(),
      clock: createFakeClock(T0),
      persist,
    });

    store.update((memory) => ({ ...memory, lastExportAt: 1 }));
    await store.flush();
    store.update((memory) => ({ ...memory, lastExportAt: 2 }));
    await store.flush();

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('flushes pending data when the page becomes hidden and unsubscribes on dispose', async () => {
    const primary = createFakeStore();
    const unsubscribe = vi.fn();
    let hidden: (() => void) | undefined;
    const store = createMemoryStore({
      primary,
      local: createFakeStore(),
      clock: createFakeClock(T0),
      scheduler: createFakeScheduler(),
      onHidden(flush) {
        hidden = flush;
        return unsubscribe;
      },
    });

    store.update((memory) => ({ ...memory, lastExportAt: T0 }));
    expect(hidden).toBeDefined();
    hidden?.();
    await settle();

    expect(primary.data.get(MEMORY_KEY)).toEqual(store.get());
    store.dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('reports a failed debounced save without discarding dirty memory', async () => {
    const primary = createFakeStore();
    primary.failing.add('set');
    const scheduler = createFakeScheduler();
    const onSaveError = vi.fn();
    const store = createMemoryStore({
      primary,
      local: createFakeStore(),
      clock: createFakeClock(T0),
      scheduler,
      onSaveError,
    });

    store.update((memory) => ({ ...memory, lastExportAt: T0 }));
    scheduler.runAll();
    await settle();

    expect(onSaveError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'write' }));
    primary.failing.delete('set');
    await expect(store.flush()).resolves.toEqual({ ok: true, value: undefined });
    expect(primary.data.get(MEMORY_KEY)).toEqual(store.get());
  });
});

describe('MemoryStore loading and quarantine', () => {
  it('loads valid current memory', async () => {
    const saved = { ...emptyMemory(T0 - 1000), lastExportAt: T0 - 500 };
    const store = createMemoryStore({
      primary: createFakeStore({ [MEMORY_KEY]: saved }),
      local: createFakeStore(),
      clock: createFakeClock(T0),
    });

    const loaded = await store.load();

    expect(loaded).toEqual({ ok: true, value: { memory: saved, notice: null } });
    expect(store.get()).toEqual(saved);
  });

  it('loads the local fallback when the primary store has no memory', async () => {
    const saved = emptyMemory(T0 - 1000);
    const local = createFakeStore({ [MEMORY_KEY]: saved });
    const store = createMemoryStore({
      primary: createFakeStore(),
      local,
      clock: createFakeClock(T0),
    });

    await expect(store.load()).resolves.toEqual({
      ok: true,
      value: { memory: saved, notice: null },
    });
  });

  it('quarantines malformed local JSON and preserves the exact original value', async () => {
    const storage = createFakeStorage();
    const raw = '{"attempts":';
    storage.setItem('dt:memory', raw);
    const local = createLocalStore(storage);
    const store = createMemoryStore({
      primary: local,
      local,
      clock: createFakeClock(T0),
    });

    const loaded = await store.load();
    const quarantineKey = `${CORRUPT_PREFIX}${T0}`;

    expect(loaded).toEqual({
      ok: true,
      value: {
        memory: emptyMemory(T0),
        notice: {
          kind: 'quarantined',
          key: quarantineKey,
          message: QUARANTINE_MESSAGE,
        },
      },
    });
    expect(storage.getItem('dt:memory')).toBe(raw);
    expect(await local.get(quarantineKey)).toBe(raw);
  });

  it('quarantines invalid structured data without altering the source copy', async () => {
    const corrupt = { version: 1, incomplete: true };
    const primary = createFakeStore({ [MEMORY_KEY]: corrupt });
    const local = createFakeStore();
    const store = createMemoryStore({
      primary,
      local,
      clock: createFakeClock(T0),
    });

    const loaded = await store.load();

    expect(loaded.ok).toBe(true);
    expect(primary.data.get(MEMORY_KEY)).toEqual(corrupt);
    expect(local.data.get(`${CORRUPT_PREFIX}${T0}`)).toEqual(corrupt);
  });

  it('keeps corrupt source data untouched and blocks saving when quarantine fails', async () => {
    const corrupt = { version: 1, incomplete: true };
    const primary = createFakeStore({ [MEMORY_KEY]: corrupt });
    const local = createFakeStore();
    primary.failing.add('set');
    local.failing.add('set');
    const store = createMemoryStore({
      primary,
      local,
      clock: createFakeClock(T0),
    });

    const loaded = await store.load();
    store.update((memory) => ({ ...memory, lastExportAt: T0 }));
    await store.flush();

    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.kind).toBe('quarantine');
    expect(primary.data.get(MEMORY_KEY)).toEqual(corrupt);
    expect(local.data.size).toBe(0);
  });
});
