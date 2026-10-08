export type AgentErrorKind =
  | 'network'
  | 'auth'
  | 'not-found'
  | 'rate-limit'
  | 'timeout'
  | 'server'
  | 'invalid-json'
  | 'bad-response'
  | 'config';

const USER_MESSAGES: Readonly<Record<AgentErrorKind, string>> = {
  network:
    "Can't reach the API from the browser. The provider may block browser requests (CORS). Check the base URL or use a provider that allows browser access.",
  auth: 'The API key was rejected. Check it in Settings.',
  'not-found': 'Model or endpoint not found. Check the base URL and model name.',
  'rate-limit': 'Rate limit reached. Wait a moment and try again.',
  timeout:
    'The agent took too long to answer. Try again, or keep going with the built-in problems.',
  server: 'The provider had a problem. Try again later.',
  'invalid-json': "The agent's answer could not be read. Try again, or use a built-in problem.",
  'bad-response': 'The provider returned an empty answer. Try again.',
  config: 'The agent settings are incomplete. Check the base URL, model and API key.',
};

export class AgentError extends Error {
  override readonly name = 'AgentError';
  readonly userMessage: string;

  constructor(readonly kind: AgentErrorKind) {
    super(USER_MESSAGES[kind]);
    this.userMessage = USER_MESSAGES[kind];
  }
}

export function errorForStatus(status: number): AgentError {
  if (status === 401 || status === 403) return new AgentError('auth');
  if (status === 404) return new AgentError('not-found');
  if (status === 429) return new AgentError('rate-limit');
  if (status >= 500) return new AgentError('server');
  return new AgentError('config');
}
