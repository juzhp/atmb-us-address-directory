import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseContext } from '@atmb/db';
import type {
  AddressCmra,
  AddressCmraFilter,
  AddressPriceFilter,
  AddressRdi,
  AddressRdiFilter,
  AdminAddressListItem,
  AdminAddressListResponse,
  AdminAddressStats,
  AdminStateOption,
} from '@atmb/shared';

export interface AddressQuery {
  keyword?: string;
  state?: string;
  rdi?: AddressRdiFilter;
  cmra?: AddressCmraFilter;
  featured?: boolean;
  price?: AddressPriceFilter;
  page?: number;
  pageSize?: number;
}

export interface AddressUpdateInput {
  name?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  rdi?: AddressRdi;
  cmra?: AddressCmra;
  priceCents?: number;
  isFeatured?: boolean;
  isVisible?: boolean;
  statusNote?: string | null;
}

export interface UploadImageInput {
  addressId: number;
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
  uploadDir: string;
  publicBase: string;
}

export interface ClearImageInput {
  addressId: number;
  uploadDir: string;
}

interface AddressRow {
  recordSource: 'address' | 'discovered';
  canEdit: number;
  id: number;
  name: string;
  anytimeUrl: string;
  signupUrl: string | null;
  googleMapsUrl: string | null;
  country: string;
  state: string;
  stateName: string;
  city: string;
  streetAddress: string;
  postalCode: string;
  fullAddress: string;
  priceCents: number;
  priceCurrency: string;
  pricePeriod: string;
  rdi: AddressRdi | null;
  cmra: AddressCmra | null;
  mailboxMin: number | null;
  mailboxMax: number | null;
  mailboxCount: number | null;
  isFeatured: number;
  isActive: number;
  isVisible: number;
  statusNote: string | null;
  imageUrl: string | null;
  updatedAt: string;
}

interface AddressImageRow {
  id: number;
  fileName: string;
}

const MAX_PAGE_SIZE = 100;
const adminAddressRowsSql = `
  SELECT
    'address' AS recordSource,
    1 AS canEdit,
    a.id,
    a.name,
    a.anytime_url AS anytimeUrl,
    a.signup_url AS signupUrl,
    a.google_maps_url AS googleMapsUrl,
    a.country,
    a.state,
    a.state_name AS stateName,
    a.city,
    a.street_address AS streetAddress,
    a.postal_code AS postalCode,
    a.full_address AS fullAddress,
    a.price_cents AS priceCents,
    a.price_currency AS priceCurrency,
    a.price_period AS pricePeriod,
    a.rdi,
    a.cmra,
    a.mailbox_min AS mailboxMin,
    a.mailbox_max AS mailboxMax,
    a.mailbox_count AS mailboxCount,
    a.is_featured AS isFeatured,
    a.is_active AS isActive,
    a.is_visible AS isVisible,
    a.status_note AS statusNote,
    a.updated_at AS updatedAt,
    img.public_url AS imageUrl
  FROM addresses a
  LEFT JOIN address_images img
    ON img.address_id = a.id AND img.is_primary = 1
  UNION ALL
  SELECT
    'discovered' AS recordSource,
    0 AS canEdit,
    stage.id,
    stage.name,
    stage.anytime_url AS anytimeUrl,
    stage.signup_url AS signupUrl,
    NULL AS googleMapsUrl,
    stage.country,
    stage.state,
    stage.state_name AS stateName,
    stage.city,
    stage.street_address AS streetAddress,
    stage.postal_code AS postalCode,
    stage.full_address AS fullAddress,
    stage.price_cents AS priceCents,
    stage.price_currency AS priceCurrency,
    stage.price_period AS pricePeriod,
    stage.rdi,
    stage.cmra,
    stage.mailbox_min AS mailboxMin,
    stage.mailbox_max AS mailboxMax,
    stage.mailbox_count AS mailboxCount,
    0 AS isFeatured,
    1 AS isActive,
    1 AS isVisible,
    CASE
      WHEN stage.rdi IS NULL OR stage.cmra IS NULL THEN '待同步 RDI/CMRA'
      ELSE NULL
    END AS statusNote,
    stage.updated_at AS updatedAt,
    NULL AS imageUrl
  FROM crawl_discovered_addresses stage
  WHERE stage.imported_address_id IS NULL
    AND stage.crawl_status <> 'skipped'
    AND stage.id = (
      SELECT MAX(latest.id)
      FROM crawl_discovered_addresses latest
      WHERE latest.anytime_url = stage.anytime_url
    )
    AND NOT EXISTS (
      SELECT 1 FROM addresses existing WHERE existing.anytime_url = stage.anytime_url
    )
`;

export class AddressService {
  constructor(private readonly database: DatabaseContext) {}

