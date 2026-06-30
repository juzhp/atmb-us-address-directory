import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { createDatabase, ensureDatabaseSchema, type DatabaseContext } from '@atmb/db';
import axios from 'axios';

import { resolveServerConfig } from '../src/auth/config.ts';
import {
  CrawlPipeline,
  HttpCrawlFetcher,
  HttpSmartyLookupClient,
  type CrawlFetcher,
  type CrawlFetchResult,
  type SmartyLookupClient,
  type SmartyLookupInput,
  type SmartyLookupResult,
} from '../src/crawl/pipeline.ts';
import { parseLocationDetail } from '../src/crawl/parser.ts';
import { SettingsService } from '../src/settings/service.ts';
import { shouldCreateSystemTask } from '../src/tasks/scheduler.ts';
import { TaskService } from '../src/tasks/service.ts';

const startUrl = 'https://locations.anytimemailbox.com/l/usa';
const stateUrl = 'https://locations.anytimemailbox.com/l/usa/alabama';
const testEnv = {
  NODE_ENV: 'test',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'secret123',
  ADMIN_DISPLAY_NAME: 'Test Admin',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  WEB_ORIGIN: 'http://localhost:3000',
};

test('HTTP crawl fetcher varies request header profiles between requests', async () => {
  const getMock = mock.method(axios, 'get', async (_url: string, _config: unknown) => ({
    status: 200,
    data: '<html></html>',
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }));
  const fetcher = new HttpCrawlFetcher({
    random: randomSequence([0, 0]),
    requestDelayMs: { min: 0, max: 0 },
  });

  try {
    await fetcher.fetchHtml('https://www.anytimemailbox.com/l/usa');
    await fetcher.fetchHtml('https://www.anytimemailbox.com/l/usa');
  } finally {
    getMock.mock.restore();
  }

  const firstHeaders = getMock.mock.calls[0]?.arguments[1]?.headers as Record<string, string>;
  const secondHeaders = getMock.mock.calls[1]?.arguments[1]?.headers as Record<string, string>;

  assert.ok(firstHeaders);
  assert.ok(secondHeaders);
  assert.notEqual(firstHeaders['User-Agent'], secondHeaders['User-Agent']);
  assert.equal(firstHeaders['Sec-Fetch-Mode'], 'navigate');
  assert.equal(secondHeaders['Sec-Fetch-Mode'], 'navigate');
});

test('HTTP crawl fetcher waits a jittered delay before requests', async () => {
  const delays: number[] = [];
  const getMock = mock.method(axios, 'get', async (_url: string, _config: unknown) => ({
    status: 200,
    data: '<html></html>',
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }));
  const fetcher = new HttpCrawlFetcher({
    random: () => 0.5,
    requestDelayMs: { min: 100, max: 300 },
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
  });

  try {
    await fetcher.fetchHtml('https://www.anytimemailbox.com/l/usa');
  } finally {
    getMock.mock.restore();
  }

  assert.deepEqual(delays, [200]);
});

test('HTTP crawl fetcher reports Cloudflare challenge responses clearly', async () => {
  const getMock = mock.method(axios, 'get', async () => {
    throw {
      isAxiosError: true,
      response: {
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'cf-mitigated': 'challenge',
          server: 'cloudflare',
          'content-type': 'text/html; charset=UTF-8',
        },
        data: '<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>',
      },
    };
  });
  const fetcher = new HttpCrawlFetcher({
    random: () => 0,
    requestDelayMs: { min: 0, max: 0 },
    curlFetch: async () => {
      throw new Error('curl fallback unavailable');
    },
  });

  try {
    await assert.rejects(
      () => fetcher.fetchHtml('https://www.anytimemailbox.com/l/usa'),
      /Cloudflare challenge.*status=403.*title="Just a moment\.\.\."/,
    );
  } finally {
    getMock.mock.restore();
  }
});

test('HTTP crawl fetcher retries once with curl after Axios returns 403', async () => {
  const getMock = mock.method(axios, 'get', async () => {
    throw {
      isAxiosError: true,
      response: {
        status: 403,
        statusText: 'Forbidden',
        headers: {
          'cf-mitigated': 'challenge',
          server: 'cloudflare',
          'content-type': 'text/html; charset=UTF-8',
        },
        data: '<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>',
      },
    };
  });
  const curlCalls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetcher = new HttpCrawlFetcher({
    random: () => 0,
    requestDelayMs: { min: 0, max: 0 },
    curlFetch: async (url, options) => {
      curlCalls.push({ url, headers: options.headers });

      return {
        url,
        finalUrl: url,
        html: '<html><title>Anytime Mailbox</title></html>',
        status: 200,
        contentType: 'text/html; charset=utf-8',
      };
    },
  });

  try {
    const result = await fetcher.fetchHtml('https://www.anytimemailbox.com/l/usa');

    assert.equal(result.status, 200);
    assert.match(result.html, /Anytime Mailbox/);
    assert.equal(curlCalls.length, 1);
    assert.equal(curlCalls[0]?.url, 'https://www.anytimemailbox.com/l/usa');
    assert.ok(curlCalls[0]?.headers['User-Agent']);
  } finally {
    getMock.mock.restore();
  }
});
test('HTTP crawl fetcher applies a random active proxy to Axios requests', async () => {
  const configs: unknown[] = [];
  const getMock = mock.method(axios, 'get', async (_url: string, config: unknown) => {
    configs.push(config);
    return {
      status: 200,
      data: '<html></html>',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    };
  });
  const fetcher = new HttpCrawlFetcher({
    random: () => 0,
    requestDelayMs: { min: 0, max: 0 },
    proxyProvider: () => ({ id: 1, url: 'http://user:pass@127.0.0.1:8080' }),
  });

  try {
    await fetcher.fetchHtml('https://www.anytimemailbox.com/l/usa');
  } finally {
    getMock.mock.restore();
  }

  const proxy = (configs[0] as { proxy?: { protocol?: string; host?: string; port?: number; auth?: { username: string; password: string } } }).proxy;
  assert.deepEqual(proxy, {
    protocol: 'http',
    host: '127.0.0.1',
    port: 8080,
    auth: { username: 'user', password: 'pass' },
  });
});

