const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const rootDir = __dirname;
const databaseUrl = process.env.DATABASE_URL || path.join(rootDir, 'data', 'atmb.sqlite');
const publicOrigin = process.env.WEB_ORIGIN || 'https://example.com';
const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
const uploadDir = process.env.ADDRESS_IMAGE_UPLOAD_DIR
  || path.join(rootDir, 'apps', 'web', 'public', 'uploads', 'address-images');

module.exports = {
  apps: [
    {
      name: 'atmbNew-server',
      cwd: rootDir,
      script: 'apps/server/dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      env: {
        ATMB_SERVER_ENTRY: '1',
        NODE_ENV: 'production',
        HOST: process.env.HOST || '127.0.0.1',
        PORT: process.env.PORT || '3001',
        DATABASE_URL: databaseUrl,
        SESSION_SECRET: process.env.SESSION_SECRET,
        ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
        ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME || '管理员',
        WEB_ORIGIN: publicOrigin,
        ADDRESS_IMAGE_UPLOAD_DIR: uploadDir,
        ADDRESS_IMAGE_PUBLIC_BASE: process.env.ADDRESS_IMAGE_PUBLIC_BASE || '/uploads/address-images',
      },
    },
    {
      name: 'atmbNew-web',
      cwd: rootDir,
      script: 'npm',
      args: 'run start:web',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.WEB_PORT || '3000',
        HOSTNAME: process.env.WEB_HOST || '127.0.0.1',
        DATABASE_URL: databaseUrl,
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || publicOrigin,
        API_BASE_URL: apiBaseUrl,
      },
    },
  ],
};
