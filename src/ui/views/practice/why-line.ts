import type { PickReason } from '../../../memory/picker';
import { DAY_MS } from '../../../lib/time';

function daysAgo(then: number, now: number): number {
  return Math.max(0, Math.floor((now - then) / DAY_MS));
}

export function whyText(reason: PickReason, now: number): string {
  switch (reason.kind) {
    case 'review': {
      const days = daysAgo(reason.lastSeenAt, now);
      const action = reason.lastOutcome === 'incorrect' ? 'You missed this' : 'You saw this';
      return `Review. ${action} ${days === 0 ? 'today' : `${days} days ago`}.`;
    }
    case 'relearn':
      return 'Review. This is a short retry from this session.';
    case 'new':
      if (reason.topicLastSeenAt === null) return 'New. You have not practised this topic yet.';
      return `New. You last practised this topic ${daysAgo(reason.topicLastSeenAt, now)} days ago.`;
    case 'extra':
      return 'Extra practice. This keeps the session varied.';
  }
}
