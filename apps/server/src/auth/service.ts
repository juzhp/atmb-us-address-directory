import type { AdminUserProfile } from '@atmb/shared';
import { adminUsers, type DatabaseContext } from '@atmb/db';
import { eq } from 'drizzle-orm';

import type { ServerConfig } from './config.js';
import { hashPassword, verifyPassword } from './password.js';

type AdminUserRow = typeof adminUsers.$inferSelect;

export class AuthService {
  constructor(
    private readonly database: DatabaseContext,
    private readonly config: ServerConfig,
  ) {}

  ensureDefaultAdmin() {
    const row = this.database.sqlite
      .prepare('SELECT COUNT(*) AS count FROM admin_users')
      .get() as { count: number };

    if (row.count > 0) {
      return;
    }

    const now = new Date().toISOString();

    this.database.db.insert(adminUsers).values({
      username: this.config.adminUsername,
      displayName: this.config.adminDisplayName,
      passwordHash: hashPassword(this.config.adminPassword),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  authenticate(username: string, password: string): AdminUserProfile | null {
    const user = this.findUserByUsername(username.trim());

    if (!user || user.status !== 'active' || !verifyPassword(password, user.passwordHash)) {
      return null;
    }

    this.touchLastLogin(user.id);
    return this.toProfile(user);
  }

  changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = this.findUserById(userId);

    if (!user || user.status !== 'active' || !verifyPassword(currentPassword, user.passwordHash)) {
      return false;
    }

    const now = new Date().toISOString();

    this.database.db
      .update(adminUsers)
      .set({
        passwordHash: hashPassword(newPassword),
        updatedAt: now,
      })
      .where(eq(adminUsers.id, userId))
      .run();

    return true;
  }

  findActiveUserProfile(id: number): AdminUserProfile | null {
    const [user] = this.database.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1)
      .all();

    if (!user || user.status !== 'active') {
      return null;
    }

    return this.toProfile(user);
  }

  private findUserByUsername(username: string): AdminUserRow | undefined {
    const [user] = this.database.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username))
      .limit(1)
      .all();

    return user;
  }

  private findUserById(id: number): AdminUserRow | undefined {
    const [user] = this.database.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1)
      .all();

    return user;
  }

  private touchLastLogin(id: number) {
    const now = new Date().toISOString();

    this.database.db
      .update(adminUsers)
      .set({
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(adminUsers.id, id))
      .run();
  }

  private toProfile(user: AdminUserRow): AdminUserProfile {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };
  }
}
