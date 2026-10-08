import { describe, expect, it } from 'vitest';
import { toString } from '../rational';
import { checkNumeric, parseCanonicalNumber, parseNumber } from './numeric';
import { MESSAGES } from './types';

describe('checkNumeric', () => {
  it.each(['3/8', '6/16', '0.375', '.375', ' 3 / 8 ', '\t0.375\n', '(3)/(8)', '3÷8', '1/2 - 1/8'])(
    'accepts %j for 3/8',
    (input) => {
      expect(checkNumeric(input, '3/8')).toEqual({ status: 'correct', message: 'Correct.' });
    },
  );

  it('accepts all equal forms whatever form the canonical has', () => {
    for (const canonical of ['3/8', '6/16', '0.375', 0.375]) {
      for (const input of ['3/8', '6/16', '0.375']) {
        expect(checkNumeric(input, canonical).status).toBe('correct');
      }
    }
  });

  it('accepts constant expressions', () => {
    expect(checkNumeric('2^10', 1024).status).toBe('correct');
    expect(checkNumeric('binom(10, 3)', 120).status).toBe('correct');
    expect(checkNumeric('5!/2', '60').status).toBe('correct');
    expect(checkNumeric('1024', '2^10').status).toBe('correct');
  });

  it('accepts grouped thousands', () => {
    expect(checkNumeric('1,000', 1000).status).toBe('correct');
    expect(checkNumeric('1,000,000', 1_000_000).status).toBe('correct');
    expect(checkNumeric('1 000 000', 1_000_000).status).toBe('correct');
    expect(checkNumeric('-12,345', -12345).status).toBe('correct');
  });

  it('a wrong value is incorrect, calmly and without details', () => {
    expect(checkNumeric('3/7', '3/8')).toEqual({
      status: 'incorrect',
      message: 'Not quite. Want a hint?',
    });
    expect(checkNumeric('-3/8', '3/8').status).toBe('incorrect');
  });

  it('empty input asks for an answer', () => {
    expect(checkNumeric('   ', 5)).toEqual({
      status: 'unparsed',
      message: 'Type an answer first.',
    });
    expect(checkNumeric('', 5).message).toBe(MESSAGES.empty);
  });

  it.each(['abc', 'n+1', '1,5', '3/', '2 3', '12,34', '$5', '1e3'])(
    'unparsable %j gives the gentle number message',
    (input) => {
      const r = checkNumeric(input, 5);
      expect(r.status).toBe('unparsed');
      expect(r.message).toBe('I could not read this as a number. Try a form like 42, 3/8 or 2^10.');
      expect(typeof r.detail).toBe('string');
    },
  );

  it('explains why the input could not be read', () => {
    expect(checkNumeric('n+1', 5).detail).toBe('The name "n" is not known.');
    expect(checkNumeric('3/0', 5).detail).toBe('Division by zero.');
  });

  it('accepts extra literal inputs', () => {
    const options = { accepted: ['about five', 'V'] };
    expect(checkNumeric('About  Five', 5, options).status).toBe('correct');
    expect(checkNumeric('v', 5, options).status).toBe('correct');
    expect(checkNumeric('six', 5, options).status).toBe('unparsed');
  });

  it('uses a tolerance only when one is set', () => {
    expect(checkNumeric('3.1416', 3.14159, { tolerance: 0.001 }).status).toBe('correct');
    expect(checkNumeric('3.15', 3.14159, { tolerance: 0.001 }).status).toBe('incorrect');
    expect(checkNumeric('3.1416', 3.14159).status).toBe('incorrect');
    for (const tolerance of [0, -1, NaN, Infinity]) {
      expect(checkNumeric('3.1416', 3.14159, { tolerance }).status).toBe('incorrect');
      expect(checkNumeric('3.14159', 3.14159, { tolerance }).status).toBe('correct');
    }
  });

  it('reports an unreadable canonical answer', () => {
    const stored =
      'The saved answer for this problem could not be read, so it cannot be checked here.';
    expect(checkNumeric('5', 'five').message).toBe(stored);
    expect(checkNumeric('5', NaN)).toEqual({ status: 'unparsed', message: stored });
  });
});

describe('parseNumber', () => {
  it('reads plain numbers and constant expressions', () => {
    const r = parseNumber('2^-3 + 1,000'.replace(',', ''));
    if (!r.ok) throw new Error(r.error);
    expect(toString(r.value)).toBe('8001/8');
  });

  it('returns the reason as an error', () => {
    expect(parseNumber('x')).toEqual({ ok: false, error: 'The name "x" is not known.' });
  });
});

describe('parseCanonicalNumber', () => {
  it.each([
    [42, '42'],
    [0.375, '3/8'],
    ['3/8', '3/8'],
    ['1.5e-3', '3/2000'],
    ['2^10', '1024'],
    ['binom(6, 3)', '20'],
  ])('reads %j', (canonical, expected) => {
    const r = parseCanonicalNumber(canonical);
    expect(r && toString(r)).toBe(expected);
  });

  it('returns null for unreadable values', () => {
    expect(parseCanonicalNumber('n')).toBeNull();
    expect(parseCanonicalNumber(Infinity)).toBeNull();
  });
});
