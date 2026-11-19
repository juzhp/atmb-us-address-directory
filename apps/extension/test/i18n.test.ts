import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { classify } from '../src/shared/classify.ts';
import { uspsResultFromPage } from '../src/shared/verify.ts';
import { loadMessages, useLocale } from './helpers/fake-i18n.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const locales = readdirSync(new URL('_locales/', root));
const manifest = JSON.parse(read('manifest.json')) as { default_locale: string };
const base = loadMessages(manifest.default_locale);

function sourceFiles(dir: string): string[] {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(`${dir}${entry.name}/`) : [`${dir}${entry.name}`],
  );
}

const placeholders = (message: string) => [...new Set(message.match(/\$\d/g) ?? [])].sort().join(',');

test('every locale has the same keys and placeholders as the default locale', () => {
  assert.deepEqual(locales.sort(), ['en', 'zh_CN', 'zh_TW']);
  assert.equal(manifest.default_locale, 'en');
  for (const locale of locales) {
    const messages = loadMessages(locale);
    assert.deepEqual(Object.keys(messages), Object.keys(base), locale);
    for (const [key, entry] of Object.entries(messages)) {
      assert.ok(entry.message.trim(), `${locale}.${key} is empty`);
      assert.equal(placeholders(entry.message), placeholders(base[key]!.message), `${locale}.${key} placeholders`);
    }
  }
});

test('store-facing strings stay within the manifest limits in every locale', () => {
  for (const locale of locales) {
    const messages = loadMessages(locale);
    assert.ok([...messages.extName!.message].length <= 75, `${locale} name`);
    assert.ok([...messages.extShortName!.message].length <= 12, `${locale} short name`);
    assert.ok([...messages.extDesc!.message].length <= 132, `${locale} description`);
  }
});

test('keys used by the code, popup and manifest all exist, and none is left unused', () => {
  const used = new Set<string>();
  for (const file of sourceFiles('src/')) {
    const text = read(file);
    for (const match of text.matchAll(/data-i18n="(\w+)"/g)) used.add(match[1]!);
    // t('key') 以及 t(cond ? 'a' : 'b') 里的键；类型为 MessageKey 的对象字段也用引号写键
    for (const match of text.matchAll(/'(\w+)'/g)) if (match[1]! in base) used.add(match[1]!);
  }
  for (const match of read('manifest.json').matchAll(/__MSG_(\w+)__/g)) used.add(match[1]!);

  for (const key of used) assert.ok(key in base, `missing message: ${key}`);
  assert.deepEqual(Object.keys(base).filter((key) => !used.has(key)), []);
});

test('ui text follows the active locale', () => {
  const blacklisted = { address: null, blacklist: [{ id: 1, address: '1 Main St', reason: 'x', sourceUrl: null }] };

  useLocale('en');
  assert.equal(classify({ address: null, blacklist: [] }).chipText, 'Not in data');
  assert.equal(classify(blacklisted).chipText, 'Blacklist (1) · Not in data');
  assert.deepEqual(uspsResultFromPage(['1 MAIN ST'], ['-', 'KINGS', '-', '-', 'N', '-', '-', '-', '-', '-', '-', '-', '-', 'D'], 2).fields, [
    { label: 'CMRA', value: 'N', tone: 'good' },
    { label: 'DPV confirmation', value: 'D unit missing', tone: 'warn' },
    { label: 'County', value: 'KINGS', tone: 'info' },
    { label: 'Results', value: '2 found, showing the first', tone: 'info' },
  ]);

  useLocale('zh_TW');
  assert.equal(classify(blacklisted).chipText, '黑名單 1 筆 · 未收錄');
});
