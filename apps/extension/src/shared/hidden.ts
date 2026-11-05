import { normalizeAddressKey, normalizeComparable } from '@atmb/shared';

import type { ExtensionLookupItem } from './types.js';

// 本地隐藏：用户在列表里点「隐藏」的地址只记在这台浏览器里，不上传
export interface HiddenEntry {
  label: string;
  at: string;
}

export type HiddenMap = Record<string, HiddenEntry>;

const HIDDEN_KEY = 'hidden';

// 同一个地址在同一平台上要得到稳定的标识：优先平台自己的 ID，其次归一化地址
export function hiddenKey(item: Omit<ExtensionLookupItem, 'ref'>) {
  if (item.sourceId) return `${item.platform}:id:${item.sourceId}`;
  if (item.street && item.city && item.state && item.postalCode) {
    const key = normalizeAddressKey({ streetAddress: item.street, city: item.city, state: item.state, postalCode: item.postalCode });
    return `${item.platform}:addr:${key}`;
  }
  return `${item.platform}:text:${normalizeComparable(item.text ?? '')}`;
}

export async function readHidden(): Promise<HiddenMap> {
  const stored = await chrome.storage.local.get(HIDDEN_KEY);
  return (stored[HIDDEN_KEY] as HiddenMap | undefined) ?? {};
}

export async function writeHidden(map: HiddenMap) {
  await chrome.storage.local.set({ [HIDDEN_KEY]: map });
}

export async function clearHidden() {
  await chrome.storage.local.remove(HIDDEN_KEY);
}

export function onHiddenChanged(callback: (map: HiddenMap) => void) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[HIDDEN_KEY]) return;
    callback((changes[HIDDEN_KEY].newValue as HiddenMap | undefined) ?? {});
  });
}
