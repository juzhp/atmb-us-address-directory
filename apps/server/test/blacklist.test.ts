import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createServer } from '../src/server.ts';

const testEnv = {
  NODE_ENV: 'test',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'secret123',
  ADMIN_DISPLAY_NAME: '测试管理员',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  WEB_ORIGIN: 'http://localhost:3000',
};

const submission = {
  streetAddress: '123 Main St, Suite 5',
  city: 'Los Angeles',
  state: 'CA',
  postalCode: '90001',
  reason: '申请 Capital One 信用卡时被识别为 CMRA 地址拒绝',
  sourceUrl: 'https://example.com/report',
};

async function buildTestServer() {
  const app = await createServer({
    databaseUrl: ':memory:',
    env: testEnv,
    logger: false,
  });

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
  assert.ok(header, 'expected login to set session cookie');
  return header.split(';')[0] ?? '';
}

function submit(app: Awaited<ReturnType<typeof createServer>>, payload: Record<string, unknown>, ip = '198.51.100.7') {
  return app.inject({
    method: 'POST',
    url: '/api/public/blacklist/submissions',
    headers: { 'x-forwarded-for': ip },
    payload,
  });
}

test('visitor submission is stored as pending and visible to admins only', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const response = await submit(app, submission);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { ok: true });

  const cookie = await loginCookie(app);
  const list = await app.inject({ method: 'GET', url: '/api/admin/blacklist?status=pending', headers: { cookie } });
  assert.equal(list.statusCode, 200);
  const body = list.json();
  assert.equal(body.total, 1);
  assert.equal(body.pendingCount, 1);
  assert.equal(body.items[0].status, 'pending');
  assert.equal(body.items[0].submittedBy, 'visitor');
  assert.equal(body.items[0].state, 'CA');
  assert.equal(body.items[0].reviewedBy, null);

  const approved = await app.inject({ method: 'GET', url: '/api/admin/blacklist?status=approved', headers: { cookie } });
  assert.equal(approved.json().total, 0);
});

test('visitor submission validates fields and the honeypot', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const honeypot = await submit(app, { ...submission, website: 'http://spam.example' });
  assert.equal(honeypot.statusCode, 400);

  const badState = await submit(app, { ...submission, state: 'XX' });
  assert.equal(badState.statusCode, 400);
  assert.match(badState.json().message, /州/);

  const badZip = await submit(app, { ...submission, postalCode: '9000' });
  assert.equal(badZip.statusCode, 400);
  assert.match(badZip.json().message, /ZIP/);

  const longReason = await submit(app, { ...submission, reason: 'a'.repeat(501) });
  assert.equal(longReason.statusCode, 400);
  assert.match(longReason.json().message, /500/);

  const emptyReason = await submit(app, { ...submission, reason: '   ' });
  assert.equal(emptyReason.statusCode, 400);

  const badUrl = await submit(app, { ...submission, sourceUrl: 'ftp://example.com' });
  assert.equal(badUrl.statusCode, 400);

  const noUrl = await submit(app, { ...submission, sourceUrl: '' });
  assert.equal(noUrl.statusCode, 201);
});

test('visitor submissions are rate limited per ip and deduplicated per ip', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  for (let index = 0; index < 5; index += 1) {
    const response = await submit(app, { ...submission, streetAddress: `${index + 1} Elm St` });
    assert.equal(response.statusCode, 201, `submission ${index + 1} should succeed`);
  }

  const sixth = await submit(app, { ...submission, streetAddress: '6 Elm St' });
  assert.equal(sixth.statusCode, 429);

  const otherIp = await submit(app, { ...submission, streetAddress: '1 Elm St' }, '203.0.113.9');
  assert.equal(otherIp.statusCode, 201, 'same address from another ip is allowed');

  const duplicate = await submit(app, { ...submission, streetAddress: '1 Elm St' }, '203.0.113.9');
  assert.equal(duplicate.statusCode, 409);
});

test('admin blacklist endpoints require login', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const list = await app.inject({ method: 'GET', url: '/api/admin/blacklist' });
  assert.equal(list.statusCode, 401);

  const create = await app.inject({ method: 'POST', url: '/api/admin/blacklist', payload: submission });
  assert.equal(create.statusCode, 401);
});

test('admin can create approved entries, review, edit and delete', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const created = await app.inject({
    method: 'POST',
    url: '/api/admin/blacklist',
    headers: { cookie },
    payload: { ...submission, state: 'ca', sourceUrl: '' },
  });
  assert.equal(created.statusCode, 201);
  const createdItem = created.json().item;
  assert.equal(createdItem.status, 'approved');
  assert.equal(createdItem.submittedBy, 'admin');
  assert.equal(createdItem.reviewedBy, 'admin');
  assert.equal(createdItem.state, 'CA');
  assert.equal(createdItem.sourceUrl, null);

  await submit(app, submission);
  const pending = await app.inject({ method: 'GET', url: '/api/admin/blacklist?status=pending', headers: { cookie } });
  const pendingItem = pending.json().items[0];

  const rejected = await app.inject({
    method: 'PATCH',
    url: `/api/admin/blacklist/${pendingItem.id}`,
    headers: { cookie },
    payload: { status: 'rejected', reviewNote: '信息不足' },
  });
  assert.equal(rejected.statusCode, 200);
  assert.equal(rejected.json().item.status, 'rejected');
  assert.equal(rejected.json().item.reviewNote, '信息不足');
  assert.equal(rejected.json().item.reviewedBy, 'admin');
  assert.ok(rejected.json().item.reviewedAt);

  const approved = await app.inject({
    method: 'PATCH',
    url: `/api/admin/blacklist/${pendingItem.id}`,
    headers: { cookie },
    payload: { status: 'approved', city: 'Pasadena' },
  });
  assert.equal(approved.statusCode, 200);
  assert.equal(approved.json().item.status, 'approved');
  assert.equal(approved.json().item.city, 'Pasadena');

  const all = await app.inject({ method: 'GET', url: '/api/admin/blacklist?status=all&q=pasadena', headers: { cookie } });
  assert.equal(all.json().total, 1);

  const emptyPatch = await app.inject({
    method: 'PATCH',
    url: `/api/admin/blacklist/${pendingItem.id}`,
    headers: { cookie },
    payload: {},
  });
  assert.equal(emptyPatch.statusCode, 400);

  const removed = await app.inject({ method: 'DELETE', url: `/api/admin/blacklist/${createdItem.id}`, headers: { cookie } });
  assert.equal(removed.statusCode, 204);

  const removedAgain = await app.inject({ method: 'DELETE', url: `/api/admin/blacklist/${createdItem.id}`, headers: { cookie } });
  assert.equal(removedAgain.statusCode, 404);
});
