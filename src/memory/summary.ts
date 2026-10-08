import type { Topic } from '../bank/types';
import { bandOf, BAND_LABELS } from './mastery';
import type { Memory } from './schema';

export const RECENT_TITLES = 10;
export const RECENT_MISTAKES = 3;

export interface AgentMemorySummary {
  readonly topic: Topic;
  readonly band: string;
  /** Titles of the latest problems in this topic, newest first, to avoid duplicates. */
  readonly recentTitles: readonly string[];
  /** Short notes on recent misses. Never contains the user's own answer text. */
  readonly recentMistakes: readonly string[];
}

export type TitleLookup = (problemId: string) => string | undefined;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export function summarizeForAgent(
  memory: Memory,
  topic: Topic,
  titleOf: TitleLookup,
): AgentMemorySummary {
  const inTopic = memory.attempts
    .filter((a) => a.topic === topic && a.outcome !== 'skipped')
    .sort((a, b) => b.endedAt - a.endedAt);
  const titles: string[] = [];
  for (const a of inTopic) {
    const title = titleOf(a.problemId);
    if (title && !titles.includes(title)) titles.push(title);
    if (titles.length >= RECENT_TITLES) break;
  }
  const recentMistakes = inTopic
    .filter((a) => a.outcome === 'incorrect' || a.outcome === 'partial')
    .slice(0, RECENT_MISTAKES)
    .map((a) => {
      const title = titleOf(a.problemId) ?? 'A problem';
      const hints = a.hintsUsed + a.agentHints;
      return `${title}: ${a.outcome}, ${plural(a.wrongChecks, 'wrong check')}, ${plural(hints, 'hint')}.`;
    });
  return {
    topic,
    band: BAND_LABELS[bandOf(memory.topics[topic].mastery)],
    recentTitles: titles,
    recentMistakes,
  };
}

/** Plain-text form for an agent prompt. */
export function formatSummary(summary: AgentMemorySummary): string {
  const lines = [`Topic: ${summary.topic}. Learner level in this topic: ${summary.band}.`];
  if (summary.recentTitles.length > 0) {
    lines.push(`Recent problems (do not repeat these): ${summary.recentTitles.join('; ')}.`);
  }
  if (summary.recentMistakes.length > 0)
    lines.push(`Recent mistakes: ${summary.recentMistakes.join(' ')}`);
  return lines.join('\n');
}
