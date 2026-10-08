import { h } from '../../lib/dom';

export function topBar(): HTMLElement {
  const title = h('a', { class: 'top-bar__title', href: '#/practice' }, ['Discrete Tasks']);
  const nav = h('nav', { class: 'top-bar__nav', 'aria-label': 'Main navigation' }, [
    h('a', { class: 'nav-link', href: '#/progress', 'aria-label': 'Progress' }, ['Progress']),
    h('a', { class: 'nav-link', href: '#/settings', 'aria-label': 'Settings' }, ['Settings']),
  ]);
  return h('header', { class: 'top-bar' }, [title, nav]);
}
