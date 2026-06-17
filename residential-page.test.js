const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('residential page uses real data and no static rows', () => {
  const source = readFileSync('apps/web/app/residential-addresses/page.tsx', 'utf8');

  assert.match(source, /getPublicResidentialAddressesPageData/);
  assert.match(source, /searchParams/);
  assert.match(source, /FAQPage/);
  assert.match(source, /action="\/residential-addresses#residential-list-title"/);
  assert.doesNotMatch(source, /const residentialRows = \[/);
  assert.doesNotMatch(source, /'use client'|"use client"/);
});

test('residential filters only expose keyword, CMRA and page', async () => {
  const helpers = await import('./apps/web/app/_lib/public-residential-address-data.ts');

  assert.deepEqual(
    helpers.parsePublicResidentialAddressFilters({
      q: '  vancouver  ',
      state: 'CA',
      rdi: 'Commercial',
      cmra: 'No',
      price: 'lt20',
      page: '2',
    }),
    {
      q: 'vancouver',
      cmra: 'No',
      page: 2,
    },
  );
});

test('residential urls preserve filters and scroll back to results', async () => {
  const helpers = await import('./apps/web/app/_lib/public-residential-address-data.ts');
  const filters = {
    q: 'vancouver',
    cmra: 'No',
    page: 2,
  };

  assert.equal(
    helpers.buildResidentialAddressesPageUrl(filters, { page: 3 }),
    '/residential-addresses?q=vancouver&cmra=No&page=3#residential-list-title',
  );
  assert.equal(
    helpers.buildResidentialAddressesPageUrl(filters, { cmra: 'Yes', page: 1 }),
    '/residential-addresses?q=vancouver&cmra=Yes#residential-list-title',
  );
});

test('residential address detail links use the referral-gated redirect', () => {
  const source = readFileSync('apps/web/app/residential-addresses/page.tsx', 'utf8');

  assert.match(source, /href=\{address\.detailUrl\}/);
  assert.match(source, /addresses-detail-button/);
  assert.match(source, /href=\{address\.mapsUrl\}/);
});

test('residential address list hides sorting and labels key metrics', () => {
  const source = readFileSync('apps/web/app/residential-addresses/page.tsx', 'utf8');

  assert.doesNotMatch(source, /addresses-sort/);
  assert.match(source, /address\.rdi\}[\s\S]*RDI/);
  assert.match(source, /address\.cmra\}[\s\S]*CMRA/);
  assert.match(source, /address\.price\}[\s\S]*价格/);
  assert.match(source, /address\.mailbox\}[\s\S]*邮箱编号/);
});
