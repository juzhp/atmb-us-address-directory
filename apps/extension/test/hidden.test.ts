import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isHiddenByFilters } from '../src/shared/filter-bar.ts';
import { hiddenKey } from '../src/shared/hidden.ts';
import { DEFAULT_FILTERS } from '../src/shared/types.ts';

test('hidden key prefers the platform id, then the normalized address, then text', () => {
  assert.equal(hiddenKey({ platform: 'ipostal1', sourceId: '2803', street: '1910 Pacific Ave', city: 'Dallas', state: 'TX', postalCode: '75201' }), 'ipostal1:id:2803');
  assert.equal(
    hiddenKey({ platform: 'anytimemailbox', street: '2438 Industrial Blvd', city: 'Abilene', state: 'TX', postalCode: '79605' }),
    'anytimemailbox:addr:2438 industrial blvd|abilene|tx|79605',
  );
  assert.equal(hiddenKey({ platform: 'anytimemailbox', text: '6001 W Parmer Lane, Austin, TX 78727' }), 'anytimemailbox:text:6001 w parmer lane austin tx 78727');
  // 同一地址在两个平台各自隐藏，互不影响
  assert.notEqual(hiddenKey({ platform: 'ipostal1', sourceId: '1' }), hiddenKey({ platform: 'anytimemailbox', sourceId: '1' }));
});

test('locally hidden cards are excluded by default and can be listed on their own', () => {
  const base = { usaddrRecorded: '1', usaddrBlacklisted: '0', usaddrRdi: 'Residential', usaddrCmra: 'No', usaddrUsps: '', usaddrC1: '' };
  const hidden = { dataset: { ...base, usaddrLocalHidden: '1' } };
  const visible = { dataset: { ...base, usaddrLocalHidden: '0' } };

  assert.equal(DEFAULT_FILTERS.hidden, 'exclude');
  assert.equal(isHiddenByFilters(hidden, DEFAULT_FILTERS), true);
  assert.equal(isHiddenByFilters(visible, DEFAULT_FILTERS), false);
  assert.equal(isHiddenByFilters(hidden, { ...DEFAULT_FILTERS, hidden: 'only' }), false);
  assert.equal(isHiddenByFilters(visible, { ...DEFAULT_FILTERS, hidden: 'only' }), true);
  assert.equal(isHiddenByFilters(hidden, { ...DEFAULT_FILTERS, hidden: 'all' }), false);
  assert.equal(isHiddenByFilters(visible, { ...DEFAULT_FILTERS, hidden: 'all' }), false);
  // 其他筛选条件照常叠加
  assert.equal(isHiddenByFilters(hidden, { ...DEFAULT_FILTERS, hidden: 'only', rdi: 'Commercial' }), true);
});
