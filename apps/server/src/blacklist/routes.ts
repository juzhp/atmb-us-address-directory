import { BLACKLIST_REASON_MAX_LENGTH, BLACKLIST_STATUSES, US_STATES, US_ZIP_PATTERN } from '@atmb/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AuthService } from '../auth/service.js';
import type { BlacklistService } from './service.js';

const US_STATE_CODES = new Set(US_STATES.map((state) => state.code));

const fieldMessages: Record<string, string> = {
  streetAddress: '街道地址需为 3–160 个字符',
  city: '城市不能为空且不超过 80 个字符',
  state: '州必须是有效的两位美国州码',
  postalCode: 'ZIP 格式不正确，例如 90001 或 90001-1234',
  reason: `黑名单原因必填，且不超过 ${BLACKLIST_REASON_MAX_LENGTH} 字`,
  sourceUrl: '来源链接需以 http:// 或 https:// 开头，且不超过 500 个字符',
  website: '提交被拒绝',
};

// 来源链接可空：空字符串与 null 都存为 null
const sourceUrlSchema = z
  .union([z.literal(''), z.string().trim().max(500).regex(/^https?:\/\/\S+$/)])
  .nullable();

const addressFields = {
  streetAddress: z.string().trim().min(3).max(160),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().toUpperCase().length(2).refine((code) => US_STATE_CODES.has(code)),
  postalCode: z.string().trim().regex(US_ZIP_PATTERN),
  reason: z.string().trim().min(1).max(BLACKLIST_REASON_MAX_LENGTH),
  sourceUrl: sourceUrlSchema.optional().transform((value) => (value ? value : null)),
};

// website 是蜜罐字段：正常表单隐藏且为空，机器人填了就直接拒绝
const publicSubmissionSchema = z.object({
  ...addressFields,
  website: z.string().max(0).optional(),
});

const adminCreateSchema = z.object(addressFields);

const adminUpdateSchema = z
  .object({
    streetAddress: addressFields.streetAddress.optional(),
    city: addressFields.city.optional(),
    state: addressFields.state.optional(),
    postalCode: addressFields.postalCode.optional(),
    reason: addressFields.reason.optional(),
    // 编辑时未传 sourceUrl 表示保持不变，不能像新增那样折叠成 null
    sourceUrl: sourceUrlSchema.optional().transform((value) => (value === undefined ? undefined : value || null)),
    status: z.enum(BLACKLIST_STATUSES).optional(),
    reviewNote: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'empty' });

const listQuerySchema = z.object({
  status: z.enum([...BLACKLIST_STATUSES, 'all']).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const idSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function registerBlacklistRoutes(
  app: FastifyInstance,
  blacklistService: BlacklistService,
  authService: AuthService,
) {
  app.post('/api/public/blacklist/submissions', async (request, reply) => {
    const parsed = publicSubmissionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: firstFieldMessage(parsed.error) });
    }

    const { website: _website, ...input } = parsed.data;

    try {
      blacklistService.submitPublic(input, request.ip);
      return reply.code(201).send({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === 'BLACKLIST_RATE_LIMITED') {
        return reply.code(429).send({ message: '提交过于频繁，请稍后再试' });
      }
      if (error instanceof Error && error.message === 'BLACKLIST_QUEUE_FULL') {
        return reply.code(429).send({ message: '当前待审核提交过多，请稍后再试' });
      }
      if (error instanceof Error && error.message === 'BLACKLIST_DUPLICATE') {
        return reply.code(409).send({ message: '你已提交过该地址，请等待审核' });
      }
      throw error;
    }
  });

  app.get('/api/admin/blacklist', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const parsed = listQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ message: '查询参数不正确' });
    }

    return blacklistService.list({
      status: parsed.data.status,
      keyword: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
  });

  app.post('/api/admin/blacklist', async (request, reply) => {
    const user = requireAdmin(request, reply, authService);
    if (!user) return reply;
    const parsed = adminCreateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: firstFieldMessage(parsed.error) });
    }

    return reply.code(201).send({ item: blacklistService.createAdminEntry(parsed.data, user.username) });
  });

  app.patch('/api/admin/blacklist/:id', async (request, reply) => {
    const user = requireAdmin(request, reply, authService);
    if (!user) return reply;
    const params = idSchema.safeParse(request.params);
    const parsed = adminUpdateSchema.safeParse(request.body);

    if (!params.success) {
      return reply.code(400).send({ message: '黑名单 ID 不正确' });
    }

    if (!parsed.success) {
      return reply.code(400).send({ message: firstFieldMessage(parsed.error) });
    }

    try {
      return { item: blacklistService.update(params.data.id, parsed.data, user.username) };
    } catch (error) {
      if (error instanceof Error && error.message === 'BLACKLIST_NOT_FOUND') {
        return reply.code(404).send({ message: '黑名单记录不存在' });
      }
      throw error;
    }
  });

  app.delete('/api/admin/blacklist/:id', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const params = idSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ message: '黑名单 ID 不正确' });
    }

    try {
      blacklistService.delete(params.data.id);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'BLACKLIST_NOT_FOUND') {
        return reply.code(404).send({ message: '黑名单记录不存在' });
      }
      throw error;
    }
  });
}

function firstFieldMessage(error: z.ZodError) {
  const field = error.issues[0]?.path[0];
  return (typeof field === 'string' && fieldMessages[field]) || '提交字段不正确';
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply, authService: AuthService) {
  const adminUserId = request.session.get('adminUserId');

  if (typeof adminUserId !== 'number') {
    reply.code(401).send({ message: '未登录' });
    return null;
  }

  const user = authService.findActiveUserProfile(adminUserId);

  if (!user) {
    reply.code(401).send({ message: '未登录' });
    return null;
  }

  return user;
}
