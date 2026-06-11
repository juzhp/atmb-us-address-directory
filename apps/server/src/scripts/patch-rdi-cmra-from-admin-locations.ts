import axios from 'axios';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { createDatabase } from '@atmb/db';

import {
  buildAddressQuery,
  chooseBestMatch,
  extractLegacyMatches,
  loadAddressPatchRows,
  patchAddressRdiCmra,
  type AddressPatchRow,
} from './legacy-rdi-cmra-patch.js';

interface CliOptions {
  apply: boolean;
  apiBase: string;
  cookie: string;
  cookieFile: string;
  databaseUrl: string;
  delayMs: number;
  max: number | null;
  remoteLimit: number;
}

const defaultDatabaseUrl = fileURLToPath(new URL('../../data/atmb.sqlite', import.meta.url));
const defaultCookieFile = fileURLToPath(new URL('../../data/legacy-admin.cookie', import.meta.url));

async function main() {
  const options = parseCliOptions();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  assertDatabaseExists(options.databaseUrl);

  if (!options.cookie) {
    throw new Error(`Cookie file is required. Create ${options.cookieFile} and paste the legacy admin cookie into it.`);
  }

  const database = createDatabase({ url: options.databaseUrl });

  try {
    const rows = loadAddressPatchRows(database.sqlite, options.max);
    const summary = {
      scanned: rows.length,
      matched: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
    };

    console.log(`[patch] mode=${options.apply ? 'apply' : 'dry-run'} database=${options.databaseUrl}`);
    console.log(`[patch] address rows to check=${rows.length}`);

    for (const row of rows) {
      const query = buildAddressQuery(row);

      try {
        const match = await lookupLegacyLocation(options, query, row);

        if (!match) {
          summary.skipped += 1;
          console.log(`[skip] address=${row.id} no RDI/CMRA match for "${query}"`);
          await delay(options.delayMs);
          continue;
        }

        summary.matched += 1;
        console.log(`[match] address=${row.id} ${match.rdi}/${match.cmra} score=${match.score} "${query}"`);

        if (options.apply) {
          const changed = patchAddressRdiCmra(database.sqlite, row, match);
          if (changed) {
            summary.updated += 1;
          } else {
            summary.unchanged += 1;
          }
        }
      } catch (error) {
        summary.failed += 1;
        console.error(`[fail] address=${row.id} ${error instanceof Error ? error.message : String(error)}`);
      }

      await delay(options.delayMs);
    }

    console.log(`[done] ${JSON.stringify(summary)}`);
  } finally {
    database.sqlite.close();
  }
}

function parseCliOptions(): CliOptions {
  const args = new Map<string, string | true>();

  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [key, rawValue] = arg.slice(2).split('=', 2);
    if (!key) continue;
    args.set(key, rawValue ?? true);
  }

  const apiBase = stringOption(args.get('api-base')) ?? process.env.ATMB_LEGACY_API_BASE ?? 'https://atmb.juzhp.com';
  const cookieFile = resolve(
    stringOption(args.get('cookie-file')) ?? process.env.ATMB_ADMIN_COOKIE_FILE ?? defaultCookieFile,
  );
  const cookie = stringOption(args.get('cookie')) ?? process.env.ATMB_ADMIN_COOKIE ?? readCookieFile(cookieFile);
  const databaseUrl = resolve(stringOption(args.get('database')) ?? process.env.DATABASE_URL ?? defaultDatabaseUrl);
  const max = numberOption(args.get('max') ?? process.env.ATMB_PATCH_MAX, null);

  return {
    apply: args.has('apply'),
    apiBase: apiBase.replace(/\/$/, ''),
    cookie,
    cookieFile,
    databaseUrl,
    delayMs: numberOption(args.get('delay-ms') ?? process.env.ATMB_PATCH_DELAY_MS, 250) ?? 250,
    max,
    remoteLimit: numberOption(args.get('remote-limit') ?? process.env.ATMB_PATCH_REMOTE_LIMIT, 25) ?? 25,
  };
}

function printHelp() {
  console.log(`
Patch address RDI/CMRA from the legacy admin locations endpoint.

Default mode is dry-run. Use --apply to write changes.

This script uses local database rows as the source of truth:
  - existing addresses rows are patched in place by RDI/CMRA only.
  - unimported crawl_discovered_addresses rows are patched, then imported into
    addresses so they can appear in address management.

It does not fetch new Anytime Mailbox addresses. It only matches legacy API
results against local rows that already exist in this database.

Usage:
  npm run patch:rdi-cmra -- --max=50
  npm run patch:rdi-cmra -- --apply

Options:
  --apply                  Write patched RDI/CMRA. Omit for dry-run.
  --database=PATH          SQLite path. Defaults to apps/server/data/atmb.sqlite.
  --api-base=URL           Defaults to https://atmb.juzhp.com.
  --cookie-file=PATH       Cookie file. Defaults to apps/server/data/legacy-admin.cookie.
  --max=N                  Process at most N address rows.
  --delay-ms=N             Delay between requests. Defaults to 250.
  --remote-limit=N         Legacy API page limit. Defaults to 25.

Cookie:
  Put the legacy admin cookie in apps/server/data/legacy-admin.cookie.
  The file can contain the full Cookie header or only atmb_admin_session=...
`);
}

async function lookupLegacyLocation(options: CliOptions, query: string, row: AddressPatchRow) {
  const url = new URL('/api/admin/locations', options.apiBase);
  url.searchParams.set('page', '1');
  url.searchParams.set('limit', String(options.remoteLimit));
  url.searchParams.set('q', query);

  const response = await axios.get(url.toString(), {
    timeout: 20000,
    headers: {
      accept: 'application/json, text/plain, */*',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      cookie: options.cookie,
      referer: `${options.apiBase}/admin/locations`,
    },
    validateStatus: () => true,
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`legacy API auth failed: ${response.status}`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`legacy API returned ${response.status}`);
  }

  return chooseBestMatch(extractLegacyMatches(response.data), row);
}

function readCookieFile(cookieFile: string) {
  if (!existsSync(cookieFile)) {
    return '';
  }

  return readFileSync(cookieFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .join('; ');
}

function assertDatabaseExists(databaseUrl: string) {
  if (databaseUrl !== ':memory:' && !existsSync(databaseUrl)) {
    throw new Error(`Database file does not exist: ${databaseUrl}`);
  }
}

function stringOption(value: string | true | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberOption(value: string | true | undefined, fallback: number | null) {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function delay(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(`[fatal] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
