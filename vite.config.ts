import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// connect-src allows any https: origin because the agent API origin is chosen by the
// user at runtime in Settings. style-src-attr needs 'unsafe-inline' for KaTeX output.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https:",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// Build only: the dev server injects <style> tags that this policy would block.
function cspPlugin(): Plugin {
  return {
    name: 'discrete-tasks:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => {
        const charset = /<meta charset="UTF-8"\s*\/?>/i;
        if (!charset.test(html)) throw new Error('index.html needs <meta charset="UTF-8" />');
        const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
        return html.replace(charset, (tag) => `${tag}\n    ${meta}`);
      },
    },
  };
}

export default defineConfig({
  base: '/discrete-tasks/',
  plugins: [cspPlugin()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
