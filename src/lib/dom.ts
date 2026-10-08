export type Child = Node | string | null | undefined | false;

export type Attrs = Record<string, string | number | boolean | null | undefined>;

/**
 * Creates an element. Strings become text nodes, so markup in a string is never parsed.
 * `true` sets an empty attribute; `false`, `null` and `undefined` leave it out.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (/^on/i.test(name)) throw new Error(`Event handler attributes are not allowed: ${name}`);
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(el: Element): void {
  el.replaceChildren();
}
