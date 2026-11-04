import { createDatabase, ensureDatabaseSchema } from '@atmb/db';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveServerConfig } from '../src/auth/config.ts';
import { ExtensionLookupService } from '../src/extension/service.ts';
import { createServer } from '../src/server.ts';

const testEnv = {
  NODE_ENV: 'test',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'secret123',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  WEB_ORIGIN: 'http://localhost:3000',
};

async function buildTestServer() {
  const app = await createServer({ databaseUrl: ':memory:', env: testEnv, logger: false });
  await app.ready();
  return app;
}

async function loginCookie(app: Awaited<ReturnType<typeof createServer>>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: { username: 'admin', password: 'secret123' },
  });
  const setCookie = response.headers['set-cookie'];
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(header);
  return header.split(';')[0] ?? '';
}

function lookup(app: Awaited<ReturnType<typeof createServer>>, items: unknown[], ip = '203.0.113.9') {
  return app.inject({
    method: 'POST',
    url: '/api/public/extension/lookup',
    headers: { 'x-forwarded-for': ip },
    payload: { items },
  });
}

function buildService() {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const insert = database.sqlite.prepare(`
    INSERT INTO addresses (
      source, source_id, name, slug, anytime_url, state, state_name, city, street_address, postal_code,
      full_address, price_cents, rdi, cmra, usps_cmra, mailbox_min, mailbox_max, is_active, is_visible
    ) VALUES (
      @source, @sourceId, @name, @slug, @anytimeUrl, @state, 'Texas', @city, @street, @zip,
      @street || ' ' || @city || ', ' || @state || ' ' || @zip, 1999, @rdi, @cmra, @uspsCmra, @mailboxMin, @mailboxMax, 1, @isVisible
    )
  `);
  const rows = [
    {
      source: 'anytimemailbox', sourceId: 'abilene-2438-industrial-blvd', name: 'Abilene', slug: 'abilene-2438',
      anytimeUrl: 'https://www.anytimemailbox.com/s/abilene-2438-industrial-blvd', state: 'TX', city: 'Abilene',
      street: '2438 Industrial Blvd', zip: '79605', rdi: 'Residential', cmra: 'No', uspsCmra: 'N', mailboxMin: 100, mailboxMax: 450, isVisible: 1,
    },
    {
      source: 'ipostal1', sourceId: '2803', name: 'Dallas - 1910 Pacific Ave', slug: 'dallas-1910',
      anytimeUrl: 'https://ipostal1.com/secure_checkout.php?stID=2803', state: 'TX', city: 'Dallas',
      street: '1910 Pacific Ave Suite 2000', zip: '75201', rdi: 'Commercial', cmra: 'Yes', uspsCmra: null, mailboxMin: null, mailboxMax: null, isVisible: 1,
    },
    {
      source: 'anytimemailbox', sourceId: 'austin-10900-research-blvd', name: 'Austin', slug: 'austin-10900',
      anytimeUrl: 'https://www.anytimemailbox.com/s/austin-10900-research-blvd', state: 'TX', city: 'Austin',
      street: '10900 Research Blvd Ste 160C', zip: '78759', rdi: 'Commercial', cmra: 'No', uspsCmra: null, mailboxMin: null, mailboxMax: null, isVisible: 1,
    },
    {
      source: 'anytimemailbox', sourceId: 'austin-13359-n-hwy-183', name: 'Austin', slug: 'austin-13359',
      anytimeUrl: 'https://www.anytimemailbox.com/s/austin-13359-n-hwy-183', state: 'TX', city: 'Austin',
      street: '13359 N Highway 183', zip: '78750', rdi: 'Residential', cmra: 'No', uspsCmra: null, mailboxMin: null, mailboxMax: null, isVisible: 1,
    },
    {
      source: 'anytimemailbox', sourceId: 'hidden-row', name: 'Hidden', slug: 'hidden',
      anytimeUrl: 'https://www.anytimemailbox.com/s/hidden-row', state: 'TX', city: 'Austin',
      street: '1 Hidden Rd', zip: '78701', rdi: 'Residential', cmra: 'No', uspsCmra: null, mailboxMin: null, mailboxMax: null, isVisible: 0,
    },
  ];
  for (const row of rows) insert.run(row);

  const service = new ExtensionLookupService(database, resolveServerConfig(testEnv));
  return { service, database };
}

