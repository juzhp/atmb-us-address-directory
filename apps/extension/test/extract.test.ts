import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  atmbSlugFromHref,
  extractAddressText,
  extractZip,
  parseAddressLines,
  parseCityLine,
  splitHtmlLines,
  stripMailboxPlaceholder,
} from '../src/shared/extract.ts';

test('parseCityLine splits "City, ST zip"', () => {
  assert.deepEqual(parseCityLine('Abilene, TX 79605'), { city: 'Abilene', state: 'TX', postalCode: '79605' });
  assert.deepEqual(parseCityLine('  North Pole,AK 99705-1234 '), { city: 'North Pole', state: 'AK', postalCode: '99705' });
  assert.equal(parseCityLine('United States'), null);
});

test('ATMB state list .t-addr html splits into street and city line', () => {
  const lines = splitHtmlLines('2438 Industrial Blvd<br>Abilene, TX 79605<br>');
  assert.deepEqual(lines, ['2438 Industrial Blvd', 'Abilene, TX 79605']);
  assert.deepEqual(parseAddressLines(lines), { street: '2438 Industrial Blvd', city: 'Abilene', state: 'TX', postalCode: '79605' });
});

test('iPostal1 tooltip with suite line and country line parses', () => {
  const parsed = parseAddressLines('1910 Pacific Ave\nSuite 2000\nDallas, TX 75201\nUnited States'.split('\n'));
  assert.deepEqual(parsed, { street: '1910 Pacific Ave Suite 2000', city: 'Dallas', state: 'TX', postalCode: '75201' });
  assert.deepEqual(splitHtmlLines('\n  1910 Pacific Ave<br>Suite 2000   '), ['1910 Pacific Ave', 'Suite 2000']);
});

test('ATMB detail street row drops the MAILBOX placeholder', () => {
  assert.equal(stripMailboxPlaceholder('2438 Industrial Blvd #'), '2438 Industrial Blvd');
  assert.equal(stripMailboxPlaceholder('3011 Town Center Dr Ste 130 # MAILBOX'), '3011 Town Center Dr Ste 130');
});

test('generic text extraction keeps everything up to the zip', () => {
  assert.equal(extractAddressText('6001 W Parmer Lane Austin, TX 78727'), '6001 W Parmer Lane Austin, TX 78727');
  assert.equal(
    extractAddressText('  1910 Pacific Ave Suite 2000 Dallas, TX    75201 United States '),
    '1910 Pacific Ave Suite 2000 Dallas, TX 75201',
  );
  assert.equal(extractAddressText('no address here'), null);
  assert.equal(extractZip('Dallas, TX 75201-1234'), '75201');
});

test('atmbSlugFromHref reads /s/{slug}', () => {
  assert.equal(atmbSlugFromHref('/s/abilene-2438-industrial-blvd'), 'abilene-2438-industrial-blvd');
  assert.equal(atmbSlugFromHref('https://www.anytimemailbox.com/s/madison-7169-hwy-72-w?x=1'), 'madison-7169-hwy-72-w');
  assert.equal(atmbSlugFromHref('/l/usa/texas'), null);
});
