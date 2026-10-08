import { describe, expect, it } from 'vitest';
import {
  extractMath,
  inlineText,
  parseInline,
  parseMarkdown,
  type Block,
  type Inline,
} from './markdown';

const text = (t: string): Inline => ({ type: 'text', text: t });
const math = (tex: string, display = false): Inline => ({ type: 'math', tex, display });
const para = (...children: Inline[]): Block => ({ type: 'paragraph', children });

describe('extractMath', () => {
  it('replaces inline and display math with markers', () => {
    const r = extractMath('a $x^2$ b $$\\sum_i i$$ c');
    expect(r.math).toEqual([
      { tex: 'x^2', display: false },
      { tex: '\\sum_i i', display: true },
    ]);
    expect(r.text).not.toContain('$');
    expect(r.text).not.toContain('x^2');
  });

  it('reads \\$ as a literal dollar sign', () => {
    expect(extractMath('it costs \\$5')).toEqual({ text: 'it costs $5', math: [] });
    expect(extractMath('\\$a\\$')).toEqual({ text: '$a$', math: [] });
  });

  it('keeps an escaped dollar inside math as TeX', () => {
    expect(extractMath('$a\\$b$').math).toEqual([{ tex: 'a\\$b', display: false }]);
  });

  it('leaves an unclosed $ or $$ as literal text', () => {
    expect(extractMath('costs $5')).toEqual({ text: 'costs $5', math: [] });
    expect(extractMath('$$x')).toEqual({ text: '$$x', math: [] });
  });

  it('leaves empty math as literal text', () => {
    expect(extractMath('$ $')).toEqual({ text: '$ $', math: [] });
    expect(extractMath('$$  $$')).toEqual({ text: '$$  $$', math: [] });
  });

  it('inline math may span one newline but not a blank line', () => {
    expect(extractMath('$a\nb$').math).toEqual([{ tex: 'a\nb', display: false }]);
    expect(extractMath('$a\n\nb$').math).toEqual([]);
  });

  it('display math may span lines', () => {
    expect(extractMath('$$\na+b\n\nc\n$$').math).toEqual([{ tex: 'a+b\n\nc', display: true }]);
  });

  it('reads adjacent inline spans separately', () => {
    expect(extractMath('$a$$b$').math.map((m) => m.tex)).toEqual(['a', 'b']);
  });

  it('strips private-use marker characters from the input', () => {
    const r = extractMath('x \uE0000\uE001 $y$');
    expect(r.math).toHaveLength(1);
    expect(r.text.match(/\uE000/g)).toHaveLength(1);
  });
});

describe('parseMarkdown: blocks', () => {
  it('splits paragraphs at blank lines and joins lines with a space', () => {
    expect(parseMarkdown('one\ntwo\n\nthree')).toEqual([
      para(text('one two')),
      para(text('three')),
    ]);
  });

  it('handles Windows line endings', () => {
    expect(parseMarkdown('one\r\n\r\ntwo')).toEqual([para(text('one')), para(text('two'))]);
  });

  it('reads #, ## and ### headings', () => {
    expect(parseMarkdown('# A\n## B\n### C')).toEqual([
      { type: 'heading', children: [text('A')] },
      { type: 'heading', children: [text('B')] },
      { type: 'heading', children: [text('C')] },
    ]);
  });

  it('reads #### and #x as plain text', () => {
    expect(parseMarkdown('#### D')).toEqual([para(text('#### D'))]);
    expect(parseMarkdown('#x')).toEqual([para(text('#x'))]);
  });

  it('reads unordered and ordered lists', () => {
    expect(parseMarkdown('- a\n* b\n+ c')).toEqual([
      { type: 'list', ordered: false, items: [[text('a')], [text('b')], [text('c')]] },
    ]);
    expect(parseMarkdown('1. a\n2) b')).toEqual([
      { type: 'list', ordered: true, items: [[text('a')], [text('b')]] },
    ]);
  });

  it('joins an indented line to the previous list item', () => {
    expect(parseMarkdown('- a\n  more\n- b')).toEqual([
      { type: 'list', ordered: false, items: [[text('a more')], [text('b')]] },
    ]);
  });

  it('separates lists of different kinds and following paragraphs', () => {
    expect(parseMarkdown('intro\n- a\n1. b\nafter')).toEqual([
      para(text('intro')),
      { type: 'list', ordered: false, items: [[text('a')]] },
      { type: 'list', ordered: true, items: [[text('b')]] },
      para(text('after')),
    ]);
  });

  it('returns no blocks for empty input', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n  \n')).toEqual([]);
  });
});

