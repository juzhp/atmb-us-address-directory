const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

const siteUrl = 'https://usaddres.com';

test('root metadata uses the production canonical base domain', () => {
  const source = readFileSync('apps/web/app/layout.tsx', 'utf8');

  assert.match(source, /metadataBase: new URL\('https:\/\/usaddres\.com'\)/);
  assert.doesNotMatch(source, /metadataBase: new URL\('https:\/\/atmb\.juzhp\.com'\)/);
});

test('robots route exposes the public site and blocks private routes', async () => {
  const route = await import('./apps/web/app/robots.ts');
  const robots = route.default();

  assert.equal(robots.host, siteUrl);
  assert.equal(robots.sitemap, `${siteUrl}/sitemap.xml`);
  assert.deepEqual(robots.rules, [
    {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/go/'],
    },
  ]);
});

test('sitemap route lists current public SEO pages with production urls', async () => {
  const route = await import('./apps/web/app/sitemap.ts');
  const sitemap = route.default();

  assert.deepEqual(
    sitemap.map((entry) => entry.url),
    [
      `${siteUrl}/`,
      `${siteUrl}/addresses`,
      `${siteUrl}/residential-addresses`,
      `${siteUrl}/guide/anytime-mailbox-tutorial`,
      `${siteUrl}/guide/usps-form-1583`,
      `${siteUrl}/guide/us-residential-address-verification`,
    ],
  );
  assert.equal(sitemap[0].priority, 1);
  assert.equal(sitemap[1].changeFrequency, 'daily');
  assert.equal(sitemap[2].changeFrequency, 'daily');
});

test('llms.txt route serves markdown with an h1 and the public page list', async () => {
  const route = await import('./apps/web/app/llms.txt/route.ts');
  const response = route.GET();
  const body = await response.text();

  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.match(body, /^# .+/);
  assert.equal(body.match(/^# /gm).length, 1);

  const sitemapRoute = await import('./apps/web/app/sitemap.ts');
  for (const entry of sitemapRoute.default()) {
    assert.ok(body.includes(entry.url), `llms.txt is missing ${entry.url}`);
  }
});
