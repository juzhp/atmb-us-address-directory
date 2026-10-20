import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDatabase, ensureDatabaseSchema } from '@atmb/db';

import { resolveServerConfig } from '../src/auth/config.ts';
import { createServer } from '../src/server.ts';
import { SettingsService } from '../src/settings/service.ts';
import { TaskScheduler } from '../src/tasks/scheduler.ts';
import { TaskService } from '../src/tasks/service.ts';

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

test('protects task management endpoints', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());

  for (const request of [
    { method: 'GET', url: '/api/admin/tasks' },
    { method: 'GET', url: '/api/admin/tasks/stats' },
    { method: 'POST', url: '/api/admin/tasks' },
    { method: 'GET', url: '/api/admin/tasks/1/subtasks' },
    { method: 'POST', url: '/api/admin/tasks/1/pause' },
    { method: 'POST', url: '/api/admin/tasks/1/resume' },
    { method: 'POST', url: '/api/admin/tasks/1/stop' },
    { method: 'DELETE', url: '/api/admin/tasks/1' },
  ] as const) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401);
  }
});

test('lists task batches with filters, pagination and stats', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/tasks?keyword=自动&createdType=system&status=completed&page=1&pageSize=2',
    headers: { cookie },
  });

  assert.equal(listResponse.statusCode, 200);
  const body = listResponse.json();
  assert.equal(body.page, 1);
  assert.equal(body.pageSize, 2);
  assert.ok(body.total >= 1);
  assert.ok(body.items.every((item: { createdType: string; status: string }) => (
    item.createdType === 'system' && item.status === 'completed'
  )));

  const date = String(body.items[0].generatedAt).slice(0, 10);
  const dateResponse = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks?generatedDate=${date}`,
    headers: { cookie },
  });

  assert.equal(dateResponse.statusCode, 200);
  assert.ok(dateResponse.json().items.length >= 1);

  const statsResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/tasks/stats',
    headers: { cookie },
  });

  assert.equal(statsResponse.statusCode, 200);
  assert.deepEqual(Object.keys(statsResponse.json()).sort(), [
    'completedTasks',
    'failedSubtasks',
    'runningTasks',
    'totalTasks',
  ]);
});

test('creates a manual task batch with five pending subtasks', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks',
    headers: { cookie },
    payload: {
      note: '手动测试任务',
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json().item;
  assert.match(created.batchCode, /^TASK-/);
  assert.equal(created.createdType, 'manual');
  assert.equal(created.createdBy, '测试管理员');
  assert.equal(created.status, 'running');
  assert.equal(created.pendingCount, 5);
  assert.equal(created.successCount, 0);
  assert.equal(created.failedCount, 0);
  assert.equal(created.totalCount, 5);
  assert.equal(created.progress.taskType, 'fetch_states');

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/tasks?keyword=手动测试任务&createdType=manual&status=running',
    headers: { cookie },
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().items[0].id, created.id);
  assert.equal(listResponse.json().items[0].progress.taskType, 'fetch_states');

  const subtasksResponse = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${created.id}/subtasks?page=1&pageSize=2`,
    headers: { cookie },
  });

  assert.equal(subtasksResponse.statusCode, 200);
  const subtasksBody = subtasksResponse.json();
  assert.equal(subtasksBody.task.id, created.id);
  assert.equal(subtasksBody.items.length, 2);
  assert.equal(subtasksBody.total, 5);
  assert.ok(subtasksBody.items.every((item: { progress: unknown }) => item.progress));
  assert.ok(subtasksBody.items.every((item: { executionStatus: string; resultStatus: string | null }) => (
    item.executionStatus === 'pending' && item.resultStatus === null
  )));

  const conflictResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks',
    headers: { cookie },
    payload: {
      note: 'should be rejected while another task is running',
    },
  });

  assert.equal(conflictResponse.statusCode, 409);
});

