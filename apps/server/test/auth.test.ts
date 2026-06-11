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

async function buildTestServer() {
  const app = await createServer({
    databaseUrl: ':memory:',
    env: testEnv,
    logger: false,
  });

  await app.ready();
  return app;
}

function cookieHeader(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.ok(header, 'expected login response to set a session cookie');
  return header.split(';')[0] ?? '';
}

test('seeds the default admin user when the database is empty', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: {
      username: 'admin',
      password: 'secret123',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    user: {
      id: 1,
      username: 'admin',
      displayName: '测试管理员',
    },
  });
});

test('logs in and reads the current admin user from the session', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: {
      username: 'admin',
      password: 'secret123',
    },
  });

  assert.equal(loginResponse.statusCode, 200);
  assert.match(cookieHeader(loginResponse.headers['set-cookie']), /^atmb_admin_sid=/);

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/me',
    headers: {
      cookie: cookieHeader(loginResponse.headers['set-cookie']),
    },
  });

  assert.equal(meResponse.statusCode, 200);
  assert.deepEqual(meResponse.json(), {
    user: {
      id: 1,
      username: 'admin',
      displayName: '测试管理员',
    },
  });
});

test('rejects an invalid password with a generic error message', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: {
      username: 'admin',
      password: 'wrong-password',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    message: '账号或密码错误',
  });
});

test('destroys the session on logout', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: {
      username: 'admin',
      password: 'secret123',
    },
  });

  const sessionCookie = cookieHeader(loginResponse.headers['set-cookie']);

  const logoutResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/logout',
    headers: {
      cookie: sessionCookie,
    },
  });

  assert.equal(logoutResponse.statusCode, 200);
  assert.deepEqual(logoutResponse.json(), { ok: true });

  const meResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/auth/me',
    headers: {
      cookie: sessionCookie,
    },
  });

  assert.equal(meResponse.statusCode, 401);
});
