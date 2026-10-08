import type { Problem } from '../../../bank/types';
import { clear, h } from '../../../lib/dom';
import { richText } from '../../components/rich-text';

export interface HintPanel {
  readonly root: HTMLElement;
  render(shown: number, agentText: string | null, busy: boolean, interactive: boolean): void;
  collapse(): void;
}

export function hintPanel(
  problem: Problem,
  onNext: () => void,
  onSolution: () => void,
  onAgent: () => void,
  agentAvailable: boolean,
): HintPanel {
  const body = h('div', { class: 'hint-panel__body' });
  const details = h('details', { class: 'hint-panel' }, [h('summary', {}, ['Hints']), body]);

  const render = (
    shown: number,
    agentText: string | null,
    busy: boolean,
    interactive: boolean,
  ): void => {
    const children: Node[] = [];
    if (shown === 0) {
      children.push(h('p', { class: 'quiet' }, ['Hints appear one step at a time.']));
    } else {
      children.push(
        h('p', { class: 'hint-panel__count' }, [`Hint ${shown} of ${problem.hints.length}`]),
      );
      for (const text of problem.hints.slice(0, shown)) children.push(richText(text));
    }
    if (agentText) children.push(richText(agentText, 'rich-text agent-text'));
    const actions = h('div', { class: 'inline-actions' });
    if (interactive && shown < problem.hints.length) {
      const next = h('button', { class: 'button button--ghost', type: 'button' }, ['Next hint']);
      next.addEventListener('click', onNext);
      actions.append(next);
    }
    if (interactive && shown === problem.hints.length) {
      const solution = h('button', { class: 'button button--ghost', type: 'button' }, [
        'Show solution',
      ]);
      solution.addEventListener('click', onSolution);
      actions.append(solution);
    }
    if (interactive && agentAvailable) {
      const ask = h('button', { class: 'button button--agent', type: 'button', disabled: busy }, [
        busy ? 'Asking…' : 'Ask the agent about my work',
      ]);
      ask.addEventListener('click', onAgent);
      actions.append(ask);
    }
    if (actions.childElementCount > 0) children.push(actions);
    clear(body);
    body.append(...children);
    if (shown > 0 || agentText || busy) details.open = true;
  };

  return {
    root: details,
    render,
    collapse: () => {
      details.open = false;
    },
  };
}
