import { NextResponse } from 'next/server';

import {
  hasReferralVisitedCookie,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_VALUE,
  resolveReferralPlatform,
} from '../../_lib/referral-redirect';

export function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('target') ?? '';
  const platform = resolveReferralPlatform(target);

  if (!platform) {
    return NextResponse.json({ message: 'Invalid address detail target' }, { status: 400 });
  }

  if (hasReferralVisitedCookie(request.headers.get('cookie'), platform.referralCookieName)) {
    return NextResponse.redirect(target, 302);
  }

  const response = NextResponse.redirect(platform.referralUrl, 302);

  response.cookies.set({
    name: platform.referralCookieName,
    value: REFERRAL_COOKIE_VALUE,
    httpOnly: true,
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
