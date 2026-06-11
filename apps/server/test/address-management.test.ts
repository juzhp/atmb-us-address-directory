import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import { createServer } from '../src/server.ts';

const testEnv = {
  NODE_ENV: 'test',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'secret123',
  ADMIN_DISPLAY_NAME: '测试管理员',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  WEB_ORIGIN: 'http://localhost:3000',
};

async function buildTestServer(databaseUrl = ':memory:') {
  const uploadDir = join(process.cwd(), '.runtime', 'test-address-images');
  rmSync(uploadDir, { force: true, recursive: true });

  const app = await createServer({
    databaseUrl,
    env: {
      ...testEnv,
      ADDRESS_IMAGE_UPLOAD_DIR: uploadDir,
      ADDRESS_IMAGE_PUBLIC_BASE: '/uploads/address-images',
    },
    logger: false,
  });

  await app.ready();
  return { app, uploadDir };
}

async function loginCookie(app: Awaited<ReturnType<typeof createServer>>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: {
      username: 'admin',
      password: 'secret123',
    },
  });

  const setCookie = response.headers['set-cookie'];
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(header, 'expected login to set session cookie');
  return header.split(';')[0] ?? '';
}

test('protects address management endpoints', async (t) => {
  const { app } = await buildTestServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses',
  });

  assert.equal(response.statusCode, 401);
});

test('allows admin address CORS preflight methods', async (t) => {
  const { app } = await buildTestServer();
  t.after(() => app.close());

  for (const method of ['PATCH', 'DELETE']) {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/admin/addresses/1/images',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': method,
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.match(String(response.headers['access-control-allow-methods']), new RegExp(`\\b${method}\\b`));
  }
});

test('lists addresses with filters, pagination and stats', async (t) => {
  const { app } = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses?state=AL&rdi=Residential&cmra=No&featured=true&price=lt20&page=1&pageSize=2',
    headers: { cookie },
  });

  assert.equal(listResponse.statusCode, 200);
  const body = listResponse.json();
  assert.equal(body.items.length, 2);
  assert.equal(body.page, 1);
  assert.equal(body.pageSize, 2);
  assert.ok(body.total >= 2);
  assert.ok(body.items.every((item: { state: string; rdi: string; cmra: string; isFeatured: boolean; priceCents: number }) => (
    item.state === 'AL'
    && item.rdi === 'Residential'
    && item.cmra === 'No'
    && item.isFeatured
    && item.priceCents < 2000
  )));

  const keywordResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses?keyword=Phoenix&price=lt10',
    headers: { cookie },
  });

  assert.equal(keywordResponse.statusCode, 200);
  assert.equal(keywordResponse.json().items[0].city, 'Phoenix');

  const noneFilterResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses?rdi=none&cmra=none',
    headers: { cookie },
  });

  assert.equal(noneFilterResponse.statusCode, 200);
  assert.deepEqual(noneFilterResponse.json().items, []);

  const statsResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses/stats',
    headers: { cookie },
  });

  assert.equal(statsResponse.statusCode, 200);
  assert.deepEqual(Object.keys(statsResponse.json()).sort(), [
    'activeAddresses',
    'residentialAddresses',
    'todayAdded',
    'todayRemoved',
    'totalAddresses',
  ]);
});

