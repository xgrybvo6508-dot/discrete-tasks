// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentClient } from '../../agent/client';
import { AgentError } from '../../agent/errors';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type SettingsStorage,
} from '../../agent/settings';
import type { Problem } from '../../bank/types';
import { err, ok } from '../../lib/result';
import { createSession, presentProblem } from '../../memory/session';
import { emptyMemory, type Memory } from '../../memory/schema';
import type { MemoryStore } from '../../memory/store';
import type { KeyValueStore } from '../../memory/storage/adapter';
import { loadUiPreferences } from '../preferences';
import type { UiRuntime } from '../runtime';
import { progressView } from './progress';
import { sessionSummary } from './session-summary';
import { settingsView } from './settings';

const NOW = Date.UTC(2026, 9, 8, 12);
const PROBLEM: Problem = {
  id: 'test-001',
  source: 'bank',
  topic: 'combinatorics',
  difficulty: 3,
  title: 'Inline fixture problem',
  statement: 'Count a finite family.',
  hints: ['First hint.', 'Second hint.', 'Third hint.'],
  solution: 'A short solution.',
  answer: { type: 'numeric', canonical: 4, display: '4' },
};

interface RuntimeFixture {
  readonly runtime: UiRuntime;
  readonly settingsStorage: SettingsStorage;
  readonly agentCalls: () => number;
}

function runtimeFixture(problem: Problem = PROBLEM): RuntimeFixture {
  let memory: Memory = emptyMemory(NOW);
  const store: MemoryStore = {
    load: () => Promise.resolve(ok({ memory, notice: null })),
    get: () => memory,
    update: (fn) => {
      memory = fn(memory);
      return memory;
    },
    replace: (next) => {
      memory = next;
    },
    flush: () => Promise.resolve(ok(undefined)),
    backup: () => Promise.resolve(ok(undefined)),
    dispose: vi.fn(),
  };
  const localStore: KeyValueStore = {
    kind: 'memory',
    get: () => Promise.resolve(undefined),
    set: () => Promise.resolve(undefined),
    remove: () => Promise.resolve(undefined),
    keys: () => Promise.resolve([]),
  };
  const values = new Map<string, string>();
  const settingsStorage: SettingsStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  let agentCalls = 0;
  const agentClient: AgentClient = {
    complete: () => {
      agentCalls++;
      return Promise.resolve(err(new AgentError('network')));
    },
  };
  return {
    runtime: {
      bank: [problem],
      bankById: new Map([[problem.id, problem]]),
      store,
      localStore,
      settingsStorage,
      agentClient,
      clock: { now: () => NOW },
      focusTopic: null,
      loadNotice: null,
    },
    settingsStorage,
    agentCalls: () => agentCalls,
  };
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing test element: ${selector}`);
  return element;
}

function buttonWithText(root: ParentNode, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`Missing test button: ${text}`);
  return button;
}

beforeEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, '', '/');
});

describe('settingsView', () => {
  it('keeps the key masked, clears it, and stores display preferences locally', () => {
    const fixture = runtimeFixture();
    saveSettings(fixture.settingsStorage, {
      ...DEFAULT_SETTINGS,
      apiKey: 'sk-test-secret-1234',
    });
    const root = settingsView(fixture.runtime);
    document.body.append(root);

    expect(requireElement<HTMLInputElement>(root, '#api-key').type).toBe('password');
    expect(root.textContent).toContain('Saved as sk-…1234.');
    buttonWithText(root, 'Clear key').click();

    expect(loadSettings(fixture.settingsStorage).apiKey).toBe('');
    expect(root.textContent).toContain('API key cleared.');

    const showTime = requireElement<HTMLInputElement>(root, '#show-time');
    showTime.checked = true;
    showTime.dispatchEvent(new Event('change', { bubbles: true }));
    expect(loadUiPreferences(fixture.settingsStorage).showTime).toBe(true);
  });

  it('rejects an unsafe base URL without calling the agent', () => {
    const fixture = runtimeFixture();
    const root = settingsView(fixture.runtime);
    document.body.append(root);
    const baseUrl = requireElement<HTMLInputElement>(root, '#base-url');
    baseUrl.value = 'http://api.example.com/v1';

    buttonWithText(root, 'Test connection').click();

    expect(root.textContent).toContain('Use an HTTPS base URL, or an HTTP localhost URL.');
    expect(fixture.agentCalls()).toBe(0);
  });
});

describe('progressView', () => {
  it('opens a topic from the keyboard-accessible map and starts focused practice', async () => {
    const fixture = runtimeFixture();
    const root = progressView(fixture.runtime);
    document.body.append(root);
    const mapNode = requireElement<SVGGElement>(root, '.topic-node[aria-label^="Combinatorics,"]');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    mapNode.dispatchEvent(event);
    await Promise.resolve();

    expect(event.defaultPrevented).toBe(true);
    expect(root.querySelector('.topic-detail h2')?.textContent).toBe('Combinatorics');
    expect(root.textContent).toContain(PROBLEM.title);
    buttonWithText(root, 'Practice this topic').click();

    expect(fixture.runtime.focusTopic).toBe('combinatorics');
    expect(loadUiPreferences(fixture.settingsStorage).focusTopic).toBe('combinatorics');
    expect(window.location.hash).toBe('#/practice');
  });
});

describe('sessionSummary', () => {
  it('summarizes the session and offers an explicit restart', () => {
    const fixture = runtimeFixture();
    const session = presentProblem(createSession(NOW), {
      problemId: PROBLEM.id,
      topic: PROBLEM.topic,
    });
    const restart = vi.fn();

    const root = sessionSummary(session, fixture.runtime.store, restart);
    expect(root.textContent).toContain('You saw 1 problem across 1 topic.');
    expect(root.textContent).toContain('Combinatorics');
    buttonWithText(root, 'Start again').click();
    expect(restart).toHaveBeenCalledOnce();
  });
});
