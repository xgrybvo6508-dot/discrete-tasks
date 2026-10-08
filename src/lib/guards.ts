export type UnknownRecord = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const isString = (v: unknown): v is string => typeof v === 'string';
export const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

export function isOneOf<T extends string | number>(options: readonly T[]) {
  return (v: unknown): v is T => options.includes(v as T);
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** True for keys that are safe to use as plain-object record keys. */
export const isSafeKey = (key: string): boolean => !UNSAFE_KEYS.has(key);

/** Reads an own property only, so `__proto__` and inherited names are never followed. */
export function own(record: UnknownRecord, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}
