import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIpostal1Export } from '../src/crawl/ipostal1-import.ts';

const body = JSON.stringify({ num_results: 1, display: '<article class="mail-center-card" store-id="2996"></article>' });

test('parses an export file keeping only ok states known to the built-in state table', () => {
  const parsed = parseIpostal1Export({
    source: 'ipostal1',
    fetchedAt: '2026-10-21T08:30:00Z',
    states: [
      { stateId: '2', code: 'AK', name: 'Alaska', status: 'ok', body },
      { stateId: '12', code: 'CA', name: 'California', status: 'failed', error: 'Cloudflare challenge', body: null },
      { stateId: '999', code: 'XX', name: 'Nowhere', status: 'ok', body },
      { stateId: '1', code: 'AL', name: 'Alabama', status: 'ok', body: '' },
    ],
  });

  assert.equal(parsed.fetchedAt, '2026-10-21T08:30:00Z');
  assert.deepEqual(parsed.states.map((state) => [state.stateId, state.code, state.name]), [['2', 'AK', 'Alaska']]);
  assert.equal(parsed.states[0]?.body, body);
  assert.deepEqual(parsed.skipped, [
    'CA (12): Cloudflare challenge',
    'XX (999): 不在内置的美国州表中',
    'AL (1): body 为空',
  ]);
});

test('rejects export files that are not iPostal1 exports', () => {
  assert.throws(() => parseIpostal1Export(null), /不是 JSON 对象/);
  assert.throws(() => parseIpostal1Export({ source: 'anytimemailbox', states: [] }), /source 不是 ipostal1/);
  assert.throws(() => parseIpostal1Export({ source: 'ipostal1', states: [] }), /缺少 states/);
  assert.throws(
    () => parseIpostal1Export({ source: 'ipostal1', states: [{ stateId: '2', status: 'failed', error: 'x' }] }),
    /没有可导入的州/,
  );
});
