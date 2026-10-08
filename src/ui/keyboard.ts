export interface ShortcutHandlers {
  readonly hint: () => void;
  readonly next: () => void;
  readonly collapse: () => void;
  readonly help: () => void;
  readonly check: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function bindPracticeShortcuts(handlers: ShortcutHandlers): () => void {
  const listener = (event: KeyboardEvent): void => {
    const typing = isTyping(event.target);
    if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey) &&
      event.target instanceof HTMLTextAreaElement
    ) {
      event.preventDefault();
      handlers.check();
      return;
    }
    if (event.key === 'Enter' && !typing) {
      event.preventDefault();
      handlers.check();
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'h') handlers.hint();
    else if (key === 'n') handlers.next();
    else if (event.key === 'Escape') handlers.collapse();
    else if (event.key === '?') handlers.help();
    else return;
    event.preventDefault();
  };
  document.addEventListener('keydown', listener);
  return () => document.removeEventListener('keydown', listener);
}
