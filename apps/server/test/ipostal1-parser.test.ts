import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildIpostal1StateUrl,
  IPOSTAL1_US_STATES,
  listIpostal1States,
  parseIpostal1MailCenters,
} from '../src/crawl/ipostal1-parser.ts';

function card(input: {
  storeId: string;
  street: string;
  cityStateZip: string;
  zip: string;
  price?: string;
  withLink?: boolean;
}) {
  return `
    <article class="mail-center-card" store-id="${input.storeId}" long="-149.89" lat="61.19" store-tooltip="${input.street.replace(/<br>/g, '\n')}\n${input.cityStateZip}\nUnited States" store-postcode="${input.zip}">
      <div class="store-address-and-img-div">
        <p class="store-address">
          <!--<b class="store-name">iPostal1 Business Center AK001 </b><br>-->
          <span class="store-street-address">${input.street}</span>
          <br>
          <span class="store-city-state-zip">${input.cityStateZip}</span>
          <br><span class="stores-country">United States</span>
        </p>
      </div>
      <div class="location-price-and-choose-btn-div">
        ${input.price ? `<p class="store-plan-desktop"><b>${input.price}</b></p>` : ''}
        ${input.withLink === false ? '' : `<a href="https://ipostal1.com/secure_checkout.php?stID=${input.storeId}" class="choose-location-btn choose-location-btn-desktop" rel="nofollow">Choose this "Standard" address</a>`}
      </div>
    </article>
  `;
}

test('lists every built-in US state with its JSON endpoint url', () => {
  const states = listIpostal1States();

  assert.equal(states.length, IPOSTAL1_US_STATES.length);
  assert.equal(new Set(states.map((state) => state.code)).size, states.length);
  assert.equal(new Set(states.map((state) => state.stateId)).size, states.length);

  const alaska = states.find((state) => state.code === 'AK');
  assert.equal(alaska?.name, 'Alaska');
  assert.equal(alaska?.stateId, '2');
  assert.equal(alaska?.url, buildIpostal1StateUrl('223', '2'));
  assert.equal(alaska?.url, 'https://ipostal1.com/locations_ajax.php?action=get_mail_centers&country_id=223&state_id=2&exactMatch=0');
  assert.ok(states.some((state) => state.code === 'DC'));
  assert.ok(states.some((state) => state.code === 'PR'));
});

test('parses mail center cards from the state endpoint JSON', () => {
  const body = JSON.stringify({
    num_results: 2,
    display: [
      card({ storeId: '2996', street: '3300 Arctic Blvd<br>Suite 201', cityStateZip: 'Anchorage, AK 99503', zip: '99503', price: "''Standard'' address from $9.99" }),
      card({ storeId: '3597', street: '601 W 5th Ave', cityStateZip: 'Anchorage, AK 99501', zip: '99501', withLink: false }),
    ].join(''),
    searched: 'Alaska',
  });

  const { count, locations } = parseIpostal1MailCenters(body, 'AK');

  assert.equal(count, 2);
  assert.equal(locations.length, 2);
  assert.deepEqual(locations[0], {
    storeId: '2996',
    name: 'Anchorage - 3300 Arctic Blvd',
    streetAddress: '3300 Arctic Blvd Suite 201',
    city: 'Anchorage',
    state: 'AK',
    postalCode: '99503',
    priceCents: 999,
    detailUrl: 'https://ipostal1.com/secure_checkout.php?stID=2996',
  });
  assert.equal(locations[1]?.name, 'Anchorage - 601 W 5th Ave');
  assert.equal(locations[1]?.priceCents, 0);
  assert.equal(locations[1]?.detailUrl, 'https://ipostal1.com/secure_checkout.php?stID=3597');
});

test('rejects non-JSON state endpoint responses', () => {
  assert.throws(
    () => parseIpostal1MailCenters('<html><title>Just a moment...</title></html>', 'AK'),
    /did not return JSON/,
  );
  assert.deepEqual(parseIpostal1MailCenters(JSON.stringify({ num_results: 0, display: '' }), 'AK'), { count: 0, locations: [] });
});
