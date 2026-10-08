import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../lib/result';
import {
  applyImport,
  buildExport,
  MemoryExportError,
  mergeMemory,
  parseImport,
  previewImport,
  serializeExport,
} from './export';
import type { ImportErrorKind } from './export';
import { migrate } from './migrate';
import { recordAttempt } from './record';
import { emptyMemory, type CardState, type Memory } from './schema';
import { BACKUP_KEY, createMemoryStore, MEMORY_KEY, MemoryStoreError } from './store';
import { createFakeStore } from './storage/fake';
import { makeAiProblem, makeAttempt, T0 } from './testing';

const makeCard = (problemId: string, lastSeenAt: number): CardState => ({
  problemId,
  ease: 2.5,
  intervalDays: 3,
  reps: 2,
  lapses: 0,
  dueAt: lastSeenAt + 3 * 86_400_000,
  lastSeenAt,
  lastOutcome: 'correct',
});

function memoryFixture(): Memory {
  const memory = recordAttempt(emptyMemory(T0 - 10_000), makeAttempt());
  return { ...memory, aiProblems: [makeAiProblem(1)], lastExportAt: T0 - 1000 };
}

describe('memory export parsing and preview', () => {
  it('round-trips a valid memory export through JSON and migration', () => {
    const memory = memoryFixture();
    const text = serializeExport(memory, T0);
    const parsed = parseImport(text, T0 + 1000);
    const clean = migrate(memory, T0);

    expect(clean.ok).toBe(true);
    expect(parsed).toEqual(clean);
    expect(JSON.parse(text)).toEqual(buildExport(memory, T0));
    expect(buildExport(memory, T0).exportedAt).toBe(new Date(T0).toISOString());
  });

  it('previews totals and only counts attempt ids new to this device', () => {
    const current = {
      ...emptyMemory(T0),
      attempts: [makeAttempt({ id: 'known' })],
    };
    const incoming = {
      ...memoryFixture(),
      attempts: [
        makeAttempt({ id: 'known' }),
        makeAttempt({ id: 'new-1', problemId: 'logic-001', topic: 'logic' }),
        makeAttempt({ id: 'new-2', problemId: 'sets-001', topic: 'sets' }),
      ],
      cards: {
        'logic-001': makeCard('logic-001', T0),
        'sets-001': makeCard('sets-001', T0),
      },
      aiProblems: [makeAiProblem(1), makeAiProblem(2)],
    };

    expect(previewImport(current, incoming)).toEqual({
      attempts: 3,
      problems: 2,
      aiProblems: 2,
      newAttempts: 2,
    });
  });

  it('rejects invalid JSON, unrelated files, future formats and corrupt memory', () => {
    const expectKind = (text: string, kind: ImportErrorKind): void => {
      const result = parseImport(text, T0);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe(kind);
    };

    expectKind('{', 'not-json');
    expectKind(JSON.stringify({ app: 'other' }), 'wrong-file');
    expectKind(
      JSON.stringify({
        ...buildExport(emptyMemory(T0), T0),
        exportVersion: 999,
      }),
      'newer-file',
    );
    expectKind(
      JSON.stringify({
        ...buildExport(emptyMemory(T0), T0),
        memory: { version: 1, incomplete: true },
      }),
      'corrupt',
    );
  });

  it('excludes settings, API-key fields and other unknown data', () => {
    const privateValue = 'DO_NOT_EXPORT_PRIVATE_CREDENTIAL';
    const memory = {
      ...memoryFixture(),
      'dt:settings': { model: 'private-model', apiKey: privateValue },
      apiKey: privateValue,
      attempts: memoryFixture().attempts.map((attempt) => ({
        ...attempt,
        apiKey: privateValue,
      })),
    };

    const text = serializeExport(memory, T0);

    expect(text).not.toContain('dt:settings');
    expect(text).not.toContain('apiKey');
    expect(text).not.toContain('private-model');
    expect(text).not.toContain(privateValue);
  });

  it('refuses invalid in-memory data instead of leaking the unsanitized object', () => {
    const malformed = {
      ...memoryFixture(),
      apiKey: 'DO_NOT_EXPORT_PRIVATE_CREDENTIAL',
      attempts: [{ id: 'incomplete' }],
    } as unknown as Memory;

    expect(() => serializeExport(malformed, T0)).toThrowError(MemoryExportError);
  });
});

