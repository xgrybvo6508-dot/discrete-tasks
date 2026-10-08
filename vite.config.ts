import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
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
  plugins: [
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'icons/icon.svg',
        'icons/favicon.ico',
        'icons/pwa-64x64.png',
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
        'icons/maskable-icon-512x512.png',
        'icons/apple-touch-icon-180x180.png',
      ],
      manifest: {
        name: 'Discrete Tasks',
        short_name: 'Discrete',
        description: 'Calm, offline discrete-math practice.',
        start_url: '/discrete-tasks/',
        scope: '/discrete-tasks/',
        display: 'standalone',
        background_color: '#0e0f13',
        theme_color: '#0e0f13',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
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
