import { TOPIC_LABELS } from '../../bank/topics';
import type { Problem } from '../../bank/types';
import { check, generateProblem, hint, type ActionDeps } from '../../agent/actions';
import { loadSettings, saveSettings } from '../../agent/settings';
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

type SourceMode = 'bank' | 'agent';

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
  let noticeTone: 'success' | 'warning' | 'quiet' = runtime.loadNotice ? 'warning' : 'quiet';
  let shortcutHelp = false;
  let busy = false;
  const initialSettings = loadSettings(runtime.settingsStorage);
  let sourceMode: SourceMode =
    initialSettings.agentProblems && initialSettings.apiKey.trim() ? 'agent' : 'bank';
  let unbindShortcuts = (): void => undefined;

  const problemLookup = (id: string): Problem | undefined =>
    runtime.bankById.get(id) ?? runtime.store.get().aiProblems.find((p) => p.id === id);

  const agentDeps = (): ActionDeps => ({
    client: runtime.agentClient,
    getSettings: () => loadSettings(runtime.settingsStorage),
    rng,
    onGenerated: (problem) => runtime.store.update((memory) => addAiProblem(memory, problem)),
  });

  const bankTarget = (): { problem: Problem; reason: PickReason } | null => {
    const pick = pickNext({
      problems: runtime.bank,
      cards: runtime.store.get().cards,
      topics: runtime.store.get().topics,
      session,
      now: runtime.clock.now(),
      rng,
    });
    if (!pick) return null;
    const problem = runtime.bankById.get(pick.problemId);
    return problem ? { problem, reason: pick.reason } : null;
  };

  const setProblem = (problem: Problem, nextReason: PickReason): void => {
    current = problem;
    reason = nextReason;
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
  };

  const chooseNext = (): boolean => {
    const target = bankTarget();
    if (!target) return false;
    setProblem(target.problem, target.reason);
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
        noticeTone = 'quiet';
        render();
        return;
      }
      record('skipped', 'self');
    }
    notice = null;
    noticeTone = 'quiet';
    if (sourceMode === 'agent' && loadSettings(runtime.settingsStorage).apiKey.trim()) {
      void newAgentProblem();
      return;
    }
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
        if (sourceMode === 'agent') void newAgentProblem();
        else {
          chooseNext();
          render();
        }
      }),
    );
  };

  const render = (): void => {
    const problem = current;
    if (!problem) {
      clear(root);
      root.append(
        h('section', { class: 'screen empty-state' }, [
          h('h1', {}, [busy ? 'Preparing a problem' : 'No problem is available']),
          h('p', { class: 'quiet' }, [
            busy
              ? 'The agent is working. A built-in problem will be used if it is unavailable.'
              : 'The built-in problem bank is still loading.',
          ]),
        ]),
      );
      return;
    }
    unbindShortcuts();
    clear(root);
    const settings = loadSettings(runtime.settingsStorage);
    const agentAvailable = settings.apiKey.trim().length > 0;
    const source = sourceControl(sourceMode, agentAvailable, busy, (next) => {
      if (next === sourceMode) return;
      if (!finished) record('skipped', 'self');
      sourceMode = next;
      saveSettings(runtime.settingsStorage, {
        ...loadSettings(runtime.settingsStorage),
        agentProblems: next === 'agent',
      });
      notice = null;
      noticeTone = 'quiet';
      if (next === 'agent') void newAgentProblem();
      else {
        chooseNext();
        render();
      }
    });
    const box = answerBox(problem.answer.type);
    box.input.value = answerText;
    box.input.disabled = finished || busy;
    box.input.addEventListener('input', () => {
      answerText = box.input.value;
      skipConfirm = false;
    });
    const feedback = resultPanel();
    if (notice) feedback.show(noticeTone, notice);
    const hints = hintPanel(
      problem,
      () => {
        if (hintsUsed < problem.hints.length) hintsUsed++;
        render();
      },
      () => revealSolution(),
      () => void askAgentHint(),
      agentAvailable,
    );
    hints.render(hintsUsed, agentText, busy, !finished && !solutionViewed);

    const task = h('article', { class: 'task-card', 'data-problem-id': problem.id }, [
      h('div', { class: 'task-meta' }, [
        h('span', { class: 'topic-chip' }, [TOPIC_LABELS[problem.topic]]),
        h('span', { class: 'quiet' }, [`Level ${problem.difficulty}`]),
        ...(problem.source === 'ai'
          ? [h('span', { class: 'ai-label' }, ['Made by the agent. Not verified.'])]
          : []),
      ]),
      h('h1', {}, [problem.title]),
      richText(problem.statement),
      h('p', { class: 'why-line' }, [whyText(reason, runtime.clock.now())]),
    ]);

    const form = h('form', { class: 'answer-form', id: 'practice-answer-form' }, [box.root]);
    const primary = h(
      'button',
      {
        class: 'button button--primary',
        type: 'submit',
        form: 'practice-answer-form',
        disabled: busy,
      },
      [
        finished
          ? 'Next problem'
          : problem.answer.type === 'proof'
            ? 'Show model solution'
            : 'Check',
      ],
    );
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
          noticeTone = 'quiet';
          render();
        }
      });
      quietActions.append(skip);
    }
    const end = h('button', { class: 'text-button', type: 'button' }, ['End session']);
    end.addEventListener('click', showSummary);
    quietActions.append(end);

    const solutionArea = h('div', { class: 'practice-solution' });
    if (solutionViewed && problem.answer.type !== 'proof') {
      solutionArea.append(solutionBlock(problem));
    }
    if (problem.answer.type === 'proof' && solutionViewed) {
      solutionArea.append(
        proofSolution(
          problem,
          (assessment) => {
            record(
              assessment === 'got' ? 'correct' : assessment === 'partly' ? 'partial' : 'incorrect',
              'self',
              assessment,
            );
            render();
          },
          !finished,
        ),
      );
    }
    const footerExtra = h('div', { class: 'practice-extra' });
    if (finished && loadUiPreferences(runtime.settingsStorage).showTime) {
      footerExtra.append(
        h('p', { class: 'quiet' }, [
          `Active time: ${Math.max(1, Math.round(timer.elapsed() / 60_000))} min.`,
        ]),
      );
    }
    const related = relatedProblems(problem);
    if (related) footerExtra.append(related);
    const help = h('p', { class: 'shortcut-help', hidden: !shortcutHelp }, [
      problem.answer.type === 'proof'
        ? 'Ctrl or Command + Enter: show solution · H: hint · N: next · Esc: close hints · ?: help'
        : 'Enter: check · H: hint · N: next · Esc: close hints · ?: help',
    ]);

    const showPrimary = !(problem.answer.type === 'proof' && solutionViewed && !finished);
    root.append(
      h('section', { class: 'screen practice-screen' }, [
        source,
        task,
        h('p', { class: 'interleave-note' }, [
          'Topics are mixed on purpose. Past mistakes come back at growing intervals.',
        ]),
        form,
        hints.root,
        ...(showPrimary ? [primary] : []),
        feedback.root,
        ...(solutionArea.childElementCount > 0 ? [solutionArea] : []),
        quietActions,
        ...(footerExtra.childElementCount > 0 ? [footerExtra] : []),
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
      check: () => {
        if (!(problem.answer.type === 'proof' && solutionViewed && !finished)) {
          form.requestSubmit();
        }
      },
    });
    if (!finished && !busy && !(problem.answer.type === 'proof' && solutionViewed)) {
      queueMicrotask(() => box.input.focus());
    }
  };

  const checkLocal = (feedback: ReturnType<typeof resultPanel>): void => {
    const problem = current;
    if (!problem) return;
    const result = checkAnswer(problem.answer, answerText);
    if (result.status === 'correct') {
      record('correct', 'local');
      solutionViewed = true;
      notice = result.message;
      noticeTone = 'success';
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
    const retry = h('button', { class: 'button button--ghost', type: 'button' }, ['Try again']);
    retry.addEventListener('click', () => {
      root.querySelector<HTMLInputElement | HTMLTextAreaElement>('#practice-answer')?.focus();
    });
    const hintButton = h('button', { class: 'button button--ghost', type: 'button' }, ['Hint']);
    hintButton.addEventListener('click', () => {
      if (current && hintsUsed < current.hints.length) hintsUsed++;
      render();
    });
    const solution = h('button', { class: 'button button--ghost', type: 'button' }, [
      'Show solution',
    ]);
    solution.addEventListener('click', revealSolution);
    actions.append(retry, hintButton, solution);
    if (loadSettings(runtime.settingsStorage).apiKey) {
      const explain = h('button', { class: 'button button--agent', type: 'button' }, [
        'Explain my mistake',
      ]);
      explain.addEventListener('click', () => void askAgentHint());
      actions.append(explain);
    }
    container.append(actions);
  };

  const revealSolution = (): void => {
    const problem = current;
    if (!problem) return;
    solutionViewed = true;
    if (problem.answer.type !== 'proof') record('incorrect', 'self');
    render();
    queueMicrotask(() => root.querySelector<HTMLElement>('.solution')?.focus());
  };

  const showProof = (): void => {
    revealSolution();
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
      noticeTone = 'warning';
    } else if ('hint' in result.value) {
      notice = null;
      noticeTone = 'quiet';
      agentText = result.value.hint;
      if (!result.value.hidden) agentHints++;
    } else if (result.value.source === 'agent') {
      notice = null;
      noticeTone = 'quiet';
      agentText = `${result.value.feedback}\n\nNext step: ${result.value.nextStep}`;
      agentHints++;
    }
    render();
  };

  const newAgentProblem = async (): Promise<void> => {
    if (busy) return;
    const target = bankTarget();
    if (!target) {
      showSummary();
      return;
    }
    busy = true;
    render();
    const summary = summarizeForAgent(
      runtime.store.get(),
      target.problem.topic,
      (id) => problemLookup(id)?.title,
    );
    const result = await generateProblem(
      agentDeps(),
      target.problem.topic,
      target.problem.difficulty,
      summary,
    );
    busy = false;
    if (!result.ok) {
      notice = `${result.error.userMessage} A built-in problem is ready instead.`;
      noticeTone = 'warning';
      sourceMode = 'bank';
      saveSettings(runtime.settingsStorage, {
        ...loadSettings(runtime.settingsStorage),
        agentProblems: false,
      });
      setProblem(target.problem, target.reason);
    } else {
      setProblem(result.value.problem, target.reason);
      notice = result.value.message ?? null;
      noticeTone = 'quiet';
    }
    render();
  };

  const solutionBlock = (problem: Problem): HTMLElement =>
    problem.answer.type === 'proof'
      ? h('div')
      : h('section', { class: 'solution', tabindex: '-1' }, [
          h('h3', {}, ['Solution']),
          richText(problem.solution),
        ]);

  const relatedProblems = (problem: Problem): HTMLElement | null => {
    const items = (problem.related ?? [])
      .map((id) => problemLookup(id))
      .filter((item): item is Problem => item !== undefined);
    if (items.length === 0) return null;
    return h('div', { class: 'related' }, [
      h('span', { class: 'quiet' }, ['Connected: ']),
      ...items.map((item) =>
        h('span', { class: 'related-chip', title: TOPIC_LABELS[item.topic] }, [item.title]),
      ),
    ]);
  };

  if (sourceMode === 'agent') {
    void newAgentProblem();
  } else {
    chooseNext();
    render();
  }
  return {
    root,
    dispose() {
      unbindShortcuts();
      timer.dispose();
    },
  };
}