  listAddresses(query: AddressQuery): AdminAddressListResponse {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize || 20)));
    const params: Record<string, string | number> = {};
    const where = ['a.isActive = 1'];

    if (query.keyword) {
      params.keyword = `%${query.keyword.trim()}%`;
      where.push(`(
        a.name LIKE @keyword OR a.streetAddress LIKE @keyword OR a.city LIKE @keyword
        OR a.postalCode LIKE @keyword OR a.fullAddress LIKE @keyword
      )`);
    }

    if (query.state) {
      params.state = query.state;
      where.push('a.state = @state');
    }

    if (query.rdi === 'none') {
      where.push("(a.rdi IS NULL OR a.rdi = '')");
    } else if (query.rdi) {
      params.rdi = query.rdi;
      where.push('a.rdi = @rdi');
    }

    if (query.cmra === 'none') {
      where.push("(a.cmra IS NULL OR a.cmra = '')");
    } else if (query.cmra) {
      params.cmra = query.cmra;
      where.push('a.cmra = @cmra');
    }

    if (typeof query.featured === 'boolean') {
      params.featured = query.featured ? 1 : 0;
      where.push('a.isFeatured = @featured');
    }

    if (query.price === 'lt10') {
      where.push('a.priceCents < 1000');
    } else if (query.price === 'lt20') {
      where.push('a.priceCents < 2000');
    } else if (query.price === 'gte20') {
      where.push('a.priceCents >= 2000');
    }

    const whereSql = where.join(' AND ');
    const total = (this.database.sqlite
      .prepare(`SELECT COUNT(*) AS count FROM (${adminAddressRowsSql}) a WHERE ${whereSql}`)
      .get(params) as { count: number }).count;
    const rows = this.database.sqlite
      .prepare(`
        SELECT *
        FROM (${adminAddressRowsSql}) a
        WHERE ${whereSql}
        ORDER BY a.updatedAt DESC, a.recordSource ASC, a.id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all({
        ...params,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }) as AddressRow[];

    return {
      items: rows.map(toListItem),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  getAddress(id: number) {
    const result = this.listAddresses({ page: 1, pageSize: 1 });
    const row = this.database.sqlite
      .prepare(`
        SELECT
          'address' AS recordSource,
          1 AS canEdit,
          a.id,
          a.name,
          a.anytime_url AS anytimeUrl,
          a.signup_url AS signupUrl,
          a.google_maps_url AS googleMapsUrl,
          a.country,
          a.state,
          a.state_name AS stateName,
          a.city,
          a.street_address AS streetAddress,
          a.postal_code AS postalCode,
          a.full_address AS fullAddress,
          a.price_cents AS priceCents,
          a.price_currency AS priceCurrency,
          a.price_period AS pricePeriod,
          a.rdi,
          a.cmra,
          a.mailbox_min AS mailboxMin,
          a.mailbox_max AS mailboxMax,
          a.mailbox_count AS mailboxCount,
          a.is_featured AS isFeatured,
          a.is_active AS isActive,
          a.is_visible AS isVisible,
          a.status_note AS statusNote,
          a.updated_at AS updatedAt,
          img.public_url AS imageUrl
        FROM addresses a
        LEFT JOIN address_images img
          ON img.address_id = a.id AND img.is_primary = 1
        WHERE a.id = ?
      `)
      .get(id) as AddressRow | undefined;

    void result;
    return row ? toListItem(row) : null;
  }

  updateAddress(id: number, input: AddressUpdateInput) {
    const current = this.getAddress(id);

    if (!current) {
      return null;
    }

    const next = {
      name: input.name ?? current.name,
      streetAddress: input.streetAddress ?? current.streetAddress,
      city: input.city ?? current.city,
      state: input.state ?? current.state,
      postalCode: input.postalCode ?? current.postalCode,
      rdi: input.rdi ?? current.rdi,
      cmra: input.cmra ?? current.cmra,
      priceCents: input.priceCents ?? current.priceCents,
      isFeatured: input.isFeatured ?? current.isFeatured,
      isVisible: input.isVisible ?? current.isVisible,
      statusNote: input.statusNote === undefined ? current.statusNote : input.statusNote,
    };
    const now = new Date().toISOString();
    const stateName = stateCodeToName(next.state) ?? current.stateName;
    const fullAddress = `${next.streetAddress} ${next.city}, ${next.state} ${next.postalCode} United States`;

    this.database.sqlite
      .prepare(`
        UPDATE addresses
        SET
          name = @name,
          street_address = @streetAddress,
          city = @city,
          state = @state,
          state_name = @stateName,
          postal_code = @postalCode,
          full_address = @fullAddress,
          rdi = @rdi,
          cmra = @cmra,
          price_cents = @priceCents,
          is_featured = @isFeatured,
          is_visible = @isVisible,
          status_note = @statusNote,
          updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        id,
        ...next,
        stateName,
        fullAddress,
        isFeatured: next.isFeatured ? 1 : 0,
        isVisible: next.isVisible ? 1 : 0,
        updatedAt: now,
      });

    if (current.priceCents !== next.priceCents) {
      this.recordEvent(id, 'price_changed', String(current.priceCents), String(next.priceCents));
    }

    return this.getAddress(id);
  }

  listStates(): AdminStateOption[] {
    return this.database.sqlite
      .prepare('SELECT id, name, code, slug FROM states ORDER BY name ASC')
      .all() as AdminStateOption[];
  }

  getStats(): AdminAddressStats {
    const totalAddresses = scalar(this.database.sqlite, `SELECT COUNT(*) FROM (${adminAddressRowsSql}) a WHERE a.isActive = 1`);
    const activeAddresses = scalar(this.database.sqlite, `SELECT COUNT(*) FROM (${adminAddressRowsSql}) a WHERE a.isActive = 1 AND a.isVisible = 1`);
    const residentialAddresses = scalar(this.database.sqlite, `SELECT COUNT(*) FROM (${adminAddressRowsSql}) a WHERE a.isActive = 1 AND a.isVisible = 1 AND a.rdi = 'Residential'`);
    const todayAdded = scalar(this.database.sqlite, "SELECT COUNT(*) FROM address_events WHERE event_type = 'added' AND date(created_at) = date('now')");
    const todayRemoved = scalar(this.database.sqlite, "SELECT COUNT(*) FROM address_events WHERE event_type = 'removed' AND date(created_at) = date('now')");

    return {
      totalAddresses,
      activeAddresses,
      residentialAddresses,
      todayAdded,
      todayRemoved,
    };
  }

  uploadStreetViewImage(input: UploadImageInput) {
    const address = this.getAddress(input.addressId);

    if (!address) {
      return null;
    }

    const extension = extensionForMime(input.mimeType, input.originalFileName);

    if (!extension) {
      throw new Error('INVALID_IMAGE_TYPE');
    }

    if (input.buffer.length > 5 * 1024 * 1024) {
      throw new Error('IMAGE_TOO_LARGE');
    }

    mkdirSync(input.uploadDir, { recursive: true });
    const fileName = `${randomUUID()}${extension}`;
    const publicUrl = `${input.publicBase.replace(/\/$/, '')}/${fileName}`;
    const filePath = join(input.uploadDir, fileName);
    writeFileSync(filePath, input.buffer);
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare('UPDATE address_images SET is_primary = 0, updated_at = ? WHERE address_id = ?')
      .run(now, input.addressId);
    const result = this.database.sqlite
      .prepare(`
        INSERT INTO address_images (
          address_id, type, file_name, public_url, original_file_name, mime_type,
          size_bytes, alt_text, is_primary, created_at, updated_at
        ) VALUES (?, 'street_view', ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)
      .run(
        input.addressId,
        fileName,
        publicUrl,
        input.originalFileName,
        input.mimeType,
        input.buffer.length,
        `${address.name} 街景图`,
        now,
        now,
      );

    return {
      id: Number(result.lastInsertRowid),
      addressId: input.addressId,
      fileName,
      publicUrl,
      originalFileName: input.originalFileName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
    };
  }

  clearStreetViewImage(input: ClearImageInput) {
    const address = this.getAddress(input.addressId);

    if (!address) {
      return null;
    }

    const images = this.database.sqlite
      .prepare(`
        SELECT id, file_name AS fileName
        FROM address_images
        WHERE address_id = ? AND is_primary = 1
      `)
      .all(input.addressId) as AddressImageRow[];
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare('UPDATE address_images SET is_primary = 0, updated_at = ? WHERE address_id = ? AND is_primary = 1')
      .run(now, input.addressId);

    for (const image of images) {
      rmSync(join(input.uploadDir, image.fileName), { force: true });
    }

    return this.getAddress(input.addressId);
  }

  private recordEvent(addressId: number, eventType: string, oldValue: string, newValue: string) {
    this.database.sqlite
      .prepare(`
        INSERT INTO address_events (address_id, event_type, old_value, new_value, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(addressId, eventType, oldValue, newValue, new Date().toISOString());
  }
}

function toListItem(row: AddressRow): AdminAddressListItem {
  return {
    ...row,
    canEdit: Boolean(row.canEdit),
    isFeatured: Boolean(row.isFeatured),
    isActive: Boolean(row.isActive),
    isVisible: Boolean(row.isVisible),
  };
}

function scalar(sqlite: DatabaseContext['sqlite'], sql: string) {
  const row = sqlite.prepare(sql).get() as { 'COUNT(*)': number };
  return row['COUNT(*)'];
}

function extensionForMime(mimeType: string, originalFileName: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/jpeg') {
    return '.jpg';
  }
  if (normalized === 'image/png') {
    return '.png';
  }

  const ext = extname(originalFileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    return '.jpg';
  }
  if (ext === '.png') {
    return '.png';
  }

  return null;
}

function stateCodeToName(code: string) {
  const states: Record<string, string> = {
    AL: 'Alabama',
    AZ: 'Arizona',
    TX: 'Texas',
  };

  return states[code];
}
