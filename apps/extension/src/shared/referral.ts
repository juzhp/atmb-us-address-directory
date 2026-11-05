import { PLATFORMS, type AddressSource } from '@atmb/shared';

import type { Settings } from './types.js';

// 功能与推荐链接绑定：平台功能开启后，30 天内至少经由一次推荐链接访问平台，数据条才会出现
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ReferralRecord = Partial<Record<AddressSource, string>>;

const PLATFORM_HOST_SUFFIX: Record<AddressSource, string> = {
  anytimemailbox: 'anytimemailbox.com',
  ipostal1: 'ipostal1.com',
};

export function isReferralFresh(iso: string | undefined, now = Date.now()) {
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && now - at < REFERRAL_TTL_MS;
}

export function isPlatformHost(platform: AddressSource, hostname: string) {
  const suffix = PLATFORM_HOST_SUFFIX[platform];
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

export function platformForUrl(url: string | undefined): AddressSource | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return (Object.keys(PLATFORM_HOST_SUFFIX) as AddressSource[]).find((platform) => isPlatformHost(platform, hostname)) ?? null;
  } catch {
    return null;
  }
}

export function referralUrlFor(platform: AddressSource) {
  return PLATFORMS[platform].referralUrl;
}

export function isPlatformEnabled(settings: Settings, platform: AddressSource) {
  return platform === 'anytimemailbox' ? settings.enableAnytimemailbox : settings.enableIpostal1;
}

// ATMB 详情页的 Select 按钮用 onclick="location.href='…'" 跳转，取出里面的 URL
export function extractOnclickUrl(onclick: string | null | undefined) {
  const match = (onclick ?? '').match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1]!.replace(/&amp;/g, '&') : null;
}
