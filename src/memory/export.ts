import { isRecord, isSafeKey, own } from '../lib/guards';
import { err, ok, type Result } from '../lib/result';
import { rebuildTopics } from './mastery';
import { migrate } from './migrate';
import { getCard } from './record';
import { MEMORY_VERSION, type Attempt, type CardState, type Memory } from './schema';
import type { MemoryStore, MemoryStoreError } from './store';

export const EXPORT_VERSION = 1;

export interface MemoryExport {
  readonly app: 'discrete-tasks';
  readonly kind: 'memory-export';
  readonly exportVersion: typeof EXPORT_VERSION;
  readonly memoryVersion: number;
  readonly exportedAt: string;
  readonly memory: Memory;
}

export type ImportErrorKind = 'not-json' | 'wrong-file' | 'newer-file' | 'corrupt';

export interface ImportError {
  readonly kind: ImportErrorKind;
  readonly message: string;
}

const IMPORT_MESSAGES: Readonly<Record<ImportErrorKind, string>> = {
  'not-json': 'This file could not be read. Choose a file that was made with "Export memory".',
  'wrong-file': 'This file is not a Discrete Tasks memory export.',
  'newer-file': 'This file comes from a newer version of the app. Update the app and try again.',
  corrupt: 'Some data in this file could not be read, so nothing was imported.',
};

const importError = (kind: ImportErrorKind): ImportError => ({
  kind,
  message: IMPORT_MESSAGES[kind],
});

/**
 * The export holds the memory only. Settings and the API key live elsewhere and are never
 * included; the memory is re-validated so unknown fields cannot slip through.
 */
export function buildExport(memory: Memory, now: number): MemoryExport {
  const clean = migrate(memory, now);
  return {
    app: 'discrete-tasks',
    kind: 'memory-export',
    exportVersion: EXPORT_VERSION,
    memoryVersion: MEMORY_VERSION,
    exportedAt: new Date(now).toISOString(),
    memory: clean.ok ? clean.value : memory,
  };
}

export function serializeExport(memory: Memory, now: number): string {
  return JSON.stringify(buildExport(memory, now), null, 2);
}

export function exportFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `discrete-tasks-memory-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export function parseImport(text: string, now: number): Result<Memory, ImportError> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return err(importError('not-json'));
  }
  if (
    !isRecord(data) ||
    own(data, 'app') !== 'discrete-tasks' ||
    own(data, 'kind') !== 'memory-export'
  ) {
    return err(importError('wrong-file'));
  }
  const exportVersion = own(data, 'exportVersion');
  if (typeof exportVersion !== 'number' || exportVersion > EXPORT_VERSION)
    return err(importError('newer-file'));
  const migrated = migrate(own(data, 'memory'), now);
  if (!migrated.ok) {
    return err(importError(migrated.error.kind === 'future-version' ? 'newer-file' : 'corrupt'));
  }
  return ok(migrated.value);
}

export interface ImportPreview {
  readonly attempts: number;
  readonly problems: number;
  readonly aiProblems: number;
  /** Attempts in the file that are not in the current memory yet. */
  readonly newAttempts: number;
}

export function previewImport(current: Memory, incoming: Memory): ImportPreview {
  const known = new Set(current.attempts.map((a) => a.id));
  return {
    attempts: incoming.attempts.length,
    problems: Object.keys(incoming.cards).length,
    aiProblems: incoming.aiProblems.length,
    newAttempts: incoming.attempts.filter((a) => !known.has(a.id)).length,
  };
}

/** Attempts by id, the card seen most recently, AI problems by id. Nothing is lost. */
export function mergeMemory(current: Memory, incoming: Memory, now: number): Memory {
  const attempts = new Map<string, Attempt>();
  for (const a of [...current.attempts, ...incoming.attempts]) {
    if (!attempts.has(a.id)) attempts.set(a.id, a);
  }
  const merged = [...attempts.values()].sort((a, b) => a.endedAt - b.endedAt);

  const cards: Record<string, CardState> = { ...current.cards };
  for (const [id, card] of Object.entries(incoming.cards)) {
    if (!isSafeKey(id)) continue;
    const mine = getCard(cards, id);
    if (!mine || card.lastSeenAt > mine.lastSeenAt) cards[id] = card;
  }

  const aiIds = new Set(current.aiProblems.map((p) => p.id));
  const aiProblems = [
    ...current.aiProblems,
    ...incoming.aiProblems.filter((p) => !aiIds.has(p.id)),
  ];
  const exports = [current.lastExportAt, incoming.lastExportAt].filter(
    (t): t is number => t !== null,
  );
  return {
    version: MEMORY_VERSION,
    createdAt: Math.min(current.createdAt, incoming.createdAt),
    updatedAt: now,
    attempts: merged,
    cards,
    topics: rebuildTopics(merged),
    aiProblems,
    lastExportAt: exports.length > 0 ? Math.max(...exports) : null,
  };
}

export type ImportMode = 'merge' | 'replace';

/** Writes a backup of the current memory first. If that fails, nothing changes. */
export async function applyImport(
  store: Pick<MemoryStore, 'get' | 'replace' | 'backup' | 'flush'>,
  incoming: Memory,
  mode: ImportMode,
  now: number,
): Promise<Result<Memory, MemoryStoreError>> {
  const backup = await store.backup();
  if (!backup.ok) return backup;
  const next = mode === 'merge' ? mergeMemory(store.get(), incoming, now) : incoming;
  store.replace(next);
  const saved = await store.flush();
  return saved.ok ? ok(store.get()) : saved;
}

export function markExported(memory: Memory, now: number): Memory {
  return { ...memory, lastExportAt: now };
}
