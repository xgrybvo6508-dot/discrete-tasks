import { describe, expect, it } from 'vitest';
import { rebuildTopics } from './mastery';
import { emptyMemory, type Attempt, type Memory } from './schema';
import { formatSummary, RECENT_MISTAKES, RECENT_TITLES, summarizeForAgent } from './summary';
import { makeAttempt, T0 } from './testing';

function summaryMemory(attempts: Attempt[]): Memory {
  return {
    ...emptyMemory(T0),
    attempts,
    topics: rebuildTopics(attempts),
  };
}

describe('summarizeForAgent', () => {
  it(`keeps the latest ${RECENT_TITLES} unique titles in the requested topic`, () => {
    const attempts = Array.from({ length: RECENT_TITLES + 3 }, (_, index) =>
      makeAttempt({
        id: `a-${index}`,
        problemId: `graph-${index}`,
        endedAt: T0 + index,
      }),
    );
    attempts.push(
      makeAttempt({
        id: 'logic-newest',
        problemId: 'logic-newest',
        topic: 'logic',
        endedAt: T0 + 100,
      }),
      makeAttempt({
        id: 'skipped-newest',
        problemId: 'graph-skipped',
        outcome: 'skipped',
        quality: 0,
        endedAt: T0 + 200,
      }),
    );
    const titleOf = (id: string): string | undefined =>
      id === 'graph-11' || id === 'graph-12'
        ? 'Repeated title'
        : id.startsWith('graph-')
          ? `Title ${id.slice('graph-'.length)}`
          : `Other ${id}`;

    const summary = summarizeForAgent(summaryMemory(attempts), 'graphs', titleOf);

    expect(summary.recentTitles).toHaveLength(RECENT_TITLES);
    expect(summary.recentTitles[0]).toBe('Repeated title');
    expect(summary.recentTitles.filter((title) => title === 'Repeated title')).toHaveLength(1);
    expect(summary.recentTitles).not.toContain('Title skipped');
    expect(summary.recentTitles.every((title) => !title.startsWith('Other logic'))).toBe(true);
  });

  it(`limits mistake notes to the latest ${RECENT_MISTAKES}`, () => {
    const attempts = Array.from({ length: RECENT_MISTAKES + 2 }, (_, index) =>
      makeAttempt({
        id: `miss-${index}`,
        problemId: `graph-miss-${index}`,
        endedAt: T0 + index,
        outcome: index % 2 === 0 ? 'incorrect' : 'partial',
        quality: index % 2 === 0 ? 1 : 2,
        wrongChecks: index,
        hintsUsed: 1,
        agentHints: 1,
      }),
    );
    const summary = summarizeForAgent(summaryMemory(attempts), 'graphs', (id) => `Title ${id}`);

    expect(summary.recentMistakes).toHaveLength(RECENT_MISTAKES);
    expect(summary.recentMistakes).toEqual([
      'Title graph-miss-4: incorrect, 4 wrong checks, 2 hints.',
      'Title graph-miss-3: partial, 3 wrong checks, 2 hints.',
      'Title graph-miss-2: incorrect, 2 wrong checks, 2 hints.',
    ]);
  });

  it('never includes answerText in the structured or formatted summary', () => {
    const privateAnswer = 'PRIVATE_USER_ANSWER_SENTINEL';
    const attempt = makeAttempt({
      outcome: 'incorrect',
      quality: 1,
      wrongChecks: 1,
      answerText: privateAnswer,
    });
    const summary = summarizeForAgent(summaryMemory([attempt]), 'graphs', () => 'Labelled trees');
    const formatted = formatSummary(summary);

    expect(JSON.stringify(summary)).not.toContain(privateAnswer);
    expect(formatted).not.toContain(privateAnswer);
    expect(formatted).toContain('Labelled trees: incorrect, 1 wrong check, 0 hints.');
  });

  it('returns an empty calm summary for a topic with no attempts', () => {
    const summary = summarizeForAgent(emptyMemory(T0), 'sets', () => undefined);

    expect(summary).toEqual({
      topic: 'sets',
      band: 'New',
      recentTitles: [],
      recentMistakes: [],
    });
    expect(formatSummary(summary)).toBe('Topic: sets. Learner level in this topic: New.');
  });
});
