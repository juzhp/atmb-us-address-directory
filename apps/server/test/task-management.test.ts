import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDatabase, ensureDatabaseSchema } from '@atmb/db';

import { createServer } from '../src/server.ts';
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
