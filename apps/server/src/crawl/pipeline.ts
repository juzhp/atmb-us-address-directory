import axios, { type AxiosRequestConfig } from 'axios';
import type { DatabaseContext } from '@atmb/db';
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AddressCmra, AddressRdi, AdminSubtaskType } from '@atmb/shared';

import { proxyUrlToAxiosProxy, type CrawlProxy } from '../proxy.js';
import type { SettingsService } from '../settings/service.js';
import type { TaskService } from '../tasks/service.js';
import {
  DEFAULT_CRAWL_HEADERS,
  normalizeAddressKey,
  normalizeText,
  parseLocationDetail,
  parseLocationList,
  parseMailboxNumberRange,
  parsePriceCents,
  parseStateList,
  slugify,
  stateCodeForName,
  type ParsedLocation,
  type ParsedState,
} from './parser.js';

export interface CrawlFetchResult {
  url: string;
  finalUrl: string;
  html: string;
  status: number;
  contentType?: string;
}

export interface CrawlFetchOptions {
  referer?: string;
  preserveRedirectCookies?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface CrawlFetcher {
  fetchHtml(url: string, options?: CrawlFetchOptions): Promise<CrawlFetchResult>;
}

export interface HttpCrawlFetcherOptions {
  random?: () => number;
  requestDelayMs?: { min: number; max: number };
  sleep?: (delayMs: number) => Promise<void>;
  curlFetch?: (url: string, options: { headers: Record<string, string>; proxy?: CrawlProxy | null; signal?: AbortSignal }) => Promise<CrawlFetchResult>;
  proxyProvider?: () => CrawlProxy | null;
}

export interface SmartyCredentials {
  authId: string;
  authToken: string;
}

export interface SmartyLookupInput {
  inputId: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface SmartyLookupResult {
  inputId: string;
  rdi?: AddressRdi;
  cmra?: AddressCmra;
  raw?: unknown;
  error?: string;
}

export interface SmartyLookupClient {
  lookupAddresses(credentials: SmartyCredentials, inputs: SmartyLookupInput[], options?: RunTaskOptions): Promise<SmartyLookupResult[]>;
}

export interface RunTaskOptions {
  signal?: AbortSignal;
}

class TaskPausedError extends Error {
  constructor() {
    super('TASK_PAUSED');
  }
}

class TaskStoppedError extends Error {
  constructor() {
    super('TASK_STOPPED');
  }
}

export interface CrawlPipelineOptions {
  database: DatabaseContext;
  taskService: TaskService;
  settingsService: SettingsService;
  fetcher?: CrawlFetcher;
  smartyClient?: SmartyLookupClient;
  startUrl?: string;
  concurrency?: number;
}

interface StateWithCode extends ParsedState {
  code: string;
  slug: string;
}

interface LocationWithState {
  state: StateWithCode;
  location: ParsedLocation;
}

interface StageRow {
  id: number;
  taskId: number;
  name: string;
  slug: string;
  anytimeUrl: string;
  signupUrl: string | null;
  myearUrl: string | null;
  country: string;
  state: string;
  stateName: string;
  stateUrl: string;
  city: string;
  streetAddress: string;
  postalCode: string;
  fullAddress: string;
  normalizedAddressKey: string;
  priceCents: number;
  priceCurrency: string;
  pricePeriod: string;
  mailboxMin: number | null;
  mailboxMax: number | null;
  mailboxCount: number | null;
  mailboxNumbersJson: string | null;
  rdi: AddressRdi | null;
  cmra: AddressCmra | null;
  smartyRaw: string | null;
  smartyCheckedAt: string | null;
  smartyError: string | null;
  smartySourceAddressId: number | null;
  importedAddressId: number | null;
}

interface AddressCacheRow {
  id: number;
  anytimeUrl: string;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  priceCents: number;
  rdi: AddressRdi;
  cmra: AddressCmra;
  smartyRaw: string | null;
  smartyCheckedAt: string;
  isActive: number;
}

const execFileAsync = promisify(execFile);
const CURL_META_MARKER = '\\n__ATMB_CURL_META__';

const DEFAULT_START_URL = 'https://www.anytimemailbox.com/l/usa';
const DEFAULT_REQUEST_DELAY_MS = Object.freeze({ min: 200, max: 900 });
const CRAWL_HEADER_PROFILES = Object.freeze([
  DEFAULT_CRAWL_HEADERS,
  Object.freeze({
    ...DEFAULT_CRAWL_HEADERS,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.7,zh;q=0.6',
  }),
  Object.freeze({
    ...DEFAULT_CRAWL_HEADERS,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    'Accept-Language': 'en-US,en;q=0.9',
  }),
]);
const SMARTY_BATCH_LIMIT = 100;
const SMARTY_BODY_LIMIT_BYTES = 32 * 1024;

export class CrawlPipeline {
  private readonly fetcher: CrawlFetcher;
  private readonly smartyClient: SmartyLookupClient;
  private readonly startUrl: string;
  private readonly concurrency: number;

  constructor(private readonly options: CrawlPipelineOptions) {
    this.fetcher = options.fetcher ?? new HttpCrawlFetcher({
      proxyProvider: () => options.settingsService.getRandomActiveProxy(),
    });
    this.smartyClient = options.smartyClient ?? new HttpSmartyLookupClient();
    this.startUrl = options.startUrl ?? DEFAULT_START_URL;
    this.concurrency = Math.max(1, options.concurrency ?? 2);
  }

  async runTask(taskId: number, runOptions: RunTaskOptions = {}) {
    let locations: LocationWithState[] = [];
    const hasFetchStates = this.options.taskService.hasSubtask(taskId, 'fetch_states');
    const hasFetchNames = this.options.taskService.hasSubtask(taskId, 'fetch_names');
    const hasFetchAddresses = this.options.taskService.hasSubtask(taskId, 'fetch_addresses');
    const hasFetchMailboxNumbers = this.options.taskService.hasSubtask(taskId, 'fetch_mailbox_numbers');
    const hasSyncSmarty = this.options.taskService.hasSubtask(taskId, 'sync_smarty');

    try {
      const states = hasFetchStates
        ? (
            this.options.taskService.isSubtaskSuccessful(taskId, 'fetch_states')
              ? this.loadStatesFromDatabase()
              : await this.runSubtask(taskId, 'fetch_states', () => this.fetchStates(runOptions), runOptions)
          )
        : [];

      const needsAddressEntries = hasFetchAddresses && !this.options.taskService.isSubtaskSuccessful(taskId, 'fetch_addresses');
      const needsLocationNames = hasFetchNames && (needsAddressEntries || !this.options.taskService.isSubtaskSuccessful(taskId, 'fetch_names'));
      if (needsLocationNames) {
        locations = this.options.taskService.isSubtaskSuccessful(taskId, 'fetch_names')
          ? await this.fetchLocationNames(taskId, states, runOptions)
          : await this.runSubtask(taskId, 'fetch_names', () => this.fetchLocationNames(taskId, states, runOptions), runOptions);
      }

      if (needsAddressEntries) {
        await this.runSubtask(
          taskId,
          'fetch_addresses',
          () => hasFetchNames
            ? this.fetchAddressDetails(taskId, locations, runOptions)
            : this.fetchStagedAddressDetails(taskId, runOptions),
          runOptions,
        );
      }

      if (hasFetchMailboxNumbers && !this.options.taskService.isSubtaskSuccessful(taskId, 'fetch_mailbox_numbers')) {
        await this.runSubtask(taskId, 'fetch_mailbox_numbers', () => this.fetchMailboxNumbers(taskId, runOptions), runOptions);
        if (!hasSyncSmarty) {
          this.applyMailboxUpdatesToImportedAddresses(taskId);
        }
      }

      if (hasSyncSmarty && !this.options.taskService.isSubtaskSuccessful(taskId, 'sync_smarty')) {
        await this.runSubtask(taskId, 'sync_smarty', async () => {
          const synced = await this.syncSmarty(taskId, runOptions);
          return synced.pendingCount === 0 ? 'No new Smarty addresses' : null;
        }, runOptions);
      }
    } catch (error) {
      if (error instanceof TaskPausedError || error instanceof TaskStoppedError) {
        return;
      }
      this.options.taskService.completeTask(taskId);
      throw error;
    }

    if (hasFetchStates && hasFetchNames && hasSyncSmarty) {
      this.markMissingAddressesRemoved(taskId);
      this.refreshStateCounts();
    }
    this.options.taskService.completeTask(taskId);
  }

