// @vitest-environment happy-dom

import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { describe, expect, it, vi } from 'vitest';
import { updatePrompt, type ServiceWorkerRegistrar } from './update-prompt';

describe('updatePrompt', () => {
  it('shows and dismisses the offline-ready message', () => {
    let options: RegisterSWOptions | undefined;
    const register: ServiceWorkerRegistrar = (next) => {
      options = next;
      return () => Promise.resolve();
    };

    const root = updatePrompt(register);
    expect(root.hidden).toBe(true);
    options?.onOfflineReady?.();

    expect(root.hidden).toBe(false);
    expect(root.textContent).toContain('Ready to work offline.');
    root.querySelector<HTMLButtonElement>('button')?.click();
    expect(root.hidden).toBe(true);
  });

  it('updates the service worker only after explicit confirmation', () => {
    let options: RegisterSWOptions | undefined;
    const update = vi.fn((_reloadPage?: boolean) => Promise.resolve());
    const register: ServiceWorkerRegistrar = (next) => {
      options = next;
      return update;
    };

    const root = updatePrompt(register);
    options?.onNeedRefresh?.();

    expect(root.hidden).toBe(false);
    expect(root.textContent).toContain('A new version is ready.');
    expect(update).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('button')?.click();
    expect(update).toHaveBeenCalledWith(true);
  });
});
