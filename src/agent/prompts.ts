import { TOPICS } from '../bank/topics';
import type { Difficulty, Problem, Topic } from '../bank/types';
import { formatSummary, type AgentMemorySummary } from '../memory/summary';
import type { ChatMessage } from './client';

const QUALITY_STANDARD = `Write precise first- or second-year university discrete-mathematics work.
The task must require a real idea, not formula substitution. Define every object and range.
Use simple English. Use Markdown and KaTeX with $...$ or $$...$$.
Hints must be progressive and must not reveal the final answer.`;

export const SYSTEM_PROMPT = `You are the optional tutor inside Discrete Tasks.
${QUALITY_STANDARD}
Return only the JSON requested by the user. Do not use code fences or add prose outside JSON.
JSON must be strict. Double every backslash in LaTeX commands.`;

const GENERATED_SCHEMA = `{
  "topic": "one allowed topic",
  "subtopics": ["short label"],
  "difficulty": 3,
  "title": "short English title",
  "statement": "Markdown and KaTeX",
  "hints": ["nudge", "main idea", "key step"],
  "solution": "full worked solution",
  "answer": {
    "type": "numeric | expression | set | proof",
    "canonical": "required except for proof",
    "display": "human-readable final answer",
    "keyPoints": ["required for proof only"]
  },
  "related": [],
  "estMinutes": 15,
  "smallCases": [{"n": 1, "value": "value of canonical expression"}]
}`;

export function generateProblemMessages(
  topic: Topic,
  difficulty: Difficulty,
  summary: AgentMemorySummary,
  validationErrors: readonly string[] = [],
): ChatMessage[] {
  const correction =
    validationErrors.length === 0
      ? ''
      : `\nThe previous object was rejected. Fix every issue:\n- ${validationErrors.join('\n- ')}`;
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Create one original problem.
Allowed topics: ${TOPICS.join(', ')}.
Required topic: ${topic}. Required difficulty: ${difficulty}.
${formatSummary(summary)}

Use this exact shape:
${GENERATED_SCHEMA}

For an expression answer, include exactly four smallCases with distinct integer n values.
For other answer types, leave out smallCases.
Leave out id and source. Return one JSON object only.${correction}`,
    },
  ];
}

function privateProblem(problem: Problem): string {
  return JSON.stringify({
    statement: problem.statement,
    answer: problem.answer,
    solution: problem.solution,
  });
}

export function hintMessages(
  problem: Problem,
  step: number,
  shownHints: readonly string[],
  userWork: string,
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}
Give one small next step. Do not state the final answer or copy the private solution.`,
    },
    {
      role: 'user',
      content: `Problem and private reference: ${privateProblem(problem)}
Built-in hints already shown: ${JSON.stringify(shownHints)}
Requested agent hint number: ${step}.
Learner's work: ${userWork.slice(0, 6000)}
Return exactly {"hint":"one concise hint"}.`,
    },
  ];
}

export function checkMessages(problem: Problem, proof: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}
Check the reasoning gently. Explain why. Never respond with only "wrong".`,
    },
    {
      role: 'user',
      content: `Problem and private model reference: ${privateProblem(problem)}
Learner's proof: ${proof.slice(0, 10_000)}
Return exactly {"verdict":"correct|partial|incorrect","feedback":"specific explanation","nextStep":"one next step"}.`,
    },
  ];
}

export const CONNECTION_MESSAGES: readonly ChatMessage[] = [
  { role: 'user', content: 'Reply with OK' },
];
