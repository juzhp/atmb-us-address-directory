const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('extension page exposes SEO content, store links and structured data', () => {
  const source = readFileSync('apps/web/app/extension/page.tsx', 'utf8');

  assert.match(source, /canonical: PAGE_PATH/);
  assert.match(source, /SoftwareApplication/);
  assert.match(source, /HowTo/);
  assert.match(source, /FAQPage/);
  assert.match(source, /CHROME_STORE_URL/);
  assert.match(source, /id="live-lookup"/);
  assert.match(source, /\/extension-privacy/);
  assert.doesNotMatch(source, /'use client'|"use client"/);

  const links = readFileSync('apps/web/app/_lib/extension-links.ts', 'utf8');
  assert.match(links, /CHROME_EXTENSION_ID = 'dpkphdjaeijbhdoljooclpdpegdbiafm'/);
  assert.match(links, /EDGE_EXTENSION_ID = 'hoeichopnfmmkkknpaapolkaocpkdkjd'/);
  assert.match(links, /https:\/\/chromewebstore\.google\.com\/detail\//);
  assert.match(links, /https:\/\/microsoftedge\.microsoft\.com\/addons\/detail\//);
});

test('extension page is reachable from navigation and sitemap', () => {
  const shell = readFileSync('apps/web/app/_components/SiteShell.tsx', 'utf8');
  assert.equal(shell.match(/href="\/extension"/g).length, 2);

  const routes = readFileSync('apps/web/app/_lib/site-routes.ts', 'utf8');
  assert.match(routes, /path: '\/extension'/);
});

test('address list pages render the live lookup entry on every row', () => {
  for (const page of ['addresses', 'residential-addresses', 'ipostal1', 'ipostal1-residential-addresses']) {
    const source = readFileSync(`apps/web/app/${page}/page.tsx`, 'utf8');
    assert.match(source, /<LiveLookup street=\{address\.streetAddress\} city=\{address\.city\} state=\{address\.state\} postalCode=\{address\.postalCode\} \/>/, page);
  }
});

test('live lookup falls back to the extension page when the extension is missing', () => {
  const component = readFileSync('apps/web/app/_components/LiveLookup.tsx', 'utf8');
  assert.match(component, /^'use client';/);
  assert.match(component, /isExtensionInstalled\(\)/);
  assert.match(component, /window\.location\.assign\(EXTENSION_LIVE_LOOKUP_URL\)/);

  const bridge = readFileSync('apps/web/app/_lib/extension-bridge.ts', 'utf8');
  const contentScript = readFileSync('apps/extension/src/content/usaddres.ts', 'utf8');
  // 网站与扩展两边都从 @atmb/shared 取同一套协议常量
  for (const name of ['EXTENSION_BRIDGE_ATTR', 'EXTENSION_PAGE_MESSAGE_SOURCE', 'EXTENSION_BRIDGE_MESSAGE_SOURCE']) {
    assert.match(bridge, new RegExp(name));
    assert.match(contentScript, new RegExp(name));
  }

  const manifest = JSON.parse(readFileSync('apps/extension/manifest.json', 'utf8'));
  const bridgeScript = manifest.content_scripts.find((entry) => entry.js.includes('content/usaddres.js'));
  assert.deepEqual(bridgeScript.matches, ['https://usaddres.com/*']);
  assert.equal(bridgeScript.run_at, 'document_start');
});
