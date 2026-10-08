import { TOPIC_LABELS } from '../../bank/topics';
import type { Problem } from '../../bank/types';
import { check, generateProblem, hint, type ActionDeps } from '../../agent/actions';
import { loadSettings } from '../../agent/settings';
import { checkAnswer } from '../../lib/check';
import { clear, h } from '../../lib/dom';
import { newId } from '../../lib/ids';
import { mulberry32 } from '../../lib/random';
import { addAiProblem, createAttempt, recordAttempt } from '../../memory/record';
import { pickNext, type PickReason } from '../../memory/picker';
import {
  createSession,
  isRetry,
  noteOutcome,
  presentProblem,
  type SessionState,
} from '../../memory/session';
import { summarizeForAgent } from '../../memory/summary';
import type { Outcome, SelfAssessment } from '../../memory/schema';
import { createActiveTimer } from '../active-timer';
import { richText } from '../components/rich-text';
import { bindPracticeShortcuts } from '../keyboard';
import { loadUiPreferences } from '../preferences';
import type { UiRuntime } from '../runtime';
import { sessionSummary } from './session-summary';
import { answerBox } from './practice/answer-box';
import { hintPanel } from './practice/hint-panel';
import { proofSolution } from './practice/proof-flow';
import { resultPanel } from './practice/result';
import { whyText } from './practice/why-line';

export interface PracticeView {
  readonly root: HTMLElement;
  dispose(): void;
}

