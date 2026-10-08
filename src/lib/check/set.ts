import { parseNumber } from './numeric';
import { correct, incorrect, MESSAGES, unparsed, type CheckResult } from './types';
import { toString } from '../rational';

export interface SetOptions {
  /** Item aliases written as "alias=item", e.g. "phi=4". */
  readonly accepted?: readonly string[] | undefined;
}

const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);
const EMPTY_WORDS = new Set(['∅', '\\emptyset', '\\varnothing', 'empty', 'none', 'emptyset']);

/** Splits at commas or semicolons that are not inside brackets. */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const c of text) {
    if (OPEN.has(c)) depth++;
    else if (CLOSE.has(c)) depth = Math.max(0, depth - 1);
    if ((c === ',' || c === ';') && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim());
}

function stripBraces(text: string): string {
  const s = text.trim();
  if (s.startsWith('\\{') && s.endsWith('\\}')) return s.slice(2, -2);
  if (s.startsWith('{') && s.endsWith('}')) return s.slice(1, -1);
  return s;
}

function isWrapped(s: string): boolean {
  if (!s.startsWith('(') || !s.endsWith(')')) return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    if (depth === 0 && i < s.length - 1) return false;
  }
  return true;
}

/** Numbers become exact rationals; tuples are normalised part by part; text is squashed. */
export function normalizeItem(raw: string): string {
  const s = raw.trim();
  if (isWrapped(s)) {
    const inner = s.slice(1, -1);
    const parts = splitTopLevel(inner);
    if (parts.length > 1) return `(${parts.map(normalizeItem).join(',')})`;
    return normalizeItem(inner);
  }
  const n = parseNumber(s);
  if (n.ok) return toString(n.value);
  return s.toLowerCase().replace(/\s+/g, '');
}

function readItems(input: string): string[] | null {
  const inner = stripBraces(input).trim();
  if (inner.length === 0 || EMPTY_WORDS.has(inner.toLowerCase())) return [];
  let items = splitTopLevel(inner);
  if (items.length === 1 && !/[()[\]{}+*/^!=-]/.test(inner)) items = inner.split(/\s+/);
  return items.some((i) => i.length === 0) ? null : items;
}

function aliasMap(accepted: readonly string[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of accepted ?? []) {
    const at = entry.indexOf('=');
    if (at <= 0) continue;
    map.set(normalizeItem(entry.slice(0, at)), normalizeItem(entry.slice(at + 1)));
  }
  return map;
}

const times = (k: number): string => (k === 2 ? 'twice' : `${k} times`);

export function checkSet(
  input: string,
  canonical: readonly (number | string)[],
  options: SetOptions = {},
): CheckResult {
  if (input.trim().length === 0) return unparsed(MESSAGES.empty);
  const items = readItems(input);
  if (!items) return unparsed(MESSAGES.set, 'One of the items is empty. Check for an extra comma.');
  const aliases = aliasMap(options.accepted);
  const seen = new Map<string, { raw: string; count: number }>();
  for (const raw of items) {
    const key = normalizeItem(raw);
    const item = aliases.get(key) ?? key;
    const entry = seen.get(item);
    if (entry) entry.count++;
    else seen.set(item, { raw, count: 1 });
  }
  const notes = [...seen.values()]
    .filter((e) => e.count > 1)
    .map((e) => `You listed ${e.raw} ${times(e.count)}. I counted it once.`);
  const detail = notes.length > 0 ? notes.join(' ') : undefined;

  const expected = new Set(canonical.map((c) => normalizeItem(String(c))));
  const given = new Set(seen.keys());
  const same = given.size === expected.size && [...given].every((g) => expected.has(g));
  return same ? correct(detail) : incorrect(detail);
}
