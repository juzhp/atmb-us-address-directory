import { createHash } from 'node:crypto';
import type { DatabaseContext } from '@atmb/db';
import type { AdminBlacklistItem, AdminBlacklistListResponse, BlacklistStatus, BlacklistSubmittedBy } from '@atmb/shared';

import type { ServerConfig } from '../auth/config.js';
import { normalizeAddressKey } from '../crawl/parser.js';

export interface BlacklistAddressInput {
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  reason: string;
  sourceUrl: string | null;
}

export interface BlacklistQuery {
  status?: BlacklistStatus | 'all';
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface BlacklistUpdateInput extends Partial<BlacklistAddressInput> {
  status?: BlacklistStatus;
  reviewNote?: string | null;
}

interface BlacklistRow {
  id: number;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  reason: string;
  sourceUrl: string | null;
  status: BlacklistStatus;
  submittedBy: BlacklistSubmittedBy;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const MAX_PAGE_SIZE = 100;
// 游客限频：同一 IP 1 小时 5 条、24 小时 20 条；全站 24 小时内待审核超过上限则暂停接收
const HOURLY_LIMIT_PER_IP = 5;
const DAILY_LIMIT_PER_IP = 20;
const PENDING_DAILY_CAP = 200;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const selectColumns = `
  id,
  street_address AS streetAddress,
  city,
  state,
  postal_code AS postalCode,
  reason,
  source_url AS sourceUrl,
  status,
  submitted_by AS submittedBy,
  review_note AS reviewNote,
  reviewed_by AS reviewedBy,
  reviewed_at AS reviewedAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

export class BlacklistService {
  constructor(
    private readonly database: DatabaseContext,
    private readonly config: ServerConfig,
  ) {}

  hashIp(ip: string) {
    return createHash('sha256').update(`${ip}:${this.config.sessionSecret}`).digest('hex');
  }

  submitPublic(input: BlacklistAddressInput, ip: string) {
    const ipHash = this.hashIp(ip);
    const now = Date.now();
    const hourAgo = new Date(now - HOUR_MS).toISOString();
    const dayAgo = new Date(now - DAY_MS).toISOString();
    const counts = this.database.sqlite
      .prepare(`
        SELECT
          SUM(CASE WHEN created_at > @hourAgo THEN 1 ELSE 0 END) AS hourly,
          COUNT(*) AS daily
        FROM address_blacklist
        WHERE submitter_ip_hash = @ipHash AND created_at > @dayAgo
      `)
      .get({ ipHash, hourAgo, dayAgo }) as { hourly: number | null; daily: number };

    if ((counts.hourly ?? 0) >= HOURLY_LIMIT_PER_IP || counts.daily >= DAILY_LIMIT_PER_IP) {
      throw new Error('BLACKLIST_RATE_LIMITED');
    }

    const normalizedAddressKey = normalizeAddressKey(input);
    const duplicate = this.database.sqlite
      .prepare(`
        SELECT 1
        FROM address_blacklist
        WHERE submitter_ip_hash = ? AND normalized_address_key = ? AND created_at > ?
        LIMIT 1
      `)
      .get(ipHash, normalizedAddressKey, dayAgo);

    if (duplicate) {
      throw new Error('BLACKLIST_DUPLICATE');
    }

    const pending = this.database.sqlite
      .prepare("SELECT COUNT(*) AS count FROM address_blacklist WHERE status = 'pending' AND created_at > ?")
      .get(dayAgo) as { count: number };

    if (pending.count >= PENDING_DAILY_CAP) {
      throw new Error('BLACKLIST_QUEUE_FULL');
    }

    this.insert(input, normalizedAddressKey, {
      status: 'pending',
      submittedBy: 'visitor',
      submitterIpHash: ipHash,
      reviewer: null,
    });
  }

  createAdminEntry(input: BlacklistAddressInput, reviewer: string) {
    const id = this.insert(input, normalizeAddressKey(input), {
      status: 'approved',
      submittedBy: 'admin',
      submitterIpHash: null,
      reviewer,
    });

    return this.getItem(id);
  }

  list(query: BlacklistQuery): AdminBlacklistListResponse {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize || 20)));
    const params: Record<string, string | number> = {};
    const where = ['1 = 1'];
    const status = query.status ?? 'pending';

    if (status !== 'all') {
      params.status = status;
      where.push('status = @status');
    }

    // 关键词按空格/逗号拆词，每个词都要出现在地址或问题描述里，整行地址也能搜到
    (query.keyword ?? '')
      .split(/[\s,，、]+/)
      .filter(Boolean)
      .slice(0, 12)
      .forEach((token, index) => {
        params[`keyword${index}`] = `%${token}%`;
        where.push(`(
          street_address || ', ' || city || ', ' || state || ' ' || postal_code || ' ' || reason
        ) LIKE @keyword${index}`);
      });

    const whereSql = where.join(' AND ');
    const total = (this.database.sqlite
      .prepare(`SELECT COUNT(*) AS count FROM address_blacklist WHERE ${whereSql}`)
      .get(params) as { count: number }).count;
    const items = this.database.sqlite
      .prepare(`
        SELECT ${selectColumns}
        FROM address_blacklist
        WHERE ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as BlacklistRow[];
    const pendingCount = (this.database.sqlite
      .prepare("SELECT COUNT(*) AS count FROM address_blacklist WHERE status = 'pending'")
      .get() as { count: number }).count;

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      pendingCount,
    };
  }

  getItem(id: number): AdminBlacklistItem {
    const row = this.database.sqlite
      .prepare(`SELECT ${selectColumns} FROM address_blacklist WHERE id = ?`)
      .get(id) as BlacklistRow | undefined;

    if (!row) {
      throw new Error('BLACKLIST_NOT_FOUND');
    }

    return row;
  }

  update(id: number, input: BlacklistUpdateInput, reviewer: string) {
    const current = this.getItem(id);
    const now = new Date().toISOString();
    const next = {
      streetAddress: input.streetAddress ?? current.streetAddress,
      city: input.city ?? current.city,
      state: input.state ?? current.state,
      postalCode: input.postalCode ?? current.postalCode,
      reason: input.reason ?? current.reason,
      sourceUrl: input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl,
    };
    const statusChanged = input.status !== undefined && input.status !== current.status;

    this.database.sqlite
      .prepare(`
        UPDATE address_blacklist
        SET
          street_address = @streetAddress,
          city = @city,
          state = @state,
          postal_code = @postalCode,
          normalized_address_key = @normalizedAddressKey,
          reason = @reason,
          source_url = @sourceUrl,
          status = @status,
          review_note = @reviewNote,
          reviewed_by = @reviewedBy,
          reviewed_at = @reviewedAt,
          updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        id,
        ...next,
        normalizedAddressKey: normalizeAddressKey(next),
        status: input.status ?? current.status,
        reviewNote: input.reviewNote === undefined ? current.reviewNote : input.reviewNote,
        reviewedBy: statusChanged ? reviewer : current.reviewedBy,
        reviewedAt: statusChanged ? now : current.reviewedAt,
        updatedAt: now,
      });

    return this.getItem(id);
  }

  delete(id: number) {
    const result = this.database.sqlite.prepare('DELETE FROM address_blacklist WHERE id = ?').run(id);

    if (result.changes === 0) {
      throw new Error('BLACKLIST_NOT_FOUND');
    }
  }

  private insert(
    input: BlacklistAddressInput,
    normalizedAddressKey: string,
    meta: {
      status: BlacklistStatus;
      submittedBy: BlacklistSubmittedBy;
      submitterIpHash: string | null;
      reviewer: string | null;
    },
  ) {
    const now = new Date().toISOString();
    const result = this.database.sqlite
      .prepare(`
        INSERT INTO address_blacklist (
          street_address, city, state, postal_code, normalized_address_key, reason, source_url,
          status, submitted_by, submitter_ip_hash, reviewed_by, reviewed_at, created_at, updated_at
        ) VALUES (
          @streetAddress, @city, @state, @postalCode, @normalizedAddressKey, @reason, @sourceUrl,
          @status, @submittedBy, @submitterIpHash, @reviewedBy, @reviewedAt, @now, @now
        )
      `)
      .run({
        streetAddress: input.streetAddress,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        normalizedAddressKey,
        reason: input.reason,
        sourceUrl: input.sourceUrl,
        status: meta.status,
        submittedBy: meta.submittedBy,
        submitterIpHash: meta.submitterIpHash,
        reviewedBy: meta.reviewer,
        reviewedAt: meta.reviewer ? now : null,
        now,
      });

    return Number(result.lastInsertRowid);
  }
}
