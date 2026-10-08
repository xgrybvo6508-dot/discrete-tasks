import { describe, expect, it } from 'vitest';
import {
  isBoolean,
  isFiniteNumber,
  isNonEmptyString,
  isOneOf,
  isRecord,
  isSafeKey,
  isString,
  isStringArray,
  own,
} from './guards';

describe('isRecord', () => {
  it('accepts plain and null-prototype objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it('rejects null, arrays and primitives', () => {
    for (const v of [null, undefined, [], [1], 'x', 1, true]) expect(isRecord(v)).toBe(false);
  });
});

describe('primitive guards', () => {
  it('isString and isNonEmptyString', () => {
    expect(isString('')).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isNonEmptyString('a')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   \n')).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });

  it('isFiniteNumber rejects NaN, infinities and numeric strings', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-2.5)).toBe(true);
    for (const v of [NaN, Infinity, -Infinity, '1', null]) expect(isFiniteNumber(v)).toBe(false);
  });

  it('isBoolean', () => {
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean('true')).toBe(false);
  });

  it('isStringArray', () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a', ''])).toBe(true);
    expect(isStringArray(['a', 1])).toBe(false);
    expect(isStringArray('a')).toBe(false);
  });
});

describe('isOneOf', () => {
  it('matches only listed values, without type coercion', () => {
    const isDiff = isOneOf([3, 4, 5]);
    expect(isDiff(4)).toBe(true);
    expect(isDiff('4')).toBe(false);
    expect(isDiff(6)).toBe(false);
    const isColour = isOneOf(['green', 'purple']);
    expect(isColour('green')).toBe(true);
    expect(isColour('Green')).toBe(false);
    expect(isColour(undefined)).toBe(false);
  });
});

describe('isSafeKey', () => {
  it('rejects prototype-related keys only', () => {
    expect(isSafeKey('__proto__')).toBe(false);
    expect(isSafeKey('constructor')).toBe(false);
    expect(isSafeKey('prototype')).toBe(false);
    expect(isSafeKey('graph-001')).toBe(true);
    expect(isSafeKey('toString')).toBe(true);
  });
});

describe('own', () => {
  it('reads own properties', () => {
    expect(own({ a: 1 }, 'a')).toBe(1);
    expect(own({ a: undefined }, 'a')).toBeUndefined();
  });

  it('never follows inherited properties', () => {
    expect(own({}, 'toString')).toBeUndefined();
    expect(own({}, 'constructor')).toBeUndefined();
    expect(own({}, '__proto__')).toBeUndefined();
    const child: unknown = Object.create({ secret: 1 });
    if (!isRecord(child)) throw new Error('expected a record');
    expect(own(child, 'secret')).toBeUndefined();
  });

  it('reads an own __proto__ key created by JSON.parse as data', () => {
    const parsed: unknown = JSON.parse('{"__proto__": {"polluted": true}}');
    if (!isRecord(parsed)) throw new Error('expected a record');
    expect(own(parsed, '__proto__')).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
