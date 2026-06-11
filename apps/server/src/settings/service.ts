import axios from 'axios';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type { DatabaseContext } from '@atmb/db';
import type {
  AdminSystemSettings,
  HeadCodeCheckResponse,
  SmartyConnectionStatus,
  UpdateFrequencyDays,
  UpdateMinute,
} from '@atmb/shared';

import type { ServerConfig } from '../auth/config.js';

export interface SmartyClient {
  testConnection(credentials: { authId: string; authToken: string }): Promise<{
    ok: boolean;
    message?: string;
  }>;
}

export interface SaveSmartySettingsInput {
  authId?: string;
  authToken?: string;
  remainingCredits?: number | null;
  monthlyUsed?: number | null;
}

export interface SaveUpdateScheduleInput {
  autoUpdateEnabled: boolean;
  updateFrequencyDays: UpdateFrequencyDays | null;
  updateHour: number;
  updateMinute: UpdateMinute;
}

interface SystemSettingsRow {
  id: number;
  smartyAuthId: string;
  smartyAuthTokenEncrypted: string | null;
  smartyConnectionStatus: SmartyConnectionStatus;
  smartyConnectionMessage: string | null;
  smartyLastTestedAt: string | null;
  smartyRemainingCredits: number | null;
  smartyMonthlyUsed: number | null;
  smartyCreditsUpdatedAt: string | null;
  autoUpdateEnabled: number;
  updateFrequencyDays: UpdateFrequencyDays | null;
  updateHour: number;
  updateMinute: UpdateMinute;
  headCode: string;
  updatedAt: string;
}

const SETTINGS_ID = 1;

export class HttpSmartyClient implements SmartyClient {
  async testConnection(credentials: { authId: string; authToken: string }) {
    const response = await axios.get('https://us-street.api.smarty.com/street-address', {
      params: {
        'auth-id': credentials.authId,
        'auth-token': credentials.authToken,
        street: '1600 Amphitheatre Pkwy',
        city: 'Mountain View',
        state: 'CA',
        candidates: 1,
      },
      timeout: 10000,
      validateStatus: () => true,
    });

    return response.status >= 200 && response.status < 300
      ? { ok: true }
      : { ok: false, message: `Smarty 返回 ${response.status}` };
  }
}

export class SettingsService {
  constructor(
    private readonly database: DatabaseContext,
    private readonly config: ServerConfig,
    private readonly smartyClient: SmartyClient = new HttpSmartyClient(),
  ) {}

  ensureDefaultSettings() {
    this.database.sqlite
      .prepare(`
        INSERT OR IGNORE INTO system_settings (
          id, smarty_auth_id, smarty_connection_status, auto_update_enabled,
          update_frequency_days, update_hour, update_minute, head_code, created_at, updated_at
        ) VALUES (1, '', 'not_configured', 1, 1, 8, 30, '', ?, ?)
      `)
      .run(new Date().toISOString(), new Date().toISOString());
  }

  getSettings(): AdminSystemSettings {
    return toSafeSettings(this.getRow());
  }

  getSmartyCredentials() {
    const current = this.getRow();

    if (!current.smartyAuthId || !current.smartyAuthTokenEncrypted) {
      return null;
    }

    return {
      authId: current.smartyAuthId,
      authToken: decryptSecret(current.smartyAuthTokenEncrypted, this.config.sessionSecret),
    };
  }

  getUpdateSchedule() {
    const current = this.getRow();

    return {
      autoUpdateEnabled: Boolean(current.autoUpdateEnabled),
      updateFrequencyDays: current.updateFrequencyDays,
      updateHour: current.updateHour,
      updateMinute: current.updateMinute,
    };
  }

  saveSmartySettings(input: SaveSmartySettingsInput) {
    const current = this.getRow();
    const now = new Date().toISOString();
    const nextAuthId = input.authId === undefined ? current.smartyAuthId : input.authId.trim();
    const nextEncryptedToken = input.authToken
      ? encryptSecret(input.authToken, this.config.sessionSecret)
      : current.smartyAuthTokenEncrypted;
    const creditsTouched = input.remainingCredits !== undefined || input.monthlyUsed !== undefined;
    const nextStatus = nextAuthId && nextEncryptedToken
      ? current.smartyConnectionStatus
      : 'not_configured';

    this.database.sqlite
      .prepare(`
        UPDATE system_settings
        SET
          smarty_auth_id = @authId,
          smarty_auth_token_encrypted = @token,
          smarty_connection_status = @status,
          smarty_remaining_credits = @remainingCredits,
          smarty_monthly_used = @monthlyUsed,
          smarty_credits_updated_at = @creditsUpdatedAt,
          updated_at = @updatedAt
        WHERE id = 1
      `)
      .run({
        authId: nextAuthId,
        token: nextEncryptedToken,
        status: nextStatus,
        remainingCredits: input.remainingCredits === undefined ? current.smartyRemainingCredits : input.remainingCredits,
        monthlyUsed: input.monthlyUsed === undefined ? current.smartyMonthlyUsed : input.monthlyUsed,
        creditsUpdatedAt: creditsTouched ? now : current.smartyCreditsUpdatedAt,
        updatedAt: now,
      });

    return this.getSettings();
  }

