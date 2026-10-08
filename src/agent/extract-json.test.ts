import { describe, expect, it } from 'vitest';
import { extractJsonObject, parseJsonObject, repairJson } from './extract-json';

describe('extractJsonObject', () => {
  it('reads fenced JSON and prose around the first balanced object', () => {
    expect(extractJsonObject('```json\n{"a":{"b":"}"} }\n```')).toEqual({
      ok: true,
      value: '{"a":{"b":"}"} }',
    });
    expect(extractJsonObject('Here it is: {"a":1} after')).toEqual({
      ok: true,
      value: '{"a":1}',
    });
  });

  it('reports missing and incomplete objects', () => {
    expect(extractJsonObject('nothing').ok).toBe(false);
    expect(extractJsonObject('{"a": 1').ok).toBe(false);
  });
});

describe('repairJson', () => {
  it('removes trailing commas outside strings', () => {
    expect(repairJson('{"a":[1,2,],"text":",}",}')).toBe('{"a":[1,2],"text":",}"}');
  });

  it.each(['frac', 'binom', 'neq', 'times', 'right', 'to', 'text', 'nu'])(
    'repairs a single backslash before \\%s',
    (command) => {
      const parsed = parseJsonObject(`{"tex":"\\${command}{x}"}`);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.value.tex).toBe(`\\${command}{x}`);
    },
  );

  it('keeps real JSON escapes and already doubled backslashes', () => {
    const parsed = parseJsonObject(String.raw`{"line":"one\ntwo","tex":"\\frac{1}{2}"}`);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.line).toBe('one\ntwo');
      expect(parsed.value.tex).toBe('\\frac{1}{2}');
    }
  });

  it('repairs invalid JSON escapes used by other TeX commands', () => {
    const parsed = parseJsonObject(String.raw`{"tex":"\alpha+\left(x\right)"}`);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.tex).toBe('\\alpha+\\left(x\\right)');
  });
});
