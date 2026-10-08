import { isRecord, own } from '../lib/guards';
import { err, ok, type Result } from '../lib/result';
import { AgentError, errorForStatus } from './errors';
import { isAllowedBaseUrl, type Settings } from './settings';

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface CompletionRequest {
  readonly messages: readonly ChatMessage[];
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly jsonMode?: boolean;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface AgentClient {
  complete(settings: Settings, request: CompletionRequest): Promise<Result<string, AgentError>>;
}

interface RawResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly text: string;
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function configurationIsReady(settings: Settings): boolean {
  return (
    isAllowedBaseUrl(settings.baseUrl) &&
    settings.model.trim().length > 0 &&
    settings.apiKey.trim().length > 0
  );
}

function readContent(text: string): Result<string, AgentError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return err(new AgentError('bad-response'));
  }
  if (!isRecord(raw)) return err(new AgentError('bad-response'));
  const choices = own(raw, 'choices');
  const first = Array.isArray(choices) ? (choices as unknown[])[0] : undefined;
  if (!isRecord(first)) return err(new AgentError('bad-response'));
  const message = own(first, 'message');
  if (!isRecord(message)) return err(new AgentError('bad-response'));
  const content = own(message, 'content');
  return typeof content === 'string' && content.trim().length > 0
    ? ok(content)
    : err(new AgentError('bad-response'));
}

export function createAgentClient(fetchFn: FetchLike = globalThis.fetch): AgentClient {
  const noJsonMode = new Set<string>();

  async function send(
    settings: Settings,
    request: CompletionRequest,
    jsonMode: boolean,
  ): Promise<Result<RawResponse, AgentError>> {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), request.timeoutMs);
    const body: Record<string, unknown> = {
      model: settings.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };
    if (jsonMode) body.response_format = { type: 'json_object' };
    try {
      const response = await fetchFn(endpoint(settings.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      return ok({ status: response.status, ok: response.ok, text });
    } catch (cause) {
      if (controller.signal.aborted) return err(new AgentError('timeout'));
      if (cause instanceof TypeError) return err(new AgentError('network'));
      return err(new AgentError('network'));
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  return {
    async complete(settings, request) {
      if (!configurationIsReady(settings)) return err(new AgentError('config'));
      const provider = `${settings.baseUrl}\n${settings.model}`;
      const useJson = request.jsonMode === true && !noJsonMode.has(provider);
      let response = await send(settings, request, useJson);
      if (!response.ok) return response;
      if (
        useJson &&
        response.value.status === 400 &&
        /response_format/i.test(response.value.text)
      ) {
        noJsonMode.add(provider);
        response = await send(settings, request, false);
        if (!response.ok) return response;
      }
      if (!response.value.ok) return err(errorForStatus(response.value.status));
      return readContent(response.value.text);
    },
  };
}
