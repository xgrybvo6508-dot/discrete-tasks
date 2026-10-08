// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentClient } from '../../agent/client';
import { AgentError } from '../../agent/errors';
import type { SettingsStorage } from '../../agent/settings';
import type { Problem } from '../../bank/types';
import { err, ok } from '../../lib/result';
import { emptyMemory, type Memory } from '../../memory/schema';
import type { MemoryStore } from '../../memory/store';
import type { KeyValueStore } from '../../memory/storage/adapter';
import type { UiRuntime } from '../runtime';
import { practiceView, type PracticeView } from './practice';

const NOW = Date.UTC(2026, 9, 8, 12);
const PROBLEM: Problem = {
  id: 'test-001',
  source: 'bank',
  topic: 'combinatorics',
  difficulty: 3,
  title: 'Count a small family',
  statement: 'How many subsets does a two-element set have?',
  hints: ['Choose each element independently.', 'Each choice is binary.', 'Use $2^2$.'],
  solution: 'There are four subsets.',
  answer: { type: 'numeric', canonical: 4, display: '4' },
  estMinutes: 5,
};

interface RuntimeFixture {
  readonly runtime: UiRuntime;
  readonly memory: () => Memory;
}

function runtimeFixture(problem: Problem = PROBLEM): RuntimeFixture {
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
    memory: () => memory,
  };
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing test element: ${selector}`);
  return element;
}

function press(key: string): void {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

let view: PracticeView | null = null;

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  view?.dispose();
  view = null;
  document.body.replaceChildren();
});

describe('practiceView', () => {
  it('renders one focused problem and reveals progressive hints from the keyboard', () => {
    const fixture = runtimeFixture();
    view = practiceView(fixture.runtime);
    document.body.append(view.root);

    expect(view.root.querySelector('h1')?.textContent).toBe(PROBLEM.title);
    expect(view.root.textContent).toContain(
      'Topics are mixed on purpose. Past mistakes come back at growing intervals.',
    );
    expect(view.root.textContent).toContain('Source');
    expect(view.root.textContent).toContain('Bank');
    expect(view.root.textContent).toContain('AI agent');
    expect(view.root.textContent).not.toContain('Ask the agent about my work');

    press('h');
    const hints = requireElement<HTMLDetailsElement>(view.root, '.hint-panel');
    expect(hints.open).toBe(true);
    expect(hints.textContent).toContain('Hint 1 of 3');
    expect(hints.textContent).toContain(PROBLEM.hints[0]);

    press('Escape');
    expect(hints.open).toBe(false);
  });

  it('toggles shortcut help with the question-mark key', () => {
    const fixture = runtimeFixture();
    view = practiceView(fixture.runtime);
    document.body.append(view.root);
    const help = requireElement<HTMLElement>(view.root, '.shortcut-help');

    expect(help.hidden).toBe(true);
    press('?');
    expect(help.hidden).toBe(false);
    press('?');
    expect(help.hidden).toBe(true);
  });

  it('gives calm wrong-answer feedback, then records a correct attempt', () => {
    const fixture = runtimeFixture();
    view = practiceView(fixture.runtime);
    document.body.append(view.root);
    let input = requireElement<HTMLInputElement>(view.root, '#practice-answer');
    input.value = '3';
    requireElement<HTMLFormElement>(view.root, 'form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(view.root.textContent).toContain('Not quite. Want a hint?');
    expect(view.root.textContent).toContain('Show solution');
    expect(fixture.memory().attempts).toHaveLength(0);

    input = requireElement<HTMLInputElement>(view.root, '#practice-answer');
    input.value = '4';
    requireElement<HTMLFormElement>(view.root, 'form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(fixture.memory().attempts).toHaveLength(1);
    expect(fixture.memory().attempts[0]).toMatchObject({
      problemId: PROBLEM.id,
      answerText: '4',
      wrongChecks: 1,
      outcome: 'correct',
      checkedBy: 'local',
    });
    expect(requireElement<HTMLButtonElement>(view.root, 'button[type="submit"]').textContent).toBe(
      'Next problem',
    );
    expect(view.root.textContent).toContain('There are four subsets.');
  });

  it('requires a second N before skipping and records the skip', () => {
    const fixture = runtimeFixture();
    view = practiceView(fixture.runtime);
    document.body.append(view.root);

    press('n');
    expect(view.root.textContent).toContain('Press N again to skip this problem.');
    expect(fixture.memory().attempts).toHaveLength(0);

    press('n');
    expect(fixture.memory().attempts).toHaveLength(1);
    expect(fixture.memory().attempts[0]).toMatchObject({
      problemId: PROBLEM.id,
      outcome: 'skipped',
      checkedBy: 'self',
    });
    expect(view.root.querySelector('h1')?.textContent).toBe(PROBLEM.title);
  });
});