describe('mergeMemory', () => {
  it('merges attempts by id, cards by latest lastSeenAt and AI problems by id', () => {
    const current = {
      ...emptyMemory(T0 - 10_000),
      attempts: [
        makeAttempt({ id: 'shared', answerText: 'current' }),
        makeAttempt({ id: 'current-only', problemId: 'graph-002' }),
      ],
      cards: {
        shared: makeCard('shared', T0),
        current: makeCard('current', T0 + 100),
      },
      aiProblems: [makeAiProblem(1, { title: 'Current copy' })],
      lastExportAt: T0 - 500,
    };
    const incoming = {
      ...emptyMemory(T0 - 20_000),
      attempts: [
        makeAttempt({ id: 'shared', endedAt: T0 + 1000, answerText: 'incoming' }),
        makeAttempt({ id: 'incoming-only', problemId: 'logic-001', topic: 'logic' }),
      ],
      cards: {
        shared: makeCard('shared', T0 + 1000),
        current: makeCard('current', T0 - 100),
        incoming: makeCard('incoming', T0 + 200),
      },
      aiProblems: [
        makeAiProblem(1, { title: 'Incoming duplicate' }),
        makeAiProblem(2, { title: 'Incoming unique' }),
      ],
      lastExportAt: T0 - 100,
    };

    const merged = mergeMemory(current, incoming, T0 + 2000);

    expect(merged.attempts.map((attempt) => attempt.id)).toEqual([
      'shared',
      'current-only',
      'incoming-only',
    ]);
    expect(merged.attempts.find((attempt) => attempt.id === 'shared')?.answerText).toBe('current');
    expect(merged.cards.shared?.lastSeenAt).toBe(T0 + 1000);
    expect(merged.cards.current?.lastSeenAt).toBe(T0 + 100);
    expect(merged.cards.incoming?.lastSeenAt).toBe(T0 + 200);
    expect(merged.aiProblems.map((problem) => [problem.id, problem.title])).toEqual([
      ['ai-graph-1', 'Current copy'],
      ['ai-graph-2', 'Incoming unique'],
    ]);
    expect(merged.createdAt).toBe(T0 - 20_000);
    expect(merged.updatedAt).toBe(T0 + 2000);
    expect(merged.lastExportAt).toBe(T0 - 100);
    expect(merged.topics.logic.attempts).toBe(1);
  });
});

describe('applyImport backup safety', () => {
  it('writes the current memory backup before replacing and flushing', async () => {
    const current = memoryFixture();
    const primary = createFakeStore({ [MEMORY_KEY]: current });
    const local = createFakeStore();
    const store = createMemoryStore({
      primary,
      local,
      clock: { now: () => T0 },
    });
    await store.load();
    const incoming = emptyMemory(T0 + 1000);

    const result = await applyImport(store, incoming, 'replace', T0 + 1000);

    expect(result.ok).toBe(true);
    expect(local.data.get(BACKUP_KEY)).toEqual(current);
    expect(primary.data.get(MEMORY_KEY)).toEqual(store.get());
    expect(store.get().attempts).toEqual([]);
  });

  it('merges only after a successful backup', async () => {
    const events: string[] = [];
    let current = emptyMemory(T0);
    const incoming = memoryFixture();
    const store = {
      get() {
        events.push('get');
        return current;
      },
      replace(next: Memory) {
        events.push('replace');
        current = next;
      },
      backup() {
        events.push('backup');
        return Promise.resolve(ok(undefined));
      },
      flush() {
        events.push('flush');
        return Promise.resolve(ok(undefined));
      },
    };

    const result = await applyImport(store, incoming, 'merge', T0 + 1000);

    expect(result.ok).toBe(true);
    expect(events[0]).toBe('backup');
    expect(events).toContain('replace');
    expect(events.at(-1)).toBe('get');
    expect(current.attempts).toHaveLength(1);
  });

  it('does not read, replace, flush or mutate memory if the backup fails', async () => {
    const current = memoryFixture();
    const get = vi.fn(() => current);
    const replace = vi.fn((_next: Memory) => undefined);
    const flush = vi.fn(() => Promise.resolve(ok(undefined)));
    const backup = vi.fn(() =>
      Promise.resolve(err<MemoryStoreError>(new MemoryStoreError('backup'))),
    );

    const result = await applyImport(
      { get, replace, flush, backup },
      emptyMemory(T0 + 1000),
      'replace',
      T0 + 1000,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('backup');
    expect(get).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
    expect(current).toEqual(memoryFixture());
  });
});
