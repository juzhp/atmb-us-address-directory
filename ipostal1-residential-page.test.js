const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('ipostal1 residential page reuses the residential data layer with the iPostal1 source', () => {
  const source = readFileSync('apps/web/app/ipostal1-residential-addresses/page.tsx', 'utf8');

  assert.match(source, /getPublicIpostal1ResidentialAddressesPageData/);
  assert.match(source, /searchParams/);
  assert.match(source, /FAQPage/);
  assert.match(source, /<SiteHeader active="ipostal1Residential" \/>/);
  assert.match(source, /action="\/ipostal1-residential-addresses#residential-list-title"/);
  assert.match(source, /name="state" type="hidden"/);
  assert.match(source, /href=\{address\.detailUrl\}/);
  assert.doesNotMatch(source, /address\.mailbox\}/);
  assert.doesNotMatch(source, /Anytime Mailbox|ATMB/);
  assert.doesNotMatch(source, /'use client'|"use client"/);
});

test('ipostal1 residential urls preserve filters under their own base path', async () => {
  const helpers = await import('./apps/web/app/_lib/public-ipostal1-residential-address-data.ts');
  const filters = { q: 'austin', state: 'TX', cmra: 'No', usps: '', c1: '', page: 2 };

  assert.equal(
    helpers.buildIpostal1ResidentialAddressesPageUrl(filters, { page: 3 }),
    '/ipostal1-residential-addresses?q=austin&state=TX&cmra=No&page=3#residential-list-title',
  );
  assert.equal(
    helpers.buildIpostal1ResidentialAddressesPageUrl({ ...filters, q: '', state: '', cmra: '', page: 1 }),
    '/ipostal1-residential-addresses#residential-list-title',
  );

  const atmb = await import('./apps/web/app/_lib/public-residential-address-data.ts');
  assert.equal(
    atmb.buildResidentialAddressesPageUrl(filters, { page: 3 }),
    '/residential-addresses?q=austin&state=TX&cmra=No&page=3#residential-list-title',
  );
});

test('site navigation labels each platform and links both residential pages', () => {
  const shell = readFileSync('apps/web/app/_components/SiteShell.tsx', 'utf8');

  for (const label of ['ATMB 所有地址', 'ATMB 住宅地址', 'iPostal1 所有地址', 'iPostal1 住宅地址']) {
    assert.ok(shell.includes(label), `missing nav label ${label}`);
  }
  assert.match(shell, /href="\/ipostal1-residential-addresses"/);
  // 右上角不再有邮箱图标，联系邮箱只保留在页脚
  assert.doesNotMatch(shell, /<Mail /);
  assert.doesNotMatch(shell, /aria-label=\{`联系邮箱/);
});
