export const REFERRAL_URL = 'https://anytimemailbox.referralrock.com/l/1RENHONGLIU21/';
export const REFERRAL_COOKIE_NAME = 'atmb_referral_visited';
export const REFERRAL_COOKIE_VALUE = '1';
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const ADDRESS_DETAIL_REDIRECT_PATH = '/go/address-detail';
const ALLOWED_ANYTIME_DETAIL_HOSTS = new Set([
  'www.anytimemailbox.com',
  'locations.anytimemailbox.com',
]);

export function buildAddressDetailRedirectUrl(target: string) {
  return `${ADDRESS_DETAIL_REDIRECT_PATH}?target=${encodeURIComponent(target)}`;
}

export function isAllowedAnytimeDetailUrl(target: string) {
  try {
    const url = new URL(target);

    return url.protocol === 'https:' && ALLOWED_ANYTIME_DETAIL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function hasReferralVisitedCookie(cookieHeader: string | null) {
  return (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${REFERRAL_COOKIE_NAME}=${REFERRAL_COOKIE_VALUE}`);
}
