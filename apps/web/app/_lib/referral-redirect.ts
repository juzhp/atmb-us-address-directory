import { PLATFORMS, type PlatformInfo } from '@atmb/shared';

export const REFERRAL_URL = PLATFORMS.anytimemailbox.referralUrl;
export const REFERRAL_COOKIE_NAME = PLATFORMS.anytimemailbox.referralCookieName;
export const REFERRAL_COOKIE_VALUE = '1';
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const ADDRESS_DETAIL_REDIRECT_PATH = '/go/address-detail';

export function buildAddressDetailRedirectUrl(target: string) {
  return `${ADDRESS_DETAIL_REDIRECT_PATH}?target=${encodeURIComponent(target)}`;
}

// 按目标域名找到对应平台（推广链接与 cookie 名），不认识的域名返回 null
export function resolveReferralPlatform(target: string): PlatformInfo | null {
  try {
    const url = new URL(target);

    if (url.protocol !== 'https:') {
      return null;
    }

    return Object.values(PLATFORMS).find((platform) => platform.detailHosts.includes(url.hostname)) ?? null;
  } catch {
    return null;
  }
}

export function isAllowedAnytimeDetailUrl(target: string) {
  return resolveReferralPlatform(target) === PLATFORMS.anytimemailbox;
}

export function hasReferralVisitedCookie(cookieHeader: string | null, cookieName = REFERRAL_COOKIE_NAME) {
  return (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${cookieName}=${REFERRAL_COOKIE_VALUE}`);
}
