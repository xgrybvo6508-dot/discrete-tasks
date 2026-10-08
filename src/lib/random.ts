/** A source of uniform numbers in [0, 1). */
export type Rng = () => number;

/** mulberry32: small, fast, seeded PRNG. Not for cryptography. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash, used to derive stable seeds from strings. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A whole number in [0, n). */
export function randomInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

export interface Weighted<T> {
  readonly item: T;
  readonly weight: number;
}

/** Picks an item with probability proportional to its weight. Non-positive weights never win. */
export function weightedChoice<T>(options: readonly Weighted<T>[], rng: Rng): T | undefined {
  let total = 0;
  for (const o of options) if (o.weight > 0 && Number.isFinite(o.weight)) total += o.weight;
  if (total <= 0) return undefined;
  let r = rng() * total;
  let last: T | undefined;
  for (const o of options) {
    if (!(o.weight > 0 && Number.isFinite(o.weight))) continue;
    last = o.item;
    r -= o.weight;
    if (r < 0) return o.item;
  }
  return last;
}
