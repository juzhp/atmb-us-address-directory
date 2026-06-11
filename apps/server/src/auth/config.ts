import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  adminUsername: string;
  adminPassword: string;
  adminDisplayName: string;
  databaseUrl: string;
  nodeEnv: string;
  sessionSecret: string;
  webOrigin: string;
  addressImageUploadDir: string;
  addressImagePublicBase: string;
  seedDemoData: boolean;
}

const DEV_ADMIN_PASSWORD = 'admin123456';
const DEV_SESSION_SECRET = 'development-session-secret-atmb-admin-32-characters';
const defaultDatabaseUrl = fileURLToPath(new URL('../../data/atmb.sqlite', import.meta.url));

export function resolveServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const adminPassword = env.ADMIN_PASSWORD ?? (isProduction ? undefined : DEV_ADMIN_PASSWORD);
  const sessionSecret = env.SESSION_SECRET ?? (isProduction ? undefined : DEV_SESSION_SECRET);

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is required in production.');
  }

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is required in production.');
  }

  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters.');
  }

  return {
    adminUsername: env.ADMIN_USERNAME ?? 'admin',
    adminPassword,
    adminDisplayName: env.ADMIN_DISPLAY_NAME ?? '管理员',
    databaseUrl: env.DATABASE_URL ?? defaultDatabaseUrl,
    nodeEnv,
    sessionSecret,
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:3000',
    addressImageUploadDir: env.ADDRESS_IMAGE_UPLOAD_DIR ?? fileURLToPath(
      new URL('../../../web/public/uploads/address-images', import.meta.url),
    ),
    addressImagePublicBase: env.ADDRESS_IMAGE_PUBLIC_BASE ?? '/uploads/address-images',
    seedDemoData: nodeEnv === 'test' || env.SEED_DEMO_DATA === 'true',
  };
}
