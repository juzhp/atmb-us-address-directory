import { NextResponse } from 'next/server';

import {
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_VALUE,
  REFERRAL_URL,
} from '../../_lib/referral-redirect';

export function GET() {
  const response = NextResponse.redirect(REFERRAL_URL, 302);

  response.cookies.set({
    name: REFERRAL_COOKIE_NAME,
    value: REFERRAL_COOKIE_VALUE,
    httpOnly: true,
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
