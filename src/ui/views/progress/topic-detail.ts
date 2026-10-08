import { TOPIC_LABELS } from '../../../bank/topics';
import type { Problem, Topic } from '../../../bank/types';
import { h } from '../../../lib/dom';
import type { Memory } from '../../../memory/schema';
import { isDue } from '../../../memory/srs';

function problemStatus(problem: Problem, memory: Memory, now: number): string {
  const card = memory.cards[problem.id];
  if (!card) return 'New';
  if (isDue(card, now)) return 'Due today';
  return `Due ${new Date(card.dueAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}

export function topicDetail(
  topic: Topic,
  problems: readonly Problem[],
  memory: Memory,
  now: number,
  focused: boolean,
  titleOf: (id: string) => string | undefined,
  onFocus: (topic: Topic | null) => void,
): HTMLElement {
  const list = h('ul', { class: 'problem-list' });
  for (const problem of problems.filter((item) => item.topic === topic)) {
    const related = (problem.related ?? []).map(titleOf).filter((v): v is string => Boolean(v));
    list.append(
      h('li', { class: 'problem-row' }, [
        h('div', {}, [
          h('span', { class: 'problem-row__title' }, [problem.title]),
          ...(related.length > 0
            ? [
                h('span', { class: 'problem-row__related quiet' }, [
                  `Connected: ${related.join(', ')}`,
                ]),
              ]
            : []),
        ]),
        h('span', { class: 'quiet' }, [problemStatus(problem, memory, now)]),
      ]),
    );
  }
  const button = h(
    'button',
    { class: focused ? 'button button--outline' : 'button button--primary', type: 'button' },
    [focused ? 'Mix all topics' : 'Practice this topic'],
  );
  button.addEventListener('click', () => onFocus(focused ? null : topic));
  return h('section', { class: 'topic-detail', 'aria-labelledby': 'topic-detail-title' }, [
    h('div', { class: 'section-heading' }, [
      h('h2', { id: 'topic-detail-title' }, [TOPIC_LABELS[topic]]),
      ...(focused ? [h('span', { class: 'focus-label' }, ['Focus mode'])] : []),
    ]),
    list.childElementCount > 0
      ? list
      : h('p', { class: 'quiet' }, ['No built-in problems are available for this topic yet.']),
    button,
  ]);
}
