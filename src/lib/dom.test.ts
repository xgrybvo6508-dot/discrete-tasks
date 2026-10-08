// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { h } from './dom';

describe('h', () => {
  it('sets strings as text, never as markup', () => {
    const el = h('p', {}, ['<img src=x onerror=alert(1)>']);
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('sets attributes and skips false, null and undefined', () => {
    const el = h('button', { type: 'button', disabled: true, hidden: false, title: null });
    expect(el.getAttribute('type')).toBe('button');
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('appends child nodes in order and skips empty children', () => {
    const el = h('div', {}, [h('span', {}, ['a']), null, false, 'b']);
    expect(el.textContent).toBe('ab');
    expect(el.childNodes).toHaveLength(2);
  });

  it('rejects inline event handler attributes', () => {
    expect(() => h('div', { onclick: 'x()' })).toThrow();
  });
});
