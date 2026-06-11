const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('public head code parser supports common SEO and analytics tags', async () => {
  const helpers = await import('./apps/web/app/_lib/public-head-code-parser.ts');
  const elements = helpers.parsePublicHeadCodeElements(`
    <meta name="google-site-verification" content="abc123">
    <link rel="preconnect" href="https://www.googletagmanager.com">
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
    </script>
    <style>.seo-test{color:#057f93}</style>
    <noscript><img src="https://example.com/pixel" alt=""></noscript>
    <div>ignored</div>
  `);

  assert.deepEqual(
    elements.map((element) => element.tagName),
    ['meta', 'link', 'script', 'script', 'style', 'noscript'],
  );
  assert.equal(elements[0].attributes.name, 'google-site-verification');
  assert.equal(elements[2].attributes.async, true);
  assert.match(elements[3].innerHTML ?? '', /window\.dataLayer/);
  assert.match(elements[4].innerHTML ?? '', /seo-test/);
  assert.match(elements[5].innerHTML ?? '', /pixel/);
});

test('public pages mount saved Head code injection while admin pages stay isolated', () => {
  const homeSource = readFileSync('apps/web/app/page.tsx', 'utf8');
  const addressesSource = readFileSync('apps/web/app/addresses/page.tsx', 'utf8');
  const residentialSource = readFileSync('apps/web/app/residential-addresses/page.tsx', 'utf8');
  const adminSettingsSource = readFileSync('apps/web/app/admin/settings/page.tsx', 'utf8');
  const rootLayoutSource = readFileSync('apps/web/app/layout.tsx', 'utf8');

  for (const source of [homeSource, addressesSource, residentialSource]) {
    assert.match(source, /getPublicHeadCode/);
    assert.match(source, /<PublicHeadCode headCode=\{headCode\}/);
  }

  assert.doesNotMatch(adminSettingsSource, /PublicHeadCode|getPublicHeadCode/);
  assert.doesNotMatch(rootLayoutSource, /PublicHeadCode|getPublicHeadCode/);
});