function sourceControl(
  selected: SourceMode,
  agentAvailable: boolean,
  busy: boolean,
  onSelect: (source: SourceMode) => void,
): HTMLElement {
  const bank = h(
    'button',
    {
      class: `source-option${selected === 'bank' ? ' is-selected' : ''}`,
      type: 'button',
      'aria-pressed': String(selected === 'bank'),
      disabled: busy,
    },
    ['Bank'],
  );
  bank.addEventListener('click', () => onSelect('bank'));
  const agent = h(
    'button',
    {
      class: `source-option source-option--agent${selected === 'agent' ? ' is-selected' : ''}`,
      type: 'button',
      'aria-pressed': String(selected === 'agent'),
      disabled: busy || !agentAvailable,
      title: agentAvailable
        ? 'Generate a problem with your configured provider.'
        : 'Add a key in Settings first.',
    },
    [busy && selected === 'agent' ? 'AI agent · working…' : 'AI agent'],
  );
  agent.addEventListener('click', () => onSelect('agent'));
  return h('div', { class: 'source-control', role: 'group', 'aria-label': 'Problem source' }, [
    h('span', { class: 'source-control__label' }, ['Source']),
    bank,
    agent,
    ...(!agentAvailable
      ? [h('a', { class: 'source-control__setup', href: '#/settings' }, ['Set up AI'])]
      : []),
  ]);
}
