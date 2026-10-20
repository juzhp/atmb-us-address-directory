#!/usr/bin/env node
// 修复「表由 ensureDatabaseSchema 建出来、但从未跑过 drizzle 迁移」的数据库：
// 1. 补齐 ensureDatabaseSchema 不会 ALTER 的列（0007、0008）
// 2. 建齐缺失的表 / 索引
// 3. 把 drizzle/meta/_journal.json 里的迁移登记到 __drizzle_migrations，之后 npm run db:migrate 可正常使用
// 幂等，可重复执行。用法：DATABASE_URL=/path/to/atmb.sqlite node packages/db/scripts/repair-migrations.cjs
const Database = require('better-sqlite3');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const dbPackageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(dbPackageRoot, '../..');
const databaseUrl = process.env.DATABASE_URL || path.join(repoRoot, 'apps/server/data/atmb.sqlite');
const migrationsDir = path.join(dbPackageRoot, 'drizzle');

const { ensureDatabaseSchema } = require(path.join(dbPackageRoot, 'dist/index.js'));
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');

// 历史迁移里通过 ALTER TABLE 增加的列；表已存在时 ensureDatabaseSchema 不会补这些列
const addedColumns = [
  {
    table: 'addresses',
    column: 'usps_cmra',
    sql: "ALTER TABLE `addresses` ADD COLUMN `usps_cmra` text CONSTRAINT `addresses_usps_cmra_check` CHECK (`usps_cmra` IS NULL OR `usps_cmra` IN ('Y', 'N'))",
  },
  { table: 'addresses', column: 'usps_cmra_updated_at', sql: 'ALTER TABLE `addresses` ADD COLUMN `usps_cmra_updated_at` text' },
  {
    table: 'addresses',
    column: 'c1_precheck',
    sql: "ALTER TABLE `addresses` ADD COLUMN `c1_precheck` text CONSTRAINT `addresses_c1_precheck_check` CHECK (`c1_precheck` IS NULL OR `c1_precheck` IN ('pass', 'fail'))",
  },
  { table: 'addresses', column: 'c1_precheck_updated_at', sql: 'ALTER TABLE `addresses` ADD COLUMN `c1_precheck_updated_at` text' },
  { table: 'crawl_tasks', column: 'platform', sql: "ALTER TABLE `crawl_tasks` ADD COLUMN `platform` text DEFAULT 'anytimemailbox' NOT NULL" },
];

function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function main() {
  if (!fs.existsSync(databaseUrl)) {
    console.error(`数据库文件不存在: ${databaseUrl}（请通过 DATABASE_URL 指定线上库路径）`);
    process.exit(1);
  }

  const db = new Database(databaseUrl);
  console.log(`数据库: ${databaseUrl}`);

  const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));
  const hadJournalTable = tableExists(db, '__drizzle_migrations');
  const appliedBefore = hadJournalTable
    ? db.prepare('SELECT created_at AS createdAt FROM __drizzle_migrations ORDER BY created_at').all().map((row) => Number(row.createdAt))
    : [];
  console.log(`已登记迁移: ${appliedBefore.length} / ${journal.entries.length}${hadJournalTable ? '' : '（没有 __drizzle_migrations 表）'}`);

  db.transaction(() => {
    for (const item of addedColumns) {
      if (!tableExists(db, item.table)) {
        continue; // 表都没有时交给下面的 ensureDatabaseSchema 整表创建
      }
      if (columnExists(db, item.table, item.column)) {
        continue;
      }
      db.exec(item.sql);
      console.log(`补列: ${item.table}.${item.column}`);
    }
  })();

  // 建齐缺失的表和索引（全部 IF NOT EXISTS）
  ensureDatabaseSchema(db);

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      )
    `);
    const insert = db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)');

    for (const entry of journal.entries) {
      if (appliedBefore.includes(entry.when)) {
        continue;
      }
      const sqlFile = path.join(migrationsDir, `${entry.tag}.sql`);
      const hash = createHash('sha256').update(fs.readFileSync(sqlFile, 'utf8')).digest('hex');
      insert.run(hash, entry.when);
      console.log(`登记迁移: ${entry.tag}`);
    }
  })();

  // 用 drizzle 自己的迁移器再跑一遍：此时应当没有待应用的迁移，否则会在这里报出真实错误
  migrate(drizzle(db), { migrationsFolder: migrationsDir });

  const missing = addedColumns.filter((item) => !columnExists(db, item.table, item.column));
  const appliedAfter = db.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations').get().count;
  db.close();

  if (missing.length > 0) {
    console.error(`仍缺少列: ${missing.map((item) => `${item.table}.${item.column}`).join(', ')}`);
    process.exit(1);
  }

  console.log(`完成：列已齐全，已登记迁移 ${appliedAfter} 条。之后可正常使用 npm run db:migrate。`);
}

main();
