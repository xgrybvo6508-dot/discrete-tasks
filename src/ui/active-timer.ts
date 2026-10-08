import type { Clock } from '../lib/time';

export const IDLE_AFTER_MS = 5 * 60_000;

export interface ActiveTimer {
  elapsed(): number;
  reset(): void;
  dispose(): void;
}

export function createActiveTimer(clock: Clock): ActiveTimer {
  let total = 0;
  let markedAt = clock.now();
  let lastInputAt = markedAt;

  const collect = (): void => {
    const now = clock.now();
    if (!document.hidden && markedAt <= lastInputAt + IDLE_AFTER_MS) {
      total += Math.max(0, Math.min(now, lastInputAt + IDLE_AFTER_MS) - markedAt);
    }
    markedAt = now;
  };
  const activity = (): void => {
    collect();
    lastInputAt = clock.now();
    markedAt = lastInputAt;
  };
  const visibility = (): void => collect();
  for (const type of ['keydown', 'pointerdown', 'input'] as const) {
    document.addEventListener(type, activity, { passive: true });
  }
  document.addEventListener('visibilitychange', visibility);

  return {
    elapsed() {
      collect();
      return total;
    },
    reset() {
      total = 0;
      markedAt = clock.now();
      lastInputAt = markedAt;
    },
    dispose() {
      collect();
      for (const type of ['keydown', 'pointerdown', 'input'] as const) {
        document.removeEventListener(type, activity);
      }
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
