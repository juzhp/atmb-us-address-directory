const assert = require('node:assert/strict');
const test = require('node:test');

const referralUrl = 'https://anytimemailbox.referralrock.com/l/1RENHONGLIU21/';
const cookieName = 'atmb_referral_visited';

test('get residential address redirect records the referral visit', async () => {
  const route = await import('./apps/web/app/go/get-us-residential-address/route.ts');
  const response = route.GET();

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), referralUrl);
  assert.match(response.headers.get('set-cookie') ?? '', new RegExp(`${cookieName}=1`));
  assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=2592000/);
});

test('address detail redirect sends first-time visitors to the referral url and records the visit', async () => {
  const route = await import('./apps/web/app/go/address-detail/route.ts');
  const target = 'https://www.anytimemailbox.com/s/fayetteville-3011-town-center-drive';
  const request = new Request(`https://atmb.test/go/address-detail?target=${encodeURIComponent(target)}`);
  const response = route.GET(request);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), referralUrl);
  assert.match(response.headers.get('set-cookie') ?? '', new RegExp(`${cookieName}=1`));
});

test('address detail redirect sends returning visitors to the real Anytime detail url', async () => {
  const route = await import('./apps/web/app/go/address-detail/route.ts');
  const target = 'https://locations.anytimemailbox.com/l/usa/alabama/madison-hwy-72';
  const request = new Request(`https://atmb.test/go/address-detail?target=${encodeURIComponent(target)}`, {
    headers: {
      cookie: `${cookieName}=1`,
    },
  });
  const response = route.GET(request);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), target);
});

test('address detail redirect rejects invalid targets', async () => {
  const route = await import('./apps/web/app/go/address-detail/route.ts');
  const target = 'https://example.com/phishing';
  const request = new Request(`https://atmb.test/go/address-detail?target=${encodeURIComponent(target)}`);
  const response = route.GET(request);

  assert.equal(response.status, 400);
});
