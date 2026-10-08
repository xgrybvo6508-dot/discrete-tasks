// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindPracticeShortcuts, type ShortcutHandlers } from './keyboard';

function handlers(): ShortcutHandlers {
  return {
    hint: vi.fn(),
    next: vi.fn(),
    collapse: vi.fn(),
    help: vi.fn(),
    check: vi.fn(),
  };
}

function press(
  key: string,
  target: HTMLElement = document.body,
  init: KeyboardEventInit = {},
): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('bindPracticeShortcuts', () => {
  it('maps the practice keys and prevents their default actions', () => {
    const actions = handlers();
    const unbind = bindPracticeShortcuts(actions);

    for (const [key, action] of [
      ['Enter', actions.check],
      ['h', actions.hint],
      ['H', actions.hint],
      ['n', actions.next],
      ['Escape', actions.collapse],
      ['?', actions.help],
    ] as const) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(action).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    }

    expect(actions.hint).toHaveBeenCalledTimes(2);
    unbind();
  });

  it('does not run shortcuts while the user is typing', () => {
    const actions = handlers();
    const unbind = bindPracticeShortcuts(actions);
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.append(input, textarea, select, editable);

    for (const target of [input, textarea, select, editable]) {
      press('h', target);
      press('Enter', target);
    }

    expect(actions.hint).not.toHaveBeenCalled();
    expect(actions.check).not.toHaveBeenCalled();
    unbind();
  });

  it('ignores modified shortcuts and stops listening after disposal', () => {
    const actions = handlers();
    const unbind = bindPracticeShortcuts(actions);

    press('h', document.body, { ctrlKey: true });
    press('n', document.body, { metaKey: true });
    press('?', document.body, { altKey: true });
    unbind();
    press('h');

    expect(actions.hint).not.toHaveBeenCalled();
    expect(actions.next).not.toHaveBeenCalled();
    expect(actions.help).not.toHaveBeenCalled();
  });
});