  async testSmartyConnection() {
    const current = this.getRow();

    if (!current.smartyAuthId || !current.smartyAuthTokenEncrypted) {
      throw new Error('SMARTY_NOT_CONFIGURED');
    }

    const authToken = decryptSecret(current.smartyAuthTokenEncrypted, this.config.sessionSecret);
    const result = await this.smartyClient.testConnection({
      authId: current.smartyAuthId,
      authToken,
    });
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare(`
        UPDATE system_settings
        SET
          smarty_connection_status = ?,
          smarty_connection_message = ?,
          smarty_last_tested_at = ?,
          updated_at = ?
        WHERE id = 1
      `)
      .run(result.ok ? 'connected' : 'failed', result.message ?? null, now, now);

    return this.getSettings();
  }

  saveUpdateSchedule(input: SaveUpdateScheduleInput) {
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare(`
        UPDATE system_settings
        SET
          auto_update_enabled = @enabled,
          update_frequency_days = @frequency,
          update_hour = @hour,
          update_minute = @minute,
          updated_at = @updatedAt
        WHERE id = 1
      `)
      .run({
        enabled: input.autoUpdateEnabled ? 1 : 0,
        frequency: input.autoUpdateEnabled ? input.updateFrequencyDays : null,
        hour: input.updateHour,
        minute: input.updateMinute,
        updatedAt: now,
      });

    return this.getSettings();
  }

  saveHeadCode(headCode: string) {
    this.database.sqlite
      .prepare('UPDATE system_settings SET head_code = ?, updated_at = ? WHERE id = 1')
      .run(headCode, new Date().toISOString());

    return this.getSettings();
  }

  checkHeadCode(headCode: string): HeadCodeCheckResponse {
    const warnings: string[] = [];

    if (/<script\b[^>]*>/i.test(headCode) && !/<\/script>/i.test(headCode)) {
      warnings.push('存在未闭合的 script 标签');
    }
    if (/<style\b[^>]*>/i.test(headCode) && !/<\/style>/i.test(headCode)) {
      warnings.push('存在未闭合的 style 标签');
    }

    return {
      lineCount: headCode.length ? headCode.split(/\r\n|\r|\n/).length : 0,
      characterCount: headCode.length,
      warnings,
    };
  }

  private getRow(): SystemSettingsRow {
    this.ensureDefaultSettings();

    return this.database.sqlite
      .prepare(`
        SELECT
          id,
          smarty_auth_id AS smartyAuthId,
          smarty_auth_token_encrypted AS smartyAuthTokenEncrypted,
          smarty_connection_status AS smartyConnectionStatus,
          smarty_connection_message AS smartyConnectionMessage,
          smarty_last_tested_at AS smartyLastTestedAt,
          smarty_remaining_credits AS smartyRemainingCredits,
          smarty_monthly_used AS smartyMonthlyUsed,
          smarty_credits_updated_at AS smartyCreditsUpdatedAt,
          auto_update_enabled AS autoUpdateEnabled,
          update_frequency_days AS updateFrequencyDays,
          update_hour AS updateHour,
          update_minute AS updateMinute,
          head_code AS headCode,
          updated_at AS updatedAt
        FROM system_settings
        WHERE id = 1
      `)
      .get() as SystemSettingsRow;
  }
}

function toSafeSettings(row: SystemSettingsRow): AdminSystemSettings {
  const autoUpdateEnabled = Boolean(row.autoUpdateEnabled);

  return {
    smartyAuthId: row.smartyAuthId,
    hasSmartyAuthToken: Boolean(row.smartyAuthTokenEncrypted),
    smartyConnectionStatus: row.smartyConnectionStatus,
    smartyConnectionMessage: row.smartyConnectionMessage,
    smartyLastTestedAt: row.smartyLastTestedAt,
    smartyRemainingCredits: row.smartyRemainingCredits,
    smartyMonthlyUsed: row.smartyMonthlyUsed,
    smartyCreditsUpdatedAt: row.smartyCreditsUpdatedAt,
    autoUpdateEnabled,
    updateFrequencyDays: row.updateFrequencyDays,
    updateHour: row.updateHour,
    updateMinute: row.updateMinute,
    nextRunAt: nextRunAt(autoUpdateEnabled, row.updateFrequencyDays, row.updateHour, row.updateMinute),
    headCode: row.headCode,
    updatedAt: row.updatedAt,
  };
}

function nextRunAt(
  enabled: boolean,
  frequencyDays: UpdateFrequencyDays | null,
  hour: number,
  minute: number,
) {
  if (!enabled || !frequencyDays) {
    return null;
  }

  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + frequencyDays);
  }

  return next.toISOString();
}

function encryptionKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

function encryptSecret(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

function decryptSecret(value: string, secret: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(':');

  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('INVALID_ENCRYPTED_SECRET');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(secret),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
