import { EXTENSION_LOOKUP_MAX_ITEMS, type AddressSource } from '@atmb/shared';

import { isPlatformHost, isReferralFresh, referralUrlFor } from './shared/referral.js';
import { readReferral, readSettings, writeReferral } from './shared/settings.js';
import { smartyDemoUrl, USPS_LOOKUP_URL, type VerifyResult } from './shared/verify.js';
import {
  API_BASE,
  type CacheStats,
  type ExtensionLookupItem,
  type ExtensionLookupResponse,
  type ExtensionLookupResult,
  type LookupMessage,
  type LookupReply,
  type ReferralReply,
  type VerifyJob,
  type VerifyJobReply,
  type VerifyPush,
  type VerifyStartReply,
} from './shared/types.js';

// 查询结果按 item 指纹缓存 15 分钟，切城市来回不重复请求
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_KEY = 'lookupCache';
const META_KEY = 'lookupMeta';
// 推荐链接跳转最多等这么久，超时就把用户送回原页，不记录归因
const REFERRAL_TIMEOUT_MS = 25_000;
// 已经落到平台域名但页面迟迟不到 complete（平台首页资源多）时，等这么久就视为归因完成
const LANDED_GRACE_MS = 5_000;

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

// ---- 推荐链接跳转：标签页先去推荐链接，落到平台域名后记录归因，再跳回原页 ----

interface PendingReferral {
  platform: AddressSource;
  returnUrl: string | null;
  sawLoading: boolean;
  landedTimer: ReturnType<typeof setTimeout> | null;
  timer: ReturnType<typeof setTimeout>;
}

const pendingByTab = new Map<number, PendingReferral>();

function platformInFlight(platform: AddressSource) {
  for (const pending of pendingByTab.values()) {
    if (pending.platform === platform) return true;
  }
  return false;
}

async function finishReferral(tabId: number, succeeded: boolean) {
  const pending = pendingByTab.get(tabId);
  if (!pending) return;
  clearTimeout(pending.timer);
  if (pending.landedTimer) clearTimeout(pending.landedTimer);
  pendingByTab.delete(tabId);
  if (succeeded) {
    await writeReferral(pending.platform, new Date().toISOString());
  }
  if (pending.returnUrl) {
    try {
      await chrome.tabs.update(tabId, { url: pending.returnUrl });
    } catch {
      // 标签页已关闭
    }
  }
}

async function startReferral(
  message: Extract<LookupMessage, { type: 'referral' }>,
  senderTabId: number | undefined,
): Promise<ReferralReply> {
  const { platform } = message;
  const record = await readReferral();
  if (isReferralFresh(record[platform])) {
    return { done: true };
  }
  if (platformInFlight(platform)) {
    return { pending: true };
  }

  let tabId = message.tabId ?? senderTabId;
  const url = referralUrlFor(platform);
  if (message.newTab || tabId === undefined) {
    const tab = await chrome.tabs.create({ url, active: true });
    tabId = tab.id;
  } else {
    await chrome.tabs.update(tabId, { url });
  }
  if (tabId === undefined) {
    return { error: 'no tab' };
  }

  pendingByTab.set(tabId, {
    platform,
    returnUrl: message.newTab ? null : (message.returnUrl ?? null),
    sawLoading: false,
    landedTimer: null,
    timer: setTimeout(() => void finishReferral(tabId!, false), REFERRAL_TIMEOUT_MS),
  });
  return { started: true };
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const pending = pendingByTab.get(tabId);
  if (!pending) return;
  if (changeInfo.status === 'loading') {
    pending.sawLoading = true;
  }
  if (!pending.sawLoading || !tab.url) return;
  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    return;
  }
  // ATMB 的推荐链接先经过 referralrock 再落到平台；iPostal1 的推荐链接本身就在平台域名下
  if (!isPlatformHost(pending.platform, hostname)) return;
  if (changeInfo.status === 'complete') {
    void finishReferral(tabId, true);
  } else if (!pending.landedTimer) {
    pending.landedTimer = setTimeout(() => void finishReferral(tabId, true), LANDED_GRACE_MS);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const pending = pendingByTab.get(tabId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingByTab.delete(tabId);
});

