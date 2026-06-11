import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDatabase, ensureDatabaseSchema } from '@atmb/db';

import {
  loadAddressPatchRows,
  patchAddressRdiCmra,
} from '../src/scripts/legacy-rdi-cmra-patch.ts';

test('patches only address RDI and CMRA from a matched legacy result', () => {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const now = '2026-06-08T00:00:00.000Z';

  try {
    const addressResult = database.sqlite
      .prepare(`
        INSERT INTO addresses (
          source, source_id, name, slug, anytime_url, signup_url, google_maps_url,
          country, state, state_name, city, street_address, postal_code, full_address,
          price_cents, price_currency, price_period, rdi, cmra, smarty_raw, smarty_checked_at,
          mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
          is_featured, is_active, is_visible, status_note, last_crawled_at, first_seen_at,
          removed_at, created_at, updated_at
        ) VALUES (
          'anytimemailbox', 'source-1', 'Madison, AL 35758', 'madison-al-35758',
          'https://www.anytimemailbox.com/s/madison-7169-hwy-72-w',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=30467',
          'https://maps.example.test/original',
          'United States', 'AL', 'Alabama', 'Madison', '7169 Hwy 72 W Ste A',
          '35758', '7169 Hwy 72 W Ste A Madison, AL 35758 United States',
          1999, 'USD', 'month', 'Commercial', 'Yes', 'old-smarty-raw', '2026-01-01T00:00:00.000Z',
          100, 200, 101, '[100,200]',
          1, 1, 1, 'keep me', @now, @now,
          NULL, @now, @now
        )
      `)
      .run({ now });
    const addressId = Number(addressResult.lastInsertRowid);

    database.sqlite
      .prepare(`
        INSERT INTO crawl_tasks (
          id, batch_code, generated_at, created_type, status, note, created_by,
          pending_count, success_count, failed_count, total_count, created_at, updated_at
        ) VALUES (
          1, 'TASK-TEST', @now, 'manual', 'completed', NULL, 'test',
          0, 0, 0, 0, @now, @now
        )
      `)
      .run({ now });

    database.sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, crawl_status, created_at, updated_at
        ) VALUES (
          1, 'anytimemailbox', 'stage-1', 'Alabama', 'AL', 'https://example.test/alabama', 1,
          'Stage Madison', 'stage-madison', 'https://example.test/stage', NULL, NULL,
          'United States', 'Madison', 'Stage Street', '35758',
          'Stage Street Madison, AL 35758 United States', 'stage|madison|al|35758',
          999, 'USD', 'month', 'discovered', @now, @now
        )
      `)
      .run({ now });

    database.sqlite
      .prepare(`
        INSERT INTO address_events (address_id, event_type, old_value, new_value, message, created_at)
        VALUES (?, 'added', NULL, ?, 'existing event', ?)
      `)
      .run(addressId, 'https://www.anytimemailbox.com/s/madison-7169-hwy-72-w', now);

    const [row] = loadAddressPatchRows(database.sqlite, null);
    assert.equal(row?.id, addressId);

    const changed = patchAddressRdiCmra(database.sqlite, row, {
      rdi: 'Residential',
      cmra: 'No',
      raw: {
        name: 'Madison, AL 35758',
        address: '7169 Hwy 72 W Ste A',
        city: 'Madison',
        state: 'AL',
        zip: '35758',
      },
      score: 10,
    });

    assert.equal(changed, true);

    const address = database.sqlite
      .prepare(`
        SELECT
          rdi,
          cmra,
          price_cents AS priceCents,
          signup_url AS signupUrl,
          google_maps_url AS googleMapsUrl,
          smarty_raw AS smartyRaw,
          smarty_checked_at AS smartyCheckedAt,
          mailbox_min AS mailboxMin,
          mailbox_max AS mailboxMax,
          is_featured AS isFeatured,
          is_active AS isActive,
          is_visible AS isVisible,
          status_note AS statusNote,
          updated_at AS updatedAt
        FROM addresses
        WHERE id = ?
      `)
      .get(addressId) as Record<string, unknown>;

    assert.deepEqual(address, {
      rdi: 'Residential',
      cmra: 'No',
      priceCents: 1999,
      signupUrl: 'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=30467',
      googleMapsUrl: 'https://maps.example.test/original',
      smartyRaw: 'old-smarty-raw',
      smartyCheckedAt: '2026-01-01T00:00:00.000Z',
      mailboxMin: 100,
      mailboxMax: 200,
      isFeatured: 1,
      isActive: 1,
      isVisible: 1,
      statusNote: 'keep me',
      updatedAt: now,
    });

    const stage = database.sqlite
      .prepare('SELECT rdi, cmra, crawl_status AS crawlStatus, imported_address_id AS importedAddressId FROM crawl_discovered_addresses')
      .get() as Record<string, unknown>;
    assert.deepEqual(stage, {
      rdi: null,
      cmra: null,
      crawlStatus: 'discovered',
      importedAddressId: null,
    });

    const events = database.sqlite
      .prepare('SELECT event_type AS eventType, COUNT(*) AS count FROM address_events GROUP BY event_type')
      .all();
    assert.deepEqual(events, [{ eventType: 'added', count: 1 }]);
  } finally {
    database.sqlite.close();
  }
});

test('patches a discovered address and imports it when the main address table is empty', () => {
  const database = createDatabase({ url: ':memory:' });
  ensureDatabaseSchema(database.sqlite);
  const now = '2026-06-08T00:00:00.000Z';

  try {
    database.sqlite
      .prepare(`
        INSERT INTO crawl_tasks (
          id, batch_code, generated_at, created_type, status, note, created_by,
          pending_count, success_count, failed_count, total_count, created_at, updated_at
        ) VALUES (
          1, 'TASK-TEST', @now, 'manual', 'completed', NULL, 'test',
          0, 0, 0, 0, @now, @now
        )
      `)
      .run({ now });

    const stageResult = database.sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
          crawl_status, created_at, updated_at
        ) VALUES (
          1, 'anytimemailbox', 'stage-1', 'Washington', 'WA', 'https://example.test/washington', 1,
          'Vancouver - Hwy 99', 'vancouver-hwy-99',
          'https://www.anytimemailbox.com/s/vancouver-7720-ne-hwy-99-ste-d',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=12345',
          'https://signup.anytimemailbox.com/signup/new?term=30&srvPlnId=12345',
          'United States', 'Vancouver', '7720 NE Hwy 99 Ste D', '98665',
          '7720 NE Hwy 99 Ste D Vancouver, WA 98665 United States',
          '7720 ne hwy 99 ste d|vancouver|wa|98665',
          1499, 'USD', 'month', 10, 25, 16, '[10,25]',
          'mailbox_fetched', @now, @now
        )
      `)
      .run({ now });
    const stageId = Number(stageResult.lastInsertRowid);

    const [row] = loadAddressPatchRows(database.sqlite, null);
    assert.ok(row);
    assert.equal(row.id, stageId);

    const changed = patchAddressRdiCmra(database.sqlite, row, {
      rdi: 'Residential',
      cmra: 'No',
      raw: {
        name: 'Vancouver - Hwy 99',
        address: '7720 NE Hwy 99 Ste D',
        city: 'Vancouver',
        state: 'WA',
        zip: '98665',
      },
      score: 10,
    });

    assert.equal(changed, true);

    const stage = database.sqlite
      .prepare(`
        SELECT rdi, cmra, crawl_status AS crawlStatus, imported_address_id AS importedAddressId
        FROM crawl_discovered_addresses
        WHERE id = ?
      `)
      .get(stageId) as Record<string, unknown>;
    const address = database.sqlite
      .prepare(`
        SELECT
          name,
          anytime_url AS anytimeUrl,
          street_address AS streetAddress,
          city,
          state,
          postal_code AS postalCode,
          rdi,
          cmra,
          mailbox_min AS mailboxMin,
          mailbox_max AS mailboxMax
        FROM addresses
        WHERE anytime_url = 'https://www.anytimemailbox.com/s/vancouver-7720-ne-hwy-99-ste-d'
      `)
      .get() as Record<string, unknown>;
    const eventCount = (database.sqlite
      .prepare("SELECT COUNT(*) AS count FROM address_events WHERE event_type = 'added'")
      .get() as { count: number }).count;

    assert.equal(stage.rdi, 'Residential');
    assert.equal(stage.cmra, 'No');
    assert.equal(stage.crawlStatus, 'imported');
    assert.equal(typeof stage.importedAddressId, 'number');
    assert.deepEqual(address, {
      name: 'Vancouver - Hwy 99',
      anytimeUrl: 'https://www.anytimemailbox.com/s/vancouver-7720-ne-hwy-99-ste-d',
      streetAddress: '7720 NE Hwy 99 Ste D',
      city: 'Vancouver',
      state: 'WA',
      postalCode: '98665',
      rdi: 'Residential',
      cmra: 'No',
      mailboxMin: 10,
      mailboxMax: 25,
    });
    assert.equal(eventCount, 1);
  } finally {
    database.sqlite.close();
  }
});
