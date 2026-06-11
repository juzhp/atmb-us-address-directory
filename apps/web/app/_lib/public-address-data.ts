import Database from 'better-sqlite3';
import { getUsStateDisplay } from '@atmb/shared';

export { buildAddressDetailRedirectUrl } from './referral-redirect';
import { buildAddressDetailRedirectUrl } from './referral-redirect';

export const PUBLIC_ADDRESS_PAGE_SIZE = 20;
export const PUBLIC_ADDRESSES_RESULT_HASH = '#address-list-title';

export interface PublicAddressFilters {
  q: string;
  state: string;
  rdi: string;
  cmra: string;
  price: string;
  page: number;
}

export interface PublicAddressListItem {
  id: number;
  name: string;
  streetAddress: string;
  cityLine: string;
  stateLabel: string;
  price: string;
  rdi: string;
  cmra: string;
  mailbox: string;
  detailUrl: string;
  mapsUrl: string;
  updatedAt: string;
}

export interface PublicStateLink {
  code: string;
  name: string;
  zhName: string;
  label: string;
  count: number;
}

export interface PublicAddressStats {
  totalAddresses: number;
  residentialAddresses: number;
  stateCount: number;
}

export interface PublicAddressesPageData {
  items: PublicAddressListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  start: number;
  end: number;
  states: PublicStateLink[];
  stats: PublicAddressStats;
  selectedStateLabel: string | null;
}

interface AddressRow {
  id: number;
  name: string;
  anytimeUrl: string;
  state: string;
  stateName: string;
  city: string;
  streetAddress: string;
  postalCode: string;
  fullAddress: string;
  priceCents: number;
  rdi: string | null;
  cmra: string | null;
  mailboxMin: number | null;
  mailboxMax: number | null;
  updatedAt: string;
}

interface CountRow {
  count: number;
}

interface StateRow {
  code: string;
  name: string;
  count: number;
}