// ---- 实时查询：为数据卡片打开 Smarty 演示页 / USPS 查询页，页面里的脚本读到结果后交回，再转给原页面 ----
// 任务按标签页存在 session 里：等用户在 USPS 页面点 Find 的时间可能超过 Service Worker 的存活时间
const VERIFY_JOBS_KEY = 'verifyJobs';

type VerifyJobs = Record<string, VerifyJob>;

async function readVerifyJobs(): Promise<VerifyJobs> {
  const stored = await chrome.storage.session.get(VERIFY_JOBS_KEY);
  return (stored[VERIFY_JOBS_KEY] as VerifyJobs | undefined) ?? {};
}

async function startVerify(message: Extract<LookupMessage, { type: 'verify' }>, originTabId: number | undefined): Promise<VerifyStartReply> {
  if (originTabId === undefined) {
    return { error: '无法确定发起查询的标签页' };
  }
  const isSmarty = message.provider === 'smarty';
  // 两边都由页面脚本自动填写并查询；USPS 对后台标签页更敏感，放到前台，出结果后再切回原页面
  const tab = await chrome.tabs.create({
    url: isSmarty ? smartyDemoUrl(message.address) : USPS_LOOKUP_URL,
    active: !isSmarty,
    openerTabId: originTabId,
  });
  if (tab.id === undefined) {
    return { error: '无法打开查询页面' };
  }
  const jobs = await readVerifyJobs();
  jobs[String(tab.id)] = { provider: message.provider, address: message.address, originTabId, requestId: message.requestId };
  await chrome.storage.session.set({ [VERIFY_JOBS_KEY]: jobs });
  return { started: true };
}

async function verifyJobFor(tabId: number | undefined): Promise<VerifyJobReply> {
  if (tabId === undefined) return { job: null };
  const job = (await readVerifyJobs())[String(tabId)];
  return { job: job ? { provider: job.provider, address: job.address } : null };
}

async function finishVerify(tabId: number | undefined, result: VerifyResult, tabStillOpen: boolean) {
  if (tabId === undefined) return;
  const jobs = await readVerifyJobs();
  const job = jobs[String(tabId)];
  if (!job) return;
  delete jobs[String(tabId)];
  await chrome.storage.session.set({ [VERIFY_JOBS_KEY]: jobs });

  const push: VerifyPush = { type: 'verifyResult', requestId: job.requestId, provider: job.provider, result };
  try {
    await chrome.tabs.sendMessage(job.originTabId, push);
  } catch {
    // 原页面已关闭或已跳走
  }
  if (!tabStillOpen) return;
  try {
    // USPS 查询页在前台，查到结果就切回原页面看卡片
    if (job.provider === 'usps' && result.ok) {
      await chrome.tabs.update(job.originTabId, { active: true });
    }
    // 查询页默认留着方便回看；设置里开了自动关闭才关。USPS 没查到时始终留给用户改地址后手动重查
    const { autoCloseVerifyTab } = await readSettings();
    if (autoCloseVerifyTab && (job.provider === 'smarty' || result.ok)) {
      await chrome.tabs.remove(tabId);
    }
  } catch {
    // 标签页已不存在
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void finishVerify(tabId, { ok: false, error: '查询页面已关闭' }, false);
});

chrome.runtime.onMessage.addListener((message: LookupMessage, sender, sendResponse) => {
  const task = (async () => {
    switch (message.type) {
      case 'lookup':
        return handleLookup(message.items);
      case 'clearCache':
        await chrome.storage.session.remove([CACHE_KEY, META_KEY]);
        return { ok: true };
      case 'cacheStats':
        return cacheStats();
      case 'referral':
        return startReferral(message, sender.tab?.id);
      case 'verify':
        return startVerify(message, sender.tab?.id);
      case 'verifyJob':
        return verifyJobFor(sender.tab?.id);
      case 'verifyResult':
        await finishVerify(sender.tab?.id, message.result, true);
        return { ok: true };
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
