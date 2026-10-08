import { registerSW } from 'virtual:pwa-register';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { h } from '../../lib/dom';

export type ServiceWorkerRegistrar = (
  options?: RegisterSWOptions,
) => (reloadPage?: boolean) => Promise<void>;

export function updatePrompt(register: ServiceWorkerRegistrar = registerSW): HTMLElement {
  const message = h('span', { role: 'status', 'aria-live': 'polite' });
  const action = h('button', { class: 'text-button', type: 'button' });
  const root = h(
    'div',
    {
      class: 'update-prompt',
      hidden: true,
    },
    [message, action],
  );
  let actionMode: 'refresh' | 'dismiss' = 'dismiss';

  const update = register({
    immediate: true,
    onNeedRefresh() {
      message.textContent = 'A new version is ready. Reload when you want.';
      action.textContent = 'Update now';
      actionMode = 'refresh';
      root.hidden = false;
    },
    onOfflineReady() {
      message.textContent = 'Ready to work offline.';
      action.textContent = 'Dismiss';
      actionMode = 'dismiss';
      root.hidden = false;
    },
  });
  action.addEventListener('click', () => {
    if (actionMode === 'refresh') void update(true);
    else root.hidden = true;
  });
  return root;
}