test('HTTP crawl fetcher retries TLS ECONNRESET once with the same proxy', async () => {
  const configs: unknown[] = [];
  let calls = 0;
  const getMock = mock.method(axios, 'get', async (_url: string, config: unknown) => {
    configs.push(config);
    calls += 1;

    if (calls === 1) {
      throw {
        isAxiosError: true,
        code: 'ECONNRESET',
        cause: {
          code: 'ECONNRESET',
          message: 'Client network socket disconnected before secure TLS connection was established',
        },
      };
    }

    return {
      status: 200,
      data: '<html></html>',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    };
  });
  let proxyProviderCalls = 0;
  const fetcher = new HttpCrawlFetcher({
    random: () => 0,
    requestDelayMs: { min: 0, max: 0 },
    proxyProvider: () => {
      proxyProviderCalls += 1;
      return { id: 1, url: 'http://user:pass@127.0.0.1:8080' };
    },
  });

  try {
    const result = await fetcher.fetchHtml('https://www.anytimemailbox.com/l/usa');

    assert.equal(result.status, 200);
    assert.equal(calls, 2);
    assert.equal(proxyProviderCalls, 1);
    assert.deepEqual(
      (configs[1] as { proxy?: unknown }).proxy,
      (configs[0] as { proxy?: unknown }).proxy,
    );
  } finally {
    getMock.mock.restore();
  }
});
test('reuses a successful Smarty result by anytime_url and never calls Smarty again', async () => {
  const harness = buildHarness([
    crawledAddress({
      name: 'Madison - Hwy 72',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
      street: '7169 Hwy 72 W Ste A',
      city: 'Madison',
      zip: '35758',
      price: 'US$ 18.99',
      mailboxNumbers: ['A101', '106'],
    }),
  ], {
    async lookupAddresses() {
      throw new Error('Smarty should not be called for cached anytime_url');
    },
  });

  insertAddress(harness.database, {
    name: 'Madison - Hwy 72',
    slug: 'madison-hwy-72',
    anytimeUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
    streetAddress: '7169 Hwy 72 W Ste A',
    city: 'Madison',
    state: 'AL',
    postalCode: '35758',
    priceCents: 1499,
    rdi: 'Residential',
    cmra: 'No',
    smartyCheckedAt: '2026-06-01T00:00:00.000Z',
    smartyRaw: '{"cached":true}',
  });

  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  await harness.pipeline.runTask(task.id);

  const row = harness.database.sqlite
    .prepare(`
      SELECT price_cents AS priceCents, rdi, cmra, mailbox_min AS mailboxMin, mailbox_max AS mailboxMax
      FROM addresses
      WHERE anytime_url = ?
    `)
    .get('https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72') as {
      priceCents: number;
      rdi: string;
      cmra: string;
      mailboxMin: number;
      mailboxMax: number;
    };

  assert.equal(row.priceCents, 1899);
  assert.equal(row.rdi, 'Residential');
  assert.equal(row.cmra, 'No');
  assert.equal(row.mailboxMin, 101);
  assert.equal(row.mailboxMax, 106);
  assertTaskCompleted(harness.database, task.id);
});

