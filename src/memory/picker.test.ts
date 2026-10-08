import { describe, expect, it } from 'vitest';
import { TOPICS } from '../bank/topics';
import type { Topic } from '../bank/types';
import { mulberry32, randomInt } from '../lib/random';
import { createFakeClock, DAY_MS, MINUTE_MS } from '../lib/time';
import { pickNext, type PickableProblem, type PickInput, type PickResult } from './picker';
import { createAttempt, getCard, recordAttempt } from './record';
import { emptyMemory, emptyTopics, type Memory, type Outcome, type TopicStats } from './schema';
import {
  createSession,
  eligibleRelearn,
  isRetry,
  noteOutcome,
  presentProblem,
  seenIds,
  topicAgo,
  type SessionState,
} from './session';
import { isDue } from './srs';
import { syntheticPool, T0 } from './testing';

const HOUR_MS = 60 * MINUTE_MS;
const POOL = syntheticPool();

function find(pool: readonly PickableProblem[], id: string): PickableProblem {
  const p = pool.find((x) => x.id === id);
  if (!p) throw new Error(`unknown problem ${id}`);
  return p;
}

const show = (session: SessionState, p: PickableProblem): SessionState =>
  presentProblem(session, { problemId: p.id, topic: p.topic });

function pick(input: Omit<PickInput, 'rng'>, seed: number): PickResult {
  const r = pickNext({ ...input, rng: mulberry32(seed) });
  if (!r) throw new Error('expected a pick');
  return r;
}

/** Records one finished attempt in memory and session, the way the app does. */
function finish(
  state: { memory: Memory; session: SessionState },
  problem: PickableProblem,
  outcome: Outcome,
  startedAt: number,
  endedAt: number,
  id: string,
): void {
  const attempt = createAttempt(id, {
    problemId: problem.id,
    source: problem.source,
    topic: problem.topic,
    difficulty: problem.difficulty,
    startedAt,
    endedAt,
    activeMs: endedAt - startedAt,
    hintsUsed: 0,
    agentHints: 0,
    wrongChecks: 0,
    solutionViewed: false,
    outcome,
    checkedBy: 'local',
  });
  state.memory = recordAttempt(state.memory, attempt, {
    relearn: isRetry(state.session, problem.id),
  });
  state.session = noteOutcome(
    state.session,
    { problemId: problem.id, topic: problem.topic },
    outcome,
  );
}

/** Independent oracle: topics that have a real (non-extra) candidate right now. */
function candidateTopics(
  pool: readonly PickableProblem[],
  memory: Memory,
  session: SessionState,
  now: number,
): Set<Topic> {
  const seen = seenIds(session);
  const relearn = new Set(eligibleRelearn(session).map((r) => r.problemId));
  const out = new Set<Topic>();
  for (const p of pool) {
    if (session.focusTopic && p.topic !== session.focusTopic) continue;
    const card = getCard(memory.cards, p.id);
    if (relearn.has(p.id) || (!seen.has(p.id) && (!card || isDue(card, now)))) out.add(p.topic);
  }
  return out;
}

interface SimPick {
  readonly problemId: string;
  readonly topic: Topic;
  readonly kind: PickResult['reason']['kind'];
  readonly last: Topic | null;
  /** Topics other than the last one that the picker could have used. */
  readonly alternatives: number;
  readonly session: number;
}

const OUTCOME_MIX: readonly Outcome[] = [
  'correct',
  'correct',
  'correct',
  'correct',
  'incorrect',
  'incorrect',
  'partial',
  'skipped',
];

