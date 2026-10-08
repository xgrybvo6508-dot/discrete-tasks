import { clear, h } from '../lib/dom';
import { topBar } from './components/top-bar';
import type { UiRuntime } from './runtime';
import { dataView } from './views/data';
import { practiceView, type PracticeView } from './views/practice';
import { progressView } from './views/progress';
import { settingsView } from './views/settings';

export interface App {
  root: HTMLElement;
  main: HTMLElement;
  dispose(): void;
}

type Route = 'practice' | 'progress' | 'settings' | 'data';

export function currentRoute(hash: string): Route {
  const route = hash.replace(/^#\/?/, '');
  return route === 'progress' || route === 'settings' || route === 'data' ? route : 'practice';
}

export function mountApp(container: HTMLElement, runtime: UiRuntime): App {
  const bar = topBar();
  const main = h('main', { class: 'main', id: 'main' });
  const root = h('div', { class: 'app' }, [bar, main]);
  let practice: PracticeView | null = null;

  const render = (): void => {
    practice?.dispose();
    practice = null;
    const route = currentRoute(window.location.hash);
    for (const link of bar.querySelectorAll<HTMLAnchorElement>('a[href^="#/"]')) {
      const active = link.getAttribute('href') === `#/${route}`;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    clear(main);
    if (route === 'practice') {
      practice = practiceView(runtime);
      main.append(practice.root);
    } else if (route === 'progress') {
      main.append(progressView(runtime));
    } else if (route === 'settings') {
      main.append(settingsView(runtime));
    } else {
      main.append(dataView(runtime));
    }
  };

  if (!window.location.hash) window.history.replaceState(null, '', '#/practice');
  container.replaceChildren(root);
  window.addEventListener('hashchange', render);
  render();
  return {
    root,
    main,
    dispose() {
      practice?.dispose();
      window.removeEventListener('hashchange', render);
    },
  };
}