test('fails the task when the start page has no state links', async () => {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const config = resolveServerConfig(testEnv);
  const settingsService = new SettingsService(database, config, {
    async testConnection() {
      return { ok: true };
    },
  });
  settingsService.ensureDefaultSettings();
  const taskService = new TaskService(database);
  const pipeline = new CrawlPipeline({
    database,
    taskService,
    settingsService,
    startUrl,
    fetcher: {
      async fetchHtml(url) {
        return {
          url,
          finalUrl: url,
          html: '<title>Error 404 - Page Not Found</title>',
          status: 200,
          contentType: 'text/html',
        };
      },
    },
    smartyClient: {
      async lookupAddresses() {
        throw new Error('Smarty should not run when no states were parsed');
      },
    },
  });
  const task = taskService.createManualTask({ createdBy: 'Test Admin' });

  await assert.rejects(() => pipeline.runTask(task.id), /未从 Anytime Mailbox 入口页解析到任何州/);

  const fetchStates = database.sqlite
    .prepare(`
      SELECT execution_status AS executionStatus, result_status AS resultStatus, error_message AS errorMessage
      FROM crawl_subtasks
      WHERE task_id = ? AND task_type = 'fetch_states'
    `)
    .get(task.id) as { executionStatus: string; resultStatus: string; errorMessage: string };
  const taskRow = database.sqlite
    .prepare('SELECT status, failed_count AS failedCount FROM crawl_tasks WHERE id = ?')
    .get(task.id) as { status: string; failedCount: number };

  assert.equal(fetchStates.executionStatus, 'completed');
  assert.equal(fetchStates.resultStatus, 'failed');
  assert.match(fetchStates.errorMessage, /入口页/);
  assert.equal(taskRow.status, 'completed');
  assert.equal(taskRow.failedCount, 1);
});

test('reuses a successful Smarty result by normalized address when the URL changed', async () => {
  const smartyCalls: SmartyLookupInput[][] = [];
  const harness = buildHarness([
    crawledAddress({
      name: 'Birmingham - 1st Ave',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/birmingham-1st-ave-new',
      street: '7841 1st Ave N',
      city: 'Birmingham',
      zip: '35206',
      price: 'US$ 14.99',
      mailboxNumbers: ['10', '11'],
    }),
  ], {
    async lookupAddresses(_credentials, inputs) {
      smartyCalls.push(inputs);
      return [];
    },
  });

  insertAddress(harness.database, {
    name: 'Birmingham - Old URL',
    slug: 'birmingham-old-url',
    anytimeUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/birmingham-old',
    streetAddress: '7841 1st Ave N',
    city: 'Birmingham',
    state: 'AL',
    postalCode: '35206',
    priceCents: 1299,
    rdi: 'Commercial',
    cmra: 'Yes',
    smartyCheckedAt: '2026-06-01T00:00:00.000Z',
    smartyRaw: '{"cachedByAddress":true}',
  });

  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  await harness.pipeline.runTask(task.id);

  assert.equal(smartyCalls.length, 0);
  const rows = harness.database.sqlite
    .prepare(`
      SELECT anytime_url AS anytimeUrl, rdi, cmra
      FROM addresses
      WHERE street_address = '7841 1st Ave N' AND city = 'Birmingham' AND state = 'AL' AND postal_code = '35206'
    `)
    .all() as Array<{ anytimeUrl: string; rdi: string; cmra: string }>;

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.anytimeUrl, 'https://locations.anytimemailbox.com/l/usa/alabama/birmingham-1st-ave-new');
  assert.equal(rows[0]?.rdi, 'Commercial');
  assert.equal(rows[0]?.cmra, 'Yes');
});

test('sends only addresses without a successful Smarty cache to the batch client', async () => {
  const smartyCalls: SmartyLookupInput[][] = [];
  const harness = buildHarness([
    crawledAddress({
      name: 'Madison - Hwy 72',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
      street: '7169 Hwy 72 W Ste A',
      city: 'Madison',
      zip: '35758',
      price: 'US$ 18.99',
      mailboxNumbers: ['101', '106'],
    }),
    crawledAddress({
      name: 'Birmingham - Doug Baker Blvd',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/birmingham-doug-baker',
      street: '1401 Doug Baker Blvd',
      city: 'Birmingham',
      zip: '35242',
      price: 'US$ 9.99',
      mailboxNumbers: ['2', '8'],
    }),
  ], {
    async lookupAddresses(_credentials, inputs) {
      smartyCalls.push(inputs);
      return inputs.map((input): SmartyLookupResult => ({
        inputId: input.inputId,
        rdi: 'Residential',
        cmra: 'No',
        raw: { components: { primary_number: '1401' }, analysis: { dpv_cmra: 'N' }, metadata: { rdi: 'Residential' } },
      }));
    },
  });

  insertAddress(harness.database, {
    name: 'Madison - Hwy 72',
    slug: 'madison-hwy-72',
    anytimeUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
    streetAddress: '7169 Hwy 72 W Ste A',
    city: 'Madison',
    state: 'AL',
    postalCode: '35758',
    priceCents: 1899,
    rdi: 'Residential',
    cmra: 'No',
    smartyCheckedAt: '2026-06-01T00:00:00.000Z',
  });

  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  await harness.pipeline.runTask(task.id);

  assert.equal(smartyCalls.length, 1);
  assert.deepEqual(smartyCalls[0]?.map((item) => item.streetAddress), ['1401 Doug Baker Blvd']);

  const imported = harness.database.sqlite
    .prepare(`
      SELECT rdi, cmra, smarty_checked_at AS smartyCheckedAt
      FROM addresses
      WHERE anytime_url = 'https://locations.anytimemailbox.com/l/usa/alabama/birmingham-doug-baker'
    `)
    .get() as { rdi: string; cmra: string; smartyCheckedAt: string };

  assert.equal(imported.rdi, 'Residential');
  assert.equal(imported.cmra, 'No');
  assert.ok(imported.smartyCheckedAt);
});