export function practiceView(runtime: UiRuntime): PracticeView {
  const root = h('div');
  const rng = mulberry32(runtime.clock.now());
  const timer = createActiveTimer(runtime.clock);
  let session: SessionState = createSession(runtime.clock.now(), runtime.focusTopic);
  let current: Problem | null = null;
  let reason: PickReason = { kind: 'extra' };
  let startedAt = runtime.clock.now();
  let hintsUsed = 0;
  let agentHints = 0;
  let wrongChecks = 0;
  let solutionViewed = false;
  let finished = false;
  let answerText = '';
  let skipConfirm = false;
  let agentText: string | null = null;
  let notice: string | null = runtime.loadNotice;
  let shortcutHelp = false;
  let busy = false;
  let unbindShortcuts = (): void => undefined;

  const problemLookup = (id: string): Problem | undefined =>
    runtime.bankById.get(id) ?? runtime.store.get().aiProblems.find((p) => p.id === id);

  const allProblems = (): readonly Problem[] => [
    ...runtime.bank,
    ...runtime.store.get().aiProblems,
  ];

  const agentDeps = (): ActionDeps => ({
    client: runtime.agentClient,
    getSettings: () => loadSettings(runtime.settingsStorage),
    rng,
    onGenerated: (problem) => runtime.store.update((memory) => addAiProblem(memory, problem)),
  });

  const chooseNext = (): boolean => {
    const pick = pickNext({
      problems: allProblems(),
      cards: runtime.store.get().cards,
      topics: runtime.store.get().topics,
      session,
      now: runtime.clock.now(),
      rng,
    });
    if (!pick) return false;
    const problem = problemLookup(pick.problemId);
    if (!problem) return false;
    current = problem;
    reason = pick.reason;
    session = presentProblem(session, { problemId: problem.id, topic: problem.topic });
    startedAt = runtime.clock.now();
    hintsUsed = 0;
    agentHints = 0;
    wrongChecks = 0;
    solutionViewed = false;
    finished = false;
    answerText = '';
    skipConfirm = false;
    agentText = null;
    timer.reset();
    return true;
  };

  const record = (
    outcome: Outcome,
    checkedBy: 'local' | 'agent' | 'self',
    selfAssessment?: SelfAssessment,
  ): void => {
    const problem = current;
    if (!problem) return;
    const now = runtime.clock.now();
    const attempt = createAttempt(newId(rng), {
      problemId: problem.id,
      source: problem.source,
      topic: problem.topic,
      difficulty: problem.difficulty,
      startedAt,
      endedAt: now,
      activeMs: timer.elapsed(),
      hintsUsed,
      agentHints,
      wrongChecks,
      solutionViewed,
      outcome,
      ...(selfAssessment && { selfAssessment }),
      checkedBy,
      ...(answerText && { answerText }),
      ...(problem.estMinutes !== undefined && { estMinutes: problem.estMinutes }),
    });
    runtime.store.update((memory) =>
      recordAttempt(memory, attempt, { relearn: isRetry(session, problem.id), seed: now }),
    );
    session = noteOutcome(session, { problemId: problem.id, topic: problem.topic }, outcome);
    finished = true;
  };

  const nextProblem = (): void => {
    if (!finished) {
      if (!skipConfirm) {
        skipConfirm = true;
        notice = 'Press N again to skip this problem.';
        render();
        return;
      }
      record('skipped', 'self');
    }
    notice = null;
    if (!chooseNext()) {
      showSummary();
      return;
    }
    render();
  };

  const showSummary = (): void => {
    unbindShortcuts();
    clear(root);
    root.append(
      sessionSummary(session, runtime.store, () => {
        session = createSession(runtime.clock.now(), runtime.focusTopic);
        chooseNext();
        render();
      }),
    );
  };

  const render = (): void => {
    const problem = current;
    if (!problem) {
      clear(root);
      root.append(
        h('section', { class: 'screen empty-state' }, [
          h('h1', {}, ['No problem is available']),
          h('p', { class: 'quiet' }, ['The built-in problem bank is still loading.']),
        ]),
      );
      return;
    }
    unbindShortcuts();
    clear(root);
    const settings = loadSettings(runtime.settingsStorage);
    const agentAvailable = settings.apiKey.trim().length > 0;
    const box = answerBox(problem.answer.type);
    box.input.value = answerText;
    box.input.disabled = finished || busy;
    box.input.addEventListener('input', () => {
      answerText = box.input.value;
      skipConfirm = false;
    });
    const feedback = resultPanel();
    if (notice) feedback.show('quiet', notice);
    const hints = hintPanel(
      problem,
      () => {
        if (hintsUsed < problem.hints.length) hintsUsed++;
        render();
      },
      () => void askAgentHint(),
      agentAvailable,
    );
    hints.render(hintsUsed, agentText, busy);

    const task = h('article', { class: 'task-card', 'data-problem-id': problem.id }, [
      h('div', { class: 'task-meta' }, [
        h('span', { class: 'topic-chip' }, [TOPIC_LABELS[problem.topic]]),
        h('span', { class: 'quiet' }, [`Level ${problem.difficulty}`]),
        ...(problem.source === 'ai' ? [h('span', { class: 'ai-label' }, ['AI · unverified'])] : []),
      ]),
      h('h1', {}, [problem.title]),
      richText(problem.statement),
      h('p', { class: 'why-line' }, [whyText(reason, runtime.clock.now())]),
    ]);

    const form = h('form', { class: 'answer-form' }, [box.root]);
    const primary = h(
      'button',
      { class: 'button button--primary', type: 'submit', disabled: busy },
      [
        finished
          ? 'Next problem'
          : problem.answer.type === 'proof'
            ? 'Show model solution'
            : 'Check',
      ],
    );
    form.append(primary);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      answerText = box.input.value;
      if (finished) nextProblem();
      else if (problem.answer.type === 'proof') showProof();
      else checkLocal(feedback);
    });

    const quietActions = h('div', { class: 'quiet-actions' });
    if (!finished) {
      const skip = h('button', { class: 'text-button', type: 'button' }, [
        skipConfirm ? 'Confirm skip' : 'Skip',
      ]);
      skip.addEventListener('click', () => {
        if (skipConfirm) {
          record('skipped', 'self');
          nextProblem();
        } else {
          skipConfirm = true;
          notice = 'Choose Skip again to confirm.';
          render();
        }
      });
      quietActions.append(skip);
    }
    const end = h('button', { class: 'text-button', type: 'button' }, ['End session']);
    end.addEventListener('click', showSummary);
    quietActions.append(end);

    if (agentAvailable && !finished) {
      const generated = h(
        'button',
        { class: 'button button--agent', type: 'button', disabled: busy },
        [busy ? 'Working…' : 'New problem from agent'],
      );
      generated.addEventListener('click', () => void newAgentProblem());
      quietActions.append(generated);
    }

    const extra = h('div', { class: 'practice-extra' });
    if (solutionViewed) extra.append(solutionBlock(problem));
    if (problem.answer.type === 'proof' && solutionViewed && !finished) {
      extra.append(
        proofSolution(problem, (assessment) => {
          record(
            assessment === 'got' ? 'correct' : assessment === 'partly' ? 'partial' : 'incorrect',
            'self',
            assessment,
          );
          render();
        }),
      );
    }
    if (finished && loadUiPreferences(runtime.settingsStorage).showTime) {
      extra.append(
        h('p', { class: 'quiet' }, [
          `Active time: ${Math.max(1, Math.round(timer.elapsed() / 60_000))} min.`,
        ]),
      );
    }
    extra.append(relatedProblems(problem));
    const help = h('p', { class: 'shortcut-help', hidden: !shortcutHelp }, [
      'Enter check · H hint · N next · Esc close hints · ? help',
    ]);

    root.append(
      h('section', { class: 'screen practice-screen' }, [
        task,
        h('p', { class: 'interleave-note' }, [
          'Topics are mixed on purpose. Past mistakes come back at growing intervals.',
        ]),
        form,
        hints.root,
        feedback.root,
        quietActions,
        extra,
        help,
      ]),
    );

    unbindShortcuts = bindPracticeShortcuts({
      hint: () => {
        if (!finished && hintsUsed < problem.hints.length) {
          hintsUsed++;
          render();
        }
      },
      next: nextProblem,
      collapse: () => hints.collapse(),
      help: () => {
        shortcutHelp = !shortcutHelp;
        help.hidden = !shortcutHelp;
      },
      check: () => form.requestSubmit(),
    });
    if (!finished && !busy) queueMicrotask(() => box.input.focus());
  };

  const checkLocal = (feedback: ReturnType<typeof resultPanel>): void => {
    const problem = current;
    if (!problem) return;
    const result = checkAnswer(problem.answer, answerText);
    if (result.status === 'correct') {
      record('correct', 'local');
      notice = result.message;
      render();
      queueMicrotask(() => root.querySelector<HTMLElement>('.result')?.focus());
    } else {
      wrongChecks++;
      feedback.show(
        'warning',
        result.status === 'unparsed' ? result.message : 'Not quite. Want a hint?',
        result.detail,
      );
      addWrongAnswerActions(feedback.root);
      feedback.focus();
    }
  };

  const addWrongAnswerActions = (container: HTMLElement): void => {
    const actions = h('div', { class: 'inline-actions' });
    const hintButton = h('button', { class: 'button button--ghost', type: 'button' }, ['Hint']);
    hintButton.addEventListener('click', () => {
      if (current && hintsUsed < current.hints.length) hintsUsed++;
      render();
    });
    const solution = h('button', { class: 'button button--ghost', type: 'button' }, [
      'Show solution',
    ]);
    solution.addEventListener('click', () => {
      solutionViewed = true;
      record('incorrect', 'self');
      render();
    });
    actions.append(hintButton, solution);
    if (loadSettings(runtime.settingsStorage).apiKey) {
      const explain = h('button', { class: 'button button--agent', type: 'button' }, [
        'Explain my mistake',
      ]);
      explain.addEventListener('click', () => void askAgentHint());
      actions.append(explain);
    }
    container.append(actions);
  };

  const showProof = (): void => {
    solutionViewed = true;
    render();
  };

  const askAgentHint = async (): Promise<void> => {
    const problem = current;
    if (!problem || busy) return;
    busy = true;
    render();
    const result =
      problem.answer.type === 'proof'
        ? await check(agentDeps(), problem, answerText)
        : await hint(agentDeps(), problem, hintsUsed, answerText);
    busy = false;
    if (!result.ok) {
      notice = result.error.userMessage;
    } else if ('hint' in result.value) {
      agentText = result.value.hint;
      if (!result.value.hidden) agentHints++;
    } else if (result.value.source === 'agent') {
      agentText = `${result.value.feedback}\n\nNext step: ${result.value.nextStep}`;
      agentHints++;
    }
    render();
  };

  const newAgentProblem = async (): Promise<void> => {
    const problem = current;
    if (!problem || busy) return;
    busy = true;
    render();
    const summary = summarizeForAgent(
      runtime.store.get(),
      problem.topic,
      (id) => problemLookup(id)?.title,
    );
    const result = await generateProblem(agentDeps(), problem.topic, problem.difficulty, summary);
    busy = false;
    if (!result.ok) {
      notice = `${result.error.userMessage} A built-in problem is ready instead.`;
      if (!chooseNext()) {
        render();
        return;
      }
    } else {
      current = result.value.problem;
      reason = { kind: 'extra' };
      session = presentProblem(session, {
        problemId: current.id,
        topic: current.topic,
      });
      startedAt = runtime.clock.now();
      hintsUsed = 0;
      agentHints = 0;
      wrongChecks = 0;
      solutionViewed = false;
      finished = false;
      answerText = '';
      agentText = null;
      timer.reset();
      notice = result.value.message ?? null;
    }
    render();
  };

  const solutionBlock = (problem: Problem): HTMLElement =>
    problem.answer.type === 'proof'
      ? h('div')
      : h('section', { class: 'solution' }, [
          h('h3', {}, ['Solution']),
          richText(problem.solution),
        ]);

  const relatedProblems = (problem: Problem): HTMLElement => {
    const items = (problem.related ?? [])
      .map((id) => problemLookup(id))
      .filter((item): item is Problem => item !== undefined);
    if (items.length === 0) return h('div');
    return h('div', { class: 'related' }, [
      h('span', { class: 'quiet' }, ['Connected: ']),
      ...items.map((item) =>
        h('span', { class: 'related-chip', title: TOPIC_LABELS[item.topic] }, [item.title]),
      ),
    ]);
  };

  chooseNext();
  render();
  return {
    root,
    dispose() {
      unbindShortcuts();
      timer.dispose();
    },
  };
}