describe('parseMarkdown: math', () => {
  it('puts math tokens in paragraphs, lists and headings', () => {
    expect(parseMarkdown('Let $n \\ge 1$.')).toEqual([
      para(text('Let '), math('n \\ge 1'), text('.')),
    ]);
    expect(parseMarkdown('- $a$\n### Sum $S$')).toEqual([
      { type: 'list', ordered: false, items: [[math('a')]] },
      { type: 'heading', children: [text('Sum '), math('S')] },
    ]);
  });

  it('keeps display math across lines as one token', () => {
    expect(parseMarkdown('$$\n\\sum_{k=0}^n k\n$$')).toEqual([para(math('\\sum_{k=0}^n k', true))]);
  });

  it('never applies markdown inside math', () => {
    expect(parseMarkdown('$a*b*c$ and $**x**$ and $`y`$')).toEqual([
      para(math('a*b*c'), text(' and '), math('**x**'), text(' and '), math('`y`')),
    ]);
    expect(parseMarkdown('$$\n# not a heading\n- not a list\n$$')).toEqual([
      para(math('# not a heading\n- not a list', true)),
    ]);
  });

  it('a stray marker in the input cannot pull in math', () => {
    const blocks = parseMarkdown('\uE0000\uE001 $x$');
    expect(blocks).toEqual([para(text('0 '), math('x'))]);
  });
});

describe('parseInline', () => {
  it('reads strong, em and code', () => {
    expect(parseInline('**bold** and *em* and `code`')).toEqual([
      { type: 'strong', children: [text('bold')] },
      text(' and '),
      { type: 'em', children: [text('em')] },
      text(' and '),
      { type: 'code', text: 'code' },
    ]);
  });

  it('reads nested emphasis', () => {
    expect(parseInline('**bold *em* more**')).toEqual([
      {
        type: 'strong',
        children: [text('bold '), { type: 'em', children: [text('em')] }, text(' more')],
      },
    ]);
    expect(parseInline('*em **strong** em*')).toEqual([
      {
        type: 'em',
        children: [text('em '), { type: 'strong', children: [text('strong')] }, text(' em')],
      },
    ]);
    expect(parseInline('***both***')).toEqual([
      { type: 'strong', children: [{ type: 'em', children: [text('both')] }] },
    ]);
  });

  it('keeps code content literal', () => {
    expect(parseInline('`*a* **b**`')).toEqual([{ type: 'code', text: '*a* **b**' }]);
  });

  it('reads backslash escapes', () => {
    expect(parseInline('\\*not em\\* \\` \\\\ \\_ \\#')).toEqual([text('*not em* ` \\ _ #')]);
  });

  it('leaves unclosed or empty markers as text', () => {
    expect(parseInline('**bold')).toEqual([text('**bold')]);
    expect(parseInline('*em')).toEqual([text('*em')]);
    expect(parseInline('****')).toEqual([text('****')]);
    expect(parseInline('a ** b')).toEqual([text('a ** b')]);
    expect(parseInline('``')).toEqual([text('``')]);
  });

  it('stays fast on adversarial unclosed markers', () => {
    for (const input of [
      '*a **b '.repeat(400),
      '*'.repeat(3000),
      '** *'.repeat(700),
      '*a'.repeat(1500),
    ]) {
      const start = performance.now();
      const nodes = parseInline(input);
      expect(performance.now() - start).toBeLessThan(500);
      expect(inlineText(nodes).length).toBeGreaterThan(0);
    }
  });
});

describe('no HTML gets through', () => {
  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<b>bold</b>',
    '[x](javascript:alert(1))',
    '&lt;i&gt;',
  ])('%j stays plain text', (input) => {
    expect(parseMarkdown(input)).toEqual([para(text(input))]);
  });

  it('only produces known token types', () => {
    const blocks = parseMarkdown('# <h1>\n\n- <li> **<b>** *<i>* `<code>` $<x>$\n\n<p>');
    const types = new Set<string>();
    const walk = (nodes: readonly Inline[]): void => {
      for (const n of nodes) {
        types.add(n.type);
        if (n.type === 'strong' || n.type === 'em') walk(n.children);
      }
    };
    for (const b of blocks) {
      types.add(b.type);
      if (b.type === 'list') b.items.forEach(walk);
      else walk(b.children);
    }
    expect([...types].sort()).toEqual([
      'code',
      'em',
      'heading',
      'list',
      'math',
      'paragraph',
      'strong',
      'text',
    ]);
  });
});

describe('inlineText', () => {
  it('returns the plain text of a token tree', () => {
    const blocks = parseMarkdown('**a** *b* `c` $d$ e');
    const first = blocks[0];
    if (first?.type !== 'paragraph') throw new Error('expected a paragraph');
    expect(inlineText(first.children)).toBe('a b c d e');
  });
});
