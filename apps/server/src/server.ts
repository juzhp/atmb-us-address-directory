import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifySession from '@fastify/session';
import { createDatabase, ensureDatabaseSchema } from '@atmb/db';
import Fastify from 'fastify';
import type { FastifyServerOptions } from 'fastify';
import { pathToFileURL } from 'node:url';

import { resolveServerConfig } from './auth/config.js';
import { registerAuthRoutes } from './auth/routes.js';
import { AuthService } from './auth/service.js';
import { SqliteSessionStore } from './auth/session-store.js';
import { registerAddressRoutes } from './addresses/routes.js';
import { seedDevelopmentAddresses } from './addresses/seed.js';
import { AddressService } from './addresses/service.js';
import { CrawlPipeline, type CrawlFetcher, type SmartyLookupClient } from './crawl/pipeline.js';
import { registerSettingsRoutes } from './settings/routes.js';
import { SettingsService, type ProxyTester, type SmartyClient } from './settings/service.js';
import { QueuedTaskExecutor } from './tasks/executor.js';
import { registerTaskRoutes } from './tasks/routes.js';
import { TaskScheduler } from './tasks/scheduler.js';
import { seedDevelopmentTasks } from './tasks/seed.js';
import { TaskService } from './tasks/service.js';

export interface CreateServerOptions {
  databaseUrl?: string;
  env?: Record<string, string | undefined>;
  logger?: FastifyServerOptions['logger'];
  smartyClient?: SmartyClient;
  proxyTester?: ProxyTester;
  smartyLookupClient?: SmartyLookupClient;
  crawlFetcher?: CrawlFetcher;
  disableTaskExecution?: boolean;
  disableScheduler?: boolean;
}

export async function createServer(options: CreateServerOptions = {}) {
  const config = resolveServerConfig(options.env);
  const database = createDatabase({
    url: options.databaseUrl ?? config.databaseUrl,
  });

  ensureDatabaseSchema(database.sqlite);

  const authService = new AuthService(database, config);
  authService.ensureDefaultAdmin();
  if (config.seedDemoData) {
    seedDevelopmentAddresses(database);
    seedDevelopmentTasks(database);
  }
  const addressService = new AddressService(database);
  const settingsService = new SettingsService(database, config, options.smartyClient, options.proxyTester);
  settingsService.ensureDefaultSettings();
  const taskService = new TaskService(database);
  taskService.recoverInterruptedTasks();
  const crawlPipeline = new CrawlPipeline({
    database,
    taskService,
    settingsService,
    fetcher: options.crawlFetcher,
    smartyClient: options.smartyLookupClient,
  });
  const taskExecutionDisabled = options.disableTaskExecution ?? config.nodeEnv === 'test';
  const taskExecutor = taskExecutionDisabled ? null : new QueuedTaskExecutor(crawlPipeline);
  const taskScheduler = taskExecutor && !options.disableScheduler
    ? new TaskScheduler(settingsService, taskService, taskExecutor)
    : null;

  const app = Fastify({
    logger: options.logger ?? true,
  });

  await app.register(cors, {
    origin: config.webOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
  });
  await app.register(fastifySession, {
    cookieName: 'atmb_admin_sid',
    secret: config.sessionSecret,
    store: new SqliteSessionStore(database.sqlite),
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
    },
  });

  app.get('/health', async () => ({ ok: true }));
  registerAuthRoutes(app, authService);
  registerAddressRoutes(app, addressService, config, taskService, taskExecutor);
  registerSettingsRoutes(app, settingsService);
  registerTaskRoutes(app, taskService, authService, taskExecutor);

  taskScheduler?.start();

  app.addHook('onClose', (_instance, done) => {
    taskScheduler?.stop();
    database.sqlite.close();
    done();
  });

  return app;
}

function shouldListen() {
  if (process.env.ATMB_SERVER_ENTRY === '1') {
    return true;
  }

  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

if (shouldListen()) {
  const app = await createServer();
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
}