test('skips address detail fetch when myear url is missing', async () => {
  const address = crawledAddress({
    name: 'Chandler - Germann Rd',
    detailUrl: 'https://locations.anytimemailbox.com/l/usa/arizona/chandler-germann-rd',
    street: '2350 E Germann Rd Ste 30',
    city: 'Chandler',
    state: 'AZ',
    zip: '85286',
    price: 'US$ 16.99',
    mailboxNumbers: ['B12', '29'],
  });
  const baseFetcher = createFixtureFetcher([address]);
  let detailFetchCount = 0;
  const fetcher: CrawlFetcher = {
    async fetchHtml(url, options) {
      if (url === address.detailUrl) {
        detailFetchCount += 1;

        if (detailFetchCount === 1) {
          return {
            url,
            finalUrl: url,
            html: `
              <div class="t-addr">
                <div class="t-text">
                  <div>${address.name}</div>
                  <div>${address.street}</div>
                  <div>Unit - # MAILBOX</div>
                  <div>${address.city}, ${address.state} ${address.zip}</div>
                  <div>United States</div>
                </div>
              </div>
            `,
            status: 200,
            contentType: 'text/html; charset=utf-8',
          };
        }
      }

      return baseFetcher.fetchHtml(url, options);
    },
  };
  const harness = buildHarness([address], {
    async lookupAddresses() {
      throw new Error('Smarty should not run when detail signup link is missing');
    },
  }, { fetcher });

  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  await harness.pipeline.runTask(task.id);

  const fetchAddresses = harness.database.sqlite
    .prepare(`
      SELECT result_status AS resultStatus, error_message AS errorMessage
      FROM crawl_subtasks
      WHERE task_id = ? AND task_type = 'fetch_addresses'
    `)
    .get(task.id) as { resultStatus: string; errorMessage: string | null };
  const staged = harness.database.sqlite
    .prepare(`
      SELECT crawl_status AS crawlStatus, error_message AS errorMessage, myear_url AS myearUrl
      FROM crawl_discovered_addresses
      WHERE task_id = ? AND anytime_url = ?
    `)
    .get(task.id, address.detailUrl) as { crawlStatus: string; errorMessage: string; myearUrl: string | null };
  const importedCount = harness.database.sqlite
    .prepare('SELECT COUNT(*) AS count FROM addresses')
    .get() as { count: number };

  assert.equal(detailFetchCount, 1);
  assert.equal(fetchAddresses.resultStatus, 'success');
  assert.equal(fetchAddresses.errorMessage, null);
  assert.equal(staged.crawlStatus, 'skipped');
  assert.match(staged.errorMessage, /Unable to parse mailbox signup link/);
  assert.equal(staged.myearUrl, null);
  assert.equal(importedCount.count, 0);
});

test('refetches existing staged details when myear url is missing', async () => {
  const address = crawledAddress({
    name: 'Chandler - Germann Rd',
    detailUrl: 'https://locations.anytimemailbox.com/l/usa/arizona/chandler-germann-rd',
    street: '2350 E Germann Rd Ste 30',
    city: 'Chandler',
    state: 'AZ',
    zip: '85286',
    price: 'US$ 16.99',
    mailboxNumbers: ['12', '29'],
  });
  const harness = buildHarness([address], {
    async lookupAddresses() {
      throw new Error('Smarty should be skipped in this resume test');
    },
  });
  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  const now = new Date().toISOString();

  harness.database.sqlite
    .prepare(`
      INSERT INTO crawl_discovered_addresses (
        task_id, source, source_id, state_name, state, state_url, state_location_count,
        name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
        postal_code, full_address, normalized_address_key, price_cents, price_currency,
        price_period, crawl_status, created_at, updated_at
      ) VALUES (
        @taskId, 'anytimemailbox', 'stale-stage', 'Arizona', 'AZ', @stateUrl, 1,
        @name, 'stale-chandler', @anytimeUrl, NULL, NULL,
        'United States', @city, @streetAddress, @postalCode, @fullAddress,
        @normalizedAddressKey, 1699, 'USD', 'month', 'discovered', @now, @now
      )
    `)
    .run({
      taskId: task.id,
      stateUrl,
      name: address.name,
      anytimeUrl: address.detailUrl,
      city: address.city,
      streetAddress: address.street,
      postalCode: address.zip,
      fullAddress: `${address.street} ${address.city}, ${address.state} ${address.zip} United States`,
      normalizedAddressKey: `${address.street.toLowerCase()}|${address.city.toLowerCase()}|${address.state.toLowerCase()}|${address.zip}`,
      now,
    });
  harness.taskService.markSubtaskSuccess(task.id, 'fetch_mailbox_numbers');
  harness.taskService.markSubtaskSuccess(task.id, 'sync_smarty');

  await harness.pipeline.runTask(task.id);

  const staged = harness.database.sqlite
    .prepare(`
      SELECT myear_url AS myearUrl, signup_url AS signupUrl
      FROM crawl_discovered_addresses
      WHERE task_id = ? AND anytime_url = ?
    `)
    .get(task.id, address.detailUrl) as { myearUrl: string | null; signupUrl: string | null };

  assert.equal(staged.myearUrl, address.signupUrl);
  assert.equal(staged.signupUrl, address.signupUrl);
});

