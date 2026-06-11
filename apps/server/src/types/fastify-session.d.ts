import 'fastify';

declare module 'fastify' {
  interface Session {
    adminUserId?: number;
  }
}
