import { clear, h } from '../../lib/dom';
import {
  applyImport,
  exportFileName,
  markExported,
  parseImport,
  previewImport,
  serializeExport,
} from '../../memory/export';
import { CORRUPT_PREFIX } from '../../memory/store';
import type { Memory } from '../../memory/schema';
import type { UiRuntime } from '../runtime';

export function dataView(runtime: UiRuntime): HTMLElement {
  const root = h('section', { class: 'screen data-screen' });
  let incoming: Memory | null = null;
  let fileName = '';
  let message = '';
  let busy = false;
  let hasCorruptCopy = runtime.loadNotice !== null;

  const render = (): void => {
    const memory = runtime.store.get();
    const exportButton = h(
      'button',
      {
        class: incoming ? 'button button--outline' : 'button button--primary',
        type: 'button',
      },
      ['Export memory'],
    );
    exportButton.addEventListener('click', exportMemory);
    const file = h('input', {
      id: 'memory-file',
      type: 'file',
      accept: 'application/json,.json',
      disabled: busy,
    });
    file.addEventListener('change', () => void readFile(file.files?.[0]));
    const importArea = h('div', { class: 'import-area' }, [
      h('label', { for: 'memory-file' }, ['Import memory']),
      file,
      h('p', { class: 'field-help' }, [
        'Choose an export file. You can review its counts before anything changes.',
      ]),
    ]);
    const lastExport =
      memory.lastExportAt === null
        ? 'Last export: never'
        : `Last export: ${new Date(memory.lastExportAt).toLocaleDateString()}`;
    clear(root);
    root.append(
      h('div', { class: 'screen-heading' }, [
        h('h1', {}, ['Your data']),
        h('p', { class: 'quiet' }, ['Settings and your API key are never exported.']),
      ]),
      h('section', { class: 'data-section' }, [
        h('h2', {}, ['Export']),
        h('p', { class: 'quiet' }, ['Save your practice memory as a JSON file.']),
        exportButton,
        h('p', { class: 'field-help' }, [lastExport]),
      ]),
      h('section', { class: 'data-section' }, [h('h2', {}, ['Import']), importArea]),
    );
    if (incoming) root.append(importPreview(memory, incoming));
    if (hasCorruptCopy) {
      root.append(
        h('p', { class: 'notice notice--warning' }, [
          'Saved data could not be read. A copy was kept. You can export it.',
        ]),
      );
    }
    root.append(
      h('p', { class: 'settings-status', 'aria-live': 'polite' }, [busy ? 'Working…' : message]),
    );
  };

  const exportMemory = (): void => {
    const now = runtime.clock.now();
    const text = serializeExport(runtime.store.get(), now);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: exportFileName(now) });
    link.click();
    URL.revokeObjectURL(url);
    runtime.store.update((memory) => markExported(memory, now));
    message = 'Memory exported.';
    render();
  };

  const readFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    busy = true;
    message = '';
    render();
    let text: string;
    try {
      text = await file.text();
    } catch {
      busy = false;
      message = 'This file could not be read.';
      render();
      return;
    }
    const parsed = parseImport(text, runtime.clock.now());
    busy = false;
    if (!parsed.ok) {
      incoming = null;
      message = parsed.error.message;
    } else {
      incoming = parsed.value;
      fileName = file.name;
      message = '';
    }
    render();
  };

  const importPreview = (current: Memory, next: Memory): HTMLElement => {
    const preview = previewImport(current, next);
    const merge = h('button', { class: 'button button--primary', type: 'button', disabled: busy }, [
      'Merge',
    ]);
    merge.addEventListener('click', () => void apply('merge'));
    const replace = h(
      'button',
      { class: 'button button--outline', type: 'button', disabled: busy },
      ['Replace'],
    );
    replace.addEventListener('click', () => {
      if (
        window.confirm(
          'Replace all current practice memory with this file? A backup is made first.',
        )
      ) {
        void apply('replace');
      }
    });
    return h('section', { class: 'import-preview' }, [
      h('h2', {}, ['Ready to import']),
      h('p', {}, [fileName]),
      h('dl', { class: 'preview-counts' }, [
        h('div', {}, [h('dt', {}, ['Attempts']), h('dd', {}, [String(preview.attempts)])]),
        h('div', {}, [h('dt', {}, ['New attempts']), h('dd', {}, [String(preview.newAttempts)])]),
        h('div', {}, [h('dt', {}, ['Saved problems']), h('dd', {}, [String(preview.problems)])]),
      ]),
      h('p', { class: 'field-help' }, [
        'Merge keeps both sets of memory. Replace uses only this file.',
      ]),
      h('div', { class: 'inline-actions' }, [merge, replace]),
    ]);
  };

  const apply = async (mode: 'merge' | 'replace'): Promise<void> => {
    if (!incoming) return;
    busy = true;
    render();
    const result = await applyImport(runtime.store, incoming, mode, runtime.clock.now());
    busy = false;
    if (result.ok) {
      incoming = null;
      message = mode === 'merge' ? 'Memory merged.' : 'Memory replaced.';
    } else {
      message = result.error.userMessage;
    }
    render();
  };

  void runtime.localStore.keys().then((keys) => {
    const found = keys.some((key) => key.startsWith(CORRUPT_PREFIX));
    if (found !== hasCorruptCopy) {
      hasCorruptCopy = found;
      render();
    }
  });
  render();
  return root;
}
