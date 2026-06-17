const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('addresses page uses real SQLite data integration points', () => {
  const source = readFileSync('apps/web/app/addresses/page.tsx', 'utf8');

  assert.match(source, /getPublicAddressesPageData/);
  assert.match(source, /searchParams/);
  assert.match(source, /FAQPage/);
  assert.doesNotMatch(source, /const addressRows = \[/);
  assert.doesNotMatch(source, /const commonStates = \[/);
  assert.doesNotMatch(source, /'use client'|"use client"/);
});

test('public address helpers format fields and generated links', async () => {
  const helpers = await import('./apps/web/app/_lib/public-address-data.ts');

  assert.equal(helpers.formatPublicPrice(1999), 'US$ 19.99');
  assert.equal(helpers.formatPublicMailboxRange(null, null), '0 - 0');
  assert.equal(helpers.formatPublicMailboxRange(1018, 1119), '1018 - 1119');
  assert.equal(
    helpers.buildAddressDetailRedirectUrl('https://www.anytimemailbox.com/s/fayetteville-3011-town-center-drive'),
    '/go/address-detail?target=https%3A%2F%2Fwww.anytimemailbox.com%2Fs%2Ffayetteville-3011-town-center-drive',
  );
  assert.equal(
    helpers.buildPublicGoogleMapsUrl('7720 NE Hwy 99 Ste D, Vancouver, WA 98665, United States'),
    'https://www.google.com/maps/search/?api=1&query=7720%20NE%20Hwy%2099%20Ste%20D%2C%20Vancouver%2C%20WA%2098665%2C%20United%20States',
  );
});

test('public address detail links use the referral-gated redirect', () => {
  const source = readFileSync('apps/web/app/addresses/page.tsx', 'utf8');

  assert.match(source, /href=\{address\.detailUrl\}/);
  assert.match(source, /addresses-detail-button/);
  assert.doesNotMatch(source, /href=\{address\.anytimeUrl\}/);
});

test('public address page urls preserve filters and scroll back to results', async () => {
  const helpers = await import('./apps/web/app/_lib/public-address-data.ts');
  const filters = {
    q: 'mail',
    state: 'CA',
    rdi: 'Residential',
    cmra: 'No',
    price: 'lt20',
    page: 3,
  };

  assert.equal(
    helpers.buildAddressesPageUrl(filters, { page: 2 }),
    '/addresses?q=mail&state=CA&rdi=Residential&cmra=No&price=lt20&page=2#address-list-title',
  );
  assert.equal(
    helpers.buildAddressesPageUrl(filters, { state: 'TX', page: 1 }),
    '/addresses?q=mail&state=TX&rdi=Residential&cmra=No&price=lt20#address-list-title',
  );
});

test('addresses filter form submits to the result section anchor', () => {
  const source = readFileSync('apps/web/app/addresses/page.tsx', 'utf8');

  assert.match(source, /action="\/addresses#address-list-title"/);
});

test('public address rows expose hover and visited visual states', () => {
  const css = readFileSync('apps/web/app/globals.css', 'utf8');

  assert.match(css, /\.addresses-row:hover/);
  assert.match(css, /\.addresses-row:focus-within/);
  assert.match(css, /\.addresses-row\.is-clicked/);
  assert.match(css, /\.addresses-row:has\(a:visited\)/);
  assert.match(css, /transition:[^;]*(background|box-shadow|border-color|transform)/);
});

test('public address list hides sorting and labels key metrics', () => {
  const source = readFileSync('apps/web/app/addresses/page.tsx', 'utf8');

  assert.doesNotMatch(source, /addresses-sort/);
  assert.match(source, /address\.rdi\}[\s\S]*RDI/);
  assert.match(source, /address\.cmra\}[\s\S]*CMRA/);
  assert.match(source, /address\.price\}[\s\S]*价格/);
  assert.match(source, /address\.mailbox\}[\s\S]*邮箱编号/);
});

test('public address result toolbar is compact on mobile', () => {
  const css = readFileSync('apps/web/app/globals.css', 'utf8');

  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.addresses-result-toolbar\s*\{[\s\S]*min-height:\s*auto/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.addresses-result-toolbar\s*\{[\s\S]*padding:\s*12px 14px/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.addresses-result-count\s*\{[\s\S]*font-size:\s*15px/);
});

test('public address pages use compact list sizing', () => {
  const css = readFileSync('apps/web/app/globals.css', 'utf8');

  assert.match(css, /\.addresses-inner\s*\{[\s\S]*width:\s*min\(1440px,/);
  assert.match(css, /\.addresses-hero h1\s*\{[\s\S]*font-size:\s*clamp\(34px,\s*2\.35vw,\s*44px\)/);
  assert.match(css, /\.addresses-input-like,[\s\S]*?\.addresses-search-form button\s*\{[\s\S]*min-height:\s*46px/);
  assert.match(css, /\.addresses-row\s*\{[\s\S]*min-height:\s*98px/);
  assert.match(css, /\.addresses-row\s*\{[\s\S]*padding:\s*15px 17px/);
  assert.match(css, /\.addresses-detail-button,[\s\S]*?\.addresses-photo-button\s*\{[\s\S]*min-height:\s*36px/);
});

test('public address pages persist clicked row state', () => {
  const component = readFileSync('apps/web/app/_components/AddressRowClickState.tsx', 'utf8');
  const addressesPage = readFileSync('apps/web/app/addresses/page.tsx', 'utf8');
  const residentialPage = readFileSync('apps/web/app/residential-addresses/page.tsx', 'utf8');

  assert.match(component, /'use client'/);
  assert.match(component, /localStorage/);
  assert.match(component, /data-address-row-id/);
  assert.match(addressesPage, /AddressRowClickState/);
  assert.match(addressesPage, /data-address-row-id=\{address\.id\}/);
  assert.match(residentialPage, /AddressRowClickState/);
  assert.match(residentialPage, /data-address-row-id=\{address\.id\}/);
});