test('controls a task batch with pause, resume and stop actions', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks',
    headers: { cookie },
    payload: {
      note: '控制测试任务',
    },
  });
  assert.equal(createResponse.statusCode, 201);
  const task = createResponse.json().item;

  const pauseResponse = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/${task.id}/pause`,
    headers: { cookie },
  });
  assert.equal(pauseResponse.statusCode, 200);
  assert.equal(pauseResponse.json().item.status, 'pause_requested');

  const resumeResponse = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/${task.id}/resume`,
    headers: { cookie },
  });
  assert.equal(resumeResponse.statusCode, 200);
  assert.equal(resumeResponse.json().item.status, 'running');

  const stopResponse = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/${task.id}/stop`,
    headers: { cookie },
  });
  assert.equal(stopResponse.statusCode, 200);
  assert.equal(stopResponse.json().item.status, 'stopped');

  const subtasksResponse = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${task.id}/subtasks`,
    headers: { cookie },
  });
  assert.equal(subtasksResponse.statusCode, 200);
  assert.ok(subtasksResponse.json().items.every((item: { resultStatus: string }) => item.resultStatus === 'stopped'));

  const stoppedResumeResponse = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/${task.id}/resume`,
    headers: { cookie },
  });
  assert.equal(stoppedResumeResponse.statusCode, 409);

  const completedListResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/tasks?status=completed&page=1&pageSize=1',
    headers: { cookie },
  });
  const completedTask = completedListResponse.json().items[0];
  const completedPauseResponse = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/${completedTask.id}/pause`,
    headers: { cookie },
  });
  assert.equal(completedPauseResponse.statusCode, 409);
});

test('deletes only completed or stopped task batches', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks',
    headers: { cookie },
    payload: {
      note: '待删除状态测试',
    },
  });
  assert.equal(createResponse.statusCode, 201);
  const runningTask = createResponse.json().item;

  const runningDeleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/admin/tasks/${runningTask.id}`,
    headers: { cookie },
  });
  assert.equal(runningDeleteResponse.statusCode, 409);

  const stopResponse = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/${runningTask.id}/stop`,
    headers: { cookie },
  });
  assert.equal(stopResponse.statusCode, 200);

  const stoppedDeleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/admin/tasks/${runningTask.id}`,
    headers: { cookie },
  });
  assert.equal(stoppedDeleteResponse.statusCode, 200);
  assert.deepEqual(stoppedDeleteResponse.json(), { ok: true });

  const stoppedSubtasks = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${runningTask.id}/subtasks`,
    headers: { cookie },
  });
  assert.equal(stoppedSubtasks.statusCode, 404);

  const completedListResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/tasks?status=completed&page=1&pageSize=1',
    headers: { cookie },
  });
  assert.equal(completedListResponse.statusCode, 200);
  const completedTask = completedListResponse.json().items[0];
  assert.ok(completedTask);

  const completedDeleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/admin/tasks/${completedTask.id}`,
    headers: { cookie },
  });
  assert.equal(completedDeleteResponse.statusCode, 200);

  const completedSubtasks = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${completedTask.id}/subtasks`,
    headers: { cookie },
  });
  assert.equal(completedSubtasks.statusCode, 404);
});