/** Many sessions over many days, with mixed outcomes and an advancing fake clock. */
function simulate(
  seed: number,
  total: number,
  pool: readonly PickableProblem[] = POOL,
  focusTopic: Topic | null = null,
): SimPick[] {
  const rng = mulberry32(seed);
  const life = mulberry32(seed ^ 0x9e3779b9);
  const clock = createFakeClock(T0);
  const state = { memory: emptyMemory(clock.now()), session: createSession(clock.now()) };
  const log: SimPick[] = [];
  let sessionNo = 0;
  while (log.length < total) {
    state.session = createSession(clock.now(), focusTopic);
    sessionNo++;
    const missedAt = new Map<string, number>();
    const retried = new Set<string>();
    const length = 5 + randomInt(life, 20);
    for (let i = 0; i < length && log.length < total; i++) {
      const now = clock.now();
      const { memory, session } = state;
      const last = topicAgo(session, 1);
      const r = pickNext({
        problems: pool,
        cards: memory.cards,
        topics: memory.topics,
        session,
        now,
        rng,
      });
      if (!r) throw new Error('the picker returned nothing for a non-empty pool');
      const problem = find(pool, r.problemId);
      const options =
        r.reason.kind === 'extra'
          ? new Set(pool.filter((p) => !focusTopic || p.topic === focusTopic).map((p) => p.topic))
          : candidateTopics(pool, memory, session, now);
      if (last) options.delete(last);
      log.push({
        problemId: r.problemId,
        topic: problem.topic,
        kind: r.reason.kind,
        last,
        alternatives: options.size,
        session: sessionNo,
      });

      // A problem seen this session only comes back as a spaced retry or as extra practice.
      if (seenIds(session).has(r.problemId)) expect(['relearn', 'extra']).toContain(r.reason.kind);
      if (r.reason.kind === 'relearn') {
        const at = missedAt.get(r.problemId);
        if (at === undefined) throw new Error('relearn without a miss');
        expect(session.presented.length - at).toBeGreaterThanOrEqual(4);
        expect(retried.has(r.problemId)).toBe(false);
        retried.add(r.problemId);
      }

      state.session = show(state.session, problem);
      const startedAt = clock.now();
      clock.advance((2 + randomInt(life, 15)) * MINUTE_MS);
      const outcome = OUTCOME_MIX[randomInt(life, OUTCOME_MIX.length)] ?? 'correct';
      finish(state, problem, outcome, startedAt, clock.now(), `a${log.length}`);
      if (outcome === 'incorrect' && !retried.has(problem.id) && !missedAt.has(problem.id)) {
        missedAt.set(problem.id, state.session.presented.length);
      }
    }
    clock.advance((1 + randomInt(life, 3)) * DAY_MS + randomInt(life, 12) * HOUR_MS);
  }
  return log;
}

describe('pickNext: interleaving', () => {
  it('never repeats a topic while another topic is available (1000 seeded picks)', () => {
    let repeats = 0;
    let picks = 0;
    for (const seed of [1, 2, 3, 4]) {
      const log = simulate(seed, 250);
      picks += log.length;
      log.forEach((p, i) => {
        const prev = log[i - 1];
        if (!prev || prev.session !== p.session) return;
        if (p.topic === p.last) {
          repeats++;
          expect(p.alternatives, `pick ${i} (seed ${seed}) repeated ${p.topic}`).toBe(0);
        }
      });
    }
    expect(repeats).toBe(0);
    expect(picks).toBe(1000);
  });

  it('brings back missed problems as relearn and due problems as reviews', () => {
    const kinds = new Map<string, number>();
    for (const p of simulate(5, 1000)) kinds.set(p.kind, (kinds.get(p.kind) ?? 0) + 1);
    expect(kinds.get('relearn') ?? 0).toBeGreaterThan(0);
    expect(kinds.get('review') ?? 0).toBeGreaterThan(100);
    expect(kinds.get('new') ?? 0).toBeGreaterThanOrEqual(POOL.length);
  });

  it('repeats a topic when it is the only one with candidates', () => {
    let session = createSession(T0);
    for (const p of POOL) if (p.topic !== 'graphs') session = show(session, p);
    session = show(session, find(POOL, 'graph-003'));
    const input = { problems: POOL, cards: {}, topics: emptyTopics(), session, now: T0 };
    for (let seed = 0; seed < 50; seed++) {
      const r = pick(input, seed);
      expect(['graph-004', 'graph-005']).toContain(r.problemId);
      expect(r.reason.kind).toBe('new');
    }
  });

  it('repeats freely in a single-topic pool', () => {
    const log = simulate(11, 40, syntheticPool(['sets']));
    expect(log.every((p) => p.topic === 'sets')).toBe(true);
    expect(log.slice(1).some((p) => p.topic === p.last)).toBe(true);
  });

  it('avoids the last topic whenever another one has candidates', () => {
    const session = show(createSession(T0), find(POOL, 'graph-003'));
    const pool = syntheticPool(['graphs', 'logic']);
    for (let seed = 0; seed < 200; seed++) {
      const r = pick({ problems: pool, cards: {}, topics: emptyTopics(), session, now: T0 }, seed);
      expect(find(pool, r.problemId).topic).toBe('logic');
    }
  });

  it('halves the score of the topic seen two problems ago', () => {
    const topics = emptyTopics();
    for (const t of TOPICS)
      topics[t] = { ...topics[t], mastery: 0.5, attempts: 5, lastSeenAt: T0 - HOUR_MS };
    const prob = (id: string, topic: Topic): PickableProblem => ({
      id,
      topic,
      difficulty: 4,
      source: 'bank',
    });
    const pool = [
      prob('graphs-a', 'graphs'),
      prob('logic-a', 'logic'),
      prob('logic-b', 'logic'),
      prob('sets-a', 'sets'),
      prob('sets-b', 'sets'),
    ];
    let session = createSession(T0);
    session = show(session, find(pool, 'sets-a'));
    session = show(session, find(pool, 'logic-a'));
    // Three topics have candidates; logic was last, sets was two ago (score halved).
    let sets = 0;
    const n = 3000;
    for (let seed = 0; seed < n; seed++) {
      const r = pick({ problems: pool, cards: {}, topics, session, now: T0 }, seed);
      expect(r.problemId).not.toBe('logic-b');
      if (r.problemId === 'sets-b') sets++;
    }
    expect(sets / n).toBeGreaterThan(0.28);
    expect(sets / n).toBeLessThan(0.39);
  });
});

