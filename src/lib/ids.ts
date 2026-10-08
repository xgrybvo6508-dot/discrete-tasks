import { randomInt, type Rng } from './random';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** A base36 id from an injected PRNG, e.g. `k3f9x0q2ab`. */
export function newId(rng: Rng, length = 10): string {
  let id = '';
  for (let i = 0; i < length; i++) id += ALPHABET[randomInt(rng, ALPHABET.length)] ?? '0';
  return id;
}
