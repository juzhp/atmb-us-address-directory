import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildVerifyAddress,
  extractSmartyCandidate,
  oneLineAddress,
  smartyDemoUrl,
  smartyResultFromCandidate,
  uspsResultFromPage,
} from '../src/shared/verify.ts';

const SMARTY_PAGE_TEXT = `Results:
Found 1 valid address
Valid address:
2438 Industrial Blvd
Abilene TX 79605-7207
Raw Output
Analyzed Output
{
  "input_index": 0,
  "candidate_index": 0,
  "delivery_line_1": "2438 Industrial Blvd",
  "last_line": "Abilene TX 79605-7207",
  "components": { "primary_number": "2438", "zipcode": "79605" },
  "metadata": { "record_type": "S", "rdi": "Commercial", "precision": "Zip9" },
  "analysis": { "dpv_match_code": "Y", "dpv_footnotes": "AABBR1", "dpv_cmra": "Y", "dpv_vacant": "N", "active": "Y" }
}
SMARTY PRODUCTS USED`;

test('verify address prefers structured fields and falls back to parsing one line', () => {
  assert.deepEqual(buildVerifyAddress({ street: '2438 Industrial Blvd', city: 'Abilene', state: 'TX', postalCode: '79605' }), {
    street: '2438 Industrial Blvd', city: 'Abilene', state: 'TX', postalCode: '79605',
  });
  const parsed = buildVerifyAddress({ text: '6001 W Parmer Lane, Austin, TX 78727' });
  assert.equal(parsed.state, 'TX');
  assert.equal(parsed.postalCode, '78727');
  assert.equal(oneLineAddress({ street: '2438 Industrial Blvd', city: 'Abilene', state: 'TX', postalCode: '79605' }), '2438 Industrial Blvd Abilene TX 79605');
});

test('smarty demo url uses the page own share-link format', () => {
  assert.equal(
    smartyDemoUrl({ street: '2438 Industrial Blvd', city: 'Abilene', state: 'TX', postalCode: '79605' }),
    'https://www.smarty.com/products/us-address-verification?street=2438%20Industrial%20Blvd%20Abilene%20TX%2079605&address-type=us-street-freeform',
  );
});

test('smarty raw output is extracted from page text and summarized', () => {
  const candidate = extractSmartyCandidate(SMARTY_PAGE_TEXT);
  assert.ok(candidate);
  assert.deepEqual(smartyResultFromCandidate(candidate), {
    ok: true,
    address: '2438 Industrial Blvd, Abilene TX 79605-7207',
    fields: [
      { label: 'RDI', value: 'Commercial', tone: 'warn' },
      { label: 'CMRA', value: 'Y', tone: 'warn' },
      { label: 'DPV 匹配', value: 'Y 已确认', tone: 'good' },
      { label: '空置', value: 'N', tone: 'good' },
    ],
  });
  assert.equal(extractSmartyCandidate('Type address here'), null);
  assert.equal(extractSmartyCandidate('{ "delivery_line_1": broken'), null);
});

test('usps result details are read by template position', () => {
  const details = ['C076', 'TAYLOR', '38', '6', 'Y', '-', '0035', 'A', 'S', '-', '-', '-', '-', 'Y'];
  assert.deepEqual(uspsResultFromPage(['', '2438 INDUSTRIAL BLVD', 'ABILENE TX 79605-7207'], details, 1), {
    ok: true,
    address: '2438 INDUSTRIAL BLVD, ABILENE TX 79605-7207',
    fields: [
      { label: 'CMRA', value: 'Y', tone: 'warn' },
      { label: 'DPV 确认', value: 'Y 已确认', tone: 'good' },
      { label: '县', value: 'TAYLOR', tone: 'info' },
    ],
  });
  const none = uspsResultFromPage(['1 MAIN ST', 'X NY 10001-0001'], ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', 'D'], 3);
  assert.deepEqual(none.fields, [
    { label: 'CMRA', value: '—', tone: 'muted' },
    { label: 'DPV 确认', value: 'D 缺单元号', tone: 'warn' },
    { label: '结果', value: '共 3 条，取第一条', tone: 'info' },
  ]);
});