  private async runSubtask<T>(
    taskId: number,
    taskType: AdminSubtaskType,
    action: () => Promise<T>,
    runOptions: RunTaskOptions,
  ) {
    await this.checkTaskControl(taskId, taskType, runOptions);
    this.options.taskService.markSubtaskRunning(taskId, taskType);

    try {
      const result = await action();
      await this.checkTaskControl(taskId, taskType, runOptions);
      const successMessage = typeof result === 'string' ? result : null;
      this.options.taskService.markSubtaskSuccess(taskId, taskType, successMessage);

      return result;
    } catch (error) {
      if (error instanceof TaskPausedError) {
        this.options.taskService.markTaskPaused(taskId, taskType);
        throw error;
      }
      if (error instanceof TaskStoppedError || runOptions.signal?.aborted || isAbortError(error)) {
        this.options.taskService.markTaskStopped(taskId);
        throw new TaskStoppedError();
      }
      this.options.taskService.markSubtaskFailed(taskId, taskType, error);
      throw error;
    }
  }

  private loadStatesFromDatabase() {
    const rows = this.options.database.sqlite
      .prepare(`
        SELECT
          name,
          code,
          slug,
          anytime_url AS url,
          location_count AS count
        FROM states
        WHERE anytime_url IS NOT NULL
        ORDER BY name ASC
      `)
      .all() as StateWithCode[];

    if (rows.length === 0) {
      throw new Error('No saved states found for task resume');
    }

    return rows;
  }

  private async checkTaskControl(taskId: number, taskType: AdminSubtaskType, runOptions: RunTaskOptions) {
    if (runOptions.signal?.aborted) {
      throw new TaskStoppedError();
    }

    const status = this.options.taskService.getTaskStatus(taskId);
    if (status === 'stop_requested' || status === 'stopped') {
      throw new TaskStoppedError();
    }
    if (status === 'pause_requested' || status === 'paused') {
      throw new TaskPausedError();
    }
    if (!status) {
      throw new Error(`Task ${taskId} not found while running ${taskType}`);
    }
  }

  private async fetchStates(runOptions: RunTaskOptions) {
    const result = await this.fetcher.fetchHtml(this.startUrl, { signal: runOptions.signal });
    const parsedStates = parseStateList(result.html, this.startUrl);
    const targetStates = parsedStates
      .filter((state) => typeof state.count !== 'number' || state.count > 0)
      .map((state): StateWithCode => ({
        ...state,
        code: stateCodeForName(state.name),
        slug: slugify(state.name),
      }));

    if (targetStates.length === 0) {
      throw new Error('未从 Anytime Mailbox 入口页解析到任何州');
    }

    const now = new Date().toISOString();
    const upsert = this.options.database.sqlite.prepare(`
      INSERT INTO states (
        name, code, slug, country, anytime_url, location_count, last_crawled_at, created_at, updated_at
      ) VALUES (
        @name, @code, @slug, 'United States', @url, @locationCount, @now, @now, @now
      )
      ON CONFLICT(code) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        anytime_url = excluded.anytime_url,
        location_count = excluded.location_count,
        last_crawled_at = excluded.last_crawled_at,
        updated_at = excluded.updated_at
    `);

    for (const state of targetStates) {
      upsert.run({
        name: state.name,
        code: state.code,
        slug: state.slug,
        url: state.url,
        locationCount: state.count ?? 0,
        now,
      });
    }

    return targetStates;
  }

  private async fetchLocationNames(taskId: number, states: StateWithCode[], runOptions: RunTaskOptions) {
    const locations: LocationWithState[] = [];

    await this.mapWithConcurrency(states, async (state) => {
      await this.checkTaskControl(taskId, 'fetch_names', runOptions);
      const result = await this.fetcher.fetchHtml(state.url, { signal: runOptions.signal });
      const stateLocations = parseLocationList(result.html, state.url);

      for (const location of stateLocations) {
        locations.push({ state, location });
      }
    });

    if (locations.length === 0) {
      throw new Error('No address entries parsed from Anytime Mailbox state pages');
    }

    return locations;
  }

  private getExistingStageUrls(taskId: number) {
    const rows = this.options.database.sqlite
      .prepare('SELECT anytime_url AS anytimeUrl, myear_url AS myearUrl FROM crawl_discovered_addresses WHERE task_id = ?')
      .all(taskId) as Array<{ anytimeUrl: string; myearUrl: string | null }>;

    return new Map(rows.map((row) => [row.anytimeUrl, row]));
  }

