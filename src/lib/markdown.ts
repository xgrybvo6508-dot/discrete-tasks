export type Inline =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'strong'; readonly children: readonly Inline[] }
  | { readonly type: 'em'; readonly children: readonly Inline[] }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'math'; readonly tex: string; readonly display: boolean };

export type Block =
  | { readonly type: 'paragraph'; readonly children: readonly Inline[] }
  | { readonly type: 'heading'; readonly children: readonly Inline[] }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly Inline[])[];
    };

// Private-use characters mark extracted math, so markdown syntax inside TeX is never touched.
const MARK_OPEN = '\uE000';
const MARK_CLOSE = '\uE001';
const MARK = /\uE000(\d+)\uE001/g;

interface MathSpan {
  tex: string;
  display: boolean;
}

/** Replaces `$$..$$` and `$..$` with markers. `\$` is a literal dollar sign. */
export function extractMath(source: string): { text: string; math: MathSpan[] } {
  const src = source.replace(/[\uE000\uE001]/g, '');
  const math: MathSpan[] = [];
  let text = '';
  let i = 0;
  const mark = (tex: string, display: boolean): string => {
    math.push({ tex: tex.trim(), display });
    return `${MARK_OPEN}${math.length - 1}${MARK_CLOSE}`;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && src[i + 1] === '$') {
      text += '$';
      i += 2;
    } else if (c === '$' && src[i + 1] === '$') {
      const end = src.indexOf('$$', i + 2);
      const tex = end === -1 ? '' : src.slice(i + 2, end);
      if (end === -1 || tex.trim() === '') {
        text += '$$';
        i += 2;
      } else {
        text += mark(tex, true);
        i = end + 2;
      }
    } else if (c === '$') {
      const end = findInlineEnd(src, i + 1);
      const tex = end === -1 ? '' : src.slice(i + 1, end);
      if (end === -1 || tex.trim() === '') {
        text += '$';
        i += 1;
      } else {
        text += mark(tex, false);
        i = end + 1;
      }
    } else {
      text += c;
      i += 1;
    }
  }
  return { text, math };
}

function findInlineEnd(src: string, from: number): number {
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') j++;
    else if (c === '\n' && src[j + 1] === '\n') return -1;
    else if (c === '$') return j;
  }
  return -1;
}

const HEADING = /^#{1,3}\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const { text, math } = extractMath(source.replace(/\r\n?/g, '\n'));
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const inline = (s: string): Inline[] => parseInline(s, math);
  const flush = (): void => {
    if (para.length > 0) blocks.push({ type: 'paragraph', children: inline(para.join(' ')) });
    if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(inline) });
    para = [];
    list = null;
  };

  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', children: inline(heading[1] ?? '') });
    } else if (bullet || ordered) {
      const isOrdered = ordered !== null;
      const content = (bullet ?? ordered)?.[1] ?? '';
      if (para.length > 0 || (list && list.ordered !== isOrdered)) flush();
      list ??= { ordered: isOrdered, items: [] };
      list.items.push(content);
    } else if (list && /^\s+/.test(line)) {
      const last = list.items.length - 1;
      list.items[last] = `${list.items[last] ?? ''} ${line.trim()}`;
    } else {
      if (list) flush();
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

interface InlineRun {
  nodes: Inline[];
  end: number;
  closed: boolean;
}

export function parseInline(text: string, math: readonly MathSpan[] = []): Inline[] {
  return parseRun(text, 0, null, { math, failed: new Set() }).nodes;
}

interface RunContext {
  readonly math: readonly MathSpan[];
  /** Runs that reached the end unclosed. Remembering them keeps parsing polynomial. */
  readonly failed: Set<string>;
}

function parseRun(s: string, start: number, closer: '*' | '**' | null, ctx: RunContext): InlineRun {
  const { math } = ctx;
  const nodes: Inline[] = [];
  let buf = '';
  const pushText = (): void => {
    if (buf) nodes.push({ type: 'text', text: buf });
    buf = '';
  };
  let i = start;
  while (i < s.length) {
    const c = s[i] ?? '';
    if (c === '\\' && /[*`\\_#]/.test(s[i + 1] ?? '')) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (c === MARK_OPEN) {
      MARK.lastIndex = i;
      const m = MARK.exec(s);
      const span = m && m.index === i ? math[Number(m[1])] : undefined;
      if (m && span) {
        pushText();
        nodes.push({ type: 'math', tex: span.tex, display: span.display });
        i += m[0].length;
        continue;
      }
    }
    if (c === '`') {
      const end = s.indexOf('`', i + 1);
      if (end > i + 1) {
        pushText();
        nodes.push({ type: 'code', text: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (c === '*') {
      const double = s[i + 1] === '*';
      if (closer === '**' && double) {
        pushText();
        return { nodes, end: i + 2, closed: true };
      }
      if (closer === '*' && (!double || s[i + 2] === '*' || s.indexOf('**', i + 2) === -1)) {
        pushText();
        return { nodes, end: i + 1, closed: true };
      }
      const marker = double ? '**' : '*';
      const key = `${i + marker.length}:${marker}`;
      const inner = ctx.failed.has(key) ? null : parseRun(s, i + marker.length, marker, ctx);
      if (inner && !inner.closed) ctx.failed.add(key);
      if (inner?.closed && inner.nodes.length > 0) {
        pushText();
        nodes.push({ type: double ? 'strong' : 'em', children: inner.nodes });
        i = inner.end;
        continue;
      }
      buf += marker;
      i += marker.length;
      continue;
    }
    buf += c;
    i += 1;
  }
  pushText();
  return { nodes, end: i, closed: false };
}

/** Plain text of a token tree, e.g. for titles and aria labels. */
export function inlineText(nodes: readonly Inline[]): string {
  return nodes
    .map((n) =>
      n.type === 'text' || n.type === 'code'
        ? n.text
        : n.type === 'math'
          ? n.tex
          : inlineText(n.children),
    )
    .join('');
}
