import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createDatabase } from '@atmb/db';

import { optimizeAddressImage } from '../addresses/service.js';

interface CliOptions {
  apply: boolean;
  databaseUrl: string;
  uploadDir: string;
  max: number | null;
}

interface ImageRow {
  id: number;
  fileName: string;
  publicUrl: string;
}

const defaultDatabaseUrl = fileURLToPath(new URL('../../data/atmb.sqlite', import.meta.url));
const defaultUploadDir = fileURLToPath(
  new URL('../../../web/public/uploads/address-images', import.meta.url),
);

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const options = parseCliOptions();

  if (!existsSync(options.databaseUrl)) {
    throw new Error(`Database file does not exist: ${options.databaseUrl}`);
  }

  const database = createDatabase({ url: options.databaseUrl });

  try {
    const rows = loadLegacyImageRows(database.sqlite, options.max);
    const summary = { scanned: rows.length, converted: 0, missing: 0, failed: 0 };
    let savedBytes = 0;

    console.log(`[webp] mode=${options.apply ? 'apply' : 'dry-run'} database=${options.databaseUrl}`);
    console.log(`[webp] uploadDir=${options.uploadDir}`);
    console.log(`[webp] images to convert=${rows.length}`);

    for (const row of rows) {
      const sourcePath = join(options.uploadDir, row.fileName);

      if (!existsSync(sourcePath)) {
        summary.missing += 1;
        console.warn(`[skip] id=${row.id} file not found: ${row.fileName}`);
        continue;
      }

      try {
        const source = readFileSync(sourcePath);
        const optimized = await optimizeAddressImage(source);
        const fileName = `${basename(row.fileName, extname(row.fileName))}.webp`;
        const publicUrl = row.publicUrl.slice(0, row.publicUrl.length - row.fileName.length) + fileName;

        savedBytes += source.length - optimized.length;
        summary.converted += 1;
        console.log(
          `[${options.apply ? 'convert' : 'plan'}] id=${row.id} ${row.fileName} ${formatSize(source.length)} -> ${fileName} ${formatSize(optimized.length)}`,
        );

        if (!options.apply) {
          continue;
        }

        writeFileSync(join(options.uploadDir, fileName), optimized);
        database.sqlite
          .prepare(`
            UPDATE address_images
            SET file_name = ?, public_url = ?, mime_type = 'image/webp', size_bytes = ?, updated_at = ?
            WHERE id = ?
          `)
          .run(fileName, publicUrl, optimized.length, new Date().toISOString(), row.id);
        rmSync(sourcePath, { force: true });
      } catch (error) {
        summary.failed += 1;
        console.error(`[fail] id=${row.id} ${row.fileName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(
      `[webp] scanned=${summary.scanned} converted=${summary.converted} missing=${summary.missing} failed=${summary.failed} saved=${formatSize(savedBytes)}`,
    );

    if (!options.apply && summary.converted > 0) {
      console.log('[webp] dry-run only. Re-run with --apply to write files and update the database.');
    }
  } finally {
    database.sqlite.close();
  }
}

function loadLegacyImageRows(sqlite: ReturnType<typeof createDatabase>['sqlite'], max: number | null) {
  const rows = sqlite
    .prepare(`
      SELECT id, file_name AS fileName, public_url AS publicUrl
      FROM address_images
      WHERE file_name NOT LIKE '%.webp'
      ORDER BY id
    `)
    .all() as ImageRow[];

  return max === null ? rows : rows.slice(0, max);
}

function parseCliOptions(): CliOptions {
  const args = new Map<string, string | true>();

  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [key, rawValue] = arg.slice(2).split('=', 2);
    if (!key) continue;
    args.set(key, rawValue ?? true);
  }

  return {
    apply: args.has('apply'),
    databaseUrl: resolve(stringOption(args.get('database')) ?? process.env.DATABASE_URL ?? defaultDatabaseUrl),
    uploadDir: resolve(
      stringOption(args.get('upload-dir')) ?? process.env.ADDRESS_IMAGE_UPLOAD_DIR ?? defaultUploadDir,
    ),
    max: numberOption(args.get('max'), null),
  };
}

function printHelp() {
  console.log(`
Convert already uploaded street view images to WebP.

New uploads are converted on the fly, so this is a one-off backfill for images
that were stored before that change. Each converted row gets a new .webp file,
an updated public_url / mime_type / size_bytes, and the original file removed.

Default mode is dry-run. Use --apply to write changes.

Usage:
  npm run images:webp
  npm run images:webp -- --apply

Options:
  --apply                  Write .webp files and update the database. Omit for dry-run.
  --database=PATH          SQLite path. Defaults to DATABASE_URL or apps/server/data/atmb.sqlite.
  --upload-dir=PATH        Image directory. Defaults to ADDRESS_IMAGE_UPLOAD_DIR.
  --max=N                  Process at most N images.
`);
}

function formatSize(bytes: number) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function stringOption(value: string | true | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberOption(value: string | true | undefined, fallback: number | null) {
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  main().catch((error) => {
    console.error(`[fatal] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