interface StatsRow {
  totalAddresses: number;
  residentialAddresses: number;
  stateCount: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

export async function getPublicAddressesPageData(filters: PublicAddressFilters): Promise<PublicAddressesPageData> {
  const databaseUrl = resolvePublicAddressDatabaseUrl();

  if (!databaseUrl) {
    return emptyAddressesPageData(filters);
  }

  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(databaseUrl, {
      fileMustExist: true,
      readonly: true,
    });

    const states = listPublicStates(sqlite);
    const selectedState = filters.state ? states.find((state) => state.code === filters.state) : null;
    const stats = readPublicAddressStats(sqlite);
    const { where, params } = buildAddressWhere(filters);
    const totalRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM addresses a ${where}`).get(...params) as CountRow;
    const total = totalRow.count;
    const totalPages = Math.max(1, Math.ceil(total / PUBLIC_ADDRESS_PAGE_SIZE));
    const page = Math.min(filters.page, totalPages);
    const offset = (page - 1) * PUBLIC_ADDRESS_PAGE_SIZE;
    const rows = sqlite
      .prepare(`
        SELECT
          a.id,
          a.name,
          a.anytime_url AS anytimeUrl,
          a.state,
          a.state_name AS stateName,
          a.city,
          a.street_address AS streetAddress,
          a.postal_code AS postalCode,
          a.full_address AS fullAddress,
          a.price_cents AS priceCents,
          a.rdi,
          a.cmra,
          a.mailbox_min AS mailboxMin,
          a.mailbox_max AS mailboxMax,
          a.updated_at AS updatedAt
        FROM addresses a
        ${where}
        ORDER BY a.updated_at DESC, a.id DESC
        LIMIT ? OFFSET ?
      `)
      .all(...params, PUBLIC_ADDRESS_PAGE_SIZE, offset) as AddressRow[];

    const items = rows.map(toPublicAddressListItem);
    const start = total === 0 ? 0 : offset + 1;
    const end = offset + items.length;

    return {
      items,
      total,
      page,
      pageSize: PUBLIC_ADDRESS_PAGE_SIZE,
      totalPages,
      start,
      end,
      states,
      stats,
      selectedStateLabel: selectedState?.label ?? null,
    };
  } catch (error) {
    if (isUnavailableDatabaseError(error)) {
      return emptyAddressesPageData(filters);
    }

    throw error;
  } finally {
    sqlite?.close();
  }
}

export function parsePublicAddressFilters(searchParams: SearchParams = {}): PublicAddressFilters {
  const rdi = normalizeEnumParam(firstParam(searchParams.rdi), ['Residential', 'Commercial', 'none']);
  const cmra = normalizeEnumParam(firstParam(searchParams.cmra), ['Yes', 'No', 'none']);
  const price = normalizeEnumParam(firstParam(searchParams.price), ['lt10', 'lt20', 'gte20']);

  return {
    q: normalizeKeyword(firstParam(searchParams.q)),
    state: normalizeState(firstParam(searchParams.state)),
    rdi,
    cmra,
    price,
    page: normalizePage(firstParam(searchParams.page)),
  };
}

export function buildAddressesPageUrl(
  filters: PublicAddressFilters,
  overrides: Partial<PublicAddressFilters> = {},
) {
  const nextFilters: PublicAddressFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (nextFilters.q) params.set('q', nextFilters.q);
  if (nextFilters.state) params.set('state', nextFilters.state);
  if (nextFilters.rdi) params.set('rdi', nextFilters.rdi);
  if (nextFilters.cmra) params.set('cmra', nextFilters.cmra);
  if (nextFilters.price) params.set('price', nextFilters.price);
  if (nextFilters.page > 1) params.set('page', String(nextFilters.page));

  const query = params.toString();
  return `${query ? `/addresses?${query}` : '/addresses'}${PUBLIC_ADDRESSES_RESULT_HASH}`;
}

export function formatPublicPrice(priceCents: number) {
  return `US$ ${(priceCents / 100).toFixed(2)}`;
}

export function formatPublicMailboxRange(mailboxMin: number | null, mailboxMax: number | null) {
  return `${mailboxMin ?? 0} - ${mailboxMax ?? 0}`;
}

export function buildPublicGoogleMapsUrl(fullAddress: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

export function resolvePublicAddressDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return '../server/data/atmb.sqlite';
}

function buildAddressWhere(filters: PublicAddressFilters) {
  const where = ['a.is_active = 1', 'a.is_visible = 1'];
  const params: Array<string | number> = [];

  if (filters.q) {
    const keyword = `%${escapeLike(filters.q)}%`;
    where.push(`(
      a.name LIKE ? ESCAPE '\\'
      OR a.street_address LIKE ? ESCAPE '\\'
      OR a.city LIKE ? ESCAPE '\\'
      OR a.state_name LIKE ? ESCAPE '\\'
      OR a.state LIKE ? ESCAPE '\\'
      OR a.postal_code LIKE ? ESCAPE '\\'
      OR a.full_address LIKE ? ESCAPE '\\'
    )`);
    params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
  }

  if (filters.state) {
    where.push('a.state = ?');
    params.push(filters.state);
  }

  if (filters.rdi === 'none') {
    where.push("(a.rdi IS NULL OR a.rdi = '')");
  } else if (filters.rdi) {
    where.push('a.rdi = ?');
    params.push(filters.rdi);
  }

  if (filters.cmra === 'none') {
    where.push("(a.cmra IS NULL OR a.cmra = '')");
  } else if (filters.cmra) {
    where.push('a.cmra = ?');
    params.push(filters.cmra);
  }

  if (filters.price === 'lt10') {
    where.push('a.price_cents < ?');
    params.push(1000);
  } else if (filters.price === 'lt20') {
    where.push('a.price_cents < ?');
    params.push(2000);
  } else if (filters.price === 'gte20') {
    where.push('a.price_cents >= ?');
    params.push(2000);
  }

  return {
    where: `WHERE ${where.join(' AND ')}`,
    params,
  };
}

function listPublicStates(sqlite: Database.Database) {
  const rows = sqlite
    .prepare(`
      SELECT
        a.state AS code,
        COALESCE(s.name, a.state_name, a.state) AS name,
        COUNT(a.id) AS count
      FROM addresses a
      LEFT JOIN states s ON s.code = a.state
      WHERE a.is_active = 1
        AND a.is_visible = 1
      GROUP BY a.state, COALESCE(s.name, a.state_name, a.state)
      ORDER BY name ASC
    `)
    .all() as StateRow[];

  return rows.map((row) => {
    const state = getUsStateDisplay(row.code, row.name);

    return {
      code: state.code,
      name: state.name,
      zhName: state.zhName,
      label: state.label,
      count: row.count,
    } satisfies PublicStateLink;
  });
}

function readPublicAddressStats(sqlite: Database.Database) {
  const row = sqlite
    .prepare(`
      SELECT
        COUNT(*) AS totalAddresses,
        SUM(CASE WHEN rdi = 'Residential' THEN 1 ELSE 0 END) AS residentialAddresses,
        COUNT(DISTINCT state) AS stateCount
      FROM addresses
      WHERE is_active = 1
        AND is_visible = 1
    `)
    .get() as StatsRow;

  return {
    totalAddresses: row.totalAddresses ?? 0,
    residentialAddresses: row.residentialAddresses ?? 0,
    stateCount: row.stateCount ?? 0,
  } satisfies PublicAddressStats;
}

function toPublicAddressListItem(row: AddressRow) {
  const state = getUsStateDisplay(row.state, row.stateName);
  const fullAddress = buildPublicFullAddress(row);

  return {
    id: row.id,
    name: row.name,
    streetAddress: row.streetAddress,
    cityLine: `${row.city}, ${row.state} ${row.postalCode}`,
    stateLabel: state.label,
    price: formatPublicPrice(row.priceCents),
    rdi: row.rdi ?? '无',
    cmra: row.cmra ?? '无',
    mailbox: formatPublicMailboxRange(row.mailboxMin, row.mailboxMax),
    detailUrl: buildAddressDetailRedirectUrl(row.anytimeUrl),
    mapsUrl: buildPublicGoogleMapsUrl(fullAddress),
    updatedAt: row.updatedAt,
  } satisfies PublicAddressListItem;
}

function buildPublicFullAddress(row: AddressRow) {
  if (row.fullAddress) {
    return row.fullAddress;
  }

  return `${row.streetAddress}, ${row.city}, ${row.state} ${row.postalCode}, United States`;
}

function emptyAddressesPageData(filters: PublicAddressFilters): PublicAddressesPageData {
  return {
    items: [],
    total: 0,
    page: filters.page,
    pageSize: PUBLIC_ADDRESS_PAGE_SIZE,
    totalPages: 1,
    start: 0,
    end: 0,
    states: [],
    stats: {
      totalAddresses: 0,
      residentialAddresses: 0,
      stateCount: 0,
    },
    selectedStateLabel: null,
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeKeyword(value: string | undefined) {
  return value?.trim().slice(0, 80) ?? '';
}

function normalizeState(value: string | undefined) {
  const state = value?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(state) ? state : '';
}

function normalizeEnumParam(value: string | undefined, allowedValues: string[]) {
  const normalized = value?.trim() ?? '';
  return allowedValues.includes(normalized) ? normalized : '';
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function isUnavailableDatabaseError(error: unknown) {
  return error instanceof Error && /(no such table|unable to open database file)/i.test(error.message);
}
