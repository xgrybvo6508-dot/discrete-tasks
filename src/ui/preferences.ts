import type { Topic } from '../bank/types';
import { isTopic } from '../bank/topics';
import { isBoolean, isRecord, own } from '../lib/guards';
import type { SettingsStorage } from '../agent/settings';

export const UI_KEY = 'dt:ui';

export interface UiPreferences {
  readonly showTime: boolean;
  readonly focusTopic: Topic | null;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  showTime: false,
  focusTopic: null,
};

export function loadUiPreferences(storage: SettingsStorage): UiPreferences {
  try {
    const text = storage.getItem(UI_KEY);
    if (text === null) return DEFAULT_UI_PREFERENCES;
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw)) return DEFAULT_UI_PREFERENCES;
    const showTime = own(raw, 'showTime');
    const focusTopic = own(raw, 'focusTopic');
    return {
      showTime: isBoolean(showTime) ? showTime : false,
      focusTopic: isTopic(focusTopic) ? focusTopic : null,
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function saveUiPreferences(storage: SettingsStorage, value: UiPreferences): void {
  storage.setItem(UI_KEY, JSON.stringify(value));
}