test('updates selected address signup url and mailbox range', async () => {
  const address = crawledAddress({
    name: 'Madison - Hwy 72',
    detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
    street: '7169 Hwy 72 W Ste A',
    city: 'Madison',
    zip: '35758',
    price: 'US$ 18.99',
    mailboxNumbers: ['A101', '106'],
    signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=updated',
  });
  const harness = buildHarness([address], {
    async lookupAddresses() {
      throw new Error('Smarty should not run for selected mailbox update tasks');
    },
  });

  insertAddress(harness.database, {
    name: address.name,
    slug: 'madison-hwy-72',
    anytimeUrl: address.detailUrl,
    streetAddress: address.street,
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    priceCents: 1899,
    rdi: 'Residential',
    cmra: 'No',
    smartyCheckedAt: '2026-06-01T00:00:00.000Z',
  });
  const existing = harness.database.sqlite
    .prepare(`
      SELECT id
      FROM addresses
      WHERE anytime_url = ?
    `)
    .get(address.detailUrl) as { id: number };
  harness.database.sqlite
    .prepare(`
      UPDATE addresses
      SET signup_url = 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=old',
          mailbox_min = 1,
          mailbox_max = 2,
          mailbox_count = 2,
          mailbox_numbers_json = '[1,2]'
      WHERE id = ?
    `)
    .run(existing.id);

  const task = harness.taskService.createMailboxUpdateTask({
    addressIds: [existing.id],
    createdBy: 'Test Admin',
  });

  assert.ok(task);
  assert.equal(task.totalCount, 2);

  await harness.pipeline.runTask(task.id);
  assertTaskCompleted(harness.database, task.id);

  const subtasks = harness.taskService.listSubtasks(task.id, 1, 20);
  assert.deepEqual(subtasks?.items.map((item) => item.taskType), ['fetch_addresses', 'fetch_mailbox_numbers']);

  const updated = harness.database.sqlite
    .prepare(`
      SELECT
        signup_url AS signupUrl,
        mailbox_min AS mailboxMin,
        mailbox_max AS mailboxMax,
        mailbox_count AS mailboxCount,
        mailbox_numbers_json AS mailboxNumbersJson
      FROM addresses
      WHERE id = ?
    `)
    .get(existing.id) as {
      signupUrl: string;
      mailboxMin: number;
      mailboxMax: number;
      mailboxCount: number;
      mailboxNumbersJson: string;
    };

  assert.equal(updated.signupUrl, address.signupUrl);
  assert.equal(updated.mailboxMin, 101);
  assert.equal(updated.mailboxMax, 106);
  assert.equal(updated.mailboxCount, 2);
  assert.equal(updated.mailboxNumbersJson, '[101,106]');
});

test('returns computed progress for crawl subtasks', async () => {
  const harness = buildHarness([
    crawledAddress({
      name: 'Madison - Hwy 72',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
      street: '7169 Hwy 72 W Ste A',
      city: 'Madison',
      zip: '35758',
      price: 'US$ 18.99',
      mailboxNumbers: ['101', '106'],
    }),
    crawledAddress({
      name: 'Birmingham - Doug Baker Blvd',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/birmingham-doug-baker',
      street: '1401 Doug Baker Blvd',
      city: 'Birmingham',
      zip: '35242',
      price: 'US$ 9.99',
      mailboxNumbers: ['2', '8'],
    }),
  ], {
    async lookupAddresses(_credentials, inputs) {
      return inputs.map((input): SmartyLookupResult => ({
        inputId: input.inputId,
        rdi: 'Residential',
        cmra: 'No',
        raw: { analysis: { dpv_cmra: 'N' }, metadata: { rdi: 'Residential' } },
      }));
    },
  });

  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  await harness.pipeline.runTask(task.id);

  const subtasks = harness.taskService.listSubtasks(task.id, 1, 20);
  assert.ok(subtasks);
  const fetchAddresses = subtasks.items.find((item) => item.taskType === 'fetch_addresses');
  const fetchMailboxNumbers = subtasks.items.find((item) => item.taskType === 'fetch_mailbox_numbers');
  const syncSmarty = subtasks.items.find((item) => item.taskType === 'sync_smarty');

  assert.equal(fetchAddresses?.progress?.current, 2);
  assert.equal(fetchAddresses?.progress?.total, 2);
  assert.equal(fetchAddresses?.progress?.percent, 100);
  assert.equal(fetchMailboxNumbers?.progress?.current, 2);
  assert.equal(fetchMailboxNumbers?.progress?.total, 2);
  assert.equal(syncSmarty?.progress?.current, 2);
  assert.equal(syncSmarty?.progress?.total, 2);
});

