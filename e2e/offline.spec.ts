import { expect, test } from '@playwright/test';

test('reloads a bank problem offline after the service worker is installed', async ({
  context,
  page,
}) => {
  await page.goto('./');
  const paths = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    return {
      manifest: manifest ? new URL(manifest.href).pathname : null,
      scope: new URL(registration.scope).pathname,
    };
  });
  expect(paths).toEqual({
    manifest: '/discrete-tasks/manifest.webmanifest',
    scope: '/discrete-tasks/',
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
