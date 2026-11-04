import type { ExtensionLookupAddress, ExtensionLookupBlacklistEntry } from '@atmb/shared';

import { API_BASE } from './types.js';

// 线上站点与 API 同域；dev 构建 API 在 3001，网站仍在 3000
export const SITE_BASE = API_BASE.includes('localhost:3001') ? 'http://localhost:3000' : API_BASE;

export function buildSiteSearchUrl(address: ExtensionLookupAddress) {
  const path = address.source === 'ipostal1' ? '/ipostal1' : '/addresses';
  return `${SITE_BASE}${path}?q=${encodeURIComponent(address.streetAddress)}`;
}

// 与网站 buildPublicBlacklistLookupUrl 一致：用黑名单记录自己的地址文本做搜索词
export function buildBlacklistUrl(entry: ExtensionLookupBlacklistEntry) {
  return `${SITE_BASE}/address-blacklist?q=${encodeURIComponent(entry.address)}#blacklist-list-title`;
}

export function buildGoogleMapsUrl(fullAddress: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
}

export function buildSubmitBlacklistUrl(input: {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  sourceUrl: string;
}) {
  const params = new URLSearchParams();
  if (input.street) params.set('street', input.street);
  if (input.city) params.set('city', input.city);
  if (input.state) params.set('state', input.state);
  if (input.postalCode) params.set('zip', input.postalCode);
  params.set('source', input.sourceUrl);
  return `${SITE_BASE}/address-blacklist?${params.toString()}#submit`;
}

export function formatPrice(priceCents: number) {
  return `US$ ${(priceCents / 100).toFixed(2)}`;
}
