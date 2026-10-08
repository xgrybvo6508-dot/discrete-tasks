// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentError } from '../agent/errors';
import type { AgentClient } from '../agent/client';
import type { SettingsStorage } from '../agent/settings';
import { err, ok } from '../lib/result';
import type { MemoryStore } from '../memory/store';
import { emptyMemory } from '../memory/schema';
import type { KeyValueStore } from '../memory/storage/adapter';
import { currentRoute, mountApp, type App } from './app';
import type { UiRuntime } from './runtime';

const NOW = Date.UTC(2026, 9, 8, 12);

function runtime(): UiRuntime {
  let memory = emptyMemory(NOW);
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
  const agentClient: AgentClient = {
    complete: () => Promise.resolve(err(new AgentError('network'))),
  };
  return {
    bank: [],
    bankById: new Map(),
    store,
    localStore,
    settingsStorage,
    agentClient,
    clock: { now: () => NOW },
    focusTopic: null,
    loadNotice: null,
  };
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing test element: ${selector}`);
  return element;
}

let app: App | null = null;

beforeEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  app?.dispose();
  app = null;
  document.body.replaceChildren();
  window.history.replaceState(null, '', '/');
});

describe('currentRoute', () => {
  it.each([
    ['', 'practice'],
    ['#/practice', 'practice'],
    ['#practice', 'practice'],
    ['#/progress', 'progress'],
    ['#/settings', 'settings'],
    ['#/data', 'data'],
    ['#/unknown', 'practice'],
  ] as const)('maps %j to %s', (hash, expected) => {
    expect(currentRoute(hash)).toBe(expected);
  });
});

describe('mountApp', () => {
  it('normalizes an empty hash and marks the practice link current', () => {
    const container = document.createElement('div');
    document.body.append(container);

    app = mountApp(container, runtime());

    expect(window.location.hash).toBe('#/practice');
    expect(app.main.textContent).toContain('No problem is available');
    expect(
      requireElement<HTMLAnchorElement>(app.root, 'a[href="#/practice"]').getAttribute(
        'aria-current',
      ),
    ).toBe('page');
  });

  it('renders hash routes and moves aria-current to the active navigation link', () => {
    window.history.replaceState(null, '', '#/settings');
    const container = document.createElement('div');
    document.body.append(container);
    app = mountApp(container, runtime());

    expect(app.main.querySelector('h1')?.textContent).toBe('Settings');
    const settings = requireElement<HTMLAnchorElement>(app.root, 'a[href="#/settings"]');
    expect(settings.getAttribute('aria-current')).toBe('page');

    window.location.hash = '#/progress';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(app.main.querySelector('h1')?.textContent).toBe('Progress');
    expect(settings.hasAttribute('aria-current')).toBe(false);
    expect(
      requireElement<HTMLAnchorElement>(app.root, 'a[href="#/progress"]').getAttribute(
        'aria-current',
      ),
    ).toBe('page');
  });

  it('removes its hash listener when disposed', () => {
    window.history.replaceState(null, '', '#/settings');
    const container = document.createElement('div');
    document.body.append(container);
    app = mountApp(container, runtime());
    app.dispose();

    window.location.hash = '#/progress';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(app.main.querySelector('h1')?.textContent).toBe('Settings');
    app = null;
  });
});
