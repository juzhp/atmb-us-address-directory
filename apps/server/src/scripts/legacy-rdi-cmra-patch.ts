import { createDatabase } from '@atmb/db';
import type { AddressCmra, AddressRdi } from '@atmb/shared';

export interface AddressPatchRow {
  sourceTable: 'addresses' | 'crawl_discovered_addresses';
  id: number;
  sourceId: string | null;
  name: string;
  slug: string;
  anytimeUrl: string;
  signupUrl: string | null;
  country: string;
  city: string;
  state: string;
  stateName: string;
  streetAddress: string;
  postalCode: string;
  fullAddress: string;
  priceCents: number;
  priceCurrency: string;
  pricePeriod: string;
  mailboxMin: number | null;
  mailboxMax: number | null;
  mailboxCount: number | null;
  mailboxNumbersJson: string | null;
}

export interface LegacyMatch {
  rdi: AddressRdi;
  cmra: AddressCmra;
  raw: unknown;
  score: number;
}

export function loadAddressPatchRows(sqlite: ReturnType<typeof createDatabase>['sqlite'], max: number | null): AddressPatchRow[] {
  const limitSql = max && max > 0 ? 'LIMIT @limit' : '';

  return sqlite
    .prepare(`
      SELECT *
      FROM (
        SELECT
          0 AS sourceOrder,
          'addresses' AS sourceTable,
          id,
          source_id AS sourceId,
          name,
          slug,
          anytime_url AS anytimeUrl,
          signup_url AS signupUrl,
          country,
          city,
          state,
          state_name AS stateName,
          street_address AS streetAddress,
          postal_code AS postalCode,
          full_address AS fullAddress,
          price_cents AS priceCents,
          price_currency AS priceCurrency,
          price_period AS pricePeriod,
          mailbox_min AS mailboxMin,
          mailbox_max AS mailboxMax,
          mailbox_count AS mailboxCount,
          mailbox_numbers_json AS mailboxNumbersJson
        FROM addresses
        WHERE name <> ''
          AND street_address <> ''
          AND city <> ''
          AND state <> ''
          AND postal_code <> ''
        UNION ALL
        SELECT
          1 AS sourceOrder,
          'crawl_discovered_addresses' AS sourceTable,
          stage.id,
          stage.source_id AS sourceId,
          stage.name,
          stage.slug,
          stage.anytime_url AS anytimeUrl,
          stage.signup_url AS signupUrl,
          stage.country,
          stage.city,
          stage.state,
          stage.state_name AS stateName,
          stage.street_address AS streetAddress,
          stage.postal_code AS postalCode,
          stage.full_address AS fullAddress,
          stage.price_cents AS priceCents,
          stage.price_currency AS priceCurrency,
          stage.price_period AS pricePeriod,
          stage.mailbox_min AS mailboxMin,
          stage.mailbox_max AS mailboxMax,
          stage.mailbox_count AS mailboxCount,
          stage.mailbox_numbers_json AS mailboxNumbersJson
        FROM crawl_discovered_addresses stage
        WHERE stage.name <> ''
          AND stage.street_address <> ''
          AND stage.city <> ''
          AND stage.state <> ''
          AND stage.postal_code <> ''
          AND stage.imported_address_id IS NULL
          AND (stage.rdi IS NULL OR stage.cmra IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM addresses address WHERE address.anytime_url = stage.anytime_url
          )
      )
      ORDER BY sourceOrder ASC, id ASC
      ${limitSql}
    `)
    .all(max && max > 0 ? { limit: max } : {}) as AddressPatchRow[];
}

export function patchAddressRdiCmra(
  sqlite: ReturnType<typeof createDatabase>['sqlite'],
  row: AddressPatchRow,
  match: LegacyMatch,
) {
  if (row.sourceTable === 'crawl_discovered_addresses') {
    return patchDiscoveredAddressRdiCmra(sqlite, row, match);
  }

  const result = sqlite
    .prepare(`
      UPDATE addresses
      SET rdi = @rdi, cmra = @cmra
      WHERE id = @id
        AND (rdi <> @rdi OR cmra <> @cmra)
    `)
    .run({
      id: row.id,
      rdi: match.rdi,
      cmra: match.cmra,
    });

  return result.changes > 0;
}

function patchDiscoveredAddressRdiCmra(
  sqlite: ReturnType<typeof createDatabase>['sqlite'],
  row: AddressPatchRow,
  match: LegacyMatch,
) {
  const now = new Date().toISOString();
  const smartyRaw = JSON.stringify(match.raw ?? {});
  const importAddress = sqlite.transaction(() => {
    sqlite
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
        rdi: match.rdi,
        cmra: match.cmra,
        smartyRaw,
        smartyCheckedAt: now,
        updatedAt: now,
      });

    const existing = sqlite
      .prepare('SELECT id FROM addresses WHERE anytime_url = ?')
      .get(row.anytimeUrl) as { id: number } | undefined;

    if (existing) {
      sqlite
        .prepare(`
          UPDATE addresses
          SET
            rdi = @rdi,
            cmra = @cmra,
            smarty_raw = @smartyRaw,
            smarty_checked_at = @smartyCheckedAt,
            updated_at = @updatedAt
          WHERE id = @id
        `)
        .run({
          id: existing.id,
          rdi: match.rdi,
          cmra: match.cmra,
          smartyRaw,
          smartyCheckedAt: now,
          updatedAt: now,
        });
      markStageImported(sqlite, row.id, existing.id, now);

      return true;
    }

    const result = sqlite
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
        sourceId: row.sourceId,
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
        rdi: match.rdi,
        cmra: match.cmra,
        smartyRaw,
        smartyCheckedAt: now,
        mailboxMin: row.mailboxMin,
        mailboxMax: row.mailboxMax,
        mailboxCount: row.mailboxCount,
        mailboxNumbersJson: row.mailboxNumbersJson,
        now,
      });
    const addressId = Number(result.lastInsertRowid);

    sqlite
      .prepare(`
        INSERT INTO address_events (address_id, event_type, old_value, new_value, message, created_at)
        VALUES (?, 'added', NULL, ?, 'legacy RDI/CMRA patch import', ?)
      `)
      .run(addressId, row.anytimeUrl, now);
    markStageImported(sqlite, row.id, addressId, now);

    return true;
  });

  return importAddress();
}

