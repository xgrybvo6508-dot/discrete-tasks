import { describe, expect, it } from 'vitest';
import { isValidTex, renderMath } from './math';

const JS_LINK = /href\s*=\s*["']?\s*javascript:/i;

describe('renderMath', () => {
  it('renders inline math without display mode', () => {
    const html = renderMath('x^2', false);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-display');
  });

  it('renders display math in display mode', () => {
    expect(renderMath('\\sum_{k=1}^n k', true)).toContain('katex-display');
  });

  it('includes MathML for screen readers', () => {
    expect(renderMath('\\binom{n}{k}', false)).toContain('<math');
  });

  it.each(['\\frac{', '\\notacommand', '}', '^^', '\\begin{matrix}'])(
    'does not throw on invalid TeX %j and shows it in the calm warning colour',
    (tex) => {
      const html = renderMath(tex, false);
      expect(html).toContain('var(--warn)');
    },
  );

  it.each([
    '\\href{javascript:alert(1)}{x}',
    '\\url{javascript:alert(1)}',
    '\\href{ javascript:alert(1)}{x}',
    '\\href{JaVaScRiPt:alert(1)}{x}',
  ])('never produces a javascript: link from %j', (tex) => {
    for (const display of [false, true]) {
      const html = renderMath(tex, display);
      expect(html).not.toMatch(/<a\b/i);
      expect(html).not.toMatch(JS_LINK);
    }
  });

  it.each([
    '\\htmlId{x}{y}',
    '\\htmlClass{x}{y}',
    '\\htmlStyle{color:red}{y}',
    '\\htmlData{foo=bar}{y}',
    '\\includegraphics{x.png}',
  ])('ignores trust-only commands in %j', (tex) => {
    const html = renderMath(tex, false);
    expect(html).not.toContain('id="x"');
    expect(html).not.toContain('class="x"');
    expect(html).not.toMatch(/style="[^"]*color:\s*red/);
    expect(html).not.toContain('data-foo');
    expect(html).not.toMatch(/<img\b/i);
  });

  it('escapes HTML in the TeX source', () => {
    const html = renderMath('<script>alert(1)</script>', false);
    expect(html).not.toContain('<script>');
  });
});

describe('isValidTex', () => {
  it.each(['x^2', '\\frac{a}{b}', '\\binom{n}{k}', '\\sum_{i=1}^{n} i', 'a \\le b', ''])(
    '%j is valid',
    (tex) => {
      expect(isValidTex(tex)).toBe(true);
    },
  );

  it.each(['\\frac{', '\\notacommand', '}', '{', 'x^^2', '\\begin{matrix}'])(
    '%j is not valid',
    (tex) => {
      expect(isValidTex(tex)).toBe(false);
    },
  );

  it('checks display mode too', () => {
    expect(isValidTex('\\sum_k k', true)).toBe(true);
    expect(isValidTex('\\frac{', true)).toBe(false);
  });
});
