import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isHiddenByFilters } from '../src/shared/filter-bar.ts';
import { filtersForUrl, sanitizeFilters } from '../src/shared/settings.ts';
import { DEFAULT_FILTERS, type FilterState } from '../src/shared/types.ts';

const recorded = { dataset: { usaddrRecorded: '1', usaddrBlacklisted: '0', usaddrRdi: 'Residential', usaddrCmra: 'No', usaddrUsps: '', usaddrC1: 'pass' } };
const commercial = { dataset: { usaddrRecorded: '1', usaddrBlacklisted: '1', usaddrRdi: 'Commercial', usaddrCmra: 'Yes', usaddrUsps: 'Y', usaddrC1: 'fail' } };
const unrecorded = { dataset: { usaddrRecorded: '0', usaddrBlacklisted: '0', usaddrRdi: '', usaddrCmra: '', usaddrUsps: '', usaddrC1: '' } };
const unrecordedBlacklisted = { dataset: { ...unrecorded.dataset, usaddrBlacklisted: '1' } };

const withFilter = (patch: Partial<FilterState>): FilterState => ({ ...DEFAULT_FILTERS, ...patch });

test('default filters hide nothing', () => {
  for (const card of [recorded, commercial, unrecorded]) {
    assert.equal(isHiddenByFilters(card, DEFAULT_FILTERS), false);
  }
});

test('recorded filter has all / recorded / unrecorded', () => {
  assert.equal(isHiddenByFilters(unrecorded, withFilter({ recorded: 'recorded' })), true);
  assert.equal(isHiddenByFilters(recorded, withFilter({ recorded: 'recorded' })), false);
  assert.equal(isHiddenByFilters(recorded, withFilter({ recorded: 'unrecorded' })), true);
  assert.equal(isHiddenByFilters(unrecorded, withFilter({ recorded: 'unrecorded' })), false);
});

test('data filters match values, unknown matches empty, unrecorded always hidden', () => {
  assert.equal(isHiddenByFilters(recorded, withFilter({ rdi: 'Residential' })), false);
  assert.equal(isHiddenByFilters(commercial, withFilter({ rdi: 'Residential' })), true);
  assert.equal(isHiddenByFilters(unrecorded, withFilter({ rdi: 'Residential' })), true);
  assert.equal(isHiddenByFilters(recorded, withFilter({ usps: 'unknown' })), false);
  assert.equal(isHiddenByFilters(commercial, withFilter({ usps: 'unknown' })), true);
  assert.equal(isHiddenByFilters(unrecorded, withFilter({ usps: 'unknown' })), true);
  assert.equal(isHiddenByFilters(commercial, withFilter({ cmra: 'Yes', c1: 'fail' })), false);
  assert.equal(isHiddenByFilters(recorded, withFilter({ cmra: 'Yes' })), true);
});

test('blacklist filter can exclude or keep only blacklisted, including unrecorded ones', () => {
  assert.equal(isHiddenByFilters(commercial, withFilter({ blacklist: 'exclude' })), true);
  assert.equal(isHiddenByFilters(unrecordedBlacklisted, withFilter({ blacklist: 'exclude' })), true);
  assert.equal(isHiddenByFilters(recorded, withFilter({ blacklist: 'exclude' })), false);
  assert.equal(isHiddenByFilters(recorded, withFilter({ blacklist: 'only' })), true);
  assert.equal(isHiddenByFilters(unrecordedBlacklisted, withFilter({ blacklist: 'only' })), false);
});

test('stored filters are sanitized and legacy checkbox values ignored', () => {
  assert.deepEqual(sanitizeFilters(undefined), DEFAULT_FILTERS);
  assert.deepEqual(sanitizeFilters({ residentialOnly: true, hideBlacklisted: true }), DEFAULT_FILTERS);
  assert.deepEqual(sanitizeFilters({ recorded: 'unrecorded', rdi: 'bogus', blacklist: 'only' }), { ...DEFAULT_FILTERS, recorded: 'unrecorded', blacklist: 'only' });
});

test('filters are remembered for the same url only', () => {
  const url = 'https://www.anytimemailbox.com/l/usa/texas';
  const stored = { url, state: { ...DEFAULT_FILTERS, recorded: 'recorded', rdi: 'Residential' } };
  assert.deepEqual(filtersForUrl(stored, url), { ...DEFAULT_FILTERS, recorded: 'recorded', rdi: 'Residential' });
  assert.deepEqual(filtersForUrl(stored, 'https://www.anytimemailbox.com/l/usa/california'), DEFAULT_FILTERS);
  assert.deepEqual(filtersForUrl(undefined, url), DEFAULT_FILTERS);
});