test('returns failed subtask details for the dialog tooltip', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/tasks?keyword=编号失败&page=1&pageSize=1',
    headers: { cookie },
  });

  assert.equal(listResponse.statusCode, 200);
  const task = listResponse.json().items[0];
  assert.ok(task.failedCount > 0);

  const subtasksResponse = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${task.id}/subtasks?page=1&pageSize=20`,
    headers: { cookie },
  });

  assert.equal(subtasksResponse.statusCode, 200);
  const failed = subtasksResponse.json().items.find((item: { resultStatus: string }) => item.resultStatus === 'failed');
  assert.equal(failed.taskType, 'fetch_mailbox_numbers');
  assert.match(failed.errorMessage, /#f_boxid/);
});

test('computes mailbox and Smarty progress from the correct pending sets', () => {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const taskService = new TaskService(database);
  const now = '2026-06-08T00:00:00.000Z';

  try {
    const task = taskService.createManualTask({ createdBy: 'Test Admin' });

    database.sqlite
      .prepare(`
        INSERT INTO addresses (
          source, source_id, name, slug, anytime_url, signup_url, google_maps_url,
          country, state, state_name, city, street_address, postal_code, full_address,
          price_cents, price_currency, price_period, rdi, cmra, smarty_raw, smarty_checked_at,
          mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
          is_featured, is_active, is_visible, status_note, last_crawled_at, first_seen_at,
          removed_at, created_at, updated_at
        ) VALUES (
          'anytimemailbox', 'cached', 'Cached Address', 'cached-address',
          'https://www.anytimemailbox.com/s/cached-address',
          NULL, NULL,
          'United States', 'AL', 'Alabama', 'Madison', '7169 Hwy 72 W Ste A',
          '35758', '7169 Hwy 72 W Ste A Madison, AL 35758 United States',
          1499, 'USD', 'month', 'Residential', 'No', '{}', @now,
          NULL, NULL, NULL, NULL,
          0, 1, 1, NULL, @now, @now,
          NULL, @now, @now
        )
      `)
      .run({ now });

    const insertStage = database.sqlite.prepare(`
      INSERT INTO crawl_discovered_addresses (
        task_id, source, source_id, state_name, state, state_url, state_location_count,
        name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
        postal_code, full_address, normalized_address_key, price_cents, price_currency,
        price_period, mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
        crawl_status, created_at, updated_at
      ) VALUES (
        @taskId, 'anytimemailbox', @sourceId, 'Alabama', 'AL', 'https://example.test/alabama', 3,
        @name, @slug, @anytimeUrl, NULL, @myearUrl,
        'United States', @city, @streetAddress, @postalCode, @fullAddress,
        @normalizedAddressKey, 1499, 'USD', 'month',
        @mailboxMin, @mailboxMax, @mailboxCount, @mailboxNumbersJson,
        @crawlStatus, @now, @now
      )
    `);

    insertStage.run({
      taskId: task.id,
      sourceId: 'needs-smarty',
      name: 'Needs Smarty',
      slug: 'needs-smarty',
      anytimeUrl: 'https://www.anytimemailbox.com/s/needs-smarty',
      myearUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=needs-smarty',
      city: 'Birmingham',
      streetAddress: '120 19th Street North',
      postalCode: '35203',
      fullAddress: '120 19th Street North Birmingham, AL 35203 United States',
      normalizedAddressKey: '120 19th street north|birmingham|al|35203',
      mailboxMin: 1,
      mailboxMax: 2,
      mailboxCount: 2,
      mailboxNumbersJson: '[1,2]',
      crawlStatus: 'mailbox_fetched',
      now,
    });
    insertStage.run({
      taskId: task.id,
      sourceId: 'not-ready',
      name: 'Not Ready',
      slug: 'not-ready',
      anytimeUrl: 'https://www.anytimemailbox.com/s/not-ready',
      myearUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=not-ready',
      city: 'Mobile',
      streetAddress: '1 Pending St',
      postalCode: '36602',
      fullAddress: '1 Pending St Mobile, AL 36602 United States',
      normalizedAddressKey: '1 pending st|mobile|al|36602',
      mailboxMin: null,
      mailboxMax: null,
      mailboxCount: null,
      mailboxNumbersJson: null,
      crawlStatus: 'discovered',
      now,
    });
    insertStage.run({
      taskId: task.id,
      sourceId: 'cached',
      name: 'Cached Stage',
      slug: 'cached-stage',
      anytimeUrl: 'https://www.anytimemailbox.com/s/cached-stage',
      myearUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=cached-stage',
      city: 'Madison',
      streetAddress: '7169 Hwy 72 W Ste A',
      postalCode: '35758',
      fullAddress: '7169 Hwy 72 W Ste A Madison, AL 35758 United States',
      normalizedAddressKey: '7169 hwy 72 w ste a|madison|al|35758',
      mailboxMin: 10,
      mailboxMax: 11,
      mailboxCount: 2,
      mailboxNumbersJson: '[10,11]',
      crawlStatus: 'mailbox_fetched',
      now,
    });

    const subtasks = taskService.listSubtasks(task.id, 1, 20);
    const mailbox = subtasks.items.find((item) => item.taskType === 'fetch_mailbox_numbers');
    const smarty = subtasks.items.find((item) => item.taskType === 'sync_smarty');

    assert.equal(mailbox?.progress?.current, 2);
    assert.equal(mailbox?.progress?.total, 3);
    assert.equal(smarty?.progress?.current, 0);
    assert.equal(smarty?.progress?.total, 1);
  } finally {
    database.sqlite.close();
  }
});

test('resumes a completed task that has failed subtasks', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/admin/tasks?keyword=TASK-202606050830-FAIL01&page=1&pageSize=1',
    headers: { cookie },
  });

  assert.equal(listResponse.statusCode, 200);
  const failedTask = listResponse.json().items[0];
  assert.equal(failedTask.status, 'completed');
  assert.ok(failedTask.failedCount > 0);

  const resumeResponse = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/${failedTask.id}/resume`,
    headers: { cookie },
  });

  assert.equal(resumeResponse.statusCode, 200);
  const resumed = resumeResponse.json().item;
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.failedCount, 0);
  assert.ok(resumed.pendingCount > 0);

  const subtasksResponse = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${failedTask.id}/subtasks?page=1&pageSize=20`,
    headers: { cookie },
  });

  assert.equal(subtasksResponse.statusCode, 200);
  const retrySubtask = subtasksResponse
    .json()
    .items
    .find((item: { taskType: string }) => item.taskType === 'fetch_mailbox_numbers');
  assert.equal(retrySubtask.executionStatus, 'pending');
  assert.equal(retrySubtask.resultStatus, null);
  assert.equal(retrySubtask.errorMessage, null);
});

test('recoverInterruptedTasks resumes running tasks from checkpoint and honors pause/stop intents', () => {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const taskService = new TaskService(database);

  try {
    // running 任务：一个子任务已成功，一个在执行中被中断
    const running = taskService.createManualTask({ createdBy: 'Test Admin' });
    taskService.markSubtaskSuccess(running.id, 'fetch_states');
    taskService.markSubtaskRunning(running.id, 'fetch_names');

    const pausing = taskService.createManualTask({ createdBy: 'Test Admin' });
    database.sqlite.prepare("UPDATE crawl_tasks SET status = 'pause_requested' WHERE id = ?").run(pausing.id);

    const stopping = taskService.createManualTask({ createdBy: 'Test Admin' });
    database.sqlite.prepare("UPDATE crawl_tasks SET status = 'stop_requested' WHERE id = ?").run(stopping.id);

    const resumeIds = taskService.recoverInterruptedTasks();

    // running：仍为 running 且仅它被重新入队；已成功子任务保留，被中断子任务重置为 pending
    assert.deepEqual(resumeIds, [running.id]);
    assert.equal(taskService.getTask(running.id)?.status, 'running');

    const subtasks = database.sqlite
      .prepare('SELECT task_type AS taskType, execution_status AS executionStatus, result_status AS resultStatus FROM crawl_subtasks WHERE task_id = ?')
      .all(running.id) as Array<{ taskType: string; executionStatus: string; resultStatus: string | null }>;
    const states = subtasks.find((item) => item.taskType === 'fetch_states');
    const names = subtasks.find((item) => item.taskType === 'fetch_names');
    assert.equal(states?.executionStatus, 'completed');
    assert.equal(states?.resultStatus, 'success');
    assert.equal(names?.executionStatus, 'pending');
    assert.equal(names?.resultStatus, null);

    // pause_requested -> paused，不续跑
    assert.equal(taskService.getTask(pausing.id)?.status, 'paused');
    assert.ok(!resumeIds.includes(pausing.id));

    // stop_requested -> stopped，不续跑
    assert.equal(taskService.getTask(stopping.id)?.status, 'stopped');
    assert.ok(!resumeIds.includes(stopping.id));
  } finally {
    database.sqlite.close();
  }
});

test('creates an iPostal1 task with only fetch_names and sync_smarty subtasks', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  const createResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks',
    headers: { cookie },
    payload: { note: 'iPostal1 测试任务', platform: 'ipostal1' },
  });

  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json().item;
  assert.equal(created.platform, 'ipostal1');
  assert.equal(created.pendingCount, 2);
  assert.equal(created.totalCount, 2);
  assert.equal(created.progress.taskType, 'fetch_names');

  const subtasksResponse = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${created.id}/subtasks`,
    headers: { cookie },
  });
  assert.deepEqual(
    subtasksResponse.json().items.map((item: { taskType: string }) => item.taskType),
    ['fetch_names', 'sync_smarty'],
  );

  const invalidResponse = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks',
    headers: { cookie },
    payload: { platform: 'unknown' },
  });
  assert.equal(invalidResponse.statusCode, 400);
});

