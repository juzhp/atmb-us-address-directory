import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(webDir, '../..');

loadEnv({ path: path.join(rootDir, '.env') });

const apiBaseUrl = (process.env.API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${apiBaseUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
