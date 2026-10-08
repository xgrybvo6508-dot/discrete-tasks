import { describe, expect, it } from 'vitest';
import { createFakeStorage } from '../memory/storage/fake';
import {
  clearApiKey,
  DEFAULT_SETTINGS,
  isAllowedBaseUrl,
  jsonModeFor,
  loadSettings,
  maskKey,
  PRESETS,
  saveSettings,
  SETTINGS_KEY,
  settingsForPreset,
} from './settings';

describe('agent settings', () => {
  it('contains the specified provider presets', () => {
    expect(PRESETS.nous).toMatchObject({
      baseUrl: 'https://inference-api.nousresearch.com/v1',
      model: 'poolside/laguna-s-2.1:free',
      jsonMode: false,
    });
    expect(PRESETS.openrouter.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(PRESETS.openrouter.model).toBe('');
    expect(PRESETS.groq).toMatchObject({
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'openai/gpt-oss-120b',
      jsonMode: true,
    });
  });

  it('selects a preset without changing the key or agent toggle', () => {
    const current = { ...DEFAULT_SETTINGS, apiKey: 'private-value', agentProblems: true };
    const next = settingsForPreset('groq', current);
    expect(next).toMatchObject({
      preset: 'groq',
      baseUrl: PRESETS.groq.baseUrl,
      model: PRESETS.groq.model,
      apiKey: 'private-value',
      agentProblems: true,
    });
    expect(jsonModeFor(next)).toBe(true);
  });

  it('saves and loads only a clean versioned object', () => {
    const storage = createFakeStorage();
    const settings = { ...DEFAULT_SETTINGS, apiKey: 'private-value' };
    saveSettings(storage, settings);
    expect(loadSettings(storage)).toEqual(settings);

    storage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, version: 99 }));
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    storage.setItem(SETTINGS_KEY, '{broken');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('masks and clears the key', () => {
    expect(maskKey('')).toBe('');
    expect(maskKey('prefix-private-value')).toBe('prefix-…alue');
    expect(maskKey('abcdef')).toBe('…cdef');
    const storage = createFakeStorage();
    const cleared = clearApiKey(storage, { ...DEFAULT_SETTINGS, apiKey: 'private-value' });
    expect(cleared.apiKey).toBe('');
    expect(loadSettings(storage).apiKey).toBe('');
  });

  it('allows HTTPS and local HTTP only', () => {
    expect(isAllowedBaseUrl('https://example.test/v1')).toBe(true);
    expect(isAllowedBaseUrl('http://localhost:11434/v1')).toBe(true);
    expect(isAllowedBaseUrl('http://127.0.0.1:8080/v1')).toBe(true);
    expect(isAllowedBaseUrl('http://example.test/v1')).toBe(false);
    expect(isAllowedBaseUrl('not a url')).toBe(false);
  });
});
