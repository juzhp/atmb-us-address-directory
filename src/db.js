import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

const dbDir = path.dirname(config.dbPath);
fs.mkdirSync(dbDir, { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    location_name TEXT NOT NULL,
    full_address TEXT NOT NULL,
    street TEXT,
    street2 TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT NOT NULL DEFAULT 'US',
    monthly_price REAL,
    currency TEXT NOT NULL DEFAULT 'USD',
    price_text TEXT,
    price_type TEXT NOT NULL DEFAULT 'unknown',
    detail_url TEXT,
    first_plan_url TEXT,
    first_plan_term INTEGER,
    first_plan_srvpl_id INTEGER,
    personalize_min INTEGER,
    personalize_max INTEGER,
    personalize_scanned_at TEXT,
    personalize_error TEXT,
    source_url TEXT NOT NULL,
    services_json TEXT,
    rdi TEXT,
    cmra TEXT,
    raw_json TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_locations_state ON locations(state);
  CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
  CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

  CREATE TABLE IF NOT EXISTS crawl_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'locations',
    status TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    total_states INTEGER NOT NULL DEFAULT 0,
    total_discovered INTEGER NOT NULL DEFAULT 0,
    total_processed INTEGER NOT NULL DEFAULT 0,
    total_inserted INTEGER NOT NULL DEFAULT 0,
    total_updated INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS smarty_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    auth_id TEXT NOT NULL,
    auth_token TEXT NOT NULL,
    quota_limit INTEGER NOT NULL DEFAULT 0,
    quota_used INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    priority INTEGER NOT NULL DEFAULT 100,
    last_used_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    must_change_password INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_used_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

ensureColumn("locations", "first_plan_url", "TEXT");
ensureColumn("locations", "first_plan_term", "INTEGER");
ensureColumn("locations", "first_plan_srvpl_id", "INTEGER");
ensureColumn("locations", "personalize_min", "INTEGER");
ensureColumn("locations", "personalize_max", "INTEGER");
ensureColumn("locations", "personalize_scanned_at", "TEXT");
ensureColumn("locations", "personalize_error", "TEXT");
ensureColumn("locations", "smarty_scanned_at", "TEXT");
ensureColumn("locations", "smarty_error", "TEXT");
ensureColumn("crawl_jobs", "type", "TEXT NOT NULL DEFAULT 'locations'");
ensureColumn("smarty_tokens", "priority", "INTEGER NOT NULL DEFAULT 100");
ensureColumn("smarty_tokens", "last_used_at", "TEXT");
ensureColumn("smarty_tokens", "last_error", "TEXT");
ensureColumn("users", "must_change_password", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("users", "last_login_at", "TEXT");

const insertLocationStmt = db.prepare(`
  INSERT INTO locations (
    external_id,
    location_name,
    full_address,
    street,
    street2,
    city,
    state,
    postal_code,
    country,
    monthly_price,
    currency,
    price_text,
    price_type,
    detail_url,
    first_plan_url,
    first_plan_term,
    first_plan_srvpl_id,
    personalize_min,
    personalize_max,
    personalize_scanned_at,
    personalize_error,
    source_url,
    services_json,
    rdi,
    cmra,
    raw_json,
    first_seen_at,
    last_seen_at,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    @externalId,
    @locationName,
    @fullAddress,
    @street,
    @street2,
    @city,
    @state,
    @postalCode,
    @country,
    @monthlyPrice,
    @currency,
    @priceText,
    @priceType,
    @detailUrl,
    @firstPlanUrl,
    @firstPlanTerm,
    @firstPlanSrvplId,
    @personalizeMin,
    @personalizeMax,
    @personalizeScannedAt,
    @personalizeError,
    @sourceUrl,
    @servicesJson,
    @rdi,
    @cmra,
    @rawJson,
    @firstSeenAt,
    @lastSeenAt,
    @isActive,
    @createdAt,
    @updatedAt
  )
`);

const updateLocationStmt = db.prepare(`
  UPDATE locations SET
    location_name = @locationName,
    full_address = @fullAddress,
    street = @street,
    street2 = @street2,
    city = @city,
    state = @state,
    postal_code = @postalCode,
    country = @country,
    monthly_price = @monthlyPrice,
    currency = @currency,
    price_text = @priceText,
    price_type = @priceType,
    detail_url = @detailUrl,
    first_plan_url = COALESCE(@firstPlanUrl, first_plan_url),
    first_plan_term = COALESCE(@firstPlanTerm, first_plan_term),
    first_plan_srvpl_id = COALESCE(@firstPlanSrvplId, first_plan_srvpl_id),
    source_url = @sourceUrl,
    services_json = @servicesJson,
    raw_json = @rawJson,
    last_seen_at = @lastSeenAt,
    is_active = @isActive,
    updated_at = @updatedAt
  WHERE external_id = @externalId
`);

const getLocationByExternalIdStmt = db.prepare(`
  SELECT id, rdi, cmra, first_seen_at
  FROM locations
  WHERE external_id = ?
`);

const insertJobStmt = db.prepare(`
  INSERT INTO crawl_jobs (
    type,
    status,
    started_at,
    finished_at,
    total_states,
    total_discovered,
    total_processed,
    total_inserted,
    total_updated,
    total_failed,
    error,
    created_at,
    updated_at
  ) VALUES (
    @type,
    @status,
    @startedAt,
    @finishedAt,
    @totalStates,
    @totalDiscovered,
    @totalProcessed,
    @totalInserted,
    @totalUpdated,
    @totalFailed,
    @error,
    @createdAt,
    @updatedAt
  )
`);

const updateJobStmt = db.prepare(`
  UPDATE crawl_jobs SET
    type = @type,
    status = @status,
    started_at = @startedAt,
    finished_at = @finishedAt,
    total_states = @totalStates,
    total_discovered = @totalDiscovered,
    total_processed = @totalProcessed,
    total_inserted = @totalInserted,
    total_updated = @totalUpdated,
    total_failed = @totalFailed,
    error = @error,
    updated_at = @updatedAt
  WHERE id = @id
`);

const latestJobStmt = db.prepare(`
  SELECT *
  FROM crawl_jobs
  ORDER BY id DESC
  LIMIT 1
`);

const latestJobByTypeStmt = db.prepare(`
  SELECT *
  FROM crawl_jobs
  WHERE type = ?
  ORDER BY id DESC
  LIMIT 1
`);

const getLocationByIdStmt = db.prepare(`
  SELECT *
  FROM locations
  WHERE id = ?
`);

const getLocationStatsStmt = db.prepare(`
  SELECT
    COUNT(*) AS total_locations,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_locations,
    SUM(
      CASE
        WHEN is_active = 1
          AND personalize_min IS NOT NULL
          AND personalize_max IS NOT NULL
        THEN 1
        ELSE 0
      END
    ) AS personalize_count,
    SUM(
      CASE
        WHEN is_active = 1
          AND (rdi IS NOT NULL OR cmra IS NOT NULL)
        THEN 1
        ELSE 0
      END
    ) AS enriched_count
  FROM locations
`);

const listStatesStmt = db.prepare(`
  SELECT
    state,
    COUNT(*) AS count,
    SUM(CASE WHEN rdi = 'Residential' THEN 1 ELSE 0 END) AS residential_count
  FROM locations
  WHERE is_active = 1
    AND state IS NOT NULL
    AND state != ''
  GROUP BY state
  ORDER BY state ASC
`);

const countDistinctFirstSeenStmt = db.prepare(`
  SELECT COUNT(DISTINCT date(first_seen_at)) AS count
  FROM locations
  WHERE is_active = 1
    AND first_seen_at IS NOT NULL
    AND first_seen_at != ''
`);

const getLatestDistinctFirstSeenStmt = db.prepare(`
  SELECT date(first_seen_at) AS first_seen_day
  FROM locations
  WHERE is_active = 1
    AND first_seen_at IS NOT NULL
    AND first_seen_at != ''
  GROUP BY date(first_seen_at)
  ORDER BY date(first_seen_at) DESC
  LIMIT 1
`);

const listRecentStatesFromLatestFirstSeenStmt = db.prepare(`
  SELECT state, COUNT(*) AS count
  FROM locations
  WHERE is_active = 1
    AND state IS NOT NULL
    AND state != ''
    AND date(first_seen_at) = ?
  GROUP BY state
  ORDER BY count DESC, state ASC
`);

const updateLocationPersonalizeStmt = db.prepare(`
  UPDATE locations SET
    first_plan_url = ?,
    first_plan_term = ?,
    first_plan_srvpl_id = ?,
    personalize_min = ?,
    personalize_max = ?,
    personalize_scanned_at = ?,
    personalize_error = ?,
    updated_at = ?
  WHERE id = ?
`);

const listLocationsForSmartyStmtBase = `
  SELECT id, street, street2, city, state, postal_code, full_address, location_name, rdi, cmra
  FROM locations
`;

const updateLocationSmartyStmt = db.prepare(`
  UPDATE locations SET
    rdi = ?,
    cmra = ?,
    smarty_scanned_at = ?,
    smarty_error = ?,
    updated_at = ?
  WHERE id = ?
`);

const listSmartyTokensStmt = db.prepare(`
  SELECT
    id,
    name,
    auth_id,
    quota_limit,
    quota_used,
    status,
    priority,
    last_used_at,
    last_error,
    created_at,
    updated_at
  FROM smarty_tokens
  ORDER BY priority ASC, id ASC
`);

const getSmartyTokenByIdStmt = db.prepare(`
  SELECT *
  FROM smarty_tokens
  WHERE id = ?
`);

const insertSmartyTokenStmt = db.prepare(`
  INSERT INTO smarty_tokens (
    name,
    auth_id,
    auth_token,
    quota_limit,
    quota_used,
    status,
    priority,
    last_used_at,
    last_error,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateSmartyTokenStmt = db.prepare(`
  UPDATE smarty_tokens SET
    name = ?,
    auth_id = ?,
    auth_token = ?,
    quota_limit = ?,
    status = ?,
    priority = ?,
    updated_at = ?
  WHERE id = ?
`);

const resetSmartyTokenUsageStmt = db.prepare(`
  UPDATE smarty_tokens SET
    quota_used = 0,
    status = 'active',
    last_error = NULL,
    updated_at = ?
  WHERE id = ?
`);

const listAvailableSmartyTokensStmt = db.prepare(`
  SELECT *
  FROM smarty_tokens
  WHERE status = 'active'
    AND quota_used < quota_limit
  ORDER BY priority ASC, last_used_at ASC, id ASC
`);

const getSmartyTokenSecretByIdStmt = db.prepare(`
  SELECT *
  FROM smarty_tokens
  WHERE id = ?
`);

const updateSmartyTokenUsageStmt = db.prepare(`
  UPDATE smarty_tokens SET
    quota_used = ?,
    status = ?,
    last_used_at = ?,
    last_error = ?,
    updated_at = ?
  WHERE id = ?
`);

const markSmartyTokenErrorStmt = db.prepare(`
  UPDATE smarty_tokens SET
    status = ?,
    last_error = ?,
    updated_at = ?
  WHERE id = ?
`);

const markMissingInactiveStmt = db.prepare(`
  UPDATE locations
  SET is_active = 0, updated_at = ?, last_seen_at = last_seen_at
  WHERE external_id NOT IN (SELECT value FROM json_each(?))
`);

const countUsersStmt = db.prepare(`
  SELECT COUNT(*) AS count
  FROM users
`);

const getUserByUsernameStmt = db.prepare(`
  SELECT *
  FROM users
  WHERE username = ?
`);

const getUserByIdStmt = db.prepare(`
  SELECT *
  FROM users
  WHERE id = ?
`);

const insertUserStmt = db.prepare(`
  INSERT INTO users (
    username,
    password_hash,
    role,
    status,
    must_change_password,
    last_login_at,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateUserPasswordStmt = db.prepare(`
  UPDATE users SET
    password_hash = ?,
    must_change_password = ?,
    updated_at = ?
  WHERE id = ?
`);

const updateUserLoginStmt = db.prepare(`
  UPDATE users SET
    last_login_at = ?,
    updated_at = ?
  WHERE id = ?
`);

const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (
    user_id,
    token_hash,
    expires_at,
    created_at
  ) VALUES (?, ?, ?, ?)
`);

const getSessionByTokenHashStmt = db.prepare(`
  SELECT
    sessions.id,
    sessions.user_id,
    sessions.token_hash,
    sessions.expires_at,
    sessions.created_at,
    users.username,
    users.role,
    users.status,
    users.must_change_password
  FROM sessions
  JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ?
`);

const deleteSessionByTokenHashStmt = db.prepare(`
  DELETE FROM sessions
  WHERE token_hash = ?
`);

const deleteExpiredSessionsStmt = db.prepare(`
  DELETE FROM sessions
  WHERE expires_at <= ?
`);

const getSettingStmt = db.prepare(`
  SELECT key, value, created_at, updated_at
  FROM settings
  WHERE key = ?
`);

const upsertSettingStmt = db.prepare(`
  INSERT INTO settings (
    key,
    value,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

const listApiKeysStmt = db.prepare(`
  SELECT id, name, key_prefix, status, last_used_at, created_at, updated_at
  FROM api_keys
  ORDER BY id DESC
`);

const getApiKeyByIdStmt = db.prepare(`
  SELECT id, name, key_prefix, status, last_used_at, created_at, updated_at
  FROM api_keys
  WHERE id = ?
`);

const getApiKeyByHashStmt = db.prepare(`
  SELECT *
  FROM api_keys
  WHERE key_hash = ?
`);

const insertApiKeyStmt = db.prepare(`
  INSERT INTO api_keys (
    name,
    key_hash,
    key_prefix,
    status,
    last_used_at,
    created_at,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const deleteApiKeyStmt = db.prepare(`
  DELETE FROM api_keys
  WHERE id = ?
`);

const markApiKeyUsedStmt = db.prepare(`
  UPDATE api_keys SET
    last_used_at = ?,
    updated_at = ?
  WHERE id = ?
`);

const listResidentialLocationsStmt = db.prepare(`
  SELECT *
  FROM locations
  WHERE rdi = 'Residential'
  ORDER BY id ASC
`);

export function nowIso() {
  return new Date().toISOString();
}

export function createJob(type = "locations") {
  const now = nowIso();
  const payload = {
    type,
    status: "running",
    startedAt: now,
    finishedAt: null,
    totalStates: 0,
    totalDiscovered: 0,
    totalProcessed: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalFailed: 0,
    error: null,
    createdAt: now,
    updatedAt: now
  };

  const result = insertJobStmt.run(payload);
  return Number(result.lastInsertRowid);
}

export function updateJob(job) {
  updateJobStmt.run({
    id: job.id,
    type: job.type ?? "locations",
    status: job.status,
    startedAt: job.startedAt ?? null,
    finishedAt: job.finishedAt ?? null,
    totalStates: job.totalStates ?? 0,
    totalDiscovered: job.totalDiscovered ?? 0,
    totalProcessed: job.totalProcessed ?? 0,
    totalInserted: job.totalInserted ?? 0,
    totalUpdated: job.totalUpdated ?? 0,
    totalFailed: job.totalFailed ?? 0,
    error: job.error ?? null,
    updatedAt: nowIso()
  });
}

export function getLatestJob() {
  return latestJobStmt.get() ?? null;
}

export function getLatestJobByType(type) {
  return latestJobByTypeStmt.get(type) ?? null;
}

export function upsertLocation(location) {
  const existing = getLocationByExternalIdStmt.get(location.externalId);
  const timestamp = nowIso();
  const basePayload = {
    externalId: location.externalId,
    locationName: location.locationName,
    fullAddress: location.fullAddress,
    street: location.street ?? null,
    street2: location.street2 ?? null,
    city: location.city ?? null,
    state: location.state ?? null,
    postalCode: location.postalCode ?? null,
    country: location.country ?? "US",
    monthlyPrice: location.monthlyPrice ?? null,
    currency: location.currency ?? "USD",
    priceText: location.priceText ?? null,
    priceType: location.priceType ?? "unknown",
    detailUrl: location.detailUrl ?? null,
    sourceUrl: location.sourceUrl,
    servicesJson: location.services?.length ? JSON.stringify(location.services) : null,
    rawJson: location.raw ? JSON.stringify(location.raw) : null,
    lastSeenAt: timestamp,
    isActive: 1,
    updatedAt: timestamp
  };

  const insertPayload = {
    ...basePayload,
    firstPlanUrl: location.firstPlanUrl ?? null,
    firstPlanTerm: location.firstPlanTerm ?? null,
    firstPlanSrvplId: location.firstPlanSrvplId ?? null,
    personalizeMin: location.personalizeMin ?? null,
    personalizeMax: location.personalizeMax ?? null,
    personalizeScannedAt: location.personalizeScannedAt ?? null,
    personalizeError: location.personalizeError ?? null,
    rdi: existing?.rdi ?? null,
    cmra: existing?.cmra ?? null,
    firstSeenAt: existing?.first_seen_at ?? timestamp,
    createdAt: timestamp
  };

  const updatePayload = {
    ...basePayload,
    firstPlanUrl: location.firstPlanUrl ?? null,
    firstPlanTerm: location.firstPlanTerm ?? null,
    firstPlanSrvplId: location.firstPlanSrvplId ?? null
  };

  if (!existing) {
    insertLocationStmt.run(insertPayload);
    return { inserted: 1, updated: 0 };
  }

  updateLocationStmt.run(updatePayload);
  return { inserted: 0, updated: 1 };
}

export function markMissingLocationsInactive(seenExternalIds) {
  const idsJson = JSON.stringify(seenExternalIds);
  markMissingInactiveStmt.run(nowIso(), idsJson);
}

export function listLocations({
  page = 1,
  limit = 50,
  state = null,
  isActive = null,
  rdi = null,
  cmra = null,
  query = null,
  sort = "first_seen_desc"
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;
  const normalizedQuery = query?.trim() || null;
  const orderBySql =
    sort === "first_seen_desc"
      ? "ORDER BY datetime(first_seen_at) DESC, id DESC"
      : "ORDER BY state ASC, city ASC, location_name ASC";
  const params = {
    state: state || null,
    isActive:
      isActive === null || isActive === undefined
        ? null
        : Number(Boolean(Number(isActive))),
    rdi: rdi?.trim() || null,
    cmra: cmra?.trim() || null,
    query: normalizedQuery,
    queryLike: normalizedQuery ? `%${normalizedQuery}%` : null
  };

  const whereSql = `
    WHERE (@state IS NULL OR state = @state)
      AND (@isActive IS NULL OR is_active = @isActive)
      AND (@rdi IS NULL OR rdi = @rdi)
      AND (@cmra IS NULL OR cmra = @cmra)
      AND (
        @query IS NULL OR
        location_name LIKE @queryLike OR
        full_address LIKE @queryLike OR
        city LIKE @queryLike
      )
  `;

  const listStmt = db.prepare(`
    SELECT *
    FROM locations
    ${whereSql}
    ${orderBySql}
    LIMIT ${safeLimit} OFFSET ${offset}
  `);

  const countStmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM locations
    ${whereSql}
  `);

  const rows = listStmt.all(params).map(deserializeLocationRow);
  const total = countStmt.get(params).count;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    items: rows
  };
}

export function getLocationById(id) {
  const row = getLocationByIdStmt.get(id);
  return row ? deserializeLocationRow(row) : null;
}

export function getLocationStats() {
  const row = getLocationStatsStmt.get() ?? {};
  return {
    totalLocations: Number(row.total_locations ?? 0),
    activeLocations: Number(row.active_locations ?? 0),
    personalizeCount: Number(row.personalize_count ?? 0),
    enrichedCount: Number(row.enriched_count ?? 0)
  };
}

export function listStates() {
  return listStatesStmt.all().map((row) => ({
    state: row.state,
    count: Number(row.count ?? 0),
    residentialCount: Number(row.residential_count ?? 0)
  }));
}

export function listRecentStatesFromLatestLocations(limit = 20) {
  const distinctFirstSeenCount = Number(countDistinctFirstSeenStmt.get()?.count ?? 0);
  if (distinctFirstSeenCount <= 1) {
    return [];
  }

  const latestFirstSeenDay = getLatestDistinctFirstSeenStmt.get()?.first_seen_day;
  if (!latestFirstSeenDay) {
    return [];
  }

  return listRecentStatesFromLatestFirstSeenStmt.all(latestFirstSeenDay).map((row) => ({
    state: row.state,
    count: Number(row.count ?? 0)
  }));
}

export function listLocationsForPersonalizeScan(filters = {}) {
  const normalizedQuery = filters.query?.trim() || null;
  const isActive =
    filters.isActive === null || filters.isActive === undefined || filters.isActive === ""
      ? null
      : Number(Boolean(Number(filters.isActive)));

  const params = {
    state: filters.state?.trim().toUpperCase() || null,
    isActive,
    rdi: filters.rdi?.trim() || null,
    cmra: filters.cmra?.trim() || null,
    query: normalizedQuery,
    queryLike: normalizedQuery ? `%${normalizedQuery}%` : null
  };

  const whereSql = `
    WHERE detail_url IS NOT NULL
      AND detail_url != ''
      AND (@state IS NULL OR state = @state)
      AND (@isActive IS NULL OR is_active = @isActive)
      AND (@rdi IS NULL OR rdi = @rdi)
      AND (@cmra IS NULL OR cmra = @cmra)
      AND (
        @query IS NULL OR
        location_name LIKE @queryLike OR
        full_address LIKE @queryLike OR
        city LIKE @queryLike
      )
  `;

  const stmt = db.prepare(`
    SELECT id, detail_url, location_name
    FROM locations
    ${whereSql}
    ORDER BY id ASC
  `);

  return stmt.all(params);
}

export function updateLocationPersonalizeScan(id, result) {
  updateLocationPersonalizeStmt.run(
    result.firstPlanUrl ?? null,
    result.firstPlanTerm ?? null,
    result.firstPlanSrvplId ?? null,
    result.personalizeMin ?? null,
    result.personalizeMax ?? null,
    result.personalizeScannedAt ?? nowIso(),
    result.personalizeError ?? null,
    nowIso(),
    id
  );
}

export function listLocationsForSmartyEnrichment(filters = {}) {
  const normalizedQuery = filters.query?.trim() || null;
  const isActive =
    filters.isActive === null || filters.isActive === undefined || filters.isActive === ""
      ? null
      : Number(Boolean(Number(filters.isActive)));

  const params = {
    state: filters.state?.trim().toUpperCase() || null,
    isActive,
    rdi: filters.rdi?.trim() || null,
    cmra: filters.cmra?.trim() || null,
    query: normalizedQuery,
    queryLike: normalizedQuery ? `%${normalizedQuery}%` : null
  };

  const whereSql = `
    WHERE street IS NOT NULL
      AND city IS NOT NULL
      AND state IS NOT NULL
      AND postal_code IS NOT NULL
      AND (rdi IS NULL OR cmra IS NULL)
      AND (@state IS NULL OR state = @state)
      AND (@isActive IS NULL OR is_active = @isActive)
      AND (@rdi IS NULL OR rdi = @rdi)
      AND (@cmra IS NULL OR cmra = @cmra)
      AND (
        @query IS NULL OR
        location_name LIKE @queryLike OR
        full_address LIKE @queryLike OR
        city LIKE @queryLike
      )
  `;

  const stmt = db.prepare(`
    ${listLocationsForSmartyStmtBase}
    ${whereSql}
    ORDER BY id ASC
  `);

  return stmt.all(params);
}

export function updateLocationSmartyEnrichment(id, result) {
  updateLocationSmartyStmt.run(
    result.rdi ?? null,
    result.cmra ?? null,
    result.smartyScannedAt ?? nowIso(),
    result.smartyError ?? null,
    nowIso(),
    id
  );
}

export function patchLocation(id, patch) {
  const existing = getLocationById(id);
  if (!existing) {
    return null;
  }

  const next = {
    location_name: pickPatchValue(patch, "locationName", existing.location_name ?? null),
    full_address: pickPatchValue(patch, "fullAddress", existing.full_address ?? null),
    street: pickPatchValue(patch, "street", existing.street ?? null),
    street2: pickPatchValue(patch, "street2", existing.street2 ?? null),
    city: pickPatchValue(patch, "city", existing.city ?? null),
    state: pickPatchValue(patch, "state", existing.state ?? null),
    postal_code: pickPatchValue(patch, "postalCode", existing.postal_code ?? null),
    monthly_price: pickPatchValue(patch, "monthlyPrice", existing.monthly_price ?? null),
    detail_url: pickPatchValue(patch, "detailUrl", existing.detail_url ?? null),
    first_plan_url: pickPatchValue(patch, "firstPlanUrl", existing.first_plan_url ?? null),
    first_plan_term: pickPatchValue(patch, "firstPlanTerm", existing.first_plan_term ?? null),
    first_plan_srvpl_id: pickPatchValue(
      patch,
      "firstPlanSrvplId",
      existing.first_plan_srvpl_id ?? null
    ),
    personalize_min: pickPatchValue(patch, "personalizeMin", existing.personalize_min ?? null),
    personalize_max: pickPatchValue(patch, "personalizeMax", existing.personalize_max ?? null),
    rdi: pickPatchValue(patch, "rdi", existing.rdi ?? null),
    cmra: pickPatchValue(patch, "cmra", existing.cmra ?? null),
    is_active:
      patch.isActive === undefined ? Number(existing.isActive) : Number(Boolean(patch.isActive))
  };

  const stmt = db.prepare(`
    UPDATE locations SET
      location_name = ?,
      full_address = ?,
      street = ?,
      street2 = ?,
      city = ?,
      state = ?,
      postal_code = ?,
      monthly_price = ?,
      detail_url = ?,
      first_plan_url = ?,
      first_plan_term = ?,
      first_plan_srvpl_id = ?,
      personalize_min = ?,
      personalize_max = ?,
      rdi = ?,
      cmra = ?,
      is_active = ?,
      updated_at = ?
    WHERE id = ?
  `);

  stmt.run(
    next.location_name,
    next.full_address,
    next.street,
    next.street2,
    next.city,
    next.state,
    next.postal_code,
    next.monthly_price,
    next.detail_url,
    next.first_plan_url,
    next.first_plan_term,
    next.first_plan_srvpl_id,
    next.personalize_min,
    next.personalize_max,
    next.rdi,
    next.cmra,
    next.is_active,
    nowIso(),
    id
  );

  return getLocationById(id);
}

export function listResidentialLocations() {
  return listResidentialLocationsStmt.all().map(deserializeLocationRow);
}

export function listApiKeys() {
  return listApiKeysStmt.all().map(deserializeApiKeyRow);
}

export function getApiKeyById(id) {
  const row = getApiKeyByIdStmt.get(id);
  return row ? deserializeApiKeyRow(row) : null;
}

export function createApiKey(name) {
  const now = nowIso();
  const rawKey = `atmb_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  const result = insertApiKeyStmt.run(name, keyHash, keyPrefix, "active", null, now, now);
  const record = getApiKeyById(Number(result.lastInsertRowid));

  return {
    ...record,
    key: rawKey
  };
}

export function deleteApiKey(id) {
  const existing = getApiKeyById(id);
  if (!existing) {
    return false;
  }

  deleteApiKeyStmt.run(id);
  return true;
}

export function authenticateApiKey(rawKey) {
  const normalized = rawKey?.trim();
  if (!normalized) {
    return null;
  }

  const row = getApiKeyByHashStmt.get(hashApiKey(normalized));
  if (!row || row.status !== "active") {
    return null;
  }

  const now = nowIso();
  markApiKeyUsedStmt.run(now, now, row.id);
  return deserializeApiKeyRow({
    ...row,
    last_used_at: now,
    updated_at: now
  });
}

export function listSmartyTokens() {
  return listSmartyTokensStmt.all().map(deserializeSmartyTokenRow);
}

export function getSmartyTokenById(id) {
  const row = getSmartyTokenByIdStmt.get(id);
  return row ? deserializeSmartyTokenRow(row) : null;
}

export function getSmartyTokenSecretById(id) {
  const row = getSmartyTokenSecretByIdStmt.get(id);
  return row
    ? {
        id: row.id,
        name: row.name,
        authId: row.auth_id,
        authToken: row.auth_token,
        quotaLimit: Number(row.quota_limit ?? 0),
        quotaUsed: Number(row.quota_used ?? 0),
        status: row.status,
        priority: row.priority,
        lastUsedAt: row.last_used_at ?? null,
        lastError: row.last_error ?? null
      }
    : null;
}

export function createSmartyToken(input) {
  const now = nowIso();
  const result = insertSmartyTokenStmt.run(
    input.name,
    input.authId,
    input.authToken,
    input.quotaLimit,
    0,
    input.status ?? "active",
    input.priority ?? 100,
    null,
    null,
    now,
    now
  );

  return getSmartyTokenById(Number(result.lastInsertRowid));
}

export function updateSmartyToken(id, patch) {
  const existing = getSmartyTokenByIdStmt.get(id);
  if (!existing) {
    return null;
  }

  updateSmartyTokenStmt.run(
    patch.name ?? existing.name,
    patch.authId ?? existing.auth_id,
    patch.authToken ?? existing.auth_token,
    patch.quotaLimit ?? existing.quota_limit,
    patch.status ?? existing.status,
    patch.priority ?? existing.priority,
    nowIso(),
    id
  );

  return getSmartyTokenById(id);
}

export function resetSmartyTokenUsage(id) {
  const existing = getSmartyTokenByIdStmt.get(id);
  if (!existing) {
    return null;
  }

  resetSmartyTokenUsageStmt.run(nowIso(), id);
  return getSmartyTokenById(id);
}

export function listAvailableSmartyTokens() {
  return listAvailableSmartyTokensStmt.all().map((row) => ({
    id: row.id,
    name: row.name,
    authId: row.auth_id,
    authToken: row.auth_token,
    quotaLimit: Number(row.quota_limit ?? 0),
    quotaUsed: Number(row.quota_used ?? 0),
    status: row.status,
    priority: row.priority,
    lastUsedAt: row.last_used_at ?? null,
    lastError: row.last_error ?? null
  }));
}

export function applySmartyTokenUsage(id, usedIncrement, lastError = null) {
  const token = getSmartyTokenSecretById(id);
  if (!token) {
    return null;
  }

  const nextUsed = token.quotaUsed + usedIncrement;
  const nextStatus = nextUsed >= token.quotaLimit ? "exhausted" : token.status;
  const now = nowIso();

  updateSmartyTokenUsageStmt.run(
    nextUsed,
    nextStatus,
    now,
    lastError,
    now,
    id
  );

  return getSmartyTokenById(id);
}

export function markSmartyTokenError(id, errorMessage, status = "error") {
  markSmartyTokenErrorStmt.run(status, errorMessage, nowIso(), id);
  return getSmartyTokenById(id);
}

export function getUserCount() {
  return Number(countUsersStmt.get()?.count ?? 0);
}

export function createUser(input) {
  const now = nowIso();
  const result = insertUserStmt.run(
    input.username,
    input.passwordHash,
    input.role ?? "admin",
    input.status ?? "active",
    input.mustChangePassword ? 1 : 0,
    null,
    now,
    now
  );

  return getUserById(Number(result.lastInsertRowid));
}

export function getUserByUsername(username) {
  const row = getUserByUsernameStmt.get(username);
  return row ? deserializeUserRow(row) : null;
}

export function getUserById(id) {
  const row = getUserByIdStmt.get(id);
  return row ? deserializeUserRow(row) : null;
}

export function updateUserPassword(id, passwordHash, mustChangePassword = false) {
  updateUserPasswordStmt.run(passwordHash, mustChangePassword ? 1 : 0, nowIso(), id);
  return getUserById(id);
}

export function markUserLoggedIn(id) {
  const now = nowIso();
  updateUserLoginStmt.run(now, now, id);
  return getUserById(id);
}

export function createSession(userId, tokenHash, expiresAt) {
  insertSessionStmt.run(userId, tokenHash, expiresAt, nowIso());
}

export function getSessionByTokenHash(tokenHash) {
  const row = getSessionByTokenHashStmt.get(tokenHash);
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username,
      role: row.role,
      status: row.status,
      mustChangePassword: Boolean(row.must_change_password)
    }
  };
}

export function deleteSessionByTokenHash(tokenHash) {
  deleteSessionByTokenHashStmt.run(tokenHash);
}

export function deleteExpiredSessions() {
  deleteExpiredSessionsStmt.run(nowIso());
}

export function getSetting(key) {
  const row = getSettingStmt.get(key);
  if (!row) {
    return null;
  }

  return {
    key: row.key,
    value: row.value ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function getSiteSettings() {
  const headCodeSetting = getSetting("head_code");

  return {
    headCode: headCodeSetting?.value ?? "",
    updatedAt: headCodeSetting?.updatedAt ?? null
  };
}

export function updateSiteSettings(input) {
  const now = nowIso();
  const existing = getSetting("head_code");

  upsertSettingStmt.run(
    "head_code",
    input.headCode ?? "",
    existing?.createdAt ?? now,
    now
  );

  return getSiteSettings();
}

function deserializeLocationRow(row) {
  return {
    ...row,
    isActive: Boolean(row.is_active),
    services: row.services_json ? JSON.parse(row.services_json) : [],
    raw: row.raw_json ? JSON.parse(row.raw_json) : null
  };
}

function deserializeSmartyTokenRow(row) {
  const quotaLimit = Number(row.quota_limit ?? 0);
  const quotaUsed = Number(row.quota_used ?? 0);

  return {
    id: row.id,
    name: row.name,
    authId: row.auth_id,
    quotaLimit,
    quotaUsed,
    quotaRemaining: Math.max(0, quotaLimit - quotaUsed),
    status: row.status,
    priority: row.priority,
    lastUsedAt: row.last_used_at ?? null,
    lastError: row.last_error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function deserializeUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function deserializeApiKeyRow(row) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    status: row.status,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function hashApiKey(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function pickPatchValue(patch, key, fallback) {
  return Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : fallback;
}

function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}
