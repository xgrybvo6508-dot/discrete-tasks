import { TOPICS } from '../../bank/topics';
import type { Topic } from '../../bank/types';
import { clear, h } from '../../lib/dom';
import { DAY_MS } from '../../lib/time';
import { isDue } from '../../memory/srs';
import { loadUiPreferences, saveUiPreferences } from '../preferences';
import type { UiRuntime } from '../runtime';
import { topicDetail } from './progress/topic-detail';
import { topicMap } from './progress/topic-map';

export function progressView(runtime: UiRuntime): HTMLElement {
  const root = h('section', { class: 'screen progress-screen' });
  let selected: Topic | null = runtime.focusTopic;

  const render = (): void => {
    const memory = runtime.store.get();
    const now = runtime.clock.now();
    const solved = new Set(
      memory.attempts.filter((a) => a.outcome === 'correct').map((a) => a.problemId),
    ).size;
    const weekAgo = now - 7 * DAY_MS;
    const weekTopics = new Set(
      memory.attempts.filter((a) => a.endedAt >= weekAgo).map((a) => a.topic),
    ).size;
    const due = Object.values(memory.cards).filter((card) => isDue(card, now)).length;
    const map = topicMap(memory, selected, (topic) => {
      selected = topic;
      render();
      queueMicrotask(() =>
        root.querySelector<HTMLElement>('.topic-detail')?.scrollIntoView({ block: 'nearest' }),
      );
    });
    const stats = h('dl', { class: 'calm-stats', 'aria-label': 'Progress summary' }, [
      h('div', {}, [h('dt', {}, ['Problems solved']), h('dd', {}, [String(solved)])]),
      h('div', {}, [h('dt', {}, ['Topics this week']), h('dd', {}, [String(weekTopics)])]),
      h('div', {}, [h('dt', {}, ['Due today']), h('dd', {}, [String(due)])]),
    ]);
    clear(root);
    root.append(
      h('div', { class: 'screen-heading' }, [
        h('h1', {}, ['Progress']),
        h('p', { class: 'quiet' }, [
          'Topics are mixed on purpose. Past mistakes come back at growing intervals.',
        ]),
      ]),
      stats,
      map,
    );
    if (selected) {
      root.append(
        topicDetail(
          selected,
          [...runtime.bank, ...memory.aiProblems],
          memory,
          now,
          runtime.focusTopic === selected,
          (id) =>
            runtime.bankById.get(id)?.title ?? memory.aiProblems.find((p) => p.id === id)?.title,
          (topic) => {
            runtime.focusTopic = topic;
            const prefs = loadUiPreferences(runtime.settingsStorage);
            saveUiPreferences(runtime.settingsStorage, { ...prefs, focusTopic: topic });
            if (topic) window.location.hash = '#/practice';
            else render();
          },
        ),
      );
    }
  };

  if (!selected && runtime.focusTopic === null && TOPICS.length === 1) selected = TOPICS[0] ?? null;
  render();
  return root;
}
