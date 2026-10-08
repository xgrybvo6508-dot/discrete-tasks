import { h } from '../lib/dom';

export interface App {
  root: HTMLElement;
  main: HTMLElement;
}

export function mountApp(container: HTMLElement): App {
  const title = h('h1', { class: 'top-bar__title' }, ['Discrete Tasks']);
  const topBar = h('header', { class: 'top-bar' }, [title]);
  const main = h('main', { class: 'main', id: 'main' }, [
    h('p', { class: 'quiet' }, ['Practice is coming soon.']),
  ]);
  const root = h('div', { class: 'app' }, [topBar, main]);
  container.replaceChildren(root);
  return { root, main };
}
