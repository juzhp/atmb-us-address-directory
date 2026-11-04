import type { ExtensionLookupAddress } from '@atmb/shared';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classify } from '../src/shared/classify.ts';

const base: ExtensionLookupAddress = {
  id: 1,
  source: 'anytimemailbox',
  streetAddress: '2438 Industrial Blvd',
  city: 'Abilene',
  state: 'TX',
  postalCode: '79605',
  rdi: 'Residential',
  cmra: 'No',
  uspsCmra: 'N',
  c1Precheck: 'pass',
  priceCents: 1499,
  mailboxMin: 100,
  mailboxMax: 450,
  updatedAt: '2026-10-21T12:05:34.417Z',
  matchedBy: 'sourceId',
};

const entry = { id: 9, address: '2438 Industrial Blvd, Abilene, TX 79605', reason: '开户被拒', sourceUrl: null };

test('residential address without risk flags is good', () => {
  assert.deepEqual(classify({ address: base, blacklist: [] }), { state: 'good', chipText: '住宅 · 无黑名单' });
});

test('risk flags are listed on the chip', () => {
  const result = classify({ address: { ...base, rdi: 'Commercial', cmra: 'Yes', uspsCmra: 'Y', c1Precheck: 'fail' }, blacklist: [] });
  assert.equal(result.state, 'caution');
  assert.equal(result.chipText, '商业 · CMRA Yes · USPS CMRA Y · C1 不通过');
});

test('blacklist wins over everything else', () => {
  assert.deepEqual(classify({ address: base, blacklist: [entry] }), { state: 'blacklisted', chipText: '黑名单 1 条 · 住宅' });
  assert.deepEqual(classify({ address: null, blacklist: [entry, { ...entry, id: 10 }] }), { state: 'blacklisted', chipText: '黑名单 2 条 · 未收录' });
});

test('unknown address is unrecorded', () => {
  assert.deepEqual(classify({ address: null, blacklist: [] }), { state: 'unrecorded', chipText: '未收录' });
});
