import { describe, expect, it } from 'vitest';
import { isTopic, TOPIC_EDGES, TOPIC_LABELS, TOPIC_PREFIXES, TOPICS } from './topics';
import type { Topic } from './types';

describe('topics', () => {
  it('lists the 10 course topics once each', () => {
    expect(TOPICS).toHaveLength(10);
    expect(new Set(TOPICS).size).toBe(10);
  });

  it('has a label and a unique prefix for every topic', () => {
    for (const t of TOPICS) {
      expect(TOPIC_LABELS[t].length).toBeGreaterThan(0);
      expect(TOPIC_PREFIXES[t]).toMatch(/^[a-z]+$/);
    }
    expect(new Set(TOPICS.map((t) => TOPIC_PREFIXES[t])).size).toBe(TOPICS.length);
    expect(Object.keys(TOPIC_LABELS).sort()).toEqual([...TOPICS].sort());
    expect(Object.keys(TOPIC_PREFIXES).sort()).toEqual([...TOPICS].sort());
  });

  it('mind-map edges join known, distinct topics and connect every topic', () => {
    const adj = new Map<Topic, Topic[]>(TOPICS.map((t) => [t, []]));
    for (const [a, b] of TOPIC_EDGES) {
      expect(isTopic(a) && isTopic(b)).toBe(true);
      expect(a).not.toBe(b);
      adj.get(a)?.push(b);
      adj.get(b)?.push(a);
    }
    const first = TOPICS[0];
    if (first === undefined) throw new Error('no topics');
    const seen = new Set<Topic>([first]);
    const queue: Topic[] = [first];
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
      for (const n of adj.get(t) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(TOPICS.length);
  });

  it('isTopic accepts known topics only', () => {
    for (const t of TOPICS) expect(isTopic(t)).toBe(true);
    for (const v of ['Graphs', 'graph', '', 'toString', '__proto__', 'constructor', 1, null]) {
      expect(isTopic(v)).toBe(false);
    }
  });
});
