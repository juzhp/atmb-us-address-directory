import Database from 'better-sqlite3';

interface PublicHeadCodeRow {
  headCode: string | null;
}

export async function getPublicHeadCode() {
  const databaseUrl = resolvePublicSettingsDatabaseUrl();

  if (!databaseUrl) {
    return '';
  }

  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(databaseUrl, {
      fileMustExist: true,
      readonly: true,
    });

    const row = sqlite
      .prepare('SELECT head_code AS headCode FROM system_settings WHERE id = 1')
      .get() as PublicHeadCodeRow | undefined;

    return normalizePublicHeadCode(row?.headCode ?? '');
  } catch (error) {
    if (isUnavailableDatabaseError(error)) {
      return '';
    }

    throw error;
  } finally {
    sqlite?.close();
  }
}

export function normalizePublicHeadCode(headCode: string) {
  return headCode.trim();
}

export function resolvePublicSettingsDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return '../server/data/atmb.sqlite';
}

function isUnavailableDatabaseError(error: unknown) {
  return error instanceof Error && /(no such table|unable to open database file)/i.test(error.message);
}
