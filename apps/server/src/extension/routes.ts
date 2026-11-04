import { ADDRESS_SOURCES, EXTENSION_LOOKUP_MAX_ITEMS } from '@atmb/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { ExtensionLookupService } from './service.js';

const optionalText = (max: number) => z.string().trim().max(max).optional();

const itemSchema = z.object({
  ref: z.string().min(1).max(120),
  platform: z.enum(ADDRESS_SOURCES),
  sourceId: optionalText(200),
  street: optionalText(200),
  city: optionalText(80),
  state: optionalText(2),
  postalCode: optionalText(10),
  text: optionalText(300),
});

const lookupSchema = z.object({
  items: z.array(itemSchema).min(1).max(EXTENSION_LOOKUP_MAX_ITEMS),
});

export function registerExtensionRoutes(app: FastifyInstance, service: ExtensionLookupService) {
  app.post('/api/public/extension/lookup', async (request, reply) => {
    if (!service.consumeRateLimit(request.ip)) {
      return reply.code(429).send({ message: '查询过于频繁，请稍后再试' });
    }

    const parsed = lookupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: `请求格式不正确，items 需为 1–${EXTENSION_LOOKUP_MAX_ITEMS} 条` });
    }

    reply.header('Cache-Control', 'no-store');
    return service.lookup(parsed.data.items);
  });
}