  private async fetchAddressDetails(taskId: number, locations: LocationWithState[], runOptions: RunTaskOptions) {
    const existingUrls = this.getExistingStageUrls(taskId);

    await this.mapWithConcurrency(locations, async ({ state, location }) => {
      await this.checkTaskControl(taskId, 'fetch_addresses', runOptions);
      const existing = existingUrls.get(location.url);
      if (existing?.myearUrl) {
        return;
      }

      const detailResult = await this.fetcher.fetchHtml(location.url, {
        referer: state.url,
        signal: runOptions.signal,
      });
      const detail = parseLocationDetail(detailResult.html, location.url);

      if (!detail.myearUrl) {
        this.markAddressDetailSkipped(taskId, state, location, createMissingSignupMessage(location.url, detailResult));
        return;
      }

      const fallback = parseListAddress(location.address);
      const streetAddress = detail.address || fallback.streetAddress;
      const city = detail.city || fallback.city;
      const addressState = detail.state || fallback.state || state.code;
      const postalCode = detail.zip || fallback.postalCode;
      const country = detail.country || 'United States';

      if (!streetAddress || !city || !addressState || !postalCode) {
        throw new Error(`Unable to parse address detail: ${location.url}`);
      }

      const fullAddress = detail.detailAddress
        || `${streetAddress} ${city}, ${addressState} ${postalCode} ${country}`;
      const priceCents = parsePriceCents(location.price);
      const normalizedKey = normalizeAddressKey({
        streetAddress,
        city,
        state: addressState,
        postalCode,
      });
      const now = new Date().toISOString();

      this.options.database.sqlite
        .prepare(`
          INSERT INTO crawl_discovered_addresses (
            task_id, source, source_id, state_name, state, state_url, state_location_count,
            name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
            postal_code, full_address, normalized_address_key, price_cents, price_currency,
            price_period, crawl_status, created_at, updated_at
          ) VALUES (
            @taskId, 'anytimemailbox', @sourceId, @stateName, @state, @stateUrl, @stateLocationCount,
            @name, @slug, @anytimeUrl, @signupUrl, @myearUrl, @country, @city, @streetAddress,
            @postalCode, @fullAddress, @normalizedAddressKey, @priceCents, 'USD',
            'month', 'discovered', @now, @now
          )
          ON CONFLICT(task_id, anytime_url) DO UPDATE SET
            source_id = excluded.source_id,
            state_name = excluded.state_name,
            state = excluded.state,
            state_url = excluded.state_url,
            state_location_count = excluded.state_location_count,
            name = excluded.name,
            slug = excluded.slug,
            signup_url = excluded.signup_url,
            myear_url = excluded.myear_url,
            country = excluded.country,
            city = excluded.city,
            street_address = excluded.street_address,
            postal_code = excluded.postal_code,
            full_address = excluded.full_address,
            normalized_address_key = excluded.normalized_address_key,
            price_cents = excluded.price_cents,
            updated_at = excluded.updated_at
        `)
        .run({
          taskId,
          sourceId: sourceIdFromUrl(location.url),
          stateName: state.name,
          state: addressState,
          stateUrl: state.url,
          stateLocationCount: state.count,
          name: location.name,
          slug: slugify(`${location.name}-${city}-${addressState}-${postalCode}`),
          anytimeUrl: location.url,
          signupUrl: detail.myearUrl,
          myearUrl: detail.myearUrl,
          country,
          city,
          streetAddress,
          postalCode,
          fullAddress,
          normalizedAddressKey: normalizedKey,
          priceCents,
          now,
      });
    });
  }

  private async fetchStagedAddressDetails(taskId: number, runOptions: RunTaskOptions) {
    const rows = this.options.database.sqlite
      .prepare(`
        SELECT
          state_name AS stateName,
          state,
          state_url AS stateUrl,
          state_location_count AS stateLocationCount,
          name,
          anytime_url AS anytimeUrl,
          city,
          street_address AS streetAddress,
          postal_code AS postalCode,
          price_cents AS priceCents
        FROM crawl_discovered_addresses
        WHERE task_id = ?
          AND crawl_status <> 'skipped'
      `)
      .all(taskId) as Array<{
        stateName: string;
        state: string;
        stateUrl: string;
        stateLocationCount: number | null;
        name: string;
        anytimeUrl: string;
        city: string;
        streetAddress: string;
        postalCode: string;
        priceCents: number;
      }>;
    const locations = rows.map((row): LocationWithState => ({
      state: {
        name: row.stateName,
        code: row.state,
        slug: slugify(row.stateName),
        url: row.stateUrl,
        count: row.stateLocationCount,
      },
      location: {
        name: row.name,
        address: `${row.streetAddress} ${row.city}, ${row.state} ${row.postalCode}`,
        price: `US$ ${(row.priceCents / 100).toFixed(2)}`,
        url: row.anytimeUrl,
      },
    }));

    await this.fetchAddressDetails(taskId, locations, runOptions);
  }

  private markAddressDetailSkipped(taskId: number, state: StateWithCode, location: ParsedLocation, errorMessage: string) {
    const fallback = parseListAddress(location.address);
    const streetAddress = fallback.streetAddress;
    const city = fallback.city;
    const addressState = fallback.state || state.code;
    const postalCode = fallback.postalCode;

    if (!streetAddress || !city || !addressState || !postalCode) {
      throw new Error(`Unable to parse skipped address detail fallback: ${location.url}`);
    }

    const fullAddress = `${streetAddress} ${city}, ${addressState} ${postalCode} United States`;
    const normalizedKey = normalizeAddressKey({
      streetAddress,
      city,
      state: addressState,
      postalCode,
    });
    const now = new Date().toISOString();

    this.options.database.sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, crawl_status, error_message, created_at, updated_at
        ) VALUES (
          @taskId, 'anytimemailbox', @sourceId, @stateName, @state, @stateUrl, @stateLocationCount,
          @name, @slug, @anytimeUrl, NULL, NULL, 'United States', @city, @streetAddress,
          @postalCode, @fullAddress, @normalizedAddressKey, @priceCents, 'USD',
          'month', 'skipped', @errorMessage, @now, @now
        )
        ON CONFLICT(task_id, anytime_url) DO UPDATE SET
          source_id = excluded.source_id,
          state_name = excluded.state_name,
          state = excluded.state,
          state_url = excluded.state_url,
          state_location_count = excluded.state_location_count,
          name = excluded.name,
          slug = excluded.slug,
          country = excluded.country,
          city = excluded.city,
          street_address = excluded.street_address,
          postal_code = excluded.postal_code,
          full_address = excluded.full_address,
          normalized_address_key = excluded.normalized_address_key,
          price_cents = excluded.price_cents,
          crawl_status = excluded.crawl_status,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at
      `)
      .run({
        taskId,
        sourceId: sourceIdFromUrl(location.url),
        stateName: state.name,
        state: addressState,
        stateUrl: state.url,
        stateLocationCount: state.count,
        name: location.name,
        slug: slugify(`${location.name}-${city}-${addressState}-${postalCode}`),
        anytimeUrl: location.url,
        city,
        streetAddress,
        postalCode,
        fullAddress,
        normalizedAddressKey: normalizedKey,
        priceCents: parsePriceCents(location.price),
        errorMessage,
        now,
      });
  }

  private async fetchMailboxNumbers(taskId: number, runOptions: RunTaskOptions) {
    const rows = this.options.database.sqlite
      .prepare(`
        SELECT id, anytime_url AS anytimeUrl, myear_url AS myearUrl
        FROM crawl_discovered_addresses
        WHERE task_id = ?
          AND myear_url IS NOT NULL
          AND mailbox_numbers_json IS NULL
      `)
      .all(taskId) as Array<{ id: number; anytimeUrl: string; myearUrl: string | null }>;

    await this.mapWithConcurrency(rows, async (row) => {
      await this.checkTaskControl(taskId, 'fetch_mailbox_numbers', runOptions);
      const myearUrl = row.myearUrl || await this.refetchMailboxSignupUrl(row.id, row.anytimeUrl, runOptions);

      if (!myearUrl) {
        throw new Error(`Unable to parse mailbox signup link: ${row.anytimeUrl}`);
      }

      const result = await this.fetcher.fetchHtml(myearUrl, {
        referer: row.anytimeUrl,
        preserveRedirectCookies: true,
        signal: runOptions.signal,
      });
      const mailbox = parseMailboxNumberRange(result.html);
      const now = new Date().toISOString();

      this.options.database.sqlite
        .prepare(`
          UPDATE crawl_discovered_addresses
          SET
            mailbox_min = @mailboxMin,
            mailbox_max = @mailboxMax,
            mailbox_count = @mailboxCount,
            mailbox_numbers_json = @mailboxNumbersJson,
            crawl_status = 'mailbox_fetched',
            updated_at = @updatedAt
          WHERE id = @id
        `)
        .run({
          id: row.id,
          mailboxMin: mailbox.mailboxMin,
          mailboxMax: mailbox.mailboxMax,
          mailboxCount: mailbox.mailboxNumbers.length,
          mailboxNumbersJson: JSON.stringify(mailbox.mailboxNumbers),
          updatedAt: now,
      });
    });
  }

  private applyMailboxUpdatesToImportedAddresses(taskId: number) {
    const rows = this.options.database.sqlite
      .prepare(`
        SELECT
          id,
          imported_address_id AS importedAddressId,
          signup_url AS signupUrl,
          myear_url AS myearUrl,
          mailbox_min AS mailboxMin,
          mailbox_max AS mailboxMax,
          mailbox_count AS mailboxCount,
          mailbox_numbers_json AS mailboxNumbersJson
        FROM crawl_discovered_addresses
        WHERE task_id = ?
          AND imported_address_id IS NOT NULL
          AND mailbox_numbers_json IS NOT NULL
      `)
      .all(taskId) as Array<{
        id: number;
        importedAddressId: number;
        signupUrl: string | null;
        myearUrl: string | null;
        mailboxMin: number | null;
        mailboxMax: number | null;
        mailboxCount: number | null;
        mailboxNumbersJson: string;
      }>;
    const now = new Date().toISOString();
    const updateAddress = this.options.database.sqlite.prepare(`
      UPDATE addresses
      SET
        signup_url = @signupUrl,
        mailbox_min = @mailboxMin,
        mailbox_max = @mailboxMax,
        mailbox_count = @mailboxCount,
        mailbox_numbers_json = @mailboxNumbersJson,
        last_crawled_at = @now,
        updated_at = @now
      WHERE id = @addressId
    `);
    const updateStage = this.options.database.sqlite.prepare(`
      UPDATE crawl_discovered_addresses
      SET crawl_status = 'imported', updated_at = @now
      WHERE id = @stageId
    `);

    this.options.database.sqlite.transaction(() => {
      for (const row of rows) {
        updateAddress.run({
          addressId: row.importedAddressId,
          signupUrl: row.signupUrl ?? row.myearUrl,
          mailboxMin: row.mailboxMin,
          mailboxMax: row.mailboxMax,
          mailboxCount: row.mailboxCount,
          mailboxNumbersJson: row.mailboxNumbersJson,
          now,
        });
        updateStage.run({
          stageId: row.id,
          now,
        });
      }
    })();
  }

  private async refetchMailboxSignupUrl(addressId: number, anytimeUrl: string, runOptions: RunTaskOptions) {
    const detailResult = await this.fetcher.fetchHtml(anytimeUrl, {
      signal: runOptions.signal,
    });
    const detail = parseLocationDetail(detailResult.html, anytimeUrl);

    if (!detail.myearUrl) {
      throw createMissingSignupLinkError(anytimeUrl, detailResult);
    }

    this.options.database.sqlite
      .prepare(`
        UPDATE crawl_discovered_addresses
        SET signup_url = @myearUrl, myear_url = @myearUrl, updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        id: addressId,
        myearUrl: detail.myearUrl,
        updatedAt: new Date().toISOString(),
      });

