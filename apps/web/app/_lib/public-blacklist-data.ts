import Database from 'better-sqlite3';
import { findUsStateCodeByKeyword, getUsStateDisplay } from '@atmb/shared';

import {
  escapeLike,
  formatPublicDateTime,
  isUnavailableDatabaseError,
  resolvePublicAddressDatabaseUrl,
} from './public-address-data';

export const PUBLIC_BLACKLIST_BASE_PATH = '/address-blacklist';
export const PUBLIC_BLACKLIST_PAGE_SIZE = 20;
export const PUBLIC_BLACKLIST_RESULT_HASH = '#blacklist-list-title';

export interface PublicBlacklistFilters {
  q: string;
  page: number;
}

export interface PublicBlacklistReason {
  id: number;
  reason: string;
  sourceUrl: string | null;
  approvedAt: string;
}

// 同一地址（规范化后）可有多条原因，前台按地址聚合展示
export interface PublicBlacklistEntry {
  key: string;
  streetAddress: string;
  cityLine: string;
  stateLabel: string;
  reasons: PublicBlacklistReason[];
}

export interface PublicBlacklistPageData {
  items: PublicBlacklistEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  start: number;
  end: number;
}

interface GroupRow {
  key: string;
}

interface EntryRow {
  id: number;
  key: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  reason: string;
  sourceUrl: string | null;
  approvedAt: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

export async function getPublicBlacklistPageData(filters: PublicBlacklistFilters): Promise<PublicBlacklistPageData> {
  const databaseUrl = resolvePublicAddressDatabaseUrl();

  if (!databaseUrl) {
    return emptyBlacklistPageData(filters);
  }

  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(databaseUrl, {
      fileMustExist: true,
      readonly: true,
    });

    const { where, params } = buildBlacklistWhere(filters);
    const totalRow = sqlite
      .prepare(`SELECT COUNT(DISTINCT b.normalized_address_key) AS count FROM address_blacklist b ${where}`)
      .get(...params) as { count: number };
    const total = totalRow.count;
    const totalPages = Math.max(1, Math.ceil(total / PUBLIC_BLACKLIST_PAGE_SIZE));
    const page = Math.min(filters.page, totalPages);
    const offset = (page - 1) * PUBLIC_BLACKLIST_PAGE_SIZE;
    const groups = sqlite
      .prepare(`
        SELECT b.normalized_address_key AS key
        FROM address_blacklist b
        ${where}
        GROUP BY b.normalized_address_key
        ORDER BY MAX(COALESCE(b.reviewed_at, b.updated_at)) DESC, b.normalized_address_key ASC
        LIMIT ? OFFSET ?
      `)
      .all(...params, PUBLIC_BLACKLIST_PAGE_SIZE, offset) as GroupRow[];
    const keys = groups.map((group) => group.key);
    const rows = keys.length > 0
      ? sqlite
        .prepare(`
          SELECT
            b.id,
            b.normalized_address_key AS key,
            b.street_address AS streetAddress,
            b.city,
            b.state,
            b.postal_code AS postalCode,
            b.reason,
            b.source_url AS sourceUrl,
            COALESCE(b.reviewed_at, b.updated_at) AS approvedAt
          FROM address_blacklist b
          WHERE b.status = 'approved'
            AND b.normalized_address_key IN (${keys.map(() => '?').join(', ')})
          ORDER BY approvedAt DESC, b.id DESC
        `)
        .all(...keys) as EntryRow[]
      : [];
    const items = groupEntries(keys, rows);
    const start = total === 0 ? 0 : offset + 1;
    const end = offset + items.length;

    return {
      items,
      total,
      page,
      pageSize: PUBLIC_BLACKLIST_PAGE_SIZE,
      totalPages,
      start,
      end,
    };
  } catch (error) {
    if (isUnavailableDatabaseError(error)) {
      return emptyBlacklistPageData(filters);
    }

    throw error;
  } finally {
    sqlite?.close();
  }
}

export function parsePublicBlacklistFilters(searchParams: SearchParams = {}): PublicBlacklistFilters {
  const q = firstParam(searchParams.q)?.trim().slice(0, 80) ?? '';
  const page = Number.parseInt(firstParam(searchParams.page) ?? '1', 10);

  return {
    q,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function buildBlacklistPageUrl(filters: PublicBlacklistFilters, overrides: Partial<PublicBlacklistFilters> = {}) {
  const nextFilters: PublicBlacklistFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (nextFilters.q) params.set('q', nextFilters.q);
  if (nextFilters.page > 1) params.set('page', String(nextFilters.page));

  const query = params.toString();
  return `${query ? `${PUBLIC_BLACKLIST_BASE_PATH}?${query}` : PUBLIC_BLACKLIST_BASE_PATH}${PUBLIC_BLACKLIST_RESULT_HASH}`;
}

// 已通过条目的最近更新时间，供 sitemap 的 lastModified 使用；数据库不可用时返回 null
export async function getPublicBlacklistLastUpdated(): Promise<Date | null> {
  const databaseUrl = resolvePublicAddressDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(databaseUrl, {
      fileMustExist: true,
      readonly: true,
    });

    const row = sqlite
      .prepare("SELECT MAX(updated_at) AS updatedAt FROM address_blacklist WHERE status = 'approved'")
      .get() as { updatedAt: string | null };

    return row.updatedAt ? new Date(row.updatedAt) : null;
  } catch (error) {
    if (isUnavailableDatabaseError(error)) {
      return null;
    }

    throw error;
  } finally {
    sqlite?.close();
  }
}

function buildBlacklistWhere(filters: PublicBlacklistFilters) {
  const where = ["b.status = 'approved'"];
  const params: string[] = [];

  if (filters.q) {
    const keyword = `%${escapeLike(filters.q)}%`;
    const keywordStateCode = findUsStateCodeByKeyword(filters.q);
    where.push(`(
      b.street_address LIKE ? ESCAPE '\\'
      OR b.city LIKE ? ESCAPE '\\'
      OR b.state LIKE ? ESCAPE '\\'
      OR b.postal_code LIKE ? ESCAPE '\\'
      ${keywordStateCode ? 'OR b.state = ?' : ''}
    )`);
    params.push(keyword, keyword, keyword, keyword);

    if (keywordStateCode) {
      params.push(keywordStateCode);
    }
  }

  return {
    where: `WHERE ${where.join(' AND ')}`,
    params,
  };
}

function groupEntries(keys: string[], rows: EntryRow[]) {
  const byKey = new Map<string, PublicBlacklistEntry>();

  for (const row of rows) {
    let entry = byKey.get(row.key);

    if (!entry) {
      const state = getUsStateDisplay(row.state);
      entry = {
        key: row.key,
        streetAddress: row.streetAddress,
        cityLine: `${row.city}, ${row.state} ${row.postalCode}`,
        stateLabel: state.label,
        reasons: [],
      };
      byKey.set(row.key, entry);
    }

    entry.reasons.push({
      id: row.id,
      reason: row.reason,
      sourceUrl: row.sourceUrl,
      approvedAt: formatPublicDateTime(row.approvedAt).slice(0, 10),
    });
  }

  return keys.map((key) => byKey.get(key)).filter((entry): entry is PublicBlacklistEntry => Boolean(entry));
}

function emptyBlacklistPageData(filters: PublicBlacklistFilters): PublicBlacklistPageData {
  return {
    items: [],
    total: 0,
    page: filters.page,
    pageSize: PUBLIC_BLACKLIST_PAGE_SIZE,
    totalPages: 1,
    start: 0,
    end: 0,
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
