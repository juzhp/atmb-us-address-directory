const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
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

test('referral nav uses a plain anchor to avoid Next RSC fetch redirects', () => {
  const source = readFileSync('apps/web/app/_components/SiteShell.tsx', 'utf8');

  assert.match(
    source,
    /<a className="site-nav-recommend" href="\/go\/get-us-residential-address" rel="noreferrer" target="_blank">/,
  );
  assert.doesNotMatch(
    source,
    /<Link className="site-nav-recommend" href="\/go\/get-us-residential-address">/,
  );
});

const ipostal1ReferralUrl = 'https://ipostal1.com/?ref=7904';
const ipostal1CookieName = 'ipostal1_referral_visited';

test('address detail redirect sends first-time iPostal1 visitors to the iPostal1 referral url', async () => {
  const route = await import('./apps/web/app/go/address-detail/route.ts');
  const target = 'https://ipostal1.com/secure_checkout.php?stID=2996';
  const request = new Request(`https://atmb.test/go/address-detail?target=${encodeURIComponent(target)}`);
  const response = route.GET(request);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), ipostal1ReferralUrl);
  assert.match(response.headers.get('set-cookie') ?? '', new RegExp(`${ipostal1CookieName}=1`));
  assert.doesNotMatch(response.headers.get('set-cookie') ?? '', new RegExp(`${cookieName}=`));
});

test('address detail redirect sends returning iPostal1 visitors to the checkout url', async () => {
  const route = await import('./apps/web/app/go/address-detail/route.ts');
  const target = 'https://ipostal1.com/secure_checkout.php?stID=2996';
  const request = new Request(`https://atmb.test/go/address-detail?target=${encodeURIComponent(target)}`, {
    headers: {
      cookie: `${ipostal1CookieName}=1`,
    },
  });
  const response = route.GET(request);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), target);
});

test('the ATMB referral cookie does not satisfy an iPostal1 target', async () => {
  const route = await import('./apps/web/app/go/address-detail/route.ts');
  const target = 'https://ipostal1.com/secure_checkout.php?stID=2996';
  const request = new Request(`https://atmb.test/go/address-detail?target=${encodeURIComponent(target)}`, {
    headers: {
      cookie: `${cookieName}=1`,
    },
  });
  const response = route.GET(request);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), ipostal1ReferralUrl);
});

test('address detail redirect still rejects http and unknown hosts', async () => {
  const route = await import('./apps/web/app/go/address-detail/route.ts');

  for (const target of ['http://ipostal1.com/secure_checkout.php?stID=2996', 'https://ipostal1.com.evil.test/x']) {
    const request = new Request(`https://atmb.test/go/address-detail?target=${encodeURIComponent(target)}`);
    assert.equal(route.GET(request).status, 400, target);
  }
});
