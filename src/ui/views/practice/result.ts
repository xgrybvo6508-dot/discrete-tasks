import { clear, h } from '../../../lib/dom';
import { richText } from '../../components/rich-text';

export interface ResultPanel {
  readonly root: HTMLElement;
  show(tone: 'success' | 'warning' | 'agent' | 'quiet', title: string, detail?: string): void;
  clear(): void;
  focus(): void;
}

export function resultPanel(): ResultPanel {
  const root = h('section', {
    class: 'result result--empty',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    tabindex: '-1',
  });
  return {
    root,
    show(tone, title, detail) {
      root.className = `result result--${tone}`;
      clear(root);
      root.append(h('p', { class: 'result__title' }, [title]));
      if (detail) root.append(richText(detail));
    },
    clear() {
      root.className = 'result result--empty';
      clear(root);
    },
    focus: () => root.focus(),
  };
}