describe('pickNext: review and new slots', () => {
  /** Five topics have a due review; every topic has unseen problems. */
  function mixedMemory(): Memory {
    let m = emptyMemory(T0 - 10 * DAY_MS);
    TOPICS.slice(0, 5).forEach((topic, i) => {
      const problem = find(POOL, syntheticPool([topic])[0]?.id ?? '');
      const ended = T0 - 10 * DAY_MS;
      const state = { memory: m, session: createSession(ended) };
      finish(state, problem, i % 2 === 0 ? 'correct' : 'incorrect', ended - 60_000, ended, `m${i}`);
      m = state.memory;
    });
    return m;
  }

  it('chooses a review about 60% of the time when both slots have candidates', () => {
    const m = mixedMemory();
    const input = {
      problems: POOL,
      cards: m.cards,
      topics: m.topics,
      session: createSession(T0),
      now: T0,
    };
    let reviews = 0;
    const n = 1000;
    for (let seed = 1; seed <= n; seed++) {
      const r = pick(input, seed);
      if (r.reason.kind === 'review') {
        reviews++;
        const card = getCard(m.cards, r.problemId);
        expect(r.reason).toEqual({
          kind: 'review',
          lastOutcome: card?.lastOutcome,
          lastSeenAt: card?.lastSeenAt,
        });
      } else {
        expect(r.reason.kind).toBe('new');
        expect(getCard(m.cards, r.problemId)).toBeUndefined();
      }
    }
    expect(reviews / n).toBeGreaterThanOrEqual(0.55);
    expect(reviews / n).toBeLessThanOrEqual(0.65);
  });

  it('uses the other slot when the chosen one is empty', () => {
    const m = mixedMemory();
    const reviewOnly = POOL.filter((p) => getCard(m.cards, p.id));
    for (let seed = 0; seed < 100; seed++) {
      const r = pick(
        {
          problems: reviewOnly,
          cards: m.cards,
          topics: m.topics,
          session: createSession(T0),
          now: T0,
        },
        seed,
      );
      expect(r.reason.kind).toBe('review');
    }
  });

  it('does not offer cards that are not due yet', () => {
    const m = mixedMemory();
    const later = T0 - 10 * DAY_MS + HOUR_MS;
    const reviewed = POOL.filter((p) => getCard(m.cards, p.id));
    const r = pickNext({
      problems: reviewed,
      cards: m.cards,
      topics: m.topics,
      session: createSession(later),
      now: later,
      rng: mulberry32(1),
    });
    expect(r?.reason.kind).toBe('extra');
  });
});