test('service matches by source id, normalized key and loose text', () => {
  const { service } = buildService();

  const bySourceId = service.lookup([{ ref: 'a', platform: 'ipostal1', sourceId: '2803' }]).results[0]!;
  assert.equal(bySourceId.address?.source, 'ipostal1');
  assert.equal(bySourceId.address?.matchedBy, 'sourceId');
  assert.equal(bySourceId.address?.rdi, 'Commercial');

  // iPostal1 页面上与 ATMB 同址的地址没有 ipostal1 行，要能回落到 ATMB 行
  const byKey = service.lookup([
    { ref: 'b', platform: 'ipostal1', sourceId: '99999', street: '2438 Industrial Blvd', city: 'Abilene', state: 'TX', postalCode: '79605' },
  ]).results[0]!;
  assert.equal(byKey.address?.source, 'anytimemailbox');
  assert.equal(byKey.address?.matchedBy, 'key');
  assert.deepEqual([byKey.address?.mailboxMin, byKey.address?.mailboxMax], [100, 450]);

  // ATMB 城市落地页 / iPostal1 选套餐页只有一行文本
  const loose = service.lookup([
    { ref: 'c', platform: 'ipostal1', text: 'Your Mailbox Location 1910 Pacific Ave, Suite 2000 Dallas, TX 75201 United States' },
  ]).results[0]!;
  assert.equal(loose.address?.id, bySourceId.address?.id);
  assert.equal(loose.address?.matchedBy, 'loose');

  // 页面省略了套房号、或把 Highway 写成 Hwy，也要能宽松命中
  const noSuite = service.lookup([{ ref: 'c2', platform: 'anytimemailbox', text: '10900 Research Blvd. Austin, TX 78759' }]).results[0]!;
  assert.equal(noSuite.address?.streetAddress, '10900 Research Blvd Ste 160C');
  const abbreviated = service.lookup([{ ref: 'c3', platform: 'anytimemailbox', text: '13359 N Hwy 183, Austin, TX 78750' }]).results[0]!;
  assert.equal(abbreviated.address?.streetAddress, '13359 N Highway 183');

  const miss = service.lookup([{ ref: 'd', platform: 'anytimemailbox', text: '999 Nowhere St Dallas, TX 75201' }]).results[0]!;
  assert.equal(miss.address, null);
  assert.deepEqual(miss.blacklist, []);

  const hidden = service.lookup([{ ref: 'e', platform: 'anytimemailbox', sourceId: 'hidden-row' }]).results[0]!;
  assert.equal(hidden.address, null);
});

test('service rate limit allows 60 requests per minute per ip', () => {
  const { service } = buildService();
  const start = 1_000_000;
  for (let i = 0; i < 60; i += 1) {
    assert.equal(service.consumeRateLimit('198.51.100.1', start + i), true);
  }
  assert.equal(service.consumeRateLimit('198.51.100.1', start + 61), false);
  assert.equal(service.consumeRateLimit('198.51.100.2', start + 61), true);
  assert.equal(service.consumeRateLimit('198.51.100.1', start + 60_000), true);
});

test('public lookup route validates input and returns blacklist marks without login', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const addresses = await app.inject({ method: 'GET', url: '/api/admin/addresses?pageSize=50', headers: { cookie } });
  // 种子里有一条中文占位街道，归一化后为空，挑一条真实格式的
  const local = addresses.json().items.find((item: { streetAddress: string }) => /^\d+ /.test(item.streetAddress));
  assert.ok(local, 'expected seeded demo address');

  const before = await lookup(app, [
    { ref: 'x', platform: 'anytimemailbox', street: local.streetAddress, city: local.city, state: local.state, postalCode: local.postalCode },
  ]);
  assert.equal(before.statusCode, 200);
  assert.equal(before.headers['cache-control'], 'no-store');
  assert.equal(before.json().results[0].address.id, local.id);
  assert.deepEqual(before.json().results[0].blacklist, []);

  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/blacklist',
    headers: { cookie },
    payload: {
      streetAddress: local.streetAddress,
      city: local.city,
      state: local.state,
      postalCode: local.postalCode,
      reason: '开户被拒',
      sourceUrl: 'https://example.com/report',
    },
  });
  assert.equal(created.statusCode, 201);
  const entry = created.json().item;
  const marked = await app.inject({
    method: 'POST',
    url: `/api/admin/blacklist/${entry.id}/marks`,
    headers: { cookie },
    payload: { addressId: local.id },
  });
  assert.equal(marked.statusCode, 204);

  const after = await lookup(app, [
    { ref: 'x', platform: 'anytimemailbox', street: local.streetAddress, city: local.city, state: local.state, postalCode: local.postalCode },
    { ref: 'unrecorded-but-blacklisted', platform: 'ipostal1', text: `${local.streetAddress} ${local.city}, ${local.state} ${local.postalCode}` },
  ]);
  assert.equal(after.statusCode, 200);
  const [first, second] = after.json().results;
  assert.equal(first.blacklist.length, 1);
  assert.equal(first.blacklist[0].id, entry.id);
  assert.equal(first.blacklist[0].reason, '开户被拒');
  assert.equal(second.blacklist[0].id, entry.id);

  const tooMany = await lookup(app, Array.from({ length: 501 }, (_, i) => ({ ref: String(i), platform: 'anytimemailbox', text: 'x' })));
  assert.equal(tooMany.statusCode, 400);
  const empty = await lookup(app, []);
  assert.equal(empty.statusCode, 400);
  const badPlatform = await lookup(app, [{ ref: 'p', platform: 'other', text: 'x' }]);
  assert.equal(badPlatform.statusCode, 400);
});

test('public lookup route returns 429 after 60 requests in a minute', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  let last = 0;
  for (let i = 0; i < 61; i += 1) {
    const response = await lookup(app, [{ ref: 'r', platform: 'anytimemailbox', text: '1 Main St Austin, TX 78701' }], '203.0.113.77');
    last = response.statusCode;
  }
  assert.equal(last, 429);
});
