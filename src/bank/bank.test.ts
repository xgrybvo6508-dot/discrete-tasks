import { describe, expect, it } from 'vitest';
import { canonicalInput, checkAnswer } from '../lib/check';
import { normalizeItem } from '../lib/check/set';
import { extractMath } from '../lib/markdown';
import { isValidTex } from '../lib/math';
import { BANK, byId } from './index';
import { TOPIC_PREFIXES, TOPICS } from './topics';
import type { Answer, Problem, Topic } from './types';
import { validateProblem } from './validate';

function textFields(problem: Problem): string[] {
  return [
    problem.statement,
    ...problem.hints,
    problem.solution,
    problem.answer.display,
    ...(problem.answer.keyPoints ?? []),
  ];
}

function acceptedInput(answer: Answer, accepted: string): string {
  if (answer.type !== 'set' || !Array.isArray(answer.canonical)) return accepted;
  const at = accepted.indexOf('=');
  if (at <= 0) return accepted;
  const alias = accepted.slice(0, at);
  const item = normalizeItem(accepted.slice(at + 1));
  const values = answer.canonical.map((value) =>
    normalizeItem(String(value)) === item ? alias : String(value),
  );
  return `{${values.join(', ')}}`;
}

describe('offline problem bank', () => {
  it('contains exactly three valid bank problems per topic', () => {
    expect(BANK).toHaveLength(30);
    for (const problem of BANK) {
      const result = validateProblem(problem);
      expect(result.ok, result.ok ? '' : result.error.join('; ')).toBe(true);
      expect(problem.source).toBe('bank');
    }
    for (const topic of TOPICS) {
      expect(BANK.filter((problem) => problem.topic === topic)).toHaveLength(3);
    }
  });

  it('has unique ids with the topic prefix and a complete lookup map', () => {
    expect(new Set(BANK.map((problem) => problem.id)).size).toBe(BANK.length);
    for (const problem of BANK) {
      expect(problem.id).toMatch(new RegExp(`^${TOPIC_PREFIXES[problem.topic]}-\\d{3}$`));
      expect(byId.get(problem.id)).toBe(problem);
    }
    expect(byId.size).toBe(BANK.length);
  });

  it('has the planned answer mix and represents difficulties 3 through 5', () => {
    const counts = new Map<string, number>();
    for (const problem of BANK) {
      counts.set(problem.answer.type, (counts.get(problem.answer.type) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({
      expression: 10,
      numeric: 11,
      proof: 5,
      set: 4,
    });
    expect(new Set(BANK.map((problem) => problem.difficulty))).toEqual(new Set([3, 4, 5]));
  });

  it('accepts every canonical answer and every declared variant', () => {
    for (const problem of BANK) {
      if (problem.answer.type === 'proof') continue;
      const answer: Answer = problem.answer;
      const canonical = canonicalInput(answer);
      expect(canonical, problem.id).not.toBeNull();
      expect(checkAnswer(answer, canonical ?? '').status, problem.id).toBe('correct');
      for (const accepted of answer.accepted ?? []) {
        expect(
          checkAnswer(answer, acceptedInput(answer, accepted)).status,
          `${problem.id}: ${accepted}`,
        ).toBe('correct');
      }
    }
  });

  it('rejects an obviously wrong answer for every auto-checkable problem', () => {
    for (const problem of BANK) {
      if (problem.answer.type === 'proof') continue;
      const wrong =
        problem.answer.type === 'set' ? '{obviously-wrong-answer}' : '-999999999999999999';
      expect(checkAnswer(problem.answer, wrong).status, problem.id).toBe('incorrect');
    }
  });

  it('contains only valid KaTeX in statements, hints, solutions and answer text', () => {
    for (const problem of BANK) {
      for (const text of textFields(problem)) {
        const extracted = extractMath(text);
        expect(extracted.text, `${problem.id}: unmatched math delimiter`).not.toContain('$');
        for (const span of extracted.math) {
          expect(isValidTex(span.tex, span.display), `${problem.id}: ${span.tex}`).toBe(true);
        }
      }
    }
  });

  it('links only existing problems and keeps planned links reciprocal', () => {
    for (const problem of BANK) {
      for (const relatedId of problem.related ?? []) {
        const related = byId.get(relatedId);
        expect(related, `${problem.id} -> ${relatedId}`).toBeDefined();
        expect(related?.related, `${relatedId} -> ${problem.id}`).toContain(problem.id);
      }
    }
  });

  it('uses only known topics', () => {
    const topics = new Set<Topic>(TOPICS);
    for (const problem of BANK) expect(topics.has(problem.topic)).toBe(true);
  });
});
