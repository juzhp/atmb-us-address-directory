import type { AddressSource } from '@atmb/shared';

import type { ReferralRecord } from './referral.js';
import { DEFAULT_FILTERS, DEFAULT_SETTINGS, FILTER_OPTIONS, type FilterState, type Settings } from './types.js';

const SETTINGS_KEY = 'settings';
const FILTERS_KEY = 'filters';
const REFERRAL_KEY = 'referral';

export async function readSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] as Partial<Settings> | undefined) };
}

export async function writeSettings(patch: Partial<Settings>) {
  const current = await readSettings();
  await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

// 只接受当前合法的取值，旧版本存的勾选框布尔值直接忽略
export function sanitizeFilters(stored: unknown): FilterState {
  const input = (stored ?? {}) as Record<string, unknown>;
  const result = { ...DEFAULT_FILTERS } as Record<keyof FilterState, string>;
  for (const key of Object.keys(FILTER_OPTIONS) as Array<keyof FilterState>) {
    const value = input[key];
    if (typeof value === 'string' && FILTER_OPTIONS[key].some((option) => option.value === value)) {
      result[key] = value;
    }
  }
  return result as FilterState;
}

// 筛选条件只在同一个链接下记住（刷新仍在），换了链接就回到默认
export function filtersForUrl(stored: unknown, url: string): FilterState {
  const record = (stored ?? {}) as { url?: unknown; state?: unknown };
  return record.url === url ? sanitizeFilters(record.state) : { ...DEFAULT_FILTERS };
}

export async function readFilters(url: string): Promise<FilterState> {
  const stored = await chrome.storage.local.get(FILTERS_KEY);
  return filtersForUrl(stored[FILTERS_KEY], url);
}

export async function writeFilters(url: string, filters: FilterState) {
  await chrome.storage.local.set({ [FILTERS_KEY]: { url, state: filters } });
}

export function onSettingsChanged(callback: (settings: Settings) => void) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
    callback({ ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined) });
  });
}

// 归因时间按平台存本机（local），不随账号同步：Cookie 本来就只在这台浏览器里
export async function readReferral(): Promise<ReferralRecord> {
  const stored = await chrome.storage.local.get(REFERRAL_KEY);
  return (stored[REFERRAL_KEY] as ReferralRecord | undefined) ?? {};
}

export async function writeReferral(platform: AddressSource, at: string) {
  const current = await readReferral();
  await chrome.storage.local.set({ [REFERRAL_KEY]: { ...current, [platform]: at } });
}

export function onReferralChanged(callback: (record: ReferralRecord) => void) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[REFERRAL_KEY]) return;
    callback((changes[REFERRAL_KEY].newValue as ReferralRecord | undefined) ?? {});
  });
}