describe('pickNext: weak topics and difficulty', () => {
  function topicsWith(mastery: Partial<Record<Topic, number>>): Record<Topic, TopicStats> {
    const topics = emptyTopics();
    for (const t of TOPICS) {
      topics[t] = {
        ...topics[t],
        attempts: 10,
        mastery: mastery[t] ?? 0.5,
        lastSeenAt: T0 - HOUR_MS,
      };
    }
    return topics;
  }

  it('favours a weak topic over a strong one', () => {
    const topics = topicsWith({ graphs: 0.05, logic: 0.9 });
    const counts = new Map<string, number>();
    const byDifficulty = { graphs: [0, 0, 0], logic: [0, 0, 0] };
    for (let seed = 0; seed < 3000; seed++) {
      const r = pick(
        { problems: POOL, cards: {}, topics, session: createSession(T0), now: T0 },
        seed,
      );
      const p = find(POOL, r.problemId);
      counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);
      if (p.topic === 'graphs' || p.topic === 'logic') {
        const row = byDifficulty[p.topic];
        row[p.difficulty - 3] = (row[p.difficulty - 3] ?? 0) + 1;
      }
    }
    const weak = counts.get('graphs') ?? 0;
    const strong = counts.get('logic') ?? 0;
    expect(weak).toBeGreaterThan(2 * strong);
    expect(weak).toBeGreaterThan(
      Math.max(...TOPICS.filter((t) => t !== 'graphs').map((t) => counts.get(t) ?? 0)),
    );

    // New/Learning topics target difficulty 3, Strong topics target 5.
    const [g3 = 0, g4 = 0, g5 = 0] = byDifficulty.graphs;
    const [l3 = 0, l4 = 0, l5 = 0] = byDifficulty.logic;
    expect(g3).toBeGreaterThan(g4);
    expect(g4).toBeGreaterThan(g5);
    expect(l5).toBeGreaterThan(l4 + l3);
  });

  it('gives a topic never seen a boost', () => {
    const topics = topicsWith({});
    topics.boolean = emptyTopics().boolean;
    let boolean = 0;
    const n = 3000;
    for (let seed = 0; seed < n; seed++) {
      const r = pick(
        { problems: POOL, cards: {}, topics, session: createSession(T0), now: T0 },
        seed,
      );
      if (find(POOL, r.problemId).topic === 'boolean') boolean++;
    }
    expect(boolean / n).toBeGreaterThan(0.15);
  });
});

describe('pickNext: determinism', () => {
  it('gives the same sequence for the same seed', () => {
    expect(simulate(21, 120)).toEqual(simulate(21, 120));
  });

  it('gives a different sequence for a different seed', () => {
    const a = simulate(21, 60).map((p) => p.problemId);
    const b = simulate(22, 60).map((p) => p.problemId);
    expect(a).not.toEqual(b);
  });
});

describe('pickNext: empty and tiny pools', () => {
  const base = { cards: {}, topics: emptyTopics(), now: T0 };

  it('returns null for an empty pool', () => {
    expect(
      pickNext({ ...base, problems: [], session: createSession(T0), rng: mulberry32(1) }),
    ).toBeNull();
    const focused = createSession(T0, 'logic');
    expect(
      pickNext({
        ...base,
        problems: syntheticPool(['graphs']),
        session: focused,
        rng: mulberry32(1),
      }),
    ).toBeNull();
  });

  it('keeps offering the only problem', () => {
    const pool = syntheticPool(['graphs']).slice(0, 1);
    const only = pool[0];
    if (!only) throw new Error('fixture');
    let session = createSession(T0);
    const first = pick({ ...base, problems: pool, session }, 1);
    expect(first).toEqual({
      problemId: only.id,
      reason: { kind: 'new', topic: 'graphs', topicLastSeenAt: null },
    });
    session = show(session, only);
    const second = pick({ ...base, problems: pool, session }, 2);
    expect(second).toEqual({ problemId: only.id, reason: { kind: 'extra' } });
  });

  it('alternates two problems of the same topic', () => {
    const pool = syntheticPool(['graphs']).slice(0, 2);
    let session = createSession(T0);
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = pick({ ...base, problems: pool, session }, i);
      ids.push(r.problemId);
      session = show(session, find(pool, r.problemId));
    }
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });
});

