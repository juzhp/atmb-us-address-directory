import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ADDRESS_SOURCES } from '@atmb/shared';

import { randomUUID } from 'node:crypto';

import type { AuthService } from '../auth/service.js';
import { parseIpostal1Export, type Ipostal1Export } from '../crawl/ipostal1-import.js';
import type { CrawlPipeline, Ipostal1ImportStats } from '../crawl/pipeline.js';
import type { TaskExecutorLike } from './scheduler.js';
import type { TaskService } from './service.js';

// 离线导出文件约 10MB（53 个州的接口响应原文）
const IPOSTAL1_IMPORT_FILE_LIMIT_BYTES = 50 * 1024 * 1024;
// 上传后等待人工确认的导出数据只保留在内存里，超时或服务重启后需重新上传
const IPOSTAL1_IMPORT_PENDING_TTL_MS = 30 * 60 * 1000;
const IPOSTAL1_IMPORT_PENDING_MAX = 5;

interface PendingIpostal1Import {
  exportData: Ipostal1Export;
  stats: Ipostal1ImportStats;
  createdAt: number;
}

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
  platform: z.enum(ADDRESS_SOURCES).optional(),
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
  crawlPipeline?: Pick<CrawlPipeline, 'previewIpostal1Export' | 'importIpostal1Export'> | null,
) {
  const pendingImports = new Map<string, PendingIpostal1Import>();

  function prunePendingImports() {
    const expiredBefore = Date.now() - IPOSTAL1_IMPORT_PENDING_TTL_MS;
    for (const [id, pending] of pendingImports) {
      if (pending.createdAt < expiredBefore) {
        pendingImports.delete(id);
      }
    }
    while (pendingImports.size > IPOSTAL1_IMPORT_PENDING_MAX) {
      const oldest = pendingImports.keys().next().value;
      if (oldest === undefined) break;
      pendingImports.delete(oldest);
    }
  }
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
      platform: parsed.data.platform,
    });

    void taskExecutor?.enqueue(item.id);

    return reply.code(201).send({ item });
  });

  // 上传 iPostal1 离线导出文件：只解析并统计（含 ATMB 去重），不写库；返回 uploadId 等人工确认
  app.post('/api/admin/tasks/ipostal1-import', async (request, reply) => {
    const user = requireAdmin(request, reply, authService);

    if (!user) return reply;

    if (!crawlPipeline) {
      return reply.code(503).send({ message: '当前环境不支持导入' });
    }

    const file = await request.file({ limits: { fileSize: IPOSTAL1_IMPORT_FILE_LIMIT_BYTES } });

    if (!file) {
      return reply.code(400).send({ message: '请选择 iPostal1 导出文件' });
    }

    let exportData;
    try {
      const text = (await file.toBuffer()).toString('utf8');
      exportData = parseIpostal1Export(JSON.parse(text));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(400).send({ message: '导出文件不能超过 50MB' });
      }
      return reply.code(400).send({
        message: `导出文件无效：${error instanceof SyntaxError ? '不是合法 JSON' : error instanceof Error ? error.message : String(error)}`,
      });
    }

    const stats = crawlPipeline.previewIpostal1Export(exportData);
    const uploadId = randomUUID();

    prunePendingImports();
    pendingImports.set(uploadId, { exportData, stats, createdAt: Date.now() });

    return { uploadId, fetchedAt: exportData.fetchedAt, stats };
  });

  // 人工确认后：创建只含 sync_smarty 的 iPostal1 任务、写入暂存并进入执行队列
  app.post('/api/admin/tasks/ipostal1-import/:uploadId/confirm', async (request, reply) => {
    const user = requireAdmin(request, reply, authService);

    if (!user) return reply;

    if (!crawlPipeline) {
      return reply.code(503).send({ message: '当前环境不支持导入' });
    }

    prunePendingImports();
    const { uploadId } = request.params as { uploadId: string };
    const pending = pendingImports.get(uploadId);

    if (!pending) {
      return reply.code(404).send({ message: '上传已过期或已处理，请重新上传' });
    }

    if (taskService.hasRunningTask()) {
      return reply.code(409).send({ message: '已有任务正在执行，请等待完成后再确认导入' });
    }

    pendingImports.delete(uploadId);
    const created = taskService.createTask({
      createdBy: user.displayName || user.username,
      createdType: 'manual',
      note: `导入 iPostal1 离线数据${pending.exportData.fetchedAt ? `（抓取于 ${pending.exportData.fetchedAt}）` : ''}`,
      platform: 'ipostal1',
      taskTypes: ['sync_smarty'],
    });
    const stats = crawlPipeline.importIpostal1Export(created.id, pending.exportData);

    void taskExecutor?.enqueue(created.id);

    return reply.code(201).send({ item: taskService.getTask(created.id) ?? created, stats });
  });

  app.delete('/api/admin/tasks/ipostal1-import/:uploadId', async (request, reply) => {
    if (!requireAdmin(request, reply, authService)) return reply;
    const { uploadId } = request.params as { uploadId: string };
    pendingImports.delete(uploadId);

    return { ok: true };
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
