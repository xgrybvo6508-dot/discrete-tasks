import { isRecord, type UnknownRecord } from '../lib/guards';
import { err, ok, type Result } from '../lib/result';

const JSON_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
const TEX_COMMANDS_WITH_JSON_ESCAPE = new Set([
  'backslash',
  'bar',
  'begin',
  'beta',
  'binom',
  'bmod',
  'boldsymbol',
  'boxed',
  'frac',
  'ne',
  'neg',
  'neq',
  'not',
  'nu',
  'right',
  'rho',
  'rightarrow',
  'text',
  'theta',
  'times',
  'to',
]);

function withoutFences(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/** Finds the first balanced object while respecting braces and escapes inside strings. */
export function extractJsonObject(text: string): Result<string, string> {
  const source = withoutFences(text);
  const start = source.indexOf('{');
  if (start < 0) return err('No JSON object was found.');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i] ?? '';
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return ok(source.slice(start, i + 1));
  }
  return err('The JSON object was not complete.');
}

function commandAt(source: string, slash: number): string {
  let end = slash + 1;
  while (/[A-Za-z]/.test(source[end] ?? '')) end++;
  return source.slice(slash + 1, end);
}

/**
 * Repairs common model output: trailing commas and a single LaTeX backslash in a JSON string.
 * Real JSON escapes stay unchanged, including a real `\n`.
 */
export function repairJson(text: string): string {
  let out = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? '';
    if (c === '"') {
      let slashes = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) slashes++;
      if (slashes % 2 === 0) quoted = !quoted;
      out += c;
      continue;
    }
    if (quoted && c === '\\') {
      const next = text[i + 1] ?? '';
      if (
        !JSON_ESCAPES.has(next) ||
        (['b', 'f', 'n', 'r', 't'].includes(next) &&
          TEX_COMMANDS_WITH_JSON_ESCAPE.has(commandAt(text, i)))
      ) {
        out += '\\\\';
        continue;
      }
      out += c + next;
      i++;
      continue;
    }
    if (!quoted && c === ',') {
      let j = i + 1;
      while (/\s/.test(text[j] ?? '')) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += c;
  }
  return out;
}

export function parseJsonObject(text: string): Result<UnknownRecord, string> {
  const extracted = extractJsonObject(text);
  if (!extracted.ok) return extracted;
  try {
    const parsed: unknown = JSON.parse(repairJson(extracted.value));
    return isRecord(parsed) ? ok(parsed) : err('The JSON value was not an object.');
  } catch {
    return err('The JSON object could not be parsed.');
  }
}