test('defaults tasks to the ATMB platform and keeps mailbox updates ATMB-only', () => {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const taskService = new TaskService(database);

  try {
    const atmb = taskService.createManualTask({ createdBy: 'Test Admin' });
    assert.equal(atmb.platform, 'anytimemailbox');
    assert.equal(atmb.totalCount, 5);
    assert.equal(taskService.getTaskPlatform(atmb.id), 'anytimemailbox');
    taskService.requestStop(atmb.id, true);

    const ipostal1 = taskService.createManualTask({ createdBy: 'Test Admin', platform: 'ipostal1' });
    assert.equal(taskService.getTaskPlatform(ipostal1.id), 'ipostal1');
    taskService.requestStop(ipostal1.id, true);

    database.sqlite
      .prepare(`
        INSERT INTO addresses (
          source, source_id, name, slug, anytime_url, country, state, state_name, city, street_address,
          postal_code, full_address, price_cents, rdi, cmra, smarty_checked_at
        ) VALUES (
          'ipostal1', '2996', 'Anchorage - 3300 Arctic Blvd', 'anchorage-3300-arctic-blvd',
          'https://ipostal1.com/secure_checkout.php?stID=2996', 'United States', 'AK', 'Alaska', 'Anchorage',
          '3300 Arctic Blvd Suite 201', '99503', '3300 Arctic Blvd Suite 201 Anchorage, AK 99503 United States',
          999, 'Commercial', 'Yes', '2026-06-01T00:00:00.000Z'
        )
      `)
      .run();
    const addressId = (database.sqlite.prepare("SELECT id FROM addresses WHERE source = 'ipostal1'").get() as { id: number }).id;

    assert.equal(taskService.createMailboxUpdateTask({ createdBy: 'Test Admin', addressIds: [addressId] }), null);
  } finally {
    database.sqlite.close();
  }
});