    return detail.myearUrl;
  }

  private async syncSmarty(taskId: number, runOptions: RunTaskOptions) {
    const rows = this.getStageRows(taskId);

    if (rows.length === 0) {
      return { pendingCount: 0 };
    }

    const pending: StageRow[] = [];

    for (const row of rows) {
      await this.checkTaskControl(taskId, 'sync_smarty', runOptions);
      if (row.rdi && row.cmra && row.smartyCheckedAt) {
        this.upsertAddressFromStage(row);
        continue;
      }

      const cached = this.findSuccessfulSmartyCache(row);
      if (cached) {
        const enriched = this.applyCachedSmarty(row, cached);
        this.upsertAddressFromStage(enriched);
      } else {
        pending.push(row);
        this.markStageSmartyPending(row.id);
      }
    }

    if (pending.length === 0) {
      return { pendingCount: 0 };
    }

    const credentials = this.options.settingsService.getSmartyCredentials();
    if (!credentials) {
      throw new Error('SMARTY_NOT_CONFIGURED');
    }

    const inputs = pending.map((row): SmartyLookupInput => ({
      inputId: String(row.id),
      streetAddress: row.streetAddress,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
    }));

    for (const chunk of chunkSmartyInputs(inputs)) {
      await this.checkTaskControl(taskId, 'sync_smarty', runOptions);
      const results = await this.smartyClient.lookupAddresses(credentials, chunk, runOptions);
      const byInputId = new Map(results.map((result) => [result.inputId, result]));

      for (const input of chunk) {
        await this.checkTaskControl(taskId, 'sync_smarty', runOptions);
        const result = byInputId.get(input.inputId);
        const stage = pending.find((item) => String(item.id) === input.inputId);
        if (!stage) continue;

        if (!result) {
          this.markStageSmartyFailed(stage.id, 'Smarty did not return this address result');
          continue;
        }

        const mapped = normalizeSmartyResult(result);
        if (!mapped.rdi || !mapped.cmra) {
          this.markStageSmartyFailed(stage.id, result.error || 'Smarty result missing valid RDI/CMRA');
          continue;
        }

        const enriched = this.applySmartyResult(stage, {
          rdi: mapped.rdi,
          cmra: mapped.cmra,
          raw: mapped.raw,
        });
        this.upsertAddressFromStage(enriched);
      }
    }

    return { pendingCount: pending.length };
  }

  private getStageRows(taskId: number) {
    return this.options.database.sqlite
      .prepare(`
        SELECT
          id,
          task_id AS taskId,
          name,
          slug,
          anytime_url AS anytimeUrl,
          signup_url AS signupUrl,
          myear_url AS myearUrl,
          country,
          state,
          state_name AS stateName,
          state_url AS stateUrl,
          city,
          street_address AS streetAddress,
          postal_code AS postalCode,
          full_address AS fullAddress,
          normalized_address_key AS normalizedAddressKey,
          price_cents AS priceCents,
          price_currency AS priceCurrency,
          price_period AS pricePeriod,
          mailbox_min AS mailboxMin,
          mailbox_max AS mailboxMax,
          mailbox_count AS mailboxCount,
          mailbox_numbers_json AS mailboxNumbersJson,
          rdi,
          cmra,
          smarty_raw AS smartyRaw,
          smarty_checked_at AS smartyCheckedAt,
          smarty_error AS smartyError,
          smarty_source_address_id AS smartySourceAddressId,
          imported_address_id AS importedAddressId
        FROM crawl_discovered_addresses
        WHERE task_id = ?
          AND crawl_status <> 'skipped'
        ORDER BY id ASC
      `)
      .all(taskId) as StageRow[];
  }

  private findSuccessfulSmartyCache(row: StageRow) {
    const byUrl = this.options.database.sqlite
      .prepare(`
        SELECT
          id,
          anytime_url AS anytimeUrl,
          name,
          street_address AS streetAddress,
          city,
          state,
          postal_code AS postalCode,
          price_cents AS priceCents,
          rdi,
          cmra,
          smarty_raw AS smartyRaw,
          smarty_checked_at AS smartyCheckedAt,
          is_active AS isActive
        FROM addresses
        WHERE anytime_url = ?
          AND smarty_checked_at IS NOT NULL
          AND rdi IN ('Residential', 'Commercial')
          AND cmra IN ('Yes', 'No')
        LIMIT 1
      `)
      .get(row.anytimeUrl) as AddressCacheRow | undefined;

    if (byUrl) {
      return byUrl;
    }

    const candidates = this.options.database.sqlite
      .prepare(`
        SELECT
          id,
          anytime_url AS anytimeUrl,
          name,
          street_address AS streetAddress,
          city,
          state,
          postal_code AS postalCode,
          price_cents AS priceCents,
          rdi,
          cmra,
          smarty_raw AS smartyRaw,
          smarty_checked_at AS smartyCheckedAt,
          is_active AS isActive
        FROM addresses
        WHERE state = @state
          AND postal_code = @postalCode
          AND smarty_checked_at IS NOT NULL
          AND rdi IN ('Residential', 'Commercial')
          AND cmra IN ('Yes', 'No')
      `)
      .all({
        state: row.state,
        postalCode: row.postalCode,
      }) as AddressCacheRow[];

    return candidates.find((candidate) => normalizeAddressKey({
      streetAddress: candidate.streetAddress,
      city: candidate.city,
      state: candidate.state,
      postalCode: candidate.postalCode,
    }) === row.normalizedAddressKey) ?? null;
  }

  private applyCachedSmarty(row: StageRow, cached: AddressCacheRow) {
    const now = new Date().toISOString();
    const enriched: StageRow = {
      ...row,
      rdi: cached.rdi,
      cmra: cached.cmra,
      smartyRaw: cached.smartyRaw,
      smartyCheckedAt: cached.smartyCheckedAt,
      smartySourceAddressId: cached.id,
    };

    this.options.database.sqlite
      .prepare(`
        UPDATE crawl_discovered_addresses
        SET
          rdi = @rdi,
          cmra = @cmra,
          smarty_raw = @smartyRaw,
          smarty_checked_at = @smartyCheckedAt,
          smarty_error = NULL,
          smarty_source_address_id = @smartySourceAddressId,
          crawl_status = 'smarty_reused',
          updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        id: row.id,
        rdi: enriched.rdi,
        cmra: enriched.cmra,
        smartyRaw: enriched.smartyRaw,
        smartyCheckedAt: enriched.smartyCheckedAt,
        smartySourceAddressId: enriched.smartySourceAddressId,
        updatedAt: now,
      });

    return enriched;
  }

  private applySmartyResult(row: StageRow, result: Required<Pick<SmartyLookupResult, 'rdi' | 'cmra'>> & Pick<SmartyLookupResult, 'raw'>) {
    const now = new Date().toISOString();
    const enriched: StageRow = {
      ...row,
      rdi: result.rdi,
      cmra: result.cmra,
      smartyRaw: JSON.stringify(result.raw ?? {}),
      smartyCheckedAt: now,
      smartyError: null,
    };

    this.options.database.sqlite
      .prepare(`
        UPDATE crawl_discovered_addresses
        SET
          rdi = @rdi,
          cmra = @cmra,
          smarty_raw = @smartyRaw,
          smarty_checked_at = @smartyCheckedAt,
          smarty_error = NULL,
          crawl_status = 'imported',
          updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        id: row.id,
        rdi: enriched.rdi,
        cmra: enriched.cmra,
        smartyRaw: enriched.smartyRaw,
        smartyCheckedAt: enriched.smartyCheckedAt,
        updatedAt: now,
      });

    return enriched;
  }

  private markStageSmartyPending(id: number) {
    this.options.database.sqlite
      .prepare(`
        UPDATE crawl_discovered_addresses
        SET crawl_status = 'smarty_pending', smarty_error = NULL, updated_at = ?
        WHERE id = ?
      `)
      .run(new Date().toISOString(), id);
  }

  private markStageSmartyFailed(id: number, error: string) {
    this.options.database.sqlite
      .prepare(`
        UPDATE crawl_discovered_addresses
        SET crawl_status = 'smarty_failed', smarty_error = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(error, new Date().toISOString(), id);
  }

  private upsertAddressFromStage(row: StageRow) {
    if (!row.rdi || !row.cmra || !row.smartyCheckedAt) {
      return null;
    }

    const now = new Date().toISOString();
    const target = row.smartySourceAddressId
      ? this.getAddressById(row.smartySourceAddressId)
      : this.getAddressByAnytimeUrl(row.anytimeUrl);

    if (target) {
      this.options.database.sqlite
        .prepare(`
          UPDATE addresses
          SET
            source = 'anytimemailbox',
            source_id = @sourceId,
            name = @name,
            slug = @slug,
            anytime_url = @anytimeUrl,
            signup_url = @signupUrl,
            country = @country,
            state = @state,
            state_name = @stateName,
            city = @city,
            street_address = @streetAddress,
            postal_code = @postalCode,
            full_address = @fullAddress,
            price_cents = @priceCents,
            price_currency = @priceCurrency,
            price_period = @pricePeriod,
            rdi = @rdi,
            cmra = @cmra,
            smarty_raw = @smartyRaw,
            smarty_checked_at = @smartyCheckedAt,
            mailbox_min = @mailboxMin,
            mailbox_max = @mailboxMax,
            mailbox_count = @mailboxCount,
            mailbox_numbers_json = @mailboxNumbersJson,
            is_active = 1,
            removed_at = NULL,
            last_crawled_at = @now,
            updated_at = @now
          WHERE id = @id
        `)
        .run({
          ...addressSqlValues(row),
          id: target.id,
          now,
        });

      if (target.priceCents !== row.priceCents) {
        this.recordAddressEvent(target.id, 'price_changed', String(target.priceCents), String(row.priceCents));
      }
      if (!target.isActive) {
        this.recordAddressEvent(target.id, 'restored', '0', '1');
      }
      this.markStageImported(row.id, target.id);

      return target.id;
    }

    const result = this.options.database.sqlite
      .prepare(`
        INSERT INTO addresses (
          source, source_id, name, slug, anytime_url, signup_url, google_maps_url,
          country, state, state_name, city, street_address, postal_code, full_address,
          price_cents, price_currency, price_period, rdi, cmra, smarty_raw, smarty_checked_at,
          mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
          is_featured, is_active, is_visible, status_note, last_crawled_at, first_seen_at,
          removed_at, created_at, updated_at
        ) VALUES (
          'anytimemailbox', @sourceId, @name, @slug, @anytimeUrl, @signupUrl, NULL,
          @country, @state, @stateName, @city, @streetAddress, @postalCode, @fullAddress,
          @priceCents, @priceCurrency, @pricePeriod, @rdi, @cmra, @smartyRaw, @smartyCheckedAt,
          @mailboxMin, @mailboxMax, @mailboxCount, @mailboxNumbersJson,
          0, 1, 1, NULL, @now, @now,
          NULL, @now, @now
        )
      `)
      .run({
        ...addressSqlValues(row),
        now,
      });
    const addressId = Number(result.lastInsertRowid);

    this.recordAddressEvent(addressId, 'added', null, row.anytimeUrl);
    this.markStageImported(row.id, addressId);

    return addressId;
  }

  private getAddressById(id: number) {
    return this.options.database.sqlite
      .prepare(`
        SELECT
          id,
          anytime_url AS anytimeUrl,
          name,
          street_address AS streetAddress,
          city,
          state,
          postal_code AS postalCode,
          price_cents AS priceCents,
          rdi,
          cmra,
          smarty_raw AS smartyRaw,
          smarty_checked_at AS smartyCheckedAt,
          is_active AS isActive
        FROM addresses
        WHERE id = ?
      `)
      .get(id) as AddressCacheRow | undefined;
  }

  private getAddressByAnytimeUrl(anytimeUrl: string) {
    return this.options.database.sqlite
      .prepare(`
        SELECT
          id,
          anytime_url AS anytimeUrl,
          name,
          street_address AS streetAddress,
          city,
          state,
          postal_code AS postalCode,
          price_cents AS priceCents,
          rdi,
          cmra,
          smarty_raw AS smartyRaw,
          smarty_checked_at AS smartyCheckedAt,
          is_active AS isActive
        FROM addresses
        WHERE anytime_url = ?
      `)
      .get(anytimeUrl) as AddressCacheRow | undefined;
  }

  private markStageImported(stageId: number, addressId: number) {
    this.options.database.sqlite
      .prepare(`
        UPDATE crawl_discovered_addresses
        SET imported_address_id = ?, crawl_status = 'imported', updated_at = ?
        WHERE id = ?
      `)
      .run(addressId, new Date().toISOString(), stageId);
  }

  private markMissingAddressesRemoved(taskId: number) {
    const now = new Date().toISOString();
    const missingRows = this.options.database.sqlite
      .prepare(`
        SELECT id, anytime_url AS anytimeUrl
        FROM addresses
        WHERE source = 'anytimemailbox'
          AND is_active = 1
          AND anytime_url NOT IN (
            SELECT anytime_url FROM crawl_discovered_addresses WHERE task_id = ?
          )
      `)
      .all(taskId) as Array<{ id: number; anytimeUrl: string }>;

    const update = this.options.database.sqlite.prepare(`
      UPDATE addresses
      SET is_active = 0, removed_at = ?, updated_at = ?
      WHERE id = ?
    `);

    for (const row of missingRows) {
      update.run(now, now, row.id);
      this.recordAddressEvent(row.id, 'removed', row.anytimeUrl, null);
    }
  }

  private refreshStateCounts() {
    const states = this.options.database.sqlite
      .prepare('SELECT code FROM states')
      .all() as Array<{ code: string }>;
    const update = this.options.database.sqlite.prepare(`
      UPDATE states
      SET
        active_address_count = (
          SELECT COUNT(*) FROM addresses
          WHERE state = @code AND is_active = 1
        ),
        residential_count = (
          SELECT COUNT(*) FROM addresses
          WHERE state = @code AND is_active = 1 AND is_visible = 1 AND rdi = 'Residential'
        ),
        updated_at = @updatedAt
      WHERE code = @code
    `);
    const now = new Date().toISOString();

    for (const state of states) {
      update.run({ code: state.code, updatedAt: now });
    }
  }

  private recordAddressEvent(addressId: number, eventType: string, oldValue: string | null, newValue: string | null) {
    this.options.database.sqlite
      .prepare(`
        INSERT INTO address_events (address_id, event_type, old_value, new_value, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(addressId, eventType, oldValue, newValue, new Date().toISOString());
  }

  private async mapWithConcurrency<T>(items: T[], mapper: (item: T) => Promise<void>) {
    const workers = Array.from({ length: Math.min(this.concurrency, items.length || 1) }, async (_, workerIndex) => {
      for (let index = workerIndex; index < items.length; index += this.concurrency) {
        const item = items[index];
        if (item !== undefined) {
          await mapper(item);
        }
      }
    });

    await Promise.all(workers);
  }
}

export class HttpCrawlFetcher implements CrawlFetcher {
  private readonly random: () => number;
  private readonly requestDelayMs: { min: number; max: number };
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly curlFetch: (url: string, options: { headers: Record<string, string>; proxy?: CrawlProxy | null; signal?: AbortSignal }) => Promise<CrawlFetchResult>;
  private readonly proxyProvider: () => CrawlProxy | null;
  private lastHeaderProfileIndex: number | null = null;

  constructor(options: HttpCrawlFetcherOptions = {}) {
    this.random = options.random ?? Math.random;
    this.requestDelayMs = options.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
    this.sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.curlFetch = options.curlFetch ?? defaultCurlFetch;
    this.proxyProvider = options.proxyProvider ?? (() => null);
  }

  async fetchHtml(url: string, options: CrawlFetchOptions = {}): Promise<CrawlFetchResult> {
    return options.preserveRedirectCookies
      ? this.fetchWithRedirectCookies(url, options)
      : this.fetchSingle(url, options);
  }

  private async fetchSingle(url: string, options: CrawlFetchOptions) {
    await this.waitBeforeRequest();

    const headers = this.headersForRequest(options);
    const proxy = this.proxyProvider();

    try {
      const response = await this.axiosGetWithNetworkRetry(url, {
        timeout: 15000,
        maxRedirects: 5,
        responseType: 'text',
        transformResponse: [(data) => data],
        headers,
        ...axiosProxyOption(proxy),
        signal: options.signal,
      });

      return responseToFetchResult(url, url, response);
    } catch (error) {
      const fallback = await this.fetchWithCurlFallback(url, headers, proxy, options.signal, error);
      if (fallback) return fallback;

      throw normalizeCrawlFetchError(url, error);
    }
  }

  private async fetchWithRedirectCookies(url: string, options: CrawlFetchOptions) {
    const cookieStore = new Map<string, string>();
    let currentUrl = new URL(url);

    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      const cookieHeader = createCookieHeader(cookieStore);
      const headers = this.headersForRequest(options);
      const proxy = this.proxyProvider();
      if (cookieHeader) {
        headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${cookieHeader}` : cookieHeader;
      }

      await this.waitBeforeRequest();

      let response;
      try {
        response = await this.axiosGetWithNetworkRetry(currentUrl.toString(), {
          timeout: 15000,
          maxRedirects: 0,
          responseType: 'text',
          transformResponse: [(data) => data],
          validateStatus: (status) => status >= 200 && status < 400,
          headers,
          ...axiosProxyOption(proxy),
          signal: options.signal,
        });
      } catch (error) {
        const fallback = await this.fetchWithCurlFallback(currentUrl.toString(), headers, proxy, options.signal, error);
        if (fallback) return fallback;

        throw normalizeCrawlFetchError(currentUrl.toString(), error);
      }

      collectSetCookies(cookieStore, response.headers['set-cookie']);

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        currentUrl = new URL(response.headers.location, currentUrl);
        continue;
      }

      return responseToFetchResult(url, currentUrl.toString(), response);
    }

    throw new Error(`Too many redirects while fetching ${url}`);
  }

  private headersForRequest(options: CrawlFetchOptions) {
    this.lastHeaderProfileIndex = selectCrawlHeaderProfileIndex(this.random, this.lastHeaderProfileIndex);
    return headersForRequest(options, CRAWL_HEADER_PROFILES[this.lastHeaderProfileIndex] ?? DEFAULT_CRAWL_HEADERS);
  }

  private async axiosGetWithNetworkRetry(url: string, config: AxiosRequestConfig) {
    try {
      return await axios.get(url, config);
    } catch (error) {
      if (!isRetryableNetworkError(error)) throw error;
      return axios.get(url, config);
    }
  }
  private async fetchWithCurlFallback(
    url: string,
    headers: Record<string, string>,
    proxy: CrawlProxy | null,
    signal: AbortSignal | undefined,
    error: unknown,
  ) {
    if (!isAxiosForbiddenError(error)) return null;

    try {
      const result = await this.curlFetch(url, { headers, proxy, signal });
      return result.status >= 200 && result.status < 400 ? result : null;
    } catch {
      return null;
    }
  }

  private async waitBeforeRequest() {
    const min = Math.max(0, this.requestDelayMs.min);
    const max = Math.max(min, this.requestDelayMs.max);
    if (max === 0) return;

    const delayMs = Math.round(min + safeRandom(this.random) * (max - min));
    if (delayMs > 0) {
      await this.sleep(delayMs);
    }
  }
}

export class HttpSmartyLookupClient implements SmartyLookupClient {
  async lookupAddresses(credentials: SmartyCredentials, inputs: SmartyLookupInput[], options: RunTaskOptions = {}) {
    const payload = inputs.map((input) => {
      const street = formatSmartyStreet(input.streetAddress);

      return {
        input_id: input.inputId,
        street: street.street,
        ...(street.secondary ? { secondary: street.secondary } : {}),
        city: input.city,
        state: input.state,
        zipcode: input.postalCode,
        candidates: 10,
      };
    });
    const response = await axios.post('https://us-street.api.smarty.com/street-address', payload, {
      params: {
        'auth-id': credentials.authId,
        'auth-token': credentials.authToken,
      },
      timeout: 20000,
      validateStatus: () => true,
      signal: options.signal,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Smarty returned ${response.status}`);
    }

    const candidates = Array.isArray(response.data) ? response.data : [];
    const byInputId = new Map<string, unknown>();
    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'object' && 'input_id' in candidate) {
        byInputId.set(String((candidate as { input_id: unknown }).input_id), candidate);
      }
    }

    return inputs.map((input) => {
      const raw = byInputId.get(input.inputId);
      if (!raw || typeof raw !== 'object') {
        return {
          inputId: input.inputId,
          error: 'Smarty did not return an address candidate',
        };
      }

      const mapped = normalizeSmartyRaw(raw);
      return mapped.rdi && mapped.cmra
        ? {
            inputId: input.inputId,
            rdi: mapped.rdi,
            cmra: mapped.cmra,
            raw,
          }
        : {
            inputId: input.inputId,
            raw,
            error: 'Smarty result missing valid RDI/CMRA',
          };
    });
  }
}

