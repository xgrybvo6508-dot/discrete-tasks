import { h } from '../../lib/dom';
import { parseMarkdown, type Block, type Inline } from '../../lib/markdown';
import { renderMath } from '../../lib/math';

function renderInline(token: Inline): Node {
  switch (token.type) {
    case 'text':
      return document.createTextNode(token.text);
    case 'code':
      return h('code', {}, [token.text]);
    case 'strong':
      return h('strong', {}, token.children.map(renderInline));
    case 'em':
      return h('em', {}, token.children.map(renderInline));
    case 'math': {
      const el = h(token.display ? 'div' : 'span', {
        class: token.display ? 'math math--display' : 'math',
      });
      // This string is produced only by KaTeX with trust disabled.
      el.innerHTML = renderMath(token.tex, token.display);
      return el;
    }
  }
}

function renderBlock(block: Block): HTMLElement {
  switch (block.type) {
    case 'paragraph':
      return h('p', {}, block.children.map(renderInline));
    case 'heading':
      return h('h3', {}, block.children.map(renderInline));
    case 'list': {
      const list = h(block.ordered ? 'ol' : 'ul');
      list.append(...block.items.map((item) => h('li', {}, item.map(renderInline))));
      return list;
    }
  }
}

export function richText(source: string, className = 'rich-text'): HTMLElement {
  return h('div', { class: className }, parseMarkdown(source).map(renderBlock));
}
