import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Result } from '../lib/result';
import { createAgentClient, type FetchLike } from './client';
import type { AgentError, AgentErrorKind } from './errors';
import { DEFAULT_SETTINGS } from './settings';

const settings = {
  ...DEFAULT_SETTINGS,
  baseUrl: 'https://provider.example/v1/',
  model: 'test-model',
  apiKey: 'private-value',
};

const request = {
  messages: [{ role: 'user' as const, content: 'Hello' }],
  temperature: 0.2,
  maxTokens: 20,
  timeoutMs: 1000,
  jsonMode: true,
};

const completion = (content: string, status = 200): Response =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

afterEach(() => {
  vi.useRealTimers();
});

describe('agent client', () => {
  it('posts an OpenAI-compatible request and reads only message content', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const fake: FetchLike = (input, options) => {
      url = input;
      init = options;
      return Promise.resolve(completion('answer'));
    };
    const result = await createAgentClient(fake).complete(settings, request);
    expect(result).toEqual({ ok: true, value: 'answer' });
    expect(url).toBe('https://provider.example/v1/chat/completions');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer private-value',
      'Content-Type': 'application/json',
    });
    if (!init || typeof init.body !== 'string') throw new Error('expected a string body');
    const body: unknown = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'test-model',
      max_tokens: 20,
      response_format: { type: 'json_object' },
    });
  });

  it.each([
    [401, 'auth', 'The API key was rejected. Check it in Settings.'],
    [403, 'auth', 'The API key was rejected. Check it in Settings.'],
    [404, 'not-found', 'Model or endpoint not found. Check the base URL and model name.'],
    [429, 'rate-limit', 'Rate limit reached. Wait a moment and try again.'],
    [503, 'server', 'The provider had a problem. Try again later.'],
  ] as const)('maps HTTP %s to %s', async (status, kind, message) => {
    const fake: FetchLike = () => Promise.resolve(new Response('provider detail', { status }));
    const result = await createAgentClient(fake).complete(settings, request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(kind);
      expect(result.error.userMessage).toBe(message);
    }
  });

  it('maps a fetch TypeError to the fixed network message', async () => {
    const fake: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'));
    const result = await createAgentClient(fake).complete(settings, request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('network');
      expect(result.error.userMessage).toContain('provider may block browser requests (CORS)');
    }
  });

  it('aborts after the requested timeout', async () => {
    vi.useFakeTimers();
    const fake: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const pending = createAgentClient(fake).complete(settings, { ...request, timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('timeout');
  });

  it('retries a response_format rejection once and remembers it', async () => {
    const bodies: Record<string, unknown>[] = [];
    const responses = [
      new Response('response_format is unsupported', { status: 400 }),
      completion('first'),
      completion('second'),
    ];
    const fake: FetchLike = (_input, init) => {
      if (typeof init.body !== 'string') throw new Error('expected a string body');
      bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      const response = responses.shift();
      if (!response) throw new Error('missing response');
      return Promise.resolve(response);
    };
    const client = createAgentClient(fake);
    expect(await client.complete(settings, request)).toEqual({ ok: true, value: 'first' });
    expect(await client.complete(settings, request)).toEqual({ ok: true, value: 'second' });
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toHaveProperty('response_format');
    expect(bodies[1]).not.toHaveProperty('response_format');
    expect(bodies[2]).not.toHaveProperty('response_format');
  });

  it('rejects malformed and empty provider responses', async () => {
    for (const response of [
      new Response('not json'),
      new Response(JSON.stringify({ choices: [] })),
      completion('  '),
    ]) {
      const result = await createAgentClient(() => Promise.resolve(response)).complete(
        settings,
        request,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('bad-response');
    }
  });

  it('never includes the key in an error or console output', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const statuses = [400, 401, 403, 404, 429, 500];
    const results: Result<string, AgentError>[] = [];
    for (const status of statuses) {
      results.push(
        await createAgentClient(() =>
          Promise.resolve(new Response('private-value', { status })),
        ).complete(settings, request),
      );
    }
    const all = JSON.stringify(results);
    expect(all).not.toContain(settings.apiKey);
    expect([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls]).toEqual([]);
  });

  it('rejects incomplete or unsafe settings before fetching', async () => {
    let calls = 0;
    const fake: FetchLike = () => {
      calls++;
      return Promise.resolve(completion('unused'));
    };
    const client = createAgentClient(fake);
    for (const change of [{ apiKey: '' }, { model: '' }, { baseUrl: 'http://remote.example/v1' }]) {
      const result = await client.complete({ ...settings, ...change }, request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind satisfies AgentErrorKind).toBe('config');
    }
    expect(calls).toBe(0);
  });
});
