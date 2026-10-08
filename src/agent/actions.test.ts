import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../lib/random';
import { err, ok } from '../lib/result';
import { makeProblem } from '../memory/testing';
import type { AgentMemorySummary } from '../memory/summary';
import {
  check,
  FALLBACK_MESSAGE,
  generateProblem,
  hint,
  HINT_LEAK_MESSAGE,
  testConnection,
  type ActionDeps,
} from './actions';
import type { AgentClient } from './client';
import { AgentError } from './errors';
import { DEFAULT_SETTINGS } from './settings';

const settings = { ...DEFAULT_SETTINGS, apiKey: 'private-value' };
const summary: AgentMemorySummary = {
  topic: 'graphs',
  band: 'Learning',
  recentTitles: [],
  recentMistakes: [],
};

const generated = {
  topic: 'graphs',
  difficulty: 4,
  title: 'A constrained tree',
  statement: 'Count the labelled trees with the stated property.',
  hints: ['Encode the tree.', 'Use a sequence.', 'Count the valid sequences.'],
  solution: 'The answer is $16$.',
  answer: { type: 'numeric', canonical: 16, display: '$16$' },
  estMinutes: 12,
};

function clientWith(...results: (string | AgentError)[]): {
  client: AgentClient;
  prompts: string[];
} {
  const prompts: string[] = [];
  let index = 0;
  return {
    prompts,
    client: {
      complete: (_settings, request) => {
        prompts.push(request.messages.map((m) => m.content).join('\n'));
        const result = results[index++];
        return Promise.resolve(result instanceof AgentError ? err(result) : ok(result ?? ''));
      },
    },
  };
}

function deps(client: AgentClient, changes: Partial<ActionDeps> = {}): ActionDeps {
  return {
    client,
    getSettings: () => settings,
    rng: mulberry32(1),
    ...changes,
  };
}

describe('generateProblem', () => {
  it('validates, assigns an AI id and reports the generated problem', async () => {
    const fake = clientWith(JSON.stringify(generated));
    const cached: string[] = [];
    const result = await generateProblem(
      deps(fake.client, { onGenerated: (problem) => cached.push(problem.id) }),
      'graphs',
      4,
      summary,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe('agent');
      expect(result.value.problem.id).toMatch(/^ai-graph-[0-9a-z]{10}$/);
      expect(result.value.problem.source).toBe('ai');
      expect(cached).toEqual([result.value.problem.id]);
    }
  });

  it('retries one invalid object with validation feedback', async () => {
    const fake = clientWith('{"title":"missing fields"}', JSON.stringify(generated));
    const result = await generateProblem(deps(fake.client), 'graphs', 4, summary);
    expect(result.ok).toBe(true);
    expect(fake.prompts).toHaveLength(2);
    expect(fake.prompts[1]).toContain('previous object was rejected');
  });

  it('falls back to the bank after two invalid objects', async () => {
    const fake = clientWith('{}', '{}');
    const bank = makeProblem();
    const result = await generateProblem(
      deps(fake.client, { fallbackProblem: () => bank }),
      'graphs',
      4,
      summary,
    );
    expect(result).toEqual({
      ok: true,
      value: { problem: bank, source: 'bank', message: FALLBACK_MESSAGE },
    });
    expect(fake.prompts).toHaveLength(2);
  });

  it('returns a typed error when no fallback exists', async () => {
    const fake = clientWith(new AgentError('network'));
    const result = await generateProblem(deps(fake.client), 'graphs', 4, summary);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('network');
  });
});

describe('hint', () => {
  it('returns a concise validated hint', async () => {
    const fake = clientWith('{"hint":"Try a Prüfer sequence."}');
    const result = await hint(deps(fake.client), makeProblem(), 1, 'I started with a tree.');
    expect(result).toEqual({
      ok: true,
      value: { hint: 'Try a Prüfer sequence.', hidden: false },
    });
  });

  it('hides a hint that contains the canonical answer', async () => {
    const fake = clientWith('{"hint":"The final count is 16."}');
    const result = await hint(deps(fake.client), makeProblem(), 2, '');
    expect(result).toEqual({
      ok: true,
      value: { hint: HINT_LEAK_MESSAGE, hidden: true },
    });
  });
});

describe('check', () => {
  it('uses the local checker for auto-checkable answers', async () => {
    const fake = clientWith(new AgentError('server'));
    const result = await check(deps(fake.client), makeProblem(), '16');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.source).toBe('local');
      if (result.value.source === 'local') expect(result.value.result.status).toBe('correct');
    }
    expect(fake.prompts).toHaveLength(0);
  });

  it('validates an agent proof verdict', async () => {
    const problem = makeProblem({
      answer: { type: 'proof', display: 'Proof', keyPoints: ['Establish the invariant.'] },
    });
    const fake = clientWith(
      '{"verdict":"partial","feedback":"The invariant is useful.","nextStep":"Prove it is preserved."}',
    );
    const result = await check(deps(fake.client), problem, 'My proof');
    expect(result).toEqual({
      ok: true,
      value: {
        source: 'agent',
        verdict: 'partial',
        feedback: 'The invariant is useful.',
        nextStep: 'Prove it is preserved.',
      },
    });
  });

  it('rejects an unknown verdict', async () => {
    const problem = makeProblem({
      answer: { type: 'proof', display: 'Proof', keyPoints: ['Finish.'] },
    });
    const fake = clientWith('{"verdict":"maybe","feedback":"x","nextStep":"y"}');
    const result = await check(deps(fake.client), problem, 'proof');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-json');
  });
});

it('tests the connection with a minimal completion', async () => {
  const fake = clientWith('OK');
  expect(await testConnection(deps(fake.client))).toEqual({ ok: true, value: 'Connected.' });
  expect(fake.prompts[0]).toContain('Reply with OK');
});
