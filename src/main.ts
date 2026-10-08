import 'katex/dist/katex.min.css';
import './ui/tokens.css';
import './ui/base.css';
import './ui/components.css';
import { createAgentClient } from './agent/client';
import { BANK, byId } from './bank/index';
import { h } from './lib/dom';
import { systemClock } from './lib/time';
import { createMemoryStore, choosePrimary } from './memory/store';
import { openIndexedDbStore } from './memory/storage/indexeddb';
import { createLocalStore } from './memory/storage/local';
import { mountApp } from './ui/app';
import { loadUiPreferences } from './ui/preferences';

const container = document.getElementById('app');

async function bootstrap(root: HTMLElement): Promise<void> {
  const localStore = createLocalStore(window.localStorage);
  const primary = await choosePrimary(() => openIndexedDbStore(), localStore);
  const store = createMemoryStore({
    primary,
    local: localStore,
    clock: systemClock,
    persist: navigator.storage?.persist
      ? () => navigator.storage.persist()
      : () => Promise.resolve(false),
    onHidden: (flush) => {
      const listener = (): void => {
        if (document.hidden) flush();
      };
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  });
  const loaded = await store.load();
  const preferences = loadUiPreferences(window.localStorage);
  mountApp(root, {
    bank: BANK,
    bankById: byId,
    store,
    localStore,
    settingsStorage: window.localStorage,
    agentClient: createAgentClient(),
    clock: systemClock,
    focusTopic: preferences.focusTopic,
    loadNotice: loaded.ok ? (loaded.value.notice?.message ?? null) : loaded.error.userMessage,
  });
}

if (container) {
  container.append(h('p', { class: 'app-loading' }, ['Loading your practice memory…']));
  void bootstrap(container).catch(() => {
    container.replaceChildren(
      h('p', { class: 'app-loading' }, [
        'The app could not start. Reload the page, or clear site data if this continues.',
      ]),
    );
  });
}
