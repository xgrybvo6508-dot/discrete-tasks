import type { Problem, Topic } from '../bank/types';
import type { AgentClient } from '../agent/client';
import type { SettingsStorage } from '../agent/settings';
import type { Clock } from '../lib/time';
import type { MemoryStore } from '../memory/store';
import type { KeyValueStore } from '../memory/storage/adapter';

export interface UiRuntime {
  readonly bank: readonly Problem[];
  readonly bankById: ReadonlyMap<string, Problem>;
  readonly store: MemoryStore;
  readonly localStore: KeyValueStore;
  readonly settingsStorage: SettingsStorage;
  readonly agentClient: AgentClient;
  readonly clock: Clock;
  focusTopic: Topic | null;
  loadNotice: string | null;
}
