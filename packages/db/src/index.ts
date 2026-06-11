import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';

export { drizzle };
export * from './schema.js';

export interface CreateDatabaseOptions {
  url?: string;
}

const defaultDatabaseUrl = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data/atmb.sqlite');

export function createSqliteClient(url = process.env.DATABASE_URL ?? defaultDatabaseUrl) {
  if (url !== ':memory:') {
    mkdirSync(dirname(resolve(url)), { recursive: true });
  }

  return new Database(url);
}

export function createDatabase(options: CreateDatabaseOptions = {}) {
  const sqlite = createSqliteClient(options.url);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

export type DatabaseContext = ReturnType<typeof createDatabase>;

export function ensureDatabaseSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      sid TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx
      ON admin_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      slug TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'United States',
      anytime_url TEXT NOT NULL,
      location_count INTEGER NOT NULL DEFAULT 0,
      active_address_count INTEGER NOT NULL DEFAULT 0,
      residential_count INTEGER NOT NULL DEFAULT 0,
      last_crawled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS states_code_unique ON states (code);
    CREATE UNIQUE INDEX IF NOT EXISTS states_slug_unique ON states (slug);

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'anytimemailbox',
      source_id TEXT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      anytime_url TEXT NOT NULL UNIQUE,
      signup_url TEXT,
      google_maps_url TEXT,
      country TEXT NOT NULL DEFAULT 'United States',
      state TEXT NOT NULL,
      state_name TEXT NOT NULL,
      city TEXT NOT NULL,
      street_address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      full_address TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      price_currency TEXT NOT NULL DEFAULT 'USD',
      price_period TEXT NOT NULL DEFAULT 'month',
      rdi TEXT NOT NULL CHECK (rdi IN ('Residential', 'Commercial')),
      cmra TEXT NOT NULL CHECK (cmra IN ('Yes', 'No')),
      smarty_raw TEXT,
      smarty_checked_at TEXT,
      mailbox_min INTEGER,
      mailbox_max INTEGER,
      mailbox_count INTEGER,
      mailbox_numbers_json TEXT,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_visible INTEGER NOT NULL DEFAULT 1,
      status_note TEXT,
      last_crawled_at TEXT,
      first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      removed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS addresses_slug_idx ON addresses (slug);
    CREATE INDEX IF NOT EXISTS addresses_state_idx ON addresses (state);
    CREATE INDEX IF NOT EXISTS addresses_city_idx ON addresses (city);
    CREATE INDEX IF NOT EXISTS addresses_postal_code_idx ON addresses (postal_code);
    CREATE INDEX IF NOT EXISTS addresses_rdi_idx ON addresses (rdi);
    CREATE INDEX IF NOT EXISTS addresses_cmra_idx ON addresses (cmra);
    CREATE INDEX IF NOT EXISTS addresses_featured_idx ON addresses (is_featured);
    CREATE INDEX IF NOT EXISTS addresses_active_idx ON addresses (is_active);
    CREATE INDEX IF NOT EXISTS addresses_visible_idx ON addresses (is_visible);
    CREATE INDEX IF NOT EXISTS addresses_price_cents_idx ON addresses (price_cents);
    CREATE INDEX IF NOT EXISTS addresses_updated_at_idx ON addresses (updated_at);

    CREATE TABLE IF NOT EXISTS address_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS address_events_address_id_idx ON address_events (address_id);
    CREATE INDEX IF NOT EXISTS address_events_event_type_idx ON address_events (event_type);
    CREATE INDEX IF NOT EXISTS address_events_created_at_idx ON address_events (created_at);

    CREATE TABLE IF NOT EXISTS address_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address_id INTEGER NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'street_view',
      file_name TEXT NOT NULL,
      public_url TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      alt_text TEXT,
      is_primary INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS address_images_address_id_idx ON address_images (address_id);
    CREATE INDEX IF NOT EXISTS address_images_primary_idx ON address_images (is_primary);

    CREATE TABLE IF NOT EXISTS crawl_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_code TEXT NOT NULL UNIQUE,
      generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_type TEXT NOT NULL CHECK (created_type IN ('manual', 'system')),
      status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'pause_requested', 'paused', 'stop_requested', 'stopped', 'completed')),
      note TEXT,
      created_by TEXT NOT NULL,
      pending_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS crawl_tasks_batch_code_unique ON crawl_tasks (batch_code);
    CREATE INDEX IF NOT EXISTS crawl_tasks_generated_at_idx ON crawl_tasks (generated_at);
    CREATE INDEX IF NOT EXISTS crawl_tasks_created_type_idx ON crawl_tasks (created_type);
    CREATE INDEX IF NOT EXISTS crawl_tasks_status_idx ON crawl_tasks (status);

    CREATE TABLE IF NOT EXISTS crawl_subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES crawl_tasks(id) ON DELETE CASCADE,
      task_type TEXT NOT NULL CHECK (task_type IN ('fetch_states', 'fetch_names', 'fetch_addresses', 'fetch_mailbox_numbers', 'sync_smarty')),
      execution_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (execution_status IN ('pending', 'running', 'paused', 'completed')),
      result_status TEXT CHECK (result_status IS NULL OR result_status IN ('success', 'failed', 'stopped')),
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS crawl_subtasks_task_id_idx ON crawl_subtasks (task_id);
    CREATE INDEX IF NOT EXISTS crawl_subtasks_task_type_idx ON crawl_subtasks (task_type);
    CREATE INDEX IF NOT EXISTS crawl_subtasks_execution_status_idx ON crawl_subtasks (execution_status);
    CREATE INDEX IF NOT EXISTS crawl_subtasks_result_status_idx ON crawl_subtasks (result_status);

    CREATE TABLE IF NOT EXISTS crawl_discovered_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES crawl_tasks(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'anytimemailbox',
      source_id TEXT,
      state_name TEXT NOT NULL,
      state TEXT NOT NULL,
      state_url TEXT NOT NULL,
      state_location_count INTEGER,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      anytime_url TEXT NOT NULL,
      signup_url TEXT,
      myear_url TEXT,
      country TEXT NOT NULL DEFAULT 'United States',
      city TEXT NOT NULL,
      street_address TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      full_address TEXT NOT NULL,
      normalized_address_key TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      price_currency TEXT NOT NULL DEFAULT 'USD',
      price_period TEXT NOT NULL DEFAULT 'month',
      mailbox_min INTEGER,
      mailbox_max INTEGER,
      mailbox_count INTEGER,
      mailbox_numbers_json TEXT,
      rdi TEXT CHECK (rdi IS NULL OR rdi IN ('Residential', 'Commercial')),
      cmra TEXT CHECK (cmra IS NULL OR cmra IN ('Yes', 'No')),
      smarty_raw TEXT,
      smarty_checked_at TEXT,
      smarty_error TEXT,
      smarty_source_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
      crawl_status TEXT NOT NULL DEFAULT 'discovered'
        CHECK (crawl_status IN ('discovered', 'mailbox_fetched', 'smarty_reused', 'smarty_pending', 'smarty_failed', 'imported', 'skipped')),
      error_message TEXT,
      imported_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS crawl_discovered_task_url_unique
      ON crawl_discovered_addresses (task_id, anytime_url);
    CREATE INDEX IF NOT EXISTS crawl_discovered_task_id_idx
      ON crawl_discovered_addresses (task_id);
    CREATE INDEX IF NOT EXISTS crawl_discovered_anytime_url_idx
      ON crawl_discovered_addresses (anytime_url);
    CREATE INDEX IF NOT EXISTS crawl_discovered_normalized_key_idx
      ON crawl_discovered_addresses (normalized_address_key);
    CREATE INDEX IF NOT EXISTS crawl_discovered_status_idx
      ON crawl_discovered_addresses (crawl_status);
    CREATE INDEX IF NOT EXISTS crawl_discovered_imported_address_idx
      ON crawl_discovered_addresses (imported_address_id);

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      smarty_auth_id TEXT NOT NULL DEFAULT '',
      smarty_auth_token_encrypted TEXT,
      smarty_connection_status TEXT NOT NULL DEFAULT 'not_configured'
        CHECK (smarty_connection_status IN ('not_configured', 'connected', 'failed')),
      smarty_connection_message TEXT,
      smarty_last_tested_at TEXT,
      smarty_remaining_credits INTEGER,
      smarty_monthly_used INTEGER,
      smarty_credits_updated_at TEXT,
      auto_update_enabled INTEGER NOT NULL DEFAULT 1,
      update_frequency_days INTEGER DEFAULT 1
        CHECK (update_frequency_days IS NULL OR update_frequency_days IN (1, 2, 3, 4, 5, 10)),
      update_hour INTEGER NOT NULL DEFAULT 8 CHECK (update_hour BETWEEN 0 AND 23),
      update_minute INTEGER NOT NULL DEFAULT 30 CHECK (update_minute IN (0, 30)),
      head_code TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
