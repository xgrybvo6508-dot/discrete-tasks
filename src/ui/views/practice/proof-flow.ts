import type { Problem } from '../../../bank/types';
import type { SelfAssessment } from '../../../memory/schema';
import { h } from '../../../lib/dom';
import { richText } from '../../components/rich-text';

export function proofSolution(
  problem: Problem,
  onAssess: (value: SelfAssessment) => void,
  showAssessment = true,
): HTMLElement {
  const checklist = h('ul', { class: 'key-points' });
  for (const point of problem.answer.keyPoints ?? []) checklist.append(h('li', {}, [point]));
  const actions = h('div', { class: 'assessment', 'aria-label': 'How well did you understand?' });
  const choices: readonly [SelfAssessment, string, string][] = [
    ['got', 'Got it', 'button button--primary'],
    ['partly', 'Partly', 'button button--outline'],
    ['missed', 'Missed', 'button button--outline'],
  ];
  for (const [value, label, className] of choices) {
    const button = h('button', { class: className, type: 'button' }, [label]);
    button.addEventListener('click', () => onAssess(value));
    actions.append(button);
  }
  return h('section', { class: 'solution', tabindex: '-1' }, [
    h('h3', {}, ['Model solution']),
    richText(problem.solution),
    ...(checklist.childElementCount > 0 ? [h('h3', {}, ['Key points']), checklist] : []),
    ...(showAssessment
      ? [h('p', { class: 'quiet' }, ['How did this compare with your proof?']), actions]
      : []),
  ]);
}
