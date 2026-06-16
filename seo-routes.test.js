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
    [`${siteUrl}/`, `${siteUrl}/addresses`, `${siteUrl}/residential-addresses`],
  );
  assert.equal(sitemap[0].priority, 1);
  assert.equal(sitemap[1].changeFrequency, 'daily');
  assert.equal(sitemap[2].changeFrequency, 'daily');
});
