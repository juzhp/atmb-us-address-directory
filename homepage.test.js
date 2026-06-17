const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('homepage exposes SEO content and real data integration points', () => {
  const source = readFileSync('apps/web/app/page.tsx', 'utf8');

  assert.match(source, /美国真实住宅地址/);
  assert.match(source, /Anytime Mailbox/);
  assert.match(source, /RDI/);
  assert.match(source, /CMRA/);
  assert.match(source, /Google Maps/);
  assert.match(source, /FAQPage/);
  assert.match(source, /ItemList/);
  assert.match(source, /hero-residential-map-v4\.png/);
  assert.match(source, /getHomePageData/);
  assert.match(source, /export const revalidate = 60/);
  assert.doesNotMatch(source, /'use client'|"use client"/);
  assert.doesNotMatch(source, /const featuredAddresses = \[/);
});

test('homepage data helpers format public address fields', async () => {
  const helpers = await import('./apps/web/app/_lib/home-data.ts');

  assert.equal(helpers.formatHomePrice(1999), 'US$ 19.99');
  assert.equal(helpers.formatMailboxRange(null, null), '0 - 0');
  assert.equal(helpers.formatMailboxRange(1018, 1119), '1018 - 1119');
  assert.equal(
    helpers.buildAddressDetailRedirectUrl('https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72'),
    '/go/address-detail?target=https%3A%2F%2Flocations.anytimemailbox.com%2Fl%2Fusa%2Falabama%2Fmadison-hwy-72',
  );
  assert.equal(
    helpers.buildGoogleMapsSearchUrl('7169 Hwy 72 W Ste A, Madison, AL 35758, United States'),
    'https://www.google.com/maps/search/?api=1&query=7169%20Hwy%2072%20W%20Ste%20A%2C%20Madison%2C%20AL%2035758%2C%20United%20States',
  );
});

test('homepage detail links use the referral-gated redirect while photos keep Google Maps', () => {
  const source = readFileSync('apps/web/app/page.tsx', 'utf8');

  assert.match(source, /href=\{address\.detailUrl\}/);
  assert.match(source, /href=\{address\.mapsUrl\}/);
  assert.match(source, /buildFeaturedItemListJsonLd/);
});

test('state mapping exposes Chinese labels and searchable text', async () => {
  const states = await import('./packages/shared/src/us-states.ts');

  const california = states.getUsStateDisplay('CA');
  assert.equal(california.label, '加利福尼亚州 California (CA)');
  assert.match(california.searchText, /加利福尼亚州/);
  assert.match(california.searchText, /加州/);
  assert.match(california.searchText, /California/);
  assert.match(california.searchText, /CA/);

  assert.equal(states.getUsStateDisplay('XX', 'Example State').label, 'Example State (XX)');
});

test('public frontend uses compact sizing tokens', () => {
  const css = readFileSync('apps/web/app/globals.css', 'utf8');

  assert.match(css, /--site-gutter:\s*clamp\(20px,\s*3\.2vw,\s*60px\)/);
  assert.match(css, /\.site-header-inner,[\s\S]*?\.site-footer-inner\s*\{[\s\S]*width:\s*min\(1440px,/);
  assert.match(css, /\.site-header-inner\s*\{[\s\S]*min-height:\s*70px/);
  assert.match(css, /\.site-nav a\s*\{[\s\S]*min-height:\s*70px/);
  assert.match(css, /\.home-hero-copy h1\s*\{[\s\S]*font-size:\s*clamp\(36px,\s*2\.6vw,\s*50px\)/);
  assert.match(css, /\.home-filter-form select\s*\{[\s\S]*min-height:\s*46px/);
  assert.match(css, /\.home-filter-form > button\s*\{[\s\S]*min-height:\s*46px/);

  const adminHeaderBlock = css.match(/\.admin-header-inner\s*\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(adminHeaderBlock, /min-height:\s*70px/);
});