describe('pickNext: focus topic', () => {
  it('only picks the focus topic, including extra practice', () => {
    const log = simulate(31, 60, POOL, 'graphs');
    expect(log.every((p) => p.topic === 'graphs')).toBe(true);
    expect(log.some((p) => p.kind === 'extra')).toBe(true);
  });

  it('ignores a relearn item from another topic', () => {
    const state = { memory: emptyMemory(T0), session: createSession(T0) };
    const logic = find(POOL, 'logic-003');
    state.session = show(state.session, logic);
    finish(state, logic, 'incorrect', T0, T0 + 1, 'x0');
    for (const id of ['graph-003', 'sets-003', 'rel-003', 'ind-003']) {
      state.session = show(state.session, find(POOL, id));
    }
    expect(eligibleRelearn(state.session)).toHaveLength(1);
    const focused = { ...state.session, focusTopic: 'graphs' as const };
    for (let seed = 0; seed < 100; seed++) {
      const r = pick(
        {
          problems: POOL,
          cards: state.memory.cards,
          topics: state.memory.topics,
          session: focused,
          now: T0,
        },
        seed,
      );
      expect(find(POOL, r.problemId).topic).toBe('graphs');
    }
  });
});

describe('pickNext: relearn spacing', () => {
  it('a missed problem comes back once, after at least 4 others', () => {
    for (let seed = 0; seed < 50; seed++) {
      const clock = createFakeClock(T0);
      const rng = mulberry32(seed);
      const missed = find(POOL, 'graph-003');
      const state = { memory: emptyMemory(T0), session: show(createSession(T0), missed) };
      finish(state, missed, 'incorrect', T0, T0 + MINUTE_MS, 'miss');
      const positions: number[] = [];
      for (let i = 0; i < 25; i++) {
        clock.advance(5 * MINUTE_MS);
        const r = pickNext({
          problems: POOL,
          cards: state.memory.cards,
          topics: state.memory.topics,
          session: state.session,
          now: clock.now(),
          rng,
        });
        if (!r) throw new Error('expected a pick');
        const p = find(POOL, r.problemId);
        if (p.id === missed.id) {
          expect(r.reason.kind).toBe('relearn');
          positions.push(state.session.presented.length);
        }
        state.session = show(state.session, p);
        // The retry is missed again: it must not be queued a second time.
        finish(
          state,
          p,
          p.id === missed.id ? 'incorrect' : 'correct',
          clock.now(),
          clock.now() + 1,
          `s${i}`,
        );
      }
      expect(positions).toHaveLength(1);
      expect((positions[0] ?? 0) - 1).toBeGreaterThanOrEqual(4);
      // The retry did not count as a second lapse.
      expect(getCard(state.memory.cards, missed.id)?.lapses).toBe(1);
    }
  });
});

describe('pickNext: extra practice', () => {
  it('when everything was seen, offers the least recently seen problem, avoiding the last topic', () => {
    const pool = syntheticPool(['graphs', 'logic', 'sets']).filter((p) => p.difficulty === 3);
    let session = createSession(T0);
    for (const p of pool) session = show(session, p);
    const base = { problems: pool, cards: {}, topics: emptyTopics(), now: T0 };
    const first = pick({ ...base, session }, 1);
    expect(first).toEqual({ problemId: 'graph-003', reason: { kind: 'extra' } });
    session = show(session, find(pool, first.problemId));
    expect(pick({ ...base, session }, 2).problemId).toBe('logic-003');
  });

  it('prefers problems not seen for longest across sessions', () => {
    const state = { memory: emptyMemory(T0 - 5 * DAY_MS), session: createSession(T0) };
    const ages: Record<string, number> = { 'graph-003': 1, 'logic-003': 3, 'sets-003': 2 };
    const pool = syntheticPool(['graphs', 'logic', 'sets']).filter((p) => p.difficulty === 3);
    for (const p of pool) {
      const at = T0 - (ages[p.id] ?? 0) * HOUR_MS;
      finish(state, p, 'correct', at - 1, at, p.id);
    }
    const r = pick(
      {
        problems: pool,
        cards: state.memory.cards,
        topics: state.memory.topics,
        session: createSession(T0),
        now: T0,
      },
      1,
    );
    expect(r).toEqual({ problemId: 'logic-003', reason: { kind: 'extra' } });
  });
});
