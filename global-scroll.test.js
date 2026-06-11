const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('root layout mounts the global back-to-top control on every page', () => {
  const source = readFileSync('apps/web/app/layout.tsx', 'utf8');

  assert.match(source, /ScrollBackTop/);
});

test('root layout suppresses root hydration warnings from browser-injected attributes', () => {
  const source = readFileSync('apps/web/app/layout.tsx', 'utf8');

  assert.match(source, /<html[^>]+suppressHydrationWarning/);
  assert.match(source, /<body[^>]+suppressHydrationWarning/);
});

test('back-to-top control uses animated scroll behavior', () => {
  const source = readFileSync('apps/web/app/_components/ScrollBackTop.tsx', 'utf8');

  assert.match(source, /'use client'/);
  assert.match(source, /scrollTo\(\{/);
  assert.match(source, /behavior: prefersReducedMotion \? 'auto' : 'smooth'/);
  assert.match(source, /aria-label="返回顶部"/);
});

test('hash navigation is intercepted and animated instead of browser instant jump', () => {
  const source = readFileSync('apps/web/app/_components/ScrollBackTop.tsx', 'utf8');

  assert.match(source, /useRouter/);
  assert.match(source, /addEventListener\('click'/);
  assert.match(source, /addEventListener\('submit'/);
  assert.match(source, /router\.push\(/);
  assert.match(source, /scroll: false/);
  assert.match(source, /scrollIntoView\(\{/);
});

test('global styles animate anchor scrolling and respect reduced motion', () => {
  const source = readFileSync('apps/web/app/globals.css', 'utf8');

  assert.match(source, /scroll-behavior: smooth/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /\.scroll-back-top/);
});
