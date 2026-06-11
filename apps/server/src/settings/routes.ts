import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { SettingsService } from './service.js';

const nullableNonnegative = z.number().int().nonnegative().nullable();
const frequencySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(10),
]);

const smartySchema = z.object({
  authId: z.string().trim().optional(),
  authToken: z.string().optional(),
  remainingCredits: nullableNonnegative.optional(),
  monthlyUsed: nullableNonnegative.optional(),
});

const updateScheduleSchema = z.object({
  autoUpdateEnabled: z.boolean(),
  updateFrequencyDays: frequencySchema.nullable(),
  updateHour: z.number().int().min(0).max(23),
  updateMinute: z.union([z.literal(0), z.literal(30)]),
}).superRefine((value, context) => {
  if (value.autoUpdateEnabled && value.updateFrequencyDays === null) {
    context.addIssue({
      code: 'custom',
      path: ['updateFrequencyDays'],
      message: '开启自动更新时请选择更新频率',
    });
  }
});

const headCodeSchema = z.object({
  headCode: z.string(),
});

export function registerSettingsRoutes(app: FastifyInstance, settingsService: SettingsService) {
  app.get('/api/admin/settings', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    return { settings: settingsService.getSettings() };
  });

  app.patch('/api/admin/settings/smarty', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const parsed = smartySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Smarty 配置字段不正确' });
    }

    return { settings: settingsService.saveSmartySettings(parsed.data) };
  });

  app.post('/api/admin/settings/smarty/test', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;

    try {
      return { settings: await settingsService.testSmartyConnection() };
    } catch (error) {
      if (error instanceof Error && error.message === 'SMARTY_NOT_CONFIGURED') {
        return reply.code(400).send({ message: '请先保存 Smarty Auth ID 和 Auth Token' });
      }
      throw error;
    }
  });

  app.patch('/api/admin/settings/update-schedule', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const parsed = updateScheduleSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: '更新设置字段不正确' });
    }

    return { settings: settingsService.saveUpdateSchedule(parsed.data) };
  });

  app.patch('/api/admin/settings/head-code', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const parsed = headCodeSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Head 代码字段不正确' });
    }

    return { settings: settingsService.saveHeadCode(parsed.data.headCode) };
  });

  app.post('/api/admin/settings/head-code/check', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const parsed = headCodeSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: 'Head 代码字段不正确' });
    }

    return settingsService.checkHeadCode(parsed.data.headCode);
  });
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const adminUserId = request.session.get('adminUserId');

  if (typeof adminUserId !== 'number') {
    reply.code(401).send({ message: '未登录' });
    return false;
  }

  return true;
}
