import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
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

async function buildTestServer(options: {
  databaseUrl?: string;
  smartyClient?: {
    testConnection: (credentials: { authId: string; authToken: string }) => Promise<{ ok: boolean; message?: string }>;
  };
} = {}) {
  const app = await createServer({
    databaseUrl: options.databaseUrl ?? ':memory:',
    env: testEnv,
    logger: false,
    smartyClient: options.smartyClient,
  });

  await app.ready();
  return app;
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

test('protects system settings endpoints', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/settings',
  });

  assert.equal(response.statusCode, 401);
});

test('returns default system settings safely', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const response = await app.inject({
    method: 'GET',
    url: '/api/admin/settings',
    headers: { cookie },
  });

  assert.equal(response.statusCode, 200);
  const { settings } = response.json();
  assert.equal(settings.smartyAuthId, '');
  assert.equal(settings.hasSmartyAuthToken, false);
  assert.equal(settings.smartyConnectionStatus, 'not_configured');
  assert.equal(settings.autoUpdateEnabled, true);
  assert.equal(settings.updateFrequencyDays, 1);
  assert.equal(settings.updateHour, 8);
  assert.equal(settings.updateMinute, 30);
  assert.equal(settings.headCode, '');
  assert.equal('smartyAuthToken' in settings, false);
});

test('saves Smarty settings without returning or storing plaintext token', async (t) => {
  const databaseUrl = join(process.cwd(), '.runtime', 'test-system-settings.sqlite');
  rmSync(databaseUrl, { force: true });
  const app = await buildTestServer({ databaseUrl });
  let sqlite: Database.Database | null = null;
  t.after(async () => {
    sqlite?.close();
    await app.close();
    rmSync(databaseUrl, { force: true });
  });
  const cookie = await loginCookie(app);

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/admin/settings/smarty',
    headers: { cookie },
    payload: {
      authId: 'smarty-auth-id',
      authToken: 'smarty-secret-token',
      remainingCredits: 18420,
      monthlyUsed: 3716,
    },
  });

  assert.equal(response.statusCode, 200);
  const { settings } = response.json();
  assert.equal(settings.smartyAuthId, 'smarty-auth-id');
  assert.equal(settings.hasSmartyAuthToken, true);
  assert.equal(settings.smartyRemainingCredits, 18420);
  assert.equal(settings.smartyMonthlyUsed, 3716);
  assert.equal('smartyAuthToken' in settings, false);

  sqlite = new Database(databaseUrl);
  const row = sqlite
    .prepare('SELECT smarty_auth_token_encrypted AS token FROM system_settings WHERE id = 1')
    .get() as { token: string };
  assert.notEqual(row.token, 'smarty-secret-token');
  assert.match(row.token, /^v1:/);
});

test('tests Smarty connection and records success or failure', async (t) => {
  const app = await buildTestServer({
    smartyClient: {
      async testConnection(credentials) {
        assert.equal(credentials.authId, 'smarty-auth-id');
        assert.equal(credentials.authToken, 'smarty-secret-token');
        return { ok: true };
      },
    },
  });
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  await app.inject({
    method: 'PATCH',
    url: '/api/admin/settings/smarty',
    headers: { cookie },
    payload: {
      authId: 'smarty-auth-id',
      authToken: 'smarty-secret-token',
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/settings/smarty/test',
    headers: { cookie },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().settings.smartyConnectionStatus, 'connected');
  assert.ok(response.json().settings.smartyLastTestedAt);
});

test('validates update schedule and saves head code', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const invalidSchedule = await app.inject({
    method: 'PATCH',
    url: '/api/admin/settings/update-schedule',
    headers: { cookie },
    payload: {
      autoUpdateEnabled: true,
      updateFrequencyDays: 7,
      updateHour: 8,
      updateMinute: 15,
    },
  });
  assert.equal(invalidSchedule.statusCode, 400);

  const scheduleResponse = await app.inject({
    method: 'PATCH',
    url: '/api/admin/settings/update-schedule',
    headers: { cookie },
    payload: {
      autoUpdateEnabled: false,
      updateFrequencyDays: null,
      updateHour: 23,
      updateMinute: 30,
    },
  });
  assert.equal(scheduleResponse.statusCode, 200);
  assert.equal(scheduleResponse.json().settings.autoUpdateEnabled, false);
  assert.equal(scheduleResponse.json().settings.updateFrequencyDays, null);
  assert.equal(scheduleResponse.json().settings.nextRunAt, null);

  const headResponse = await app.inject({
    method: 'PATCH',
    url: '/api/admin/settings/head-code',
    headers: { cookie },
    payload: {
      headCode: '<meta name="theme-color" content="#057f93">\n<script>alert("x")</script>',
    },
  });
  assert.equal(headResponse.statusCode, 200);
  assert.match(headResponse.json().settings.headCode, /theme-color/);

  const checkResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/settings/head-code/check',
    headers: { cookie },
    payload: {
      headCode: '<meta name="theme-color" content="#057f93">\n<script>alert("x")</script>',
    },
  });
  assert.equal(checkResponse.statusCode, 200);
  assert.deepEqual(checkResponse.json(), {
    lineCount: 2,
    characterCount: 71,
    warnings: [],
  });
});