test('lists discovered addresses that do not have RDI and CMRA yet', async (t) => {
  const databaseUrl = join(process.cwd(), `.address-discovered-${Date.now()}.sqlite`);
  rmSync(databaseUrl, { force: true });
  const { app } = await buildTestServer(databaseUrl);
  t.after(async () => {
    await app.close();
    rmSync(databaseUrl, { force: true });
  });
  const cookie = await loginCookie(app);
  const sqlite = new Database(databaseUrl);
  const now = '2026-06-08T00:00:00.000Z';

  try {
    sqlite
      .prepare(`
        INSERT INTO crawl_tasks (
          id, batch_code, generated_at, created_type, status, note, created_by,
          pending_count, success_count, failed_count, total_count, created_at, updated_at
        ) VALUES (
          100, 'TASK-DISCOVERED', @now, 'manual', 'completed', NULL, 'test',
          0, 0, 0, 0, @now, @now
        )
      `)
      .run({ now });
    sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, crawl_status, created_at, updated_at
        ) VALUES (
          100, 'anytimemailbox', 'stage-1', 'Washington', 'WA', 'https://example.test/washington', 1,
          'Vancouver - Hwy 99', 'vancouver-hwy-99',
          'https://www.anytimemailbox.com/s/vancouver-7720-ne-hwy-99-ste-d',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=12345',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=12345',
          'United States', 'Vancouver', '7720 NE Hwy 99 Ste D', '98665',
          '7720 NE Hwy 99 Ste D Vancouver, WA 98665 United States',
          '7720 ne hwy 99 ste d|vancouver|wa|98665',
          1499, 'USD', 'month', 'mailbox_fetched', @now, @now
        )
      `)
      .run({ now });
  } finally {
    sqlite.close();
  }

  const noneFilterResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses?keyword=Vancouver&rdi=none&cmra=none',
    headers: { cookie },
  });

  assert.equal(noneFilterResponse.statusCode, 200);
  const body = noneFilterResponse.json();
  assert.equal(body.total, 1);
  assert.equal(body.items[0].name, 'Vancouver - Hwy 99');
  assert.equal(body.items[0].rdi, null);
  assert.equal(body.items[0].cmra, null);
  assert.equal(body.items[0].recordSource, 'discovered');
  assert.equal(body.items[0].canEdit, false);
});

test('creates a Smarty sync task from selected discovered addresses', async (t) => {
  const databaseUrl = join(process.cwd(), `.address-smarty-sync-${Date.now()}.sqlite`);
  rmSync(databaseUrl, { force: true });
  const { app } = await buildTestServer(databaseUrl);
  t.after(async () => {
    await app.close();
    rmSync(databaseUrl, { force: true });
  });
  const cookie = await loginCookie(app);
  const now = '2026-06-08T00:00:00.000Z';
  let stageId = 0;
  const sqlite = new Database(databaseUrl);

  try {
    sqlite
      .prepare(`
        INSERT INTO crawl_tasks (
          id, batch_code, generated_at, created_type, status, note, created_by,
          pending_count, success_count, failed_count, total_count, created_at, updated_at
        ) VALUES (
          101, 'TASK-SMARTY-SOURCE', @now, 'manual', 'completed', NULL, 'test',
          0, 0, 0, 0, @now, @now
        )
      `)
      .run({ now });
    const result = sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
          crawl_status, created_at, updated_at
        ) VALUES (
          101, 'anytimemailbox', 'stage-sync-1', 'Washington', 'WA', 'https://example.test/washington', 1,
          'Vancouver - Hwy 99', 'vancouver-hwy-99',
          'https://www.anytimemailbox.com/s/vancouver-7720-ne-hwy-99-ste-d',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=12345',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=12345',
          'United States', 'Vancouver', '7720 NE Hwy 99 Ste D', '98665',
          '7720 NE Hwy 99 Ste D Vancouver, WA 98665 United States',
          '7720 ne hwy 99 ste d|vancouver|wa|98665',
          1499, 'USD', 'month', 1018, 1119, 2, '[1018,1119]',
          'mailbox_fetched', @now, @now
        )
      `)
      .run({ now });
    stageId = Number(result.lastInsertRowid);
  } finally {
    sqlite.close();
  }

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/addresses/smarty-sync-tasks',
    headers: { cookie },
    payload: {
      stageIds: [stageId],
    },
  });

  assert.equal(response.statusCode, 201);
  const task = response.json().item;
  assert.equal(task.totalCount, 1);

  const verifyDb = new Database(databaseUrl);
  try {
    const subtasks = verifyDb
      .prepare('SELECT task_type AS taskType FROM crawl_subtasks WHERE task_id = ? ORDER BY id ASC')
      .all(task.id) as Array<{ taskType: string }>;
    assert.deepEqual(subtasks.map((item) => item.taskType), ['sync_smarty']);

    const staged = verifyDb
      .prepare(`
        SELECT
          anytime_url AS anytimeUrl,
          mailbox_numbers_json AS mailboxNumbersJson,
          crawl_status AS crawlStatus,
          rdi,
          cmra
        FROM crawl_discovered_addresses
        WHERE task_id = ?
      `)
      .get(task.id) as {
        anytimeUrl: string;
        mailboxNumbersJson: string;
        crawlStatus: string;
        rdi: string | null;
        cmra: string | null;
      };
    assert.equal(staged.anytimeUrl, 'https://www.anytimemailbox.com/s/vancouver-7720-ne-hwy-99-ste-d');
    assert.equal(staged.mailboxNumbersJson, '[1018,1119]');
    assert.equal(staged.crawlStatus, 'mailbox_fetched');
    assert.equal(staged.rdi, null);
    assert.equal(staged.cmra, null);
  } finally {
    verifyDb.close();
  }
});

