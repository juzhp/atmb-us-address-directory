const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

test('address blacklist page is a server component built on the blacklist data layer', () => {
  const source = readFileSync('apps/web/app/address-blacklist/page.tsx', 'utf8');

  assert.match(source, /getPublicBlacklistPageData/);
  assert.match(source, /searchParams/);
  assert.match(source, /FAQPage/);
  assert.match(source, /<SiteHeader active="blacklist" \/>/);
  assert.match(source, /<BlacklistSubmitForm \/>/);
  assert.match(source, /<ExpandableText text=\{item\.reason\} \/>/);
  assert.match(source, /#blacklist-list-title/);
  assert.match(source, /rel="nofollow noreferrer noopener"/);
  assert.doesNotMatch(source, /'use client'|"use client"/);
});

test('public blacklist data only reads approved entries from a read-only connection', () => {
  const source = readFileSync('apps/web/app/_lib/public-blacklist-data.ts', 'utf8');

  assert.match(source, /b\.status = 'approved'/);
  assert.match(source, /readonly: true/);
  assert.match(source, /GROUP BY b\.normalized_address_key/);
});

test('submit form keeps the honeypot field and the 500 character reason limit', () => {
  const source = readFileSync('apps/web/app/_components/BlacklistSubmitForm.tsx', 'utf8');

  assert.match(source, /^'use client';/);
  assert.match(source, /name="website"/);
  assert.match(source, /maxLength=\{BLACKLIST_REASON_MAX_LENGTH\}/);
  assert.match(source, /parseOneLineUsAddress/);
  assert.match(source, /\/api\/public\/blacklist\/submissions/);
});

test('site navigation, admin navigation and route table include the blacklist pages', () => {
  const shell = readFileSync('apps/web/app/_components/SiteShell.tsx', 'utf8');
  const routes = readFileSync('apps/web/app/_lib/site-routes.ts', 'utf8');
  const adminShell = readFileSync('apps/web/app/admin/_components/AdminShell.tsx', 'utf8');

  assert.match(shell, /href="\/address-blacklist"/);
  assert.match(routes, /path: '\/address-blacklist'/);
  assert.match(adminShell, /href: '\/admin\/blacklist'/);
});

test('blacklist page urls preserve the keyword under the base path', async () => {
  const helpers = await import('./apps/web/app/_lib/public-blacklist-data.ts');

  assert.equal(
    helpers.buildBlacklistPageUrl({ q: 'Main St', page: 3 }, { page: 2 }),
    '/address-blacklist?q=Main+St&page=2#blacklist-list-title',
  );
  assert.equal(helpers.buildBlacklistPageUrl({ q: '', page: 1 }), '/address-blacklist#blacklist-list-title');
  assert.deepEqual(helpers.parsePublicBlacklistFilters({ q: ['  90001 '], page: '0' }), { q: '90001', page: 1 });
});

test('public blacklist search matches full addresses, partial words and chinese state names', async (t) => {
  const Database = require('better-sqlite3');
  const { ensureDatabaseSchema } = await import('./packages/db/src/index.ts');
  const dir = mkdtempSync(join(tmpdir(), 'atmb-blacklist-'));
  const file = join(dir, 'test.sqlite');
  const db = new Database(file);
  ensureDatabaseSchema(db);
  const insert = db.prepare(`
    INSERT INTO address_blacklist (
      street_address, city, state, postal_code, normalized_address_key, reason, status, submitted_by,
      reviewed_at, created_at, updated_at
    ) VALUES (@street, @city, @state, @zip, @key, 'reason', @status, 'admin', @now, @now, @now)
  `);
  const now = new Date().toISOString();
  insert.run({ street: '1234 Wilshire Blvd, Suite 500', city: 'Los Angeles', state: 'CA', zip: '90017', key: 'a', status: 'approved', now });
  insert.run({ street: '1234 Wilshire Blvd, Suite 500', city: 'Los Angeles', state: 'CA', zip: '90017', key: 'a', status: 'approved', now });
  insert.run({ street: '500 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', key: 'b', status: 'approved', now });
  insert.run({ street: '9 Pending Rd', city: 'Austin', state: 'TX', zip: '78702', key: 'c', status: 'pending', now });
  db.close();

  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = file;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    rmSync(dir, { recursive: true, force: true });
  });

  const helpers = await import('./apps/web/app/_lib/public-blacklist-data.ts');
  const search = async (q) => (await helpers.getPublicBlacklistPageData({ q, page: 1 })).items.map((item) => item.streetAddress);

  assert.deepEqual(await search('1234 Wilshire Blvd, Suite 500, Los Angeles, CA 90017'), ['1234 Wilshire Blvd, Suite 500']);
  assert.deepEqual(await search('1234 wilshire blvd suite 500 los angeles ca 90017-1234'), ['1234 Wilshire Blvd, Suite 500']);
  assert.deepEqual(await search('加州 90017'), ['1234 Wilshire Blvd, Suite 500']);
  assert.deepEqual(await search('Austin'), ['500 Congress Ave']);
  assert.deepEqual(await search('德州'), ['500 Congress Ave']);
  assert.deepEqual(await search('Wilshire Austin'), []);
  assert.equal((await helpers.getPublicBlacklistPageData({ q: '', page: 1 })).total, 2);
  assert.equal((await helpers.getPublicBlacklistPageData({ q: '90017', page: 1 })).items[0].reasons.length, 2);
});

test('one-line us address parser fills street, city, state and zip', async () => {
  const { parseOneLineUsAddress } = await import('./packages/shared/src/address-parse.ts');

  assert.deepEqual(parseOneLineUsAddress('123 Main St, Suite 5, Los Angeles, CA 90001'), {
    streetAddress: '123 Main St, Suite 5',
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90001',
  });
  assert.deepEqual(parseOneLineUsAddress('456 Oak Ave, New York, New York 10001-1234, USA'), {
    streetAddress: '456 Oak Ave',
    city: 'New York',
    state: 'NY',
    postalCode: '10001-1234',
  });
  assert.deepEqual(parseOneLineUsAddress('789 Pine Rd Austin TX 78701'), {
    streetAddress: '789 Pine Rd',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
  });
  assert.deepEqual(parseOneLineUsAddress('2 Elm St, Washington, District of Columbia 20001'), {
    streetAddress: '2 Elm St',
    city: 'Washington',
    state: 'DC',
    postalCode: '20001',
  });
  assert.deepEqual(parseOneLineUsAddress('1 Infinite Loop, Cupertino 95014'), {
    streetAddress: '1 Infinite Loop',
    city: 'Cupertino',
    state: '',
    postalCode: '95014',
  });
  assert.deepEqual(parseOneLineUsAddress('no zip here'), {
    streetAddress: 'no zip here',
    city: '',
    state: '',
    postalCode: '',
  });
});