test('parses compact detail address and removes spaced mailbox placeholders', () => {
  const html = `
    <div class="t-addr">
      <div class="t-text">
        <div>YOUR NAME</div>
        <div>3011 Town Center Dr Ste 130 # MAILBOX</div>
        <div>Fayetteville, NC 28306</div>
        <div>United States</div>
      </div>
    </div>
    <a id="myear" href="/signup/fayetteville">Select</a>
  `;

  assert.deepEqual(parseLocationDetail(html, 'https://www.anytimemailbox.com/s/fayetteville-3011-town-center-drive'), {
    myearUrl: 'https://www.anytimemailbox.com/signup/fayetteville',
    detailAddress: '3011 Town Center Dr Ste 130 Fayetteville, NC 28306 United States',
    country: 'United States',
    state: 'NC',
    city: 'Fayetteville',
    address: '3011 Town Center Dr Ste 130',
    zip: '28306',
  });
});

test('parses signup url from detail page fallback content', () => {
  const html = `
    <div class="t-addr">
      <div class="t-text">
        <div>Chandler - Germann Rd</div>
        <div>2350 E Germann Rd Ste 30</div>
        <div>Chandler, AZ 85286</div>
        <div>United States</div>
      </div>
    </div>
    <script>
      window.__signup = "https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=31960";
    </script>
  `;

  assert.equal(
    parseLocationDetail(html, 'https://www.anytimemailbox.com/s/chandler-2350-e-germann-rd').myearUrl,
    'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=31960',
  );
});

test('pauses during address fetch and resumes without refetching staged addresses', async () => {
  const addresses = [
    crawledAddress({
      name: 'Madison - Hwy 72',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
      street: '7169 Hwy 72 W Ste A',
      city: 'Madison',
      zip: '35758',
      price: 'US$ 18.99',
      mailboxNumbers: ['101', '106'],
    }),
    crawledAddress({
      name: 'Birmingham - Doug Baker Blvd',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/birmingham-doug-baker',
      street: '1401 Doug Baker Blvd',
      city: 'Birmingham',
      zip: '35242',
      price: 'US$ 9.99',
      mailboxNumbers: ['2', '8'],
    }),
  ];
  const detailFetchCounts = new Map<string, number>();
  const baseFetcher = createFixtureFetcher(addresses);
  let taskService: TaskService | null = null;
  let taskId = 0;
  const fetcher: CrawlFetcher = {
    async fetchHtml(url, options) {
      const result = await baseFetcher.fetchHtml(url, options);

      if (url === addresses[0]?.detailUrl && taskService && taskId) {
        detailFetchCounts.set(url, (detailFetchCounts.get(url) ?? 0) + 1);
        taskService.requestPause(taskId);
      } else if (url === addresses[1]?.detailUrl) {
        detailFetchCounts.set(url, (detailFetchCounts.get(url) ?? 0) + 1);
      }

      return result;
    },
  };
  const harness = buildHarness(addresses, {
    async lookupAddresses(_credentials, inputs) {
      return inputs.map((input) => ({
        inputId: input.inputId,
        rdi: 'Residential',
        cmra: 'No',
        raw: { metadata: { rdi: 'Residential' }, analysis: { dpv_cmra: 'N' } },
      }));
    },
  }, { fetcher });
  taskService = harness.taskService;
  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  taskId = task.id;

  await harness.pipeline.runTask(task.id);

  const pausedTask = harness.taskService.getTask(task.id);
  const stagedAfterPause = (harness.database.sqlite
    .prepare('SELECT COUNT(*) AS count FROM crawl_discovered_addresses WHERE task_id = ?')
    .get(task.id) as { count: number }).count;
  assert.equal(pausedTask?.status, 'paused');
  assert.equal(stagedAfterPause, 1);

  harness.taskService.resumeTask(task.id);
  await harness.pipeline.runTask(task.id);

  assert.equal(detailFetchCounts.get(addresses[0].detailUrl), 1);
  assert.equal(detailFetchCounts.get(addresses[1].detailUrl), 1);
  assertTaskCompleted(harness.database, task.id);
});

test('keeps Smarty failures in staging and does not write Unknown addresses to the main table', async () => {
  const harness = buildHarness([
    crawledAddress({
      name: 'Huntsville - Test',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/huntsville-test',
      street: '100 Test Way',
      city: 'Huntsville',
      zip: '35801',
      price: 'US$ 12.00',
      mailboxNumbers: ['1', '3'],
    }),
  ], {
    async lookupAddresses(_credentials, inputs) {
      return inputs.map((input) => ({
        inputId: input.inputId,
        error: 'Smarty candidate missing RDI',
      }));
    },
  });

  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  await harness.pipeline.runTask(task.id);

  const mainCount = (harness.database.sqlite
    .prepare(`
      SELECT COUNT(*) AS count
      FROM addresses
      WHERE anytime_url = 'https://locations.anytimemailbox.com/l/usa/alabama/huntsville-test'
    `)
    .get() as { count: number }).count;
  const staged = harness.database.sqlite
    .prepare(`
      SELECT smarty_error AS smartyError, imported_address_id AS importedAddressId
      FROM crawl_discovered_addresses
      WHERE anytime_url = 'https://locations.anytimemailbox.com/l/usa/alabama/huntsville-test'
    `)
    .get() as { smartyError: string; importedAddressId: number | null };

  assert.equal(mainCount, 0);
  assert.match(staged.smartyError, /RDI/);
  assert.equal(staged.importedAddressId, null);
});

