import type { Session } from 'fastify';
import type { Database } from 'better-sqlite3';

const DEFAULT_SESSION_MAX_AGE = 12 * 60 * 60 * 1000;

export class SqliteSessionStore {
  constructor(private readonly sqlite: Database) {}

  set(sessionId: string, session: Session, callback: (err?: unknown) => void) {
    try {
      const now = Date.now();
      const expiresAt = session.cookie.expires?.getTime() ?? now + DEFAULT_SESSION_MAX_AGE;

      this.sqlite
        .prepare(
          `
            INSERT INTO admin_sessions (sid, data, expires_at, updated_at)
            VALUES (@sid, @data, @expiresAt, CURRENT_TIMESTAMP)
            ON CONFLICT(sid) DO UPDATE SET
              data = excluded.data,
              expires_at = excluded.expires_at,
              updated_at = CURRENT_TIMESTAMP
          `,
        )
        .run({
          sid: sessionId,
          data: JSON.stringify(session),
          expiresAt,
        });

      callback();
    } catch (error) {
      callback(error);
    }
  }

  get(sessionId: string, callback: (err: unknown, result?: Session | null) => void) {
    try {
      const row = this.sqlite
        .prepare('SELECT data, expires_at AS expiresAt FROM admin_sessions WHERE sid = ?')
        .get(sessionId) as { data: string; expiresAt: number } | undefined;

      if (!row) {
        callback(null, null);
        return;
      }

      if (row.expiresAt <= Date.now()) {
        this.destroy(sessionId, () => undefined);
        callback(null, null);
        return;
      }

      callback(null, JSON.parse(row.data) as Session);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sessionId: string, callback: (err?: unknown) => void) {
    try {
      this.sqlite.prepare('DELETE FROM admin_sessions WHERE sid = ?').run(sessionId);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}
