import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AuthService } from '../auth/service.js';
import type { TaskExecutorLike } from './scheduler.js';
import type { TaskService } from './service.js';

const createdTypeSchema = z.enum(['manual', 'system']);
const statusSchema = z.enum([
  'running',
  'pause_requested',
  'paused',
  'stop_requested',
  'stopped',
  'completed',
]);

const querySchema = z.object({
  keyword: z.string().optional(),
  generatedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdType: createdTypeSchema.optional(),
  status: statusSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

const createSchema = z.object({
  note: z.string().max(500).optional(),
});

const subtaskQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export function registerTaskRoutes(
  app: FastifyInstance,
  taskService: TaskService,
  authService: AuthService,
  taskExecutor?: TaskExecutorLike | null,
) {
  app.get('/api/admin/tasks/stats', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    return taskService.getStats();
  });

  app.get('/api/admin/tasks', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const parsed = querySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ message: '任务筛选参数不正确' });
    }

    return taskService.listTasks(parsed.data);
  });

  app.post('/api/admin/tasks', async (request, reply) => {
    const user = requireAdmin(request, reply, authService);

    if (!user) return reply;

    const parsed = createSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ message: '任务创建参数不正确' });
    }

    if (taskService.hasRunningTask()) {
      return reply.code(409).send({ message: '已有任务正在执行，请等待完成后再创建新任务' });
    }

    const item = taskService.createManualTask({
      createdBy: user.displayName || user.username,
      note: parsed.data.note,
    });

    void taskExecutor?.enqueue(item.id);

    return reply.code(201).send({ item });
  });

  app.post('/api/admin/tasks/:id/pause', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const taskId = Number((request.params as { id: string }).id);

    if (!taskService.getTask(taskId)) {
      return reply.code(404).send({ message: '任务不存在' });
    }

    const item = taskService.requestPause(taskId);
    if (!item) {
      return reply.code(409).send({ message: '当前任务状态不能暂停' });
    }

    return { item };
  });

  app.post('/api/admin/tasks/:id/resume', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const taskId = Number((request.params as { id: string }).id);

    if (!taskService.getTask(taskId)) {
      return reply.code(404).send({ message: '任务不存在' });
    }

    const item = taskService.resumeTask(taskId);
    if (!item) {
      return reply.code(409).send({ message: '当前任务状态不能继续' });
    }

    void taskExecutor?.enqueue(item.id);

    return { item };
  });

  app.post('/api/admin/tasks/:id/stop', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const taskId = Number((request.params as { id: string }).id);

    if (!taskService.getTask(taskId)) {
      return reply.code(404).send({ message: '任务不存在' });
    }

    taskExecutor?.requestStop?.(taskId);
    const item = taskService.requestStop(taskId, !taskExecutor);
    if (!item) {
      return reply.code(409).send({ message: '当前任务状态不能停止' });
    }

    return { item };
  });

  app.delete('/api/admin/tasks/:id', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const taskId = Number((request.params as { id: string }).id);
    const result = taskService.deleteTask(taskId);

    if (result === 'not_found') {
      return reply.code(404).send({ message: '任务不存在' });
    }

    if (result === 'invalid_state') {
      return reply.code(409).send({ message: '只有执行完毕或已停止的任务可以删除' });
    }

    return { ok: true };
  });

  app.get('/api/admin/tasks/:id/subtasks', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const { id } = request.params as { id: string };
    const parsed = subtaskQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ message: '子任务分页参数不正确' });
    }

    const result = taskService.listSubtasks(Number(id), parsed.data.page, parsed.data.pageSize);

    if (!result) {
      return reply.code(404).send({ message: '任务不存在' });
    }

    return result;
  });
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
