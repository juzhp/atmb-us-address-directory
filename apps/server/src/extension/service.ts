import type { DatabaseContext } from '@atmb/db';
import {
  normalizeAddressKey,
  normalizeComparable,
  zip5,
  type AddressSource,
  type ExtensionLookupAddress,
  type ExtensionLookupBlacklistEntry,
  type ExtensionLookupItem,
  type ExtensionLookupResponse,
  type ExtensionLookupResult,
} from '@atmb/shared';
import { createHash } from 'node:crypto';

import type { ServerConfig } from '../auth/config.js';

// 每次请求先对一次库里的指纹（一条聚合查询），变了才重建内存索引（约几千行，毫秒级）
// 公开接口限频：同一 IP 每分钟 60 次
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_WINDOW_MS = 60_000;

interface AddressRow {
  id: number;
  source: AddressSource;
  sourceId: string | null;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  rdi: ExtensionLookupAddress['rdi'];
  cmra: ExtensionLookupAddress['cmra'];
  uspsCmra: ExtensionLookupAddress['uspsCmra'];
  c1Precheck: ExtensionLookupAddress['c1Precheck'];
  priceCents: number;
  mailboxMin: number | null;
  mailboxMax: number | null;
  updatedAt: string;
  blacklistId: number | null;
}

interface IndexedAddress {
  row: AddressRow;
  streetCore: string;
  cityNorm: string;
}

interface IndexedBlacklist {
  entry: ExtensionLookupBlacklistEntry;
  key: string;
  streetCore: string;
  cityNorm: string;
}

interface LookupIndex {
  byPlatformId: Map<string, IndexedAddress>;
  byKey: Map<string, IndexedAddress>;
  byZip: Map<string, IndexedAddress[]>;
  blacklistById: Map<number, IndexedBlacklist>;
  blacklistByKey: Map<string, IndexedBlacklist[]>;
  blacklistByZip: Map<string, IndexedBlacklist[]>;
}

// 整行地址文本里门牌号也可能是 5 位数字，ZIP 取最后一个 5 位数
function lastZip5(text: string | undefined) {
  const all = (text ?? '').match(/\b\d{5}\b/g);
  return all ? all[all.length - 1]! : '';
}

function platformKey(source: AddressSource, sourceId: string) {
  return `${source}:${sourceId}`;
}

function containsPhrase(haystack: string, phrase: string) {
  return phrase.length > 0 && ` ${haystack} `.includes(` ${phrase} `);
}

// 宽松匹配用：常见街道词统一成缩写，页面写 Highway / Blvd. 与库里的 Hwy / Blvd 也能对上
const STREET_ABBREVIATIONS: Record<string, string> = {
  street: 'st', avenue: 'ave', boulevard: 'blvd', road: 'rd', drive: 'dr', lane: 'ln', parkway: 'pkwy',
  highway: 'hwy', suite: 'ste', court: 'ct', place: 'pl', circle: 'cir', terrace: 'ter', trail: 'trl',
  expressway: 'expy', freeway: 'fwy', building: 'bldg', apartment: 'apt', floor: 'fl',
  north: 'n', south: 's', east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
};

function looseText(value: string) {
  return normalizeComparable(value)
    .split(' ')
    .map((token) => STREET_ABBREVIATIONS[token] ?? token)
    .join(' ');
}

// 街道只取前 3 个词（门牌号 + 路名）做核心短语，库里多出的 "Ste 160C" 之类后缀不影响命中
function streetCore(street: string) {
  return looseText(street).split(' ').slice(0, 3).join(' ');
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}

export class ExtensionLookupService {
  private index: LookupIndex | null = null;
  private indexFingerprint = '';
  private readonly rateBuckets = new Map<string, { windowStart: number; count: number }>();

  constructor(
    private readonly database: DatabaseContext,
    private readonly config: ServerConfig,
  ) {}

