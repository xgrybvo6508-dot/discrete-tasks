import { expect, test } from '@playwright/test';

test('reloads a bank problem offline after the service worker is installed', async ({
  context,
  page,
}) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await expect(page.locator('[data-problem-id]')).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Discrete Tasks' })).toBeVisible();
  await expect(page.locator('[data-problem-id]')).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
});