test('creates a Smarty sync task for discovered addresses without mailbox numbers', async (t) => {
  const databaseUrl = join(process.cwd(), `.address-smarty-sync-no-mailbox-${Date.now()}.sqlite`);
  rmSync(databaseUrl, { force: true });
  const { app } = await buildTestServer(databaseUrl);
  t.after(async () => {
    await app.close();
    rmSync(databaseUrl, { force: true });
  });
  const cookie = await loginCookie(app);
  const now = '2026-06-08T00:00:00.000Z';
  let stageId = 0;
  const sqlite = new Database(databaseUrl);

  try {
    sqlite
      .prepare(`
        INSERT INTO crawl_tasks (
          id, batch_code, generated_at, created_type, status, note, created_by,
          pending_count, success_count, failed_count, total_count, created_at, updated_at
        ) VALUES (
          102, 'TASK-SMARTY-NO-MAILBOX', @now, 'manual', 'completed', NULL, 'test',
          0, 0, 0, 0, @now, @now
        )
      `)
      .run({ now });
    const result = sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, crawl_status, created_at, updated_at
        ) VALUES (
          102, 'anytimemailbox', 'stage-no-mailbox', 'Texas', 'TX', 'https://example.test/texas', 1,
          'Katy - Highland Knolls Dr', 'katy-highland-knolls-dr',
          'https://www.anytimemailbox.com/s/katy-highland-knolls-dr',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=23456',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=23456',
          'United States', 'Katy', '22206 Highland Knolls Dr', '77450',
          '22206 Highland Knolls Dr Katy, TX 77450 United States',
          '22206 highland knolls dr|katy|tx|77450',
          1999, 'USD', 'month', 'smarty_pending', @now, @now
        )
      `)
      .run({ now });
    stageId = Number(result.lastInsertRowid);
  } finally {
    sqlite.close();
  }

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/addresses/smarty-sync-tasks',
    headers: { cookie },
    payload: {
      stageIds: [stageId],
    },
  });

  assert.equal(response.statusCode, 201);
  const task = response.json().item;
  assert.equal(task.totalCount, 1);
});

test('creates a mailbox update task from selected discovered addresses', async (t) => {
  const databaseUrl = join(process.cwd(), `.address-mailbox-stage-${Date.now()}.sqlite`);
  rmSync(databaseUrl, { force: true });
  const { app } = await buildTestServer(databaseUrl);
  t.after(async () => {
    await app.close();
    rmSync(databaseUrl, { force: true });
  });
  const cookie = await loginCookie(app);
  const now = '2026-06-08T00:00:00.000Z';
  let stageId = 0;
  const sqlite = new Database(databaseUrl);

  try {
    sqlite
      .prepare(`
        INSERT INTO crawl_tasks (
          id, batch_code, generated_at, created_type, status, note, created_by,
          pending_count, success_count, failed_count, total_count, created_at, updated_at
        ) VALUES (
          103, 'TASK-MAILBOX-STAGE', @now, 'manual', 'completed', NULL, 'test',
          0, 0, 0, 0, @now, @now
        )
      `)
      .run({ now });
    const result = sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, crawl_status, created_at, updated_at
        ) VALUES (
          103, 'anytimemailbox', 'stage-mailbox-1', 'Texas', 'TX', 'https://example.test/texas', 1,
          'Austin - Research Blvd', 'austin-research-blvd',
          'https://www.anytimemailbox.com/s/austin-research-blvd',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=34567',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=34567',
          'United States', 'Austin', '12345 Research Blvd', '78759',
          '12345 Research Blvd Austin, TX 78759 United States',
          '12345 research blvd|austin|tx|78759',
          1999, 'USD', 'month', 'smarty_pending', @now, @now
        )
      `)
      .run({ now });
    stageId = Number(result.lastInsertRowid);
  } finally {
    sqlite.close();
  }

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/addresses/mailbox-update-tasks',
    headers: { cookie },
    payload: {
      stageIds: [stageId],
    },
  });

  assert.equal(response.statusCode, 201);
  const task = response.json().item;
  assert.equal(task.totalCount, 2);

  const verifyDb = new Database(databaseUrl);
  try {
    const subtasks = verifyDb
      .prepare('SELECT task_type AS taskType FROM crawl_subtasks WHERE task_id = ? ORDER BY id ASC')
      .all(task.id) as Array<{ taskType: string }>;
    assert.deepEqual(subtasks.map((item) => item.taskType), ['fetch_addresses', 'fetch_mailbox_numbers']);

    const staged = verifyDb
      .prepare(`
        SELECT
          anytime_url AS anytimeUrl,
          imported_address_id AS importedAddressId,
          mailbox_numbers_json AS mailboxNumbersJson,
          crawl_status AS crawlStatus
        FROM crawl_discovered_addresses
        WHERE task_id = ?
      `)
      .get(task.id) as {
        anytimeUrl: string;
        importedAddressId: number | null;
        mailboxNumbersJson: string | null;
        crawlStatus: string;
      };
    assert.equal(staged.anytimeUrl, 'https://www.anytimemailbox.com/s/austin-research-blvd');
    assert.equal(staged.importedAddressId, null);
    assert.equal(staged.mailboxNumbersJson, null);
    assert.equal(staged.crawlStatus, 'discovered');
  } finally {
    verifyDb.close();
  }
});