  // 返回 true 表示放行
  consumeRateLimit(ip: string, now = Date.now()) {
    const key = createHash('sha256').update(`${ip}:${this.config.sessionSecret}`).digest('hex');
    const bucket = this.rateBuckets.get(key);

    if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
      if (this.rateBuckets.size > 10_000) {
        this.rateBuckets.clear();
      }
      this.rateBuckets.set(key, { windowStart: now, count: 1 });
      return true;
    }

    bucket.count += 1;
    return bucket.count <= RATE_LIMIT_PER_MINUTE;
  }

  lookup(items: ExtensionLookupItem[]): ExtensionLookupResponse {
    const index = this.ensureIndex();

    return {
      generatedAt: new Date().toISOString(),
      results: items.map((item) => this.lookupOne(index, item)),
    };
  }

  private lookupOne(index: LookupIndex, item: ExtensionLookupItem): ExtensionLookupResult {
    const structured = item.street && item.city && item.state && item.postalCode
      ? { streetAddress: item.street, city: item.city, state: item.state, postalCode: item.postalCode }
      : null;
    const key = structured ? normalizeAddressKey(structured) : null;
    const text = looseText(
      item.text ?? (structured ? `${structured.streetAddress} ${structured.city} ${structured.state} ${structured.postalCode}` : ''),
    );
    const zip = zip5(item.postalCode) || lastZip5(item.text);

    let matched: IndexedAddress | undefined;
    let matchedBy: ExtensionLookupAddress['matchedBy'] = 'sourceId';

    if (item.sourceId) {
      matched = index.byPlatformId.get(platformKey(item.platform, item.sourceId));
    }
    if (!matched && key) {
      matched = index.byKey.get(key);
      matchedBy = 'key';
    }
    if (!matched && zip && text) {
      matched = pickLoose(index.byZip.get(zip) ?? [], text);
      matchedBy = 'loose';
    }

    const blacklist = new Map<number, ExtensionLookupBlacklistEntry>();
    const marked = matched?.row.blacklistId != null ? index.blacklistById.get(matched.row.blacklistId) : undefined;
    if (marked) {
      blacklist.set(marked.entry.id, marked.entry);
    }
    const lookupKeys = new Set<string>();
    if (key) lookupKeys.add(key);
    if (matched) lookupKeys.add(normalizeAddressKey(matched.row));
    for (const candidateKey of lookupKeys) {
      for (const hit of index.blacklistByKey.get(candidateKey) ?? []) {
        blacklist.set(hit.entry.id, hit.entry);
      }
    }
    if (zip && text) {
      for (const hit of index.blacklistByZip.get(zip) ?? []) {
        if (containsPhrase(text, hit.streetCore) && containsPhrase(text, hit.cityNorm)) {
          blacklist.set(hit.entry.id, hit.entry);
        }
      }
    }

    return {
      ref: item.ref,
      address: matched ? toLookupAddress(matched.row, matchedBy) : null,
      blacklist: [...blacklist.values()],
    };
  }

  private ensureIndex() {
    const fingerprint = this.readFingerprint();
    if (this.index && fingerprint === this.indexFingerprint) {
      return this.index;
    }

    this.index = this.buildIndex();
    this.indexFingerprint = fingerprint;
    return this.index;
  }

  private readFingerprint() {
    const row = this.database.sqlite
      .prepare(`
        SELECT
          (SELECT COUNT(*) || ':' || IFNULL(MAX(updated_at), '') FROM addresses) AS addresses,
          (SELECT COUNT(*) || ':' || IFNULL(MAX(updated_at), '') FROM address_blacklist) AS blacklist,
          (SELECT COUNT(*) || ':' || IFNULL(SUM(blacklist_id), 0) FROM address_blacklist_marks) AS marks
      `)
      .get() as { addresses: string; blacklist: string; marks: string };

    return `${row.addresses}|${row.blacklist}|${row.marks}`;
  }

  private buildIndex(): LookupIndex {
    const addressRows = this.database.sqlite
      .prepare(`
        SELECT
          a.id,
          a.source,
          a.source_id AS sourceId,
          a.street_address AS streetAddress,
          a.city,
          a.state,
          a.postal_code AS postalCode,
          a.rdi,
          a.cmra,
          a.usps_cmra AS uspsCmra,
          a.c1_precheck AS c1Precheck,
          a.price_cents AS priceCents,
          a.mailbox_min AS mailboxMin,
          a.mailbox_max AS mailboxMax,
          a.updated_at AS updatedAt,
          b.id AS blacklistId
        FROM addresses a
        LEFT JOIN address_blacklist_marks bm ON bm.address_id = a.id
        LEFT JOIN address_blacklist b ON b.id = bm.blacklist_id AND b.status = 'approved'
        WHERE a.is_active = 1 AND a.is_visible = 1
        ORDER BY CASE WHEN a.source = 'anytimemailbox' THEN 0 ELSE 1 END, a.id
      `)
      .all() as AddressRow[];

    const index: LookupIndex = {
      byPlatformId: new Map(),
      byKey: new Map(),
      byZip: new Map(),
      blacklistById: new Map(),
      blacklistByKey: new Map(),
      blacklistByZip: new Map(),
    };

    for (const row of addressRows) {
      const indexed: IndexedAddress = {
        row,
        streetCore: streetCore(row.streetAddress),
        cityNorm: looseText(row.city),
      };
      if (row.sourceId) {
        index.byPlatformId.set(platformKey(row.source, row.sourceId), indexed);
      }
      // 同 key 时 ATMB 行排在前面，先占位者优先，与抓取去重时 ATMB 优先一致
      const key = normalizeAddressKey(row);
      if (!index.byKey.has(key)) {
        index.byKey.set(key, indexed);
      }
      pushTo(index.byZip, zip5(row.postalCode), indexed);
    }

    const blacklistRows = this.database.sqlite
      .prepare(`
        SELECT
          id,
          street_address AS streetAddress,
          city,
          state,
          postal_code AS postalCode,
          normalized_address_key AS key,
          reason,
          source_url AS sourceUrl
        FROM address_blacklist
        WHERE status = 'approved'
        ORDER BY id
      `)
      .all() as Array<{
        id: number;
        streetAddress: string;
        city: string;
        state: string;
        postalCode: string;
        key: string;
        reason: string;
        sourceUrl: string | null;
      }>;

    for (const row of blacklistRows) {
      const indexed: IndexedBlacklist = {
        entry: {
          id: row.id,
          address: `${row.streetAddress}, ${row.city}, ${row.state} ${row.postalCode}`,
          reason: row.reason,
          sourceUrl: row.sourceUrl,
        },
        key: row.key,
        streetCore: streetCore(row.streetAddress),
        cityNorm: looseText(row.city),
      };
      index.blacklistById.set(row.id, indexed);
      pushTo(index.blacklistByKey, row.key, indexed);
      pushTo(index.blacklistByZip, zip5(row.postalCode), indexed);
    }

    return index;
  }
}

// 同一 ZIP 下，页面文本同时包含库里的街道核心短语与城市即视为同一地址；多条命中时取核心短语最长的那条
function pickLoose(candidates: IndexedAddress[], text: string) {
  let best: IndexedAddress | undefined;
  for (const candidate of candidates) {
    if (!containsPhrase(text, candidate.streetCore) || !containsPhrase(text, candidate.cityNorm)) continue;
    if (!best || candidate.streetCore.length > best.streetCore.length) {
      best = candidate;
    }
  }
  return best;
}

function toLookupAddress(row: AddressRow, matchedBy: ExtensionLookupAddress['matchedBy']): ExtensionLookupAddress {
  return {
    id: row.id,
    source: row.source,
    streetAddress: row.streetAddress,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    rdi: row.rdi,
    cmra: row.cmra,
    uspsCmra: row.uspsCmra,
    c1Precheck: row.c1Precheck,
    priceCents: row.priceCents,
    mailboxMin: row.mailboxMin,
    mailboxMax: row.mailboxMax,
    updatedAt: row.updatedAt,
    matchedBy,
  };
}
