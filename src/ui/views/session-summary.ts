import { TOPIC_LABELS } from '../../bank/topics';
import { h } from '../../lib/dom';
import { summarizeSession } from '../../memory/session';
import type { SessionState } from '../../memory/session';
import type { MemoryStore } from '../../memory/store';

export function sessionSummary(
  session: SessionState,
  store: MemoryStore,
  onRestart: () => void,
): HTMLElement {
  const summary = summarizeSession(session, store.get().cards);
  const due = h('ul', { class: 'summary-list' });
  for (const item of summary.comingBack.slice(0, 5)) {
    due.append(
      h('li', {}, [
        `${item.problemId}: ${new Date(item.dueAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })}`,
      ]),
    );
  }
  const button = h('button', { class: 'button button--primary', type: 'button' }, ['Start again']);
  button.addEventListener('click', onRestart);
  return h('section', { class: 'screen session-summary' }, [
    h('p', { class: 'eyebrow' }, ['Session complete']),
    h('h1', {}, ['A quiet stopping point']),
    h('p', {}, [
      `You saw ${summary.seen} ${summary.seen === 1 ? 'problem' : 'problems'} across ${summary.topics.length} ${summary.topics.length === 1 ? 'topic' : 'topics'}.`,
    ]),
    summary.topics.length > 0
      ? h('p', { class: 'quiet' }, [summary.topics.map((t) => TOPIC_LABELS[t]).join(' · ')])
      : h('p', { class: 'quiet' }, ['No problems were completed.']),
    due.childElementCount > 0
      ? h('div', { class: 'summary-block' }, [h('h2', {}, ['Coming back']), due])
      : h('p', { class: 'quiet' }, ['There are no scheduled reviews yet.']),
    button,
  ]);
}