test('scheduler creates one system task per platform when due', async () => {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const config = resolveServerConfig(testEnv);
  const settingsService = new SettingsService(database, config, {
    async testConnection() {
      return { ok: true };
    },
  });
  settingsService.ensureDefaultSettings();
  settingsService.saveUpdateSchedule({ autoUpdateEnabled: true, updateFrequencyDays: 1, updateHour: 9, updateMinute: 0 });
  const taskService = new TaskService(database);
  const enqueued: number[] = [];

  try {
    const scheduler = new TaskScheduler(settingsService, taskService, {
      enqueue(taskId) {
        enqueued.push(taskId);
      },
    });
    const first = await scheduler.tick(new Date('2026-10-19T12:00:00.000Z'));

    assert.ok(first);
    const tasks = taskService.listTasks({ createdType: 'system' }).items;
    assert.deepEqual(tasks.map((task) => task.platform).sort(), ['anytimemailbox', 'ipostal1']);
    assert.deepEqual([...enqueued].sort(), tasks.map((task) => task.id).sort());
    assert.equal(tasks.find((task) => task.platform === 'ipostal1')?.totalCount, 2);
    assert.match(tasks.find((task) => task.platform === 'ipostal1')?.note ?? '', /iPostal1/);
  } finally {
    database.sqlite.close();
  }
});

