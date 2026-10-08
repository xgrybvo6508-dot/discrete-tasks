import type { AnswerType } from '../../../bank/types';
import { h } from '../../../lib/dom';

const COPY: Readonly<Record<AnswerType, { label: string; help: string; placeholder: string }>> = {
  numeric: {
    label: 'Your answer',
    help: 'Use a number or exact form, such as 42, 3/8 or 2^10.',
    placeholder: 'Enter a number',
  },
  expression: {
    label: 'Your formula',
    help: 'Use n, parentheses, powers with ^, and binom(a,b) if needed.',
    placeholder: 'Enter a formula in n',
  },
  set: {
    label: 'Your set',
    help: 'Separate items with commas. Braces are optional.',
    placeholder: 'Enter set items',
  },
  proof: {
    label: 'Write your proof (optional)',
    help: 'You can compare your work with the model solution.',
    placeholder: 'Write your reasoning',
  },
};

export interface AnswerBox {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement | HTMLTextAreaElement;
}

export function answerBox(type: AnswerType): AnswerBox {
  const copy = COPY[type];
  const id = 'practice-answer';
  const input =
    type === 'proof'
      ? h('textarea', {
          id,
          class: 'answer-input answer-input--proof',
          rows: 7,
          placeholder: copy.placeholder,
        })
      : h('input', {
          id,
          class: 'answer-input',
          type: 'text',
          inputmode: type === 'numeric' ? 'text' : 'text',
          autocomplete: 'off',
          spellcheck: 'false',
          placeholder: copy.placeholder,
        });
  const root = h('div', { class: 'field' }, [
    h('label', { for: id }, [copy.label]),
    input,
    h('p', { class: 'field-help', id: `${id}-help` }, [copy.help]),
  ]);
  input.setAttribute('aria-describedby', `${id}-help`);
  return { root, input };
}