test('formats Smarty lookup payload with secondary address data and more candidates', async () => {
  const axiosWithPost = axios as unknown as { post: typeof axios.post };
  const originalPost = axiosWithPost.post;
  let capturedPayload: Array<Record<string, unknown>> = [];

  axiosWithPost.post = (async (_url, payload) => {
    capturedPayload = payload as Array<Record<string, unknown>>;

    return {
      status: 200,
      data: capturedPayload.map((item) => ({
        input_id: item.input_id,
        metadata: { rdi: 'Commercial' },
        analysis: { dpv_cmra: 'Y' },
      })),
    };
  }) as typeof originalPost;

  try {
    const client = new HttpSmartyLookupClient();
    const results = await client.lookupAddresses(
      { authId: 'auth-id', authToken: 'auth-token' },
      [
        {
          inputId: 'suite-missing-number',
          streetAddress: '6140 Hwy 6 Suite',
          city: 'Missouri City',
          state: 'TX',
          postalCode: '77459',
        },
        {
          inputId: 'has-secondary',
          streetAddress: '731 WA 9 Ste 101',
          city: 'Lake Stevens',
          state: 'WA',
          postalCode: '98258',
        },
      ],
    );

    assert.equal(results.length, 2);
    assert.equal(capturedPayload[0]?.street, '6140 Hwy 6');
    assert.equal(capturedPayload[0]?.secondary, undefined);
    assert.equal(capturedPayload[0]?.candidates, 10);
    assert.equal(capturedPayload[1]?.street, '731 WA 9');
    assert.equal(capturedPayload[1]?.secondary, 'Ste 101');
    assert.equal(capturedPayload[1]?.candidates, 10);
  } finally {
    axiosWithPost.post = originalPost;
  }
});

test('marks previously active addresses as removed when they disappear from a completed crawl', async () => {
  const harness = buildHarness([
    crawledAddress({
      name: 'Madison - Hwy 72',
      detailUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72',
      street: '7169 Hwy 72 W Ste A',
      city: 'Madison',
      zip: '35758',
      price: 'US$ 18.99',
      mailboxNumbers: ['101', '106'],
    }),
  ], {
    async lookupAddresses(_credentials, inputs) {
      return inputs.map((input) => ({
        inputId: input.inputId,
        rdi: 'Residential',
        cmra: 'No',
        raw: { metadata: { rdi: 'Residential' }, analysis: { dpv_cmra: 'N' } },
      }));
    },
  });

  insertAddress(harness.database, {
    name: 'Removed Address',
    slug: 'removed-address',
    anytimeUrl: 'https://locations.anytimemailbox.com/l/usa/alabama/removed',
    streetAddress: '1 Missing St',
    city: 'Mobile',
    state: 'AL',
    postalCode: '36602',
    priceCents: 1999,
    rdi: 'Residential',
    cmra: 'No',
    smartyCheckedAt: '2026-06-01T00:00:00.000Z',
  });

  const task = harness.taskService.createManualTask({ createdBy: 'Test Admin' });
  await harness.pipeline.runTask(task.id);

  const removed = harness.database.sqlite
    .prepare(`
      SELECT is_active AS isActive, removed_at AS removedAt
      FROM addresses
      WHERE anytime_url = 'https://locations.anytimemailbox.com/l/usa/alabama/removed'
    `)
    .get() as { isActive: number; removedAt: string | null };
  const eventCount = (harness.database.sqlite
    .prepare("SELECT COUNT(*) AS count FROM address_events WHERE event_type = 'removed'")
    .get() as { count: number }).count;

  assert.equal(removed.isActive, 0);
  assert.ok(removed.removedAt);
  assert.equal(eventCount, 1);
});

test('calculates whether automatic system tasks are due from settings', () => {
  const settings = {
    autoUpdateEnabled: true,
    updateFrequencyDays: 1 as const,
    updateHour: 8,
    updateMinute: 30 as const,
  };

  assert.equal(shouldCreateSystemTask(settings, null, new Date('2026-06-07T08:30:00.000Z')), true);
  assert.equal(
    shouldCreateSystemTask(settings, new Date('2026-06-07T08:30:00.000Z'), new Date('2026-06-07T09:00:00.000Z')),
    false,
  );
  assert.equal(
    shouldCreateSystemTask(settings, new Date('2026-06-07T08:30:00.000Z'), new Date('2026-06-08T08:30:00.000Z')),
    true,
  );
  assert.equal(
    shouldCreateSystemTask({ ...settings, autoUpdateEnabled: false }, null, new Date('2026-06-07T08:30:00.000Z')),
    false,
  );
});