function markStageImported(
  sqlite: ReturnType<typeof createDatabase>['sqlite'],
  stageId: number,
  addressId: number,
  now: string,
) {
  sqlite
    .prepare(`
      UPDATE crawl_discovered_addresses
      SET imported_address_id = ?, crawl_status = 'imported', updated_at = ?
      WHERE id = ?
    `)
    .run(addressId, now, stageId);
}

export function buildAddressQuery(row: AddressPatchRow) {
  return row.name;
}

export function extractLegacyMatches(value: unknown, depth = 0): LegacyMatch[] {
  if (depth > 6 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractLegacyMatches(item, depth + 1));
  }

  if (typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const rdi = normalizeRdi(readAny(record, ['rdi', 'RDI', 'smartyRdi', 'metadata.rdi']));
  const cmra = normalizeCmra(readAny(record, ['cmra', 'CMRA', 'smartyCmra', 'dpvCmra', 'dpv_cmra', 'analysis.dpv_cmra']));
  const matches: LegacyMatch[] = rdi && cmra ? [{ rdi, cmra, raw: record, score: 0 }] : [];

  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') {
      matches.push(...extractLegacyMatches(child, depth + 1));
    }
  }

  return matches;
}

export function chooseBestMatch(matches: LegacyMatch[], row: AddressPatchRow) {
  if (matches.length === 0) {
    return null;
  }

  const scored = matches
    .map((match) => ({ ...match, score: scoreCandidate(match.raw, row) }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0];

  if (!best) {
    return null;
  }

  if (best.score >= 4 || matches.length === 1) {
    return best;
  }

  return null;
}

function scoreCandidate(raw: unknown, row: AddressPatchRow) {
  if (!raw || typeof raw !== 'object') {
    return 0;
  }

  const record = raw as Record<string, unknown>;
  const candidateName = normalizeComparable(stringFromAny(readAny(record, ['name', 'title', 'locationName', 'location_name'])));
  const candidateStreet = normalizeComparable(stringFromAny(readAny(record, [
    'streetAddress',
    'street_address',
    'address',
    'address1',
    'line1',
    'primaryLine',
    'delivery_line_1',
    'components.street_name',
  ])));
  const candidateCity = normalizeComparable(stringFromAny(readAny(record, ['city', 'components.city_name'])));
  const candidateState = normalizeState(stringFromAny(readAny(record, ['state', 'stateCode', 'state_code', 'components.state_abbreviation'])));
  const candidatePostal = normalizeZip(stringFromAny(readAny(record, [
    'postalCode',
    'postal_code',
    'zip',
    'zipcode',
    'components.zipcode',
  ])));
  const candidateText = normalizeComparable(JSON.stringify(record));
  const targetName = normalizeComparable(row.name);
  const targetStreet = normalizeComparable(row.streetAddress);
  const targetCity = normalizeComparable(row.city);
  const targetState = normalizeState(row.state);
  const targetPostal = normalizeZip(row.postalCode);
  let score = 0;

  if (candidateName && (candidateName.includes(targetName) || targetName.includes(candidateName))) score += 4;
  if (candidatePostal && candidatePostal === targetPostal) score += 4;
  if (candidateState && candidateState === targetState) score += 2;
  if (candidateCity && candidateCity === targetCity) score += 1;
  if (candidateStreet && (candidateStreet.includes(targetStreet) || targetStreet.includes(candidateStreet))) score += 4;
  if (candidateText.includes(targetName)) score += 2;
  if (candidateText.includes(targetStreet) && candidateText.includes(targetPostal)) score += 3;

  return score;
}

function readAny(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = readPath(record, path);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  let current: unknown = record;

  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function normalizeRdi(value: unknown): AddressRdi | null {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'residential') return 'Residential';
  if (text === 'commercial') return 'Commercial';
  return null;
}

function normalizeCmra(value: unknown): AddressCmra | null {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'yes' || text === 'y' || text === 'true' || text === '1') return 'Yes';
  if (text === 'no' || text === 'n' || text === 'false' || text === '0') return 'No';
  return null;
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeState(value: string) {
  return value.trim().toUpperCase();
}

function normalizeZip(value: string) {
  return value.trim().match(/\d{5}/)?.[0] ?? '';
}

function stringFromAny(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value).trim()
    : '';
}