test('updates editable address fields without changing mailbox range', async (t) => {
  const { app } = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses?keyword=Madison',
    headers: { cookie },
  });
  const address = listResponse.json().items[0];

  const updateResponse = await app.inject({
    method: 'PATCH',
    url: `/api/admin/addresses/${address.id}`,
    headers: { cookie },
    payload: {
      name: 'Madison, AL 35758 - Featured',
      streetAddress: '7169 Hwy 72 W Ste A',
      city: 'Madison',
      state: 'AL',
      postalCode: '35758',
      rdi: 'Residential',
      cmra: 'No',
      priceCents: 1899,
      isFeatured: false,
      isVisible: true,
      statusNote: '手动校准',
      googleMapsUrl: 'https://maps.google.com/?q=should-not-be-saved',
      mailboxMin: 1,
      mailboxMax: 2,
    },
  });

  assert.equal(updateResponse.statusCode, 200);
  const updated = updateResponse.json().item;
  assert.equal(updated.name, 'Madison, AL 35758 - Featured');
  assert.equal(updated.priceCents, 1899);
  assert.equal(updated.isFeatured, false);
  assert.equal(updated.googleMapsUrl, address.googleMapsUrl);
  assert.equal(updated.mailboxMin, address.mailboxMin);
  assert.equal(updated.mailboxMax, address.mailboxMax);

  const invalidResponse = await app.inject({
    method: 'PATCH',
    url: `/api/admin/addresses/${address.id}`,
    headers: { cookie },
    payload: {
      rdi: 'Unknown',
      cmra: 'Unknown',
    },
  });

  assert.equal(invalidResponse.statusCode, 400);
});