function randomSequence(values: number[]) {
  let index = 0;

  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function buildHarness(addresses: CrawledAddressFixture[], smartyClient: SmartyLookupClient, options: {
  fetcher?: CrawlFetcher;
} = {}) {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const config = resolveServerConfig(testEnv);
  const settingsService = new SettingsService(database, config, {
    async testConnection() {
      return { ok: true };
    },
  });
  settingsService.ensureDefaultSettings();
  settingsService.saveSmartySettings({
    authId: 'smarty-auth-id',
    authToken: 'smarty-auth-token',
  });
  const taskService = new TaskService(database);
  const fetcher = options.fetcher ?? createFixtureFetcher(addresses);
  const pipeline = new CrawlPipeline({
    database,
    taskService,
    settingsService,
    fetcher,
    smartyClient,
    startUrl,
    concurrency: 1,
  });

  return { database, settingsService, taskService, pipeline };
}

interface CrawledAddressFixture {
  name: string;
  detailUrl: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  price: string;
  signupUrl: string;
  mailboxNumbers: string[];
}

function crawledAddress(input: Omit<CrawledAddressFixture, 'state' | 'signupUrl'> & {
  state?: string;
  signupUrl?: string;
}): CrawledAddressFixture {
  const slug = new URL(input.detailUrl).pathname.split('/').filter(Boolean).pop() ?? 'address';

  return {
    state: input.state ?? 'AL',
    signupUrl: input.signupUrl ?? `https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=${slug}`,
    ...input,
  };
}

function createFixtureFetcher(addresses: CrawledAddressFixture[]): CrawlFetcher {
  const pages = new Map<string, string>();
  pages.set(startUrl, indexPage(addresses.length));
  pages.set(stateUrl, statePage(addresses));

  for (const address of addresses) {
    pages.set(address.detailUrl, detailPage(address));
    pages.set(address.signupUrl, signupPage(address.mailboxNumbers));
  }

  return {
    async fetchHtml(url: string): Promise<CrawlFetchResult> {
      const html = pages.get(url);
      if (!html) {
        throw new Error(`Missing fixture page for ${url}`);
      }

      return {
        url,
        finalUrl: url,
        html,
        status: 200,
        contentType: 'text/html; charset=utf-8',
      };
    },
  };
}

function indexPage(count: number) {
  return `
    <div class="loc-list-container">
      <a href="/l/usa/alabama">Alabama <span>${count}</span></a>
    </div>
  `;
}

function statePage(addresses: CrawledAddressFixture[]) {
  return addresses.map((address) => `
    <div class="theme-location-item">
      <div class="t-title">${address.name}</div>
      <div class="t-addr">${address.street}<br>${address.city}, ${address.state} ${address.zip}</div>
      <div class="t-price">Starting from <b>${address.price}</b> / month</div>
      <a class="gt-plan" href="${address.detailUrl}">Select Plan</a>
    </div>
  `).join('');
}

function detailPage(address: CrawledAddressFixture) {
  return `
    <a id="myear" href="${address.signupUrl}">Select Plan</a>
    <div class="t-addr">
      <div class="t-text">
        <div>${address.name}</div>
        <div>${address.street}</div>
        <div>Unit - #</div>
        <div>${address.city}, ${address.state} ${address.zip}</div>
        <div>United States</div>
      </div>
    </div>
  `;
}

function signupPage(numbers: string[]) {
  return `
    <select id="f_boxid">
      ${numbers.map((number) => `<option>${number}</option>`).join('')}
    </select>
  `;
}

function insertAddress(database: DatabaseContext, input: {
  name: string;
  slug: string;
  anytimeUrl: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  priceCents: number;
  rdi: 'Residential' | 'Commercial';
  cmra: 'Yes' | 'No';
  smartyCheckedAt: string;
  smartyRaw?: string;
}) {
  const now = new Date().toISOString();
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
        'anytimemailbox', NULL, @name, @slug, @anytimeUrl, NULL, NULL,
        'United States', @state, 'Alabama', @city, @streetAddress, @postalCode, @fullAddress,
        @priceCents, 'USD', 'month', @rdi, @cmra, @smartyRaw, @smartyCheckedAt,
        NULL, NULL, NULL, NULL,
        0, 1, 1, NULL, @now, @now,
        NULL, @now, @now
      )
    `)
    .run({
      ...input,
      stateName: 'Alabama',
      fullAddress: `${input.streetAddress} ${input.city}, ${input.state} ${input.postalCode} United States`,
      smartyRaw: input.smartyRaw ?? '{"cached":true}',
      now,
    });
}

function assertTaskCompleted(database: DatabaseContext, taskId: number) {
  const task = database.sqlite
    .prepare('SELECT status, pending_count AS pendingCount, failed_count AS failedCount FROM crawl_tasks WHERE id = ?')
    .get(taskId) as { status: string; pendingCount: number; failedCount: number };

  assert.equal(task.status, 'completed');
  assert.equal(task.pendingCount, 0);
  assert.equal(task.failedCount, 0);
}
