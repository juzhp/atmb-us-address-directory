import { EXTENSION_LOOKUP_MAX_ITEMS } from '@atmb/shared';

import {
  API_BASE,
  type CacheStats,
  type ExtensionLookupItem,
  type ExtensionLookupResponse,
  type ExtensionLookupResult,
  type LookupMessage,
  type LookupReply,
} from './shared/types.js';

// 查询结果按 item 指纹缓存 15 分钟，切城市来回不重复请求
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_KEY = 'lookupCache';
const META_KEY = 'lookupMeta';

interface CacheEntry {
  at: number;
  result: Omit<ExtensionLookupResult, 'ref'>;
}

type CacheMap = Record<string, CacheEntry>;

function fingerprint(item: ExtensionLookupItem) {
  if (item.sourceId) return `${item.platform}:id:${item.sourceId}`;
  if (item.street && item.city && item.state && item.postalCode) {
    return `${item.platform}:addr:${item.street}|${item.city}|${item.state}|${item.postalCode}`.toLowerCase();
  }
  return `${item.platform}:text:${item.text ?? ''}`.toLowerCase();
}

async function readCache(): Promise<CacheMap> {
  const stored = await chrome.storage.session.get(CACHE_KEY);
  return (stored[CACHE_KEY] as CacheMap | undefined) ?? {};
}

async function fetchLookup(items: ExtensionLookupItem[]): Promise<ExtensionLookupResponse> {
  const response = await fetch(`${API_BASE}/api/public/extension/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) {
    throw new Error(`lookup failed: HTTP ${response.status}`);
  }
  return (await response.json()) as ExtensionLookupResponse;
}

async function handleLookup(items: ExtensionLookupItem[]): Promise<LookupReply> {
  const now = Date.now();
  const cache = await readCache();
  const results: ExtensionLookupResult[] = [];
  const pending: ExtensionLookupItem[] = [];
  const pendingKeys = new Set<string>();

  for (const item of items) {
    const key = fingerprint(item);
    const hit = cache[key];
    if (hit && now - hit.at < CACHE_TTL_MS) {
      results.push({ ref: item.ref, ...hit.result });
    } else if (!pendingKeys.has(key)) {
      pendingKeys.add(key);
      pending.push({ ...item, ref: key });
    }
  }

  if (pending.length > 0) {
    const fetched = new Map<string, Omit<ExtensionLookupResult, 'ref'>>();
    for (let offset = 0; offset < pending.length; offset += EXTENSION_LOOKUP_MAX_ITEMS) {
      const chunk = pending.slice(offset, offset + EXTENSION_LOOKUP_MAX_ITEMS);
      const response = await fetchLookup(chunk);
      for (const result of response.results) {
        fetched.set(result.ref, { address: result.address, blacklist: result.blacklist });
      }
    }

    for (const [key, result] of fetched) {
      cache[key] = { at: now, result };
    }
    for (const key of Object.keys(cache)) {
      if (now - cache[key]!.at >= CACHE_TTL_MS) delete cache[key];
    }
    await chrome.storage.session.set({
      [CACHE_KEY]: cache,
      [META_KEY]: { lastLookupAt: new Date(now).toISOString() },
    });

    for (const item of items) {
      const key = fingerprint(item);
      const result = fetched.get(key);
      if (result && !results.some((existing) => existing.ref === item.ref)) {
        results.push({ ref: item.ref, ...result });
      }
    }
  }

  return { results };
}

async function cacheStats(): Promise<CacheStats> {
  const stored = await chrome.storage.session.get([CACHE_KEY, META_KEY]);
  const cache = (stored[CACHE_KEY] as CacheMap | undefined) ?? {};
  const meta = stored[META_KEY] as { lastLookupAt?: string } | undefined;
  return { entries: Object.keys(cache).length, lastLookupAt: meta?.lastLookupAt ?? null, apiBase: API_BASE };
}

chrome.runtime.onMessage.addListener((message: LookupMessage, _sender, sendResponse) => {
  const task = (async () => {
    switch (message.type) {
      case 'lookup':
        return handleLookup(message.items);
      case 'clearCache':
        await chrome.storage.session.remove([CACHE_KEY, META_KEY]);
        return { ok: true };
      case 'cacheStats':
        return cacheStats();
      default:
        return { error: 'unknown message' };
    }
  })();

  task
    .then((reply) => sendResponse(reply))
    .catch((error: unknown) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
  // 异步回包
  return true;
});