test('records only price changes for admin address edits', async (t) => {
  const databaseUrl = join(process.cwd(), `.address-events-${Date.now()}.sqlite`);
  rmSync(databaseUrl, { force: true });
  const { app } = await buildTestServer(databaseUrl);
  t.after(async () => {
    await app.close();
    rmSync(databaseUrl, { force: true });
  });
  const cookie = await loginCookie(app);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses?keyword=Madison',
    headers: { cookie },
  });
  const address = listResponse.json().items[0];

  const updateResponse = await app.inject({
    method: 'PATCH',
    url: `/api/admin/addresses/${address.id}`,
    headers: { cookie },
    payload: {
      priceCents: 2099,
      rdi: 'Commercial',
      cmra: 'Yes',
      isFeatured: false,
      isVisible: false,
    },
  });

  assert.equal(updateResponse.statusCode, 200);

  const sqlite = new Database(databaseUrl, { readonly: true });
  const editedEvents = sqlite
    .prepare(`
      SELECT event_type AS eventType, COUNT(*) AS count
      FROM address_events
      WHERE event_type != 'added'
      GROUP BY event_type
      ORDER BY event_type
    `)
    .all();
  sqlite.close();

  assert.deepEqual(editedEvents, [
    {
      eventType: 'price_changed',
      count: 1,
    },
  ]);
});

test('uploads a street view image with a random static file name', async (t) => {
  const { app, uploadDir } = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/addresses?keyword=Madison',
    headers: { cookie },
  });
  const address = listResponse.json().items[0];
  const boundary = '----atmb-test-boundary';
  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="street.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await app.inject({
    method: 'POST',
    url: `/api/admin/addresses/${address.id}/images`,
    headers: {
      cookie,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  });

  assert.equal(response.statusCode, 200);
  const image = response.json().image;
  assert.match(image.fileName, /^[a-f0-9-]+\.png$/);
  assert.equal(image.publicUrl, `/uploads/address-images/${image.fileName}`);
  assert.ok(existsSync(join(uploadDir, image.fileName)));

  const detailWithImage = await app.inject({
    method: 'GET',
    url: `/api/admin/addresses/${address.id}`,
    headers: { cookie },
  });
  assert.equal(detailWithImage.json().item.imageUrl, image.publicUrl);

  const clearResponse = await app.inject({
    method: 'DELETE',
    url: `/api/admin/addresses/${address.id}/images`,
    headers: { cookie },
  });

  assert.equal(clearResponse.statusCode, 200);
  assert.equal(clearResponse.json().item.imageUrl, null);
  assert.equal(existsSync(join(uploadDir, image.fileName)), false);
});

test('changes admin password and supports the fixed referral redirect', async (t) => {
  const { app } = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const changeResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/change-password',
    headers: { cookie },
    payload: {
      currentPassword: 'secret123',
      newPassword: 'new-secret123',
    },
  });

  assert.equal(changeResponse.statusCode, 200);
  assert.deepEqual(changeResponse.json(), { ok: true });

  const oldLogin = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: { username: 'admin', password: 'secret123' },
  });
  assert.equal(oldLogin.statusCode, 401);

  const newLogin = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: { username: 'admin', password: 'new-secret123' },
  });
  assert.equal(newLogin.statusCode, 200);

  const redirectResponse = await app.inject({
    method: 'GET',
    url: '/go/get-us-residential-address',
  });
  assert.equal(redirectResponse.statusCode, 302);
  assert.equal(
    redirectResponse.headers.location,
    'https://anytimemailbox.referralrock.com/l/1RENHONGLIU21/',
  );
  const referralCookie = redirectResponse.headers['set-cookie'];
  const referralCookieHeader = Array.isArray(referralCookie) ? referralCookie[0] : referralCookie;
  assert.match(referralCookieHeader ?? '', /atmb_referral_visited=1/);
  assert.match(referralCookieHeader ?? '', /Max-Age=2592000/);
});
