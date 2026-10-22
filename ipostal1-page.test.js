const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('ipostal1 page reuses the public address data layer with the iPostal1 source', () => {
  const source = readFileSync('apps/web/app/ipostal1/page.tsx', 'utf8');

  assert.match(source, /getPublicIpostal1AddressesPageData/);
  assert.match(source, /searchParams/);
  assert.match(source, /FAQPage/);
  assert.match(source, /name="state" type="hidden"/);
  assert.match(source, /<SiteHeader active="ipostal1" \/>/);
  assert.match(source, /action="\/ipostal1#address-list-title"/);
  assert.doesNotMatch(source, /'use client'|"use client"/);
  assert.doesNotMatch(source, /getPublicAddressesPageData\(/);
  assert.doesNotMatch(source, /action="\/addresses/);
});

test('ipostal1 page links through the referral-gated redirect and hides mailbox numbers', () => {
  const source = readFileSync('apps/web/app/ipostal1/page.tsx', 'utf8');

  assert.match(source, /href=\{address\.detailUrl\}/);
  assert.match(source, /addresses-detail-button/);
  assert.doesNotMatch(source, /href=\{address\.anytimeUrl\}/);
  assert.doesNotMatch(source, /address\.mailbox\}/);
  assert.match(source, /AddressRowClickState/);
  assert.match(source, /data-address-row-id=\{address\.id\}/);
});

test('ipostal1 page urls preserve filters under the /ipostal1 base path', async () => {
  const helpers = await import('./apps/web/app/_lib/public-ipostal1-address-data.ts');
  const filters = {
    q: 'mail',
    state: 'CA',
    rdi: 'Residential',
    cmra: 'No',
    usps: '',
    c1: '',
    price: 'lt20',
    page: 3,
  };

  assert.equal(
    helpers.buildIpostal1AddressesPageUrl(filters, { page: 2 }),
    '/ipostal1?q=mail&state=CA&rdi=Residential&cmra=No&price=lt20&page=2#address-list-title',
  );
  assert.equal(
    helpers.buildIpostal1AddressesPageUrl(filters, { state: '', page: 1 }),
    '/ipostal1?q=mail&rdi=Residential&cmra=No&price=lt20#address-list-title',
  );
  assert.equal(
    helpers.buildIpostal1AddressesPageUrl({ ...filters, q: '', state: '', rdi: '', cmra: '', price: '', page: 1 }),
    '/ipostal1#address-list-title',
  );
});

test('existing public pages stay pinned to the ATMB source', () => {
  const addressesPage = readFileSync('apps/web/app/addresses/page.tsx', 'utf8');
  const residentialData = readFileSync('apps/web/app/_lib/public-residential-address-data.ts', 'utf8');
  const homeData = readFileSync('apps/web/app/_lib/home-data.ts', 'utf8');
  const publicData = readFileSync('apps/web/app/_lib/public-address-data.ts', 'utf8');

  assert.match(addressesPage, /getPublicAddressesPageData\(filters, 'anytimemailbox'\)/);
  assert.match(residentialData, /source: AddressSource = 'anytimemailbox'/);
  assert.match(residentialData, /getPublicAddressesPageData\(toAddressFilters\(filters\), source\)/);
  assert.equal((homeData.match(/a\.source = 'anytimemailbox'/g) ?? []).length, 2);
  assert.match(publicData, /const where = \['a\.source = \?', 'a\.is_active = 1', 'a\.is_visible = 1'\]/);
});

test('site navigation and route table include the ipostal1 page', () => {
  const shell = readFileSync('apps/web/app/_components/SiteShell.tsx', 'utf8');
  const routes = readFileSync('apps/web/app/_lib/site-routes.ts', 'utf8');

  assert.match(shell, /href="\/ipostal1"/);
  assert.match(routes, /path: '\/ipostal1'/);
});
