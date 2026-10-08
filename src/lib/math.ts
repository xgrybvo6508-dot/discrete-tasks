import katex from 'katex';

const OPTIONS = {
  trust: false,
  throwOnError: false,
  strict: 'ignore',
  maxSize: 20,
  maxExpand: 500,
  output: 'htmlAndMathml',
  // Calm amber from the design tokens instead of KaTeX's default red.
  errorColor: 'var(--warn)',
} as const;

/** Renders TeX to an HTML string. Only KaTeX output may be set as HTML. */
export function renderMath(tex: string, display: boolean): string {
  return katex.renderToString(tex, { ...OPTIONS, displayMode: display });
}

export function isValidTex(tex: string, display = false): boolean {
  try {
    katex.renderToString(tex, { ...OPTIONS, displayMode: display, throwOnError: true });
    return true;
  } catch {
    return false;
  }
}