function multipartJson(fileName: string, content: string) {
  const boundary = '----atmb-import-boundary';
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/json\r\n\r\n`),
    Buffer.from(content, 'utf8'),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return { payload, contentType: `multipart/form-data; boundary=${boundary}` };
}

function ipostal1ExportFile(cards: string) {
  return JSON.stringify({
    source: 'ipostal1',
    fetchedAt: '2026-10-21T08:30:00Z',
    states: [
      { stateId: '2', code: 'AK', name: 'Alaska', status: 'ok', body: JSON.stringify({ num_results: 2, display: cards }) },
      { stateId: '12', code: 'CA', name: 'California', status: 'failed', error: 'Cloudflare challenge', body: null },
    ],
  });
}

const alaskaCards = [2996, 3597].map((storeId) => `
  <article class="mail-center-card" store-id="${storeId}" store-postcode="99503">
    <span class="store-street-address">${storeId} Arctic Blvd<br>Suite 201</span>
    <span class="store-city-state-zip">Anchorage, AK 99503</span>
    <p class="store-plan-desktop"><b>''Standard'' address from $9.99</b></p>
    <a href="https://ipostal1.com/secure_checkout.php?stID=${storeId}" class="choose-location-btn">Choose</a>
  </article>
`).join('');

test('previews an iPostal1 offline export and only creates the task after confirmation', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);
  const upload = multipartJson('ipostal1-export.json', ipostal1ExportFile(alaskaCards));
  const expectedStats = {
    states: 1,
    parsed: 2,
    skippedAtmb: 0,
    staged: 2,
    warnings: ['CA (12): Cloudflare challenge'],
  };
  const countTasks = async () => (await app.inject({ method: 'GET', url: '/api/admin/tasks', headers: { cookie } })).json().total as number;
  const tasksBefore = await countTasks();

  // 第一步：上传只返回统计，不创建任务
  const preview = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks/ipostal1-import',
    headers: { cookie, 'content-type': upload.contentType },
    payload: upload.payload,
  });

  assert.equal(preview.statusCode, 200);
  const previewBody = preview.json();
  assert.match(previewBody.uploadId, /^[0-9a-f-]{36}$/);
  assert.equal(previewBody.fetchedAt, '2026-10-21T08:30:00Z');
  assert.deepEqual(previewBody.stats, expectedStats);
  assert.deepEqual(previewBody.details.duplicates, []);
  assert.deepEqual(previewBody.details.staged.map((row: { storeId: string }) => row.storeId), ['2996', '3597']);
  assert.equal(await countTasks(), tasksBefore);

  // 取消：丢弃后无法再确认
  const cancelled = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks/ipostal1-import',
    headers: { cookie, 'content-type': upload.contentType },
    payload: upload.payload,
  });
  const cancelledId = cancelled.json().uploadId;
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/admin/tasks/ipostal1-import/${cancelledId}`, headers: { cookie } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: `/api/admin/tasks/ipostal1-import/${cancelledId}/confirm`, headers: { cookie } })).statusCode, 404);
  assert.equal(await countTasks(), tasksBefore);

  // 第二步：确认后创建只含 sync_smarty 的任务
  const confirm = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/ipostal1-import/${previewBody.uploadId}/confirm`,
    headers: { cookie },
  });

  assert.equal(confirm.statusCode, 201);
  const body = confirm.json();
  assert.equal(body.item.platform, 'ipostal1');
  assert.equal(body.item.createdType, 'manual');
  assert.match(body.item.note, /导入 iPostal1 离线数据（抓取于 2026-10-21T08:30:00Z）/);
  assert.equal(body.item.totalCount, 1);
  assert.deepEqual(body.stats, expectedStats);
  assert.equal(await countTasks(), tasksBefore + 1);

  const subtasksResponse = await app.inject({
    method: 'GET',
    url: `/api/admin/tasks/${body.item.id}/subtasks`,
    headers: { cookie },
  });
  assert.deepEqual(subtasksResponse.json().items.map((item: { taskType: string }) => item.taskType), ['sync_smarty']);
  assert.equal(subtasksResponse.json().items[0].progress.total, 2);

  // 同一个 uploadId 不能重复确认；有任务执行中时新的确认被拒绝
  assert.equal((await app.inject({ method: 'POST', url: `/api/admin/tasks/ipostal1-import/${previewBody.uploadId}/confirm`, headers: { cookie } })).statusCode, 404);
  const another = await app.inject({
    method: 'POST',
    url: '/api/admin/tasks/ipostal1-import',
    headers: { cookie, 'content-type': upload.contentType },
    payload: upload.payload,
  });
  assert.equal(another.statusCode, 200);
  const conflict = await app.inject({
    method: 'POST',
    url: `/api/admin/tasks/ipostal1-import/${another.json().uploadId}/confirm`,
    headers: { cookie },
  });
  assert.equal(conflict.statusCode, 409);
});

test('rejects invalid iPostal1 export uploads', async (t) => {
  const app = await buildTestServer();
  t.after(() => app.close());
  const cookie = await loginCookie(app);

  for (const [content, pattern] of [
    ['{not json', /不是合法 JSON/],
    [JSON.stringify({ source: 'anytimemailbox', states: [] }), /source 不是 ipostal1/],
  ] as const) {
    const upload = multipartJson('bad.json', content);
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/tasks/ipostal1-import',
      headers: { cookie, 'content-type': upload.contentType },
      payload: upload.payload,
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().message, pattern);
  }

  const unauthenticated = await app.inject({ method: 'POST', url: '/api/admin/tasks/ipostal1-import' });
  assert.equal(unauthenticated.statusCode, 401);
  const unauthenticatedConfirm = await app.inject({ method: 'POST', url: '/api/admin/tasks/ipostal1-import/x/confirm' });
  assert.equal(unauthenticatedConfirm.statusCode, 401);
});
