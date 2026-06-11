import type { FastifyInstance } from 'fastify';
import type { LoginRequest } from '@atmb/shared';
import { z } from 'zod';

import type { AuthService } from './service.js';

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  app.post('/api/admin/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: '请输入账号和密码' });
    }

    const body: LoginRequest = parsed.data;
    const user = authService.authenticate(body.username, body.password);

    if (!user) {
      return reply.code(401).send({ message: '账号或密码错误' });
    }

    request.session.set('adminUserId', user.id);
    await request.session.save();

    return { user };
  });

  app.get('/api/admin/auth/me', async (request, reply) => {
    const adminUserId = request.session.get('adminUserId');

    if (typeof adminUserId !== 'number') {
      return reply.code(401).send({ message: '未登录' });
    }

    const user = authService.findActiveUserProfile(adminUserId);

    if (!user) {
      await request.session.destroy();
      return reply.code(401).send({ message: '未登录' });
    }

    return { user };
  });

  app.post('/api/admin/auth/logout', async (request) => {
    await request.session.destroy();
    return { ok: true };
  });

  app.post('/api/admin/auth/change-password', async (request, reply) => {
    const adminUserId = request.session.get('adminUserId');

    if (typeof adminUserId !== 'number') {
      return reply.code(401).send({ message: '未登录' });
    }

    const parsed = changePasswordSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: '请输入当前密码和至少 8 位的新密码' });
    }

    const changed = authService.changePassword(
      adminUserId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );

    if (!changed) {
      return reply.code(400).send({ message: '当前密码错误' });
    }

    return { ok: true };
  });
}
