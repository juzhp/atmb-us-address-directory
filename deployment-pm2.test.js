const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('pm2 ecosystem defines one web process and one server process', () => {
  const ecosystem = require('./ecosystem.config.cjs');

  assert.equal(Array.isArray(ecosystem.apps), true);
  assert.equal(ecosystem.apps.length, 2);

  const server = ecosystem.apps.find((app) => app.name === 'atmb-server');
  const web = ecosystem.apps.find((app) => app.name === 'atmb-web');

  assert.ok(server);
  assert.ok(web);
  assert.equal(server.script, 'apps/server/dist/server.js');
  assert.equal(server.exec_mode, 'fork');
  assert.equal(server.instances, 1);
  assert.equal(server.env.NODE_ENV, 'production');
  assert.equal(server.env.HOST, '127.0.0.1');
  assert.equal(server.env.PORT, '3001');

  assert.equal(web.script, 'npm');
  assert.equal(web.args, 'run start:web');
  assert.equal(web.exec_mode, 'fork');
  assert.equal(web.instances, 1);
  assert.equal(web.env.NODE_ENV, 'production');
  assert.equal(web.env.PORT, '3000');
  assert.equal(web.env.DATABASE_URL, server.env.DATABASE_URL);
  assert.equal(web.env.API_BASE_URL, 'http://127.0.0.1:3001');
});

test('pm2 deployment guide documents build, migration, nginx, and pm2 operations', () => {
  const guide = readFileSync('docs/deployment-pm2.md', 'utf8');

  assert.match(guide, /npm ci/);
  assert.match(guide, /npm run build/);
  assert.match(guide, /npm run db:migrate/);
  assert.match(guide, /pm2 start ecosystem\.config\.cjs/);
  assert.match(guide, /pm2 save/);
  assert.match(guide, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(guide, /DATABASE_URL/);
  assert.match(guide, /Nginx/);
  assert.match(guide, /\/api\//);
});
