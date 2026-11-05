import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractOnclickUrl, isPlatformEnabled, isPlatformHost, isReferralFresh, platformForUrl, referralUrlFor } from '../src/shared/referral.ts';
import { DEFAULT_SETTINGS } from '../src/shared/types.ts';

test('referral record is fresh for 30 days', () => {
  const now = Date.parse('2026-11-04T00:00:00.000Z');
  assert.equal(isReferralFresh(undefined, now), false);
  assert.equal(isReferralFresh('not a date', now), false);
  assert.equal(isReferralFresh('2026-10-06T00:00:00.000Z', now), true);
  assert.equal(isReferralFresh('2026-10-04T00:00:00.000Z', now), false);
});

test('platform hosts cover www, apex and signup subdomains', () => {
  assert.equal(isPlatformHost('anytimemailbox', 'www.anytimemailbox.com'), true);
  assert.equal(isPlatformHost('anytimemailbox', 'signup.anytimemailbox.com'), true);
  assert.equal(isPlatformHost('anytimemailbox', 'anytimemailbox.referralrock.com'), false);
  assert.equal(isPlatformHost('ipostal1', 'ipostal1.com'), true);
  assert.equal(isPlatformHost('ipostal1', 'evilipostal1.com'), false);
  assert.equal(platformForUrl('https://ipostal1.com/choose-digital-mailbox-location.php'), 'ipostal1');
  assert.equal(platformForUrl('https://www.anytimemailbox.com/l/usa/texas'), 'anytimemailbox');
  assert.equal(platformForUrl('https://example.com/'), null);
  assert.equal(platformForUrl(undefined), null);
});

test('referral urls come from the shared platform table', () => {
  assert.match(referralUrlFor('anytimemailbox'), /referralrock\.com/);
  assert.match(referralUrlFor('ipostal1'), /ipostal1\.com\/\?ref=/);
});

test('platform switches default off and map to the right platform', () => {
  assert.equal(isPlatformEnabled(DEFAULT_SETTINGS, 'anytimemailbox'), false);
  assert.equal(isPlatformEnabled(DEFAULT_SETTINGS, 'ipostal1'), false);
  assert.equal(isPlatformEnabled({ ...DEFAULT_SETTINGS, enableIpostal1: true }, 'ipostal1'), true);
  assert.equal(isPlatformEnabled({ ...DEFAULT_SETTINGS, enableIpostal1: true }, 'anytimemailbox'), false);
});

test('ATMB Select button onclick url is extracted', () => {
  assert.equal(
    extractOnclickUrl("location.href='https://signup.anytimemailbox.com/signup/new?term=30&amp;srvPlnId=31644'"),
    'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=31644',
  );
  assert.equal(extractOnclickUrl(null), null);
});
