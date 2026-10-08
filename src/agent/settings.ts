import { isBoolean, isRecord, isString, own } from '../lib/guards';

export const SETTINGS_KEY = 'dt:settings';
export const SETTINGS_VERSION = 1;

export type ProviderPreset = 'nous' | 'openrouter' | 'groq' | 'custom';

export interface Settings {
  readonly version: typeof SETTINGS_VERSION;
  readonly preset: ProviderPreset;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: string;
  readonly agentProblems: boolean;
}

export interface Preset {
  readonly id: ProviderPreset;
  readonly label: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly jsonMode: boolean;
}

export const PRESETS: Readonly<Record<ProviderPreset, Preset>> = {
  nous: {
    id: 'nous',
    label: 'Nous Portal',
    baseUrl: 'https://inference-api.nousresearch.com/v1',
    model: 'poolside/laguna-s-2.1:free',
    jsonMode: false,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: '',
    jsonMode: false,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    jsonMode: true,
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    baseUrl: '',
    model: '',
    jsonMode: false,
  },
};

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  preset: 'nous',
  baseUrl: PRESETS.nous.baseUrl,
  model: PRESETS.nous.model,
  apiKey: '',
  agentProblems: false,
};

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function settingsForPreset(preset: ProviderPreset, current: Settings): Settings {
  const next = PRESETS[preset];
  return {
    ...current,
    preset,
    baseUrl: next.baseUrl,
    model: next.model,
  };
}

function isPreset(value: unknown): value is ProviderPreset {
  return typeof value === 'string' && Object.hasOwn(PRESETS, value);
}

/** Reads a clean versioned copy. Invalid settings fall back without exposing stored text. */
export function loadSettings(storage: SettingsStorage): Settings {
  let raw: unknown;
  try {
    const text = storage.getItem(SETTINGS_KEY);
    if (text === null) return DEFAULT_SETTINGS;
    raw = JSON.parse(text) as unknown;
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (!isRecord(raw) || own(raw, 'version') !== SETTINGS_VERSION) return DEFAULT_SETTINGS;
  const preset = own(raw, 'preset');
  const baseUrl = own(raw, 'baseUrl');
  const model = own(raw, 'model');
  const apiKey = own(raw, 'apiKey');
  const agentProblems = own(raw, 'agentProblems');
  if (
    !isPreset(preset) ||
    !isString(baseUrl) ||
    !isString(model) ||
    !isString(apiKey) ||
    !isBoolean(agentProblems)
  ) {
    return DEFAULT_SETTINGS;
  }
  return {
    version: SETTINGS_VERSION,
    preset,
    baseUrl,
    model,
    apiKey,
    agentProblems,
  };
}

export function saveSettings(storage: SettingsStorage, settings: Settings): void {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearApiKey(storage: SettingsStorage, settings: Settings): Settings {
  const next = { ...settings, apiKey: '' };
  saveSettings(storage, next);
  return next;
}

export function maskKey(key: string): string {
  if (key.length === 0) return '';
  const suffix = key.slice(-4);
  const prefix = key.includes('-') ? `${key.slice(0, key.indexOf('-') + 1)}` : '';
  return `${prefix}…${suffix}`;
}

export function isAllowedBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))
    );
  } catch {
    return false;
  }
}

export function jsonModeFor(settings: Settings): boolean {
  return PRESETS[settings.preset].jsonMode;
}