function formatSmartyStreet(streetAddress: string) {
  const cleaned = streetAddress.replace(/\s+/g, ' ').trim();
  const secondaryMatch = cleaned.match(/^(.*)\s+(suite|ste\.?|unit|apt\.?|apartment|room|rm|floor|fl|#)\s+([A-Za-z0-9][A-Za-z0-9-]*)$/i);

  if (secondaryMatch?.[1] && secondaryMatch[2] && secondaryMatch[3]) {
    return {
      street: secondaryMatch[1].trim(),
      secondary: `${normalizeSecondaryDesignator(secondaryMatch[2])} ${secondaryMatch[3].trim()}`,
    };
  }

  return {
    street: cleaned.replace(/\s+(?:suite|ste\.?|unit|apt\.?|apartment|room|rm|floor|fl|#)\s*$/i, '').trim(),
  };
}

function normalizeSecondaryDesignator(value: string) {
  const normalized = value.replace(/\.$/, '').toLowerCase();

  if (normalized === 'suite') return 'Suite';
  if (normalized === 'unit') return 'Unit';
  if (normalized === 'apt' || normalized === 'apartment') return 'Apt';
  if (normalized === 'room' || normalized === 'rm') return 'Rm';
  if (normalized === 'floor' || normalized === 'fl') return 'Fl';
  if (normalized === '#') return '#';
  return 'Ste';
}

function normalizeSmartyResult(result: SmartyLookupResult) {
  const rawMapped = result.raw ? normalizeSmartyRaw(result.raw) : {};

  return {
    rdi: normalizeRdi(result.rdi) ?? rawMapped.rdi,
    cmra: normalizeCmra(result.cmra) ?? rawMapped.cmra,
    raw: result.raw,
  };
}

function normalizeSmartyRaw(raw: unknown) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const record = raw as {
    metadata?: { rdi?: unknown };
    analysis?: { dpv_cmra?: unknown };
  };

  return {
    rdi: normalizeRdi(record.metadata?.rdi),
    cmra: normalizeCmra(record.analysis?.dpv_cmra),
  };
}

function normalizeRdi(value: unknown): AddressRdi | undefined {
  return value === 'Residential' || value === 'Commercial'
    ? value
    : undefined;
}

function normalizeCmra(value: unknown): AddressCmra | undefined {
  if (value === 'Yes' || value === 'Y') {
    return 'Yes';
  }
  if (value === 'No' || value === 'N') {
    return 'No';
  }

  return undefined;
}

function chunkSmartyInputs(inputs: SmartyLookupInput[]) {
  const chunks: SmartyLookupInput[][] = [];
  let current: SmartyLookupInput[] = [];

  for (const input of inputs) {
    const next = [...current, input];
    const nextSize = Buffer.byteLength(JSON.stringify(next), 'utf8');

    if (current.length > 0 && (current.length >= SMARTY_BATCH_LIMIT || nextSize > SMARTY_BODY_LIMIT_BYTES)) {
      chunks.push(current);
      current = [input];
    } else {
      current = next;
    }
  }

  if (current.length) {
    chunks.push(current);
  }

  return chunks;
}

function addressSqlValues(row: StageRow) {
  return {
    sourceId: sourceIdFromUrl(row.anytimeUrl),
    name: row.name,
    slug: row.slug,
    anytimeUrl: row.anytimeUrl,
    signupUrl: row.signupUrl,
    country: row.country,
    state: row.state,
    stateName: row.stateName,
    city: row.city,
    streetAddress: row.streetAddress,
    postalCode: row.postalCode,
    fullAddress: row.fullAddress,
    priceCents: row.priceCents,
    priceCurrency: row.priceCurrency || 'USD',
    pricePeriod: row.pricePeriod || 'month',
    rdi: row.rdi,
    cmra: row.cmra,
    smartyRaw: row.smartyRaw,
    smartyCheckedAt: row.smartyCheckedAt,
    mailboxMin: row.mailboxMin,
    mailboxMax: row.mailboxMax,
    mailboxCount: row.mailboxCount,
    mailboxNumbersJson: row.mailboxNumbersJson,
  };
}

function sourceIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').filter(Boolean).pop() ?? parsed.pathname;
  } catch {
    return url;
  }
}

function parseListAddress(value: string) {
  const text = normalizeText(value);
  const match = text.match(/^(.*?)\s+([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  return {
    streetAddress: match ? normalizeText(match[1]) : '',
    city: match ? normalizeText(match[2]) : '',
    state: match ? match[3] : '',
    postalCode: match ? match[4] : '',
  };
}

function createMissingSignupLinkError(url: string, result: CrawlFetchResult) {
  return new Error(createMissingSignupMessage(url, result));
}

function createMissingSignupMessage(url: string, result: CrawlFetchResult) {
  const snapshotPath = saveMissingSignupSnapshot(url, result);
  const title = extractHtmlTitle(result.html);
  const hasMyear = /id=["']?myear\b/i.test(result.html);
  const hasSignupNew = /(?:signup\.anytimemailbox\.com)?\/signup\/new\b/i.test(result.html);

  return [
    `Unable to parse mailbox signup link: ${url}`,
    `status=${result.status}`,
    `finalUrl=${result.finalUrl}`,
    `contentType=${result.contentType ?? 'unknown'}`,
    `title="${title}"`,
    `hasMyear=${hasMyear}`,
    `hasSignupNew=${hasSignupNew}`,
    `snapshot=${snapshotPath ?? 'not-saved'}`,
  ].join(' ');
}

function saveMissingSignupSnapshot(url: string, result: CrawlFetchResult) {
  try {
    const directory = join(process.cwd(), '.runtime', 'crawl-failures');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-missing-signup-${slugify(url).slice(0, 120)}.html`;
    const snapshotPath = join(directory, filename);

    mkdirSync(directory, { recursive: true });
    writeFileSync(snapshotPath, result.html, 'utf8');

    return snapshotPath;
  } catch {
    return null;
  }
}

function extractHtmlTitle(html: string) {
  return normalizeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? 'no-title').slice(0, 120);
}

function axiosProxyOption(proxy: CrawlProxy | null) {
  return proxy ? { proxy: proxyUrlToAxiosProxy(proxy.url) } : {};
}

function headersForRequest(options: CrawlFetchOptions, profile: Record<string, string>) {
  const headers: Record<string, string> = {
    ...profile,
    ...(options.headers ?? {}),
  };

  if (options.referer) {
    headers.Referer = options.referer;
  }

  return headers;
}

function selectCrawlHeaderProfileIndex(random: () => number, previousIndex: number | null) {
  const total = CRAWL_HEADER_PROFILES.length;
  if (total <= 1 || previousIndex === null) {
    return Math.min(total - 1, Math.floor(safeRandom(random) * total));
  }

  const candidate = Math.floor(safeRandom(random) * (total - 1));
  return candidate >= previousIndex ? candidate + 1 : candidate;
}

function safeRandom(random: () => number) {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
}

function isAxiosForbiddenError(error: unknown) {
  return axios.isAxiosError(error) && Number(error.response?.status) === 403;
}

function isRetryableNetworkError(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const code = error.code ?? (error.cause as { code?: unknown } | undefined)?.code;
  return code === 'ECONNRESET';
}

async function defaultCurlFetch(url: string, options: { headers: Record<string, string>; proxy?: CrawlProxy | null; signal?: AbortSignal }): Promise<CrawlFetchResult> {
  const args = [
    '--silent',
    '--show-error',
    '--location',
    '--max-redirs',
    '5',
    '--connect-timeout',
    '10',
    '--max-time',
    '20',
    '--compressed',
  ];

  for (const [name, value] of Object.entries(options.headers)) {
    args.push('-H', `${name}: ${value}`);
  }

  args.push('--write-out', `${CURL_META_MARKER}%{http_code}\t%{url_effective}\t%{content_type}`, url);

  const { stdout } = await execFileAsync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    signal: options.signal,
  });

  return parseCurlFetchOutput(url, String(stdout));
}

function parseCurlFetchOutput(url: string, output: string): CrawlFetchResult {
  const markerIndex = output.lastIndexOf(CURL_META_MARKER);
  if (markerIndex < 0) {
    throw new Error(`curl fallback did not return metadata for ${url}`);
  }

  const html = output.slice(0, markerIndex);
  const [statusText, finalUrl, contentType] = output.slice(markerIndex + CURL_META_MARKER.length).split('\t');

  return {
    url,
    finalUrl: finalUrl || url,
    html,
    status: Number(statusText) || 0,
    contentType: contentType || undefined,
  };
}
function normalizeCrawlFetchError(url: string, error: unknown) {
  if (axios.isAxiosError(error) && error.response && isCloudflareChallengeResponse(error.response)) {
    return createCloudflareChallengeError(url, error.response);
  }

  return error;
}

function isCloudflareChallengeResponse(response: { status?: number; headers?: unknown; data?: unknown }) {
  const cfMitigated = responseHeaderValue(response.headers, 'cf-mitigated')?.toLowerCase();
  const server = responseHeaderValue(response.headers, 'server')?.toLowerCase() ?? '';
  const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');

  return cfMitigated === 'challenge'
    || (server.includes('cloudflare') && /Just a moment|challenges\.cloudflare\.com|cf_chl/i.test(html));
}

function createCloudflareChallengeError(url: string, response: { status?: number; headers?: unknown; data?: unknown }) {
  const title = extractHtmlTitle(typeof response.data === 'string' ? response.data : String(response.data ?? ''));
  const cfMitigated = responseHeaderValue(response.headers, 'cf-mitigated') ?? 'unknown';
  const cfRay = responseHeaderValue(response.headers, 'cf-ray');

  return new Error([
    `Cloudflare challenge blocked ${url}`,
    `status=${Number(response.status ?? 0)}`,
    `cfMitigated=${cfMitigated}`,
    cfRay ? `cfRay=${cfRay}` : null,
    `title="${title}"`,
  ].filter(Boolean).join(' '));
}

function responseHeaderValue(headers: unknown, name: string) {
  if (!headers || typeof headers !== 'object') return undefined;

  const maybeGetter = (headers as { get?: unknown }).get;
  if (typeof maybeGetter === 'function') {
    const value = maybeGetter.call(headers, name);
    if (value !== undefined && value !== null) return String(value);
  }

  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return value === undefined || value === null ? undefined : String(value);
}
function responseToFetchResult(url: string, finalUrl: string, response: Pick<AxiosRequestConfig, 'headers'> & {
  data?: unknown;
  status?: number;
}) {
  return {
    url,
    finalUrl,
    html: typeof response.data === 'string' ? response.data : String(response.data ?? ''),
    status: Number(response.status ?? 0),
    contentType: typeof response.headers?.['content-type'] === 'string'
      ? response.headers['content-type']
      : undefined,
  };
}

function collectSetCookies(cookieStore: Map<string, string>, setCookieHeaders: string[] | string | undefined) {
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];

  for (const header of headers) {
    const [cookiePair] = header.split(';');
    const separatorIndex = cookiePair?.indexOf('=') ?? -1;
    if (!cookiePair || separatorIndex <= 0) continue;

    cookieStore.set(cookiePair.slice(0, separatorIndex), cookiePair.slice(separatorIndex + 1));
  }
}

function createCookieHeader(cookieStore: Map<string, string>) {
  return [...cookieStore.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  return candidate.name === 'CanceledError'
    || candidate.name === 'AbortError'
    || candidate.code === 'ERR_CANCELED'
    || candidate.message === 'canceled';
}
