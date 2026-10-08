import { expect, test, type Page } from '@playwright/test';
import { BANK } from '../src/bank';
import type { Problem } from '../src/bank/types';

const byId = new Map(BANK.map((problem) => [problem.id, problem]));

async function currentProblem(page: Page): Promise<Problem> {
  for (let skipped = 0; skipped < BANK.length; skipped++) {
    const id = await page.locator('[data-problem-id]').getAttribute('data-problem-id');
    const problem = id ? byId.get(id) : undefined;
    if (!problem) throw new Error(`Unknown rendered problem: ${String(id)}`);
    if (problem.answer.type !== 'proof') return problem;
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm skip', exact: true }).click();
  }
  throw new Error('No auto-checkable bank problem was presented');
}

function canonicalInput(problem: Problem): string {
  const canonical = problem.answer.canonical;
  if (Array.isArray(canonical)) return canonical.join(', ');
  if (canonical === undefined) throw new Error(`Problem ${problem.id} has no canonical answer`);
  return String(canonical);
}

test('bank practice, hints, settings and memory work without network calls', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/\/discrete-tasks\/#\/practice$/);
  await expect(page.getByRole('link', { name: 'Discrete Tasks' })).toBeVisible();
  await expect(page.locator('[data-problem-id]')).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bank' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const problem = await currentProblem(page);
  await page.getByText('Hints', { exact: true }).click();
  await page.getByRole('button', { name: 'Next hint' }).click();
  await expect(page.getByText(new RegExp(`Hint 1 of ${problem.hints.length}`))).toBeVisible();

  const answer = page.locator('#practice-answer');
  const wrong = problem.answer.type === 'set' ? 'definitely-wrong' : '999999999';
  await answer.fill(wrong);
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('Not quite. Want a hint?')).toBeVisible();

  await answer.fill(canonicalInput(problem));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('Correct.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solution' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next problem' })).toBeVisible();

  await page.waitForTimeout(700);
  await page.reload();
  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByText('Problems solved').locator('..').locator('dd')).toHaveText('1');

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.locator('#model').fill('offline-model');
  await page.locator('#model').dispatchEvent('change');
  await page.reload();
  await expect(page.locator('#model')).toHaveValue('offline-model');
});
