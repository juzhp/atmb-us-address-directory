import Database from 'better-sqlite3';
import { getUsStateDisplay } from '@atmb/shared';

export { buildAddressDetailRedirectUrl } from './referral-redirect';
import { buildAddressDetailRedirectUrl } from './referral-redirect';

export interface HomeStateOption {
  code: string;
  name: string;
  zhName: string;
  label: string;
  searchText: string;
  count: number;
  residentialCount: number;
}

export interface HomeFeaturedAddress {
  id: number;
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  stateName: string;
  stateLabel: string;
  postalCode: string;
  fullAddress: string;
  price: string;
  rdi: 'Residential' | 'Commercial';
  cmra: 'Yes' | 'No';
  mailbox: string;
  imageUrl: string | null;
  detailUrl: string;
  sourceDetailUrl: string;
  mapsUrl: string;
}

export interface HomePageData {
  featuredAddresses: HomeFeaturedAddress[];
  stateOptions: HomeStateOption[];
}

interface FeaturedAddressRow {
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
  rdi: 'Residential' | 'Commercial';
  cmra: 'Yes' | 'No';
  mailboxMin: number | null;
  mailboxMax: number | null;
  imageUrl: string | null;
}

interface StateRow {
  code: string;
  name: string;
  count: number;
  residentialCount: number;
}

export async function getHomePageData(): Promise<HomePageData> {
  const databaseUrl = resolveHomepageDatabaseUrl();

  if (!databaseUrl) {
    return emptyHomePageData();
  }

  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(databaseUrl, {
      fileMustExist: true,
      readonly: true,
    });

    return {
      featuredAddresses: listFeaturedAddresses(sqlite),
      stateOptions: listStateOptions(sqlite),
    };
  } catch (error) {
    if (isUnavailableDatabaseError(error)) {
      return emptyHomePageData();
    }

    throw error;
  } finally {
    sqlite?.close();
  }
}

export function formatHomePrice(priceCents: number) {
  return `US$ ${(priceCents / 100).toFixed(2)}`;
}

export function formatMailboxRange(mailboxMin: number | null, mailboxMax: number | null) {
  return `${mailboxMin ?? 0} - ${mailboxMax ?? 0}`;
}

export function buildGoogleMapsSearchUrl(fullAddress: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

export function resolveHomepageDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return '../server/data/atmb.sqlite';
}

function listFeaturedAddresses(sqlite: Database.Database) {
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
        img.public_url AS imageUrl
      FROM addresses a
      LEFT JOIN address_images img
        ON img.address_id = a.id AND img.is_primary = 1
      WHERE a.is_active = 1
        AND a.is_visible = 1
        AND a.is_featured = 1
        AND a.rdi = 'Residential'
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT 4
    `)
    .all() as FeaturedAddressRow[];

  return rows.map((row) => {
    const state = getUsStateDisplay(row.state, row.stateName);
    const fullAddress = buildPublicFullAddress(row);

    return {
      id: row.id,
      name: row.name,
      streetAddress: row.streetAddress,
      city: row.city,
      state: row.state,
      stateName: row.stateName,
      stateLabel: state.label,
      postalCode: row.postalCode,
      fullAddress,
      price: formatHomePrice(row.priceCents),
      rdi: row.rdi,
      cmra: row.cmra,
      mailbox: formatMailboxRange(row.mailboxMin, row.mailboxMax),
      imageUrl: row.imageUrl,
      detailUrl: buildAddressDetailRedirectUrl(row.anytimeUrl),
      sourceDetailUrl: row.anytimeUrl,
      mapsUrl: buildGoogleMapsSearchUrl(fullAddress),
    } satisfies HomeFeaturedAddress;
  });
}

function listStateOptions(sqlite: Database.Database) {
  const rows = sqlite
    .prepare(`
      SELECT
        s.code,
        s.name,
        COUNT(a.id) AS count,
        SUM(CASE WHEN a.rdi = 'Residential' THEN 1 ELSE 0 END) AS residentialCount
      FROM states s
      INNER JOIN addresses a
        ON a.state = s.code
       AND a.is_active = 1
       AND a.is_visible = 1
      GROUP BY s.code, s.name
      ORDER BY s.name ASC
    `)
    .all() as StateRow[];

  return rows.map((row) => {
    const state = getUsStateDisplay(row.code, row.name);

    return {
      code: state.code,
      name: state.name,
      zhName: state.zhName,
      label: state.label,
      searchText: state.searchText,
      count: row.count,
      residentialCount: row.residentialCount ?? 0,
    } satisfies HomeStateOption;
  });
}

function buildPublicFullAddress(row: FeaturedAddressRow) {
  return `${row.streetAddress}, ${row.city}, ${row.state} ${row.postalCode}, United States`;
}

function emptyHomePageData(): HomePageData {
  return {
    featuredAddresses: [],
    stateOptions: [],
  };
}

function isUnavailableDatabaseError(error: unknown) {
  return error instanceof Error && /(no such table|unable to open database file)/i.test(error.message);
}
