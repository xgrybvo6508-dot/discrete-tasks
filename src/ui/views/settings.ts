import { testConnection } from '../../agent/actions';
import {
  clearApiKey,
  isAllowedBaseUrl,
  loadSettings,
  maskKey,
  PRESETS,
  saveSettings,
  settingsForPreset,
  type ProviderPreset,
  type Settings,
} from '../../agent/settings';
import { clear, h } from '../../lib/dom';
import { loadUiPreferences, saveUiPreferences } from '../preferences';
import type { UiRuntime } from '../runtime';

export function settingsView(runtime: UiRuntime): HTMLElement {
  const root = h('section', { class: 'screen settings-screen' });
  let settings = loadSettings(runtime.settingsStorage);
  let showKey = false;
  let message = '';
  let messageTone: 'success' | 'warning' | 'quiet' = 'quiet';
  let busy = false;

  const persist = (next: Settings): void => {
    settings = next;
    saveSettings(runtime.settingsStorage, settings);
  };

  const render = (): void => {
    const preset = h('select', { id: 'provider-preset' });
    for (const value of Object.values(PRESETS)) {
      preset.append(
        h('option', { value: value.id, selected: value.id === settings.preset }, [value.label]),
      );
    }
    const baseUrl = h('input', {
      id: 'base-url',
      type: 'url',
      value: settings.baseUrl,
      autocomplete: 'url',
      spellcheck: 'false',
    });
    const model = h('input', {
      id: 'model',
      type: 'text',
      value: settings.model,
      autocomplete: 'off',
      spellcheck: 'false',
    });
    const key = h('input', {
      id: 'api-key',
      type: showKey ? 'text' : 'password',
      value: settings.apiKey,
      autocomplete: 'off',
      spellcheck: 'false',
    });
    const show = h(
      'button',
      {
        class: 'button button--ghost',
        type: 'button',
        'aria-controls': 'api-key',
        'aria-pressed': String(showKey),
      },
      [showKey ? 'Hide' : 'Show'],
    );
    show.addEventListener('click', () => {
      showKey = !showKey;
      render();
      queueMicrotask(() => root.querySelector<HTMLInputElement>('#api-key')?.focus());
    });
    const clearKey = h('button', { class: 'button button--ghost', type: 'button' }, ['Forget key']);
    clearKey.disabled = settings.apiKey.length === 0;
    clearKey.addEventListener('click', () => {
      settings = clearApiKey(runtime.settingsStorage, settings);
      message = 'API key cleared.';
      messageTone = 'quiet';
      render();
    });

    preset.addEventListener('change', () => {
      persist(settingsForPreset(preset.value as ProviderPreset, settings));
      message = 'Settings saved.';
      render();
    });
    const saveFields = (): void => {
      persist({
        ...settings,
        baseUrl: baseUrl.value.trim(),
        model: model.value.trim(),
        apiKey: key.value.trim(),
      });
      message = 'Settings saved.';
      messageTone = 'quiet';
      render();
    };
    for (const input of [baseUrl, model, key]) input.addEventListener('change', saveFields);

    const agentProblems = h('input', {
      id: 'agent-problems',
      type: 'checkbox',
      checked: settings.agentProblems,
    });
    agentProblems.addEventListener('change', () => {
      persist({ ...settings, agentProblems: agentProblems.checked });
    });
    const prefs = loadUiPreferences(runtime.settingsStorage);
    const showTime = h('input', {
      id: 'show-time',
      type: 'checkbox',
      checked: prefs.showTime,
    });
    showTime.addEventListener('change', () => {
      saveUiPreferences(runtime.settingsStorage, { ...prefs, showTime: showTime.checked });
    });

    const test = h('button', { class: 'button button--primary', type: 'button', disabled: busy }, [
      busy ? 'Testing…' : 'Test connection',
    ]);
    test.addEventListener('click', () => void runTest(baseUrl, model, key));

    const status = h(
      'p',
      {
        class: `settings-status settings-status--${messageTone}`,
        'aria-live': 'polite',
      },
      [message],
    );
    clear(root);
    root.append(
      h('div', { class: 'screen-heading' }, [
        h('h1', {}, ['Settings']),
        h('p', { class: 'quiet' }, ['Changes are saved on this device.']),
      ]),
      h('section', { class: 'settings-section', 'aria-labelledby': 'agent-settings-title' }, [
        h('h2', { id: 'agent-settings-title' }, ['Agent']),
        field('Provider', preset, 'Choosing a provider fills in its usual URL and model.'),
        field('Base URL', baseUrl, 'Use HTTPS, or localhost for a local server.'),
        field('Model', model, 'Enter the exact model name from your provider.'),
        h('div', { class: 'field' }, [
          h('label', { for: 'api-key' }, ['API key']),
          h('div', { class: 'input-actions' }, [key, show, clearKey]),
          h('p', { class: 'field-help', id: 'api-key-help' }, [
            settings.apiKey
              ? `Saved as ${maskKey(settings.apiKey)}. It stays in this browser.`
              : 'The key stays in this browser and is sent only to your provider.',
          ]),
        ]),
        test,
        status,
        toggleField(
          agentProblems,
          'Mix in new problems from the agent',
          'Agent problems are labelled as unverified. The built-in bank remains available.',
        ),
      ]),
      h('section', { class: 'settings-section', 'aria-labelledby': 'display-settings-title' }, [
        h('h2', { id: 'display-settings-title' }, ['Display']),
        toggleField(
          showTime,
          'Show time spent',
          'Active time appears after a check. There is no ticking timer.',
        ),
      ]),
      h('a', { class: 'quiet-link', href: '#/data' }, ['Your data']),
    );
    key.setAttribute('aria-describedby', 'api-key-help');
  };

  const runTest = async (
    baseUrl: HTMLInputElement,
    model: HTMLInputElement,
    key: HTMLInputElement,
  ): Promise<void> => {
    const next = {
      ...settings,
      baseUrl: baseUrl.value.trim(),
      model: model.value.trim(),
      apiKey: key.value.trim(),
    };
    persist(next);
    if (!isAllowedBaseUrl(next.baseUrl)) {
      message = 'Use an HTTPS base URL, or an HTTP localhost URL.';
      messageTone = 'warning';
      render();
      return;
    }
    busy = true;
    message = '';
    render();
    const result = await testConnection({
      client: runtime.agentClient,
      getSettings: () => settings,
    });
    busy = false;
    message = result.ok ? result.value : result.error.userMessage;
    messageTone = result.ok ? 'success' : 'warning';
    render();
  };

  render();
  return root;
}

function field(label: string, input: HTMLElement, help: string): HTMLElement {
  const id = input.id;
  const helpId = `${id}-help`;
  input.setAttribute('aria-describedby', helpId);
  return h('div', { class: 'field' }, [
    h('label', { for: id }, [label]),
    input,
    h('p', { class: 'field-help', id: helpId }, [help]),
  ]);
}

function toggleField(input: HTMLInputElement, label: string, help: string): HTMLElement {
  const helpId = `${input.id}-help`;
  input.setAttribute('aria-describedby', helpId);
  return h('div', { class: 'toggle-field' }, [
    h('div', {}, [
      h('label', { for: input.id }, [label]),
      h('p', { class: 'field-help', id: helpId }, [help]),
    ]),
    input,
  ]);
}
