import { randomUUID } from 'node:crypto';
import type { DatabaseContext } from '@atmb/db';
import type {
  AdminTaskProgress,
  AdminSubtaskExecutionStatus,
  AdminSubtaskListItem,
  AdminSubtaskResultStatus,
  AdminSubtaskType,
  AdminTaskCreatedType,
  AdminTaskListItem,
  AdminTaskListResponse,
  AdminTaskStatus,
  AdminTaskStats,
  AdminTaskSubtasksResponse,
} from '@atmb/shared';

import { normalizeAddressKey, slugify } from '../crawl/parser.js';

export const taskTypes: AdminSubtaskType[] = [
  'fetch_states',
  'fetch_names',
  'fetch_addresses',
  'fetch_mailbox_numbers',
  'sync_smarty',
];
const mailboxUpdateTaskTypes: AdminSubtaskType[] = ['fetch_addresses', 'fetch_mailbox_numbers'];
const smartySyncTaskTypes: AdminSubtaskType[] = ['sync_smarty'];
const activeTaskStatuses: AdminTaskStatus[] = ['running', 'pause_requested', 'paused', 'stop_requested'];
const resumableTaskStatuses: AdminTaskStatus[] = ['pause_requested', 'paused'];

export interface TaskQuery {
  keyword?: string;
  generatedDate?: string;
  createdType?: AdminTaskCreatedType;
  status?: AdminTaskStatus;
  page?: number;
  pageSize?: number;
}

export interface CreateManualTaskInput {
  createdBy: string;
  note?: string | null;
}

export interface CreateTaskInput extends CreateManualTaskInput {
  createdType: AdminTaskCreatedType;
  taskTypes?: AdminSubtaskType[];
}

interface TaskRow {
  id: number;
  batchCode: string;
  generatedAt: string;
  createdType: AdminTaskCreatedType;
  status: AdminTaskStatus;
  note: string | null;
  createdBy: string;
  pendingCount: number;
  successCount: number;
  failedCount: number;
  totalCount: number;
  updatedAt: string;
}

interface SubtaskRow {
  id: number;
  taskType: AdminSubtaskType;
  createdAt: string;
  executionStatus: AdminSubtaskExecutionStatus;
  resultStatus: AdminSubtaskResultStatus | null;
  errorMessage: string | null;
  updatedAt: string;
}

interface MailboxUpdateAddressRow {
  id: number;
  sourceId: string | null;
  name: string;
  slug: string;
  anytimeUrl: string;
  country: string;
  state: string;
  stateName: string;
  stateUrl: string | null;
  city: string;
  streetAddress: string;
  postalCode: string;
  fullAddress: string;
  priceCents: number;
  priceCurrency: string;
  pricePeriod: string;
  rdi: string | null;
  cmra: string | null;
  smartyRaw: string | null;
  smartyCheckedAt: string | null;
}

const MAX_PAGE_SIZE = 100;
const deletableTaskStatuses: AdminTaskStatus[] = ['completed', 'stopped'];
const smartyCandidateWhereSql = `
  stage.task_id = ?
  AND (
    (
      stage.rdi IN ('Residential', 'Commercial')
      AND stage.cmra IN ('Yes', 'No')
      AND stage.smarty_checked_at IS NOT NULL
      AND stage.smarty_source_address_id IS NULL
    )
    OR (
      stage.crawl_status IN ('mailbox_fetched', 'smarty_pending', 'smarty_failed')
      AND NOT EXISTS (
        SELECT 1
        FROM addresses cached
        WHERE cached.anytime_url = stage.anytime_url
          AND cached.smarty_checked_at IS NOT NULL
          AND cached.rdi IN ('Residential', 'Commercial')
          AND cached.cmra IN ('Yes', 'No')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM addresses cached
        WHERE LOWER(cached.street_address || '|' || cached.city || '|' || cached.state || '|' || cached.postal_code) = stage.normalized_address_key
          AND cached.smarty_checked_at IS NOT NULL
          AND cached.rdi IN ('Residential', 'Commercial')
          AND cached.cmra IN ('Yes', 'No')
      )
    )
  )
`;

export class TaskService {
  constructor(private readonly database: DatabaseContext) {}

  hasRunningTask() {
    return scalar(
      this.database,
      "SELECT COUNT(*) FROM crawl_tasks WHERE status IN ('running', 'pause_requested', 'paused', 'stop_requested')",
    ) > 0;
  }

  getLastSystemTaskGeneratedAt() {
    const row = this.database.sqlite
      .prepare(`
        SELECT generated_at AS generatedAt
        FROM crawl_tasks
        WHERE created_type = 'system'
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
      `)
      .get() as { generatedAt: string } | undefined;

    return row?.generatedAt ?? null;
  }

  /**
   * 服务启动时恢复中断任务。返回需要重新入队续跑的 taskId 列表：
   * - running：重置中断在执行中的子任务后保持 running，从断点续跑。
   * - pause_requested：尊重暂停意图，落为 paused，不续跑。
   * - stop_requested：尊重停止意图，落为 stopped，不续跑。
   */
  recoverInterruptedTasks(): number[] {
    const now = new Date().toISOString();
    const rows = this.database.sqlite
      .prepare("SELECT id, status FROM crawl_tasks WHERE status IN ('running', 'pause_requested', 'stop_requested')")
      .all() as Array<{ id: number; status: AdminTaskStatus }>;

    if (rows.length === 0) {
      return [];
    }

    const resumeIds: number[] = [];

    const recover = this.database.sqlite.transaction(() => {
      for (const row of rows) {
        if (row.status === 'stop_requested') {
          this.markTaskStopped(row.id, '任务在服务重启前已请求停止');
          continue;
        }

        // running / pause_requested：把中断在执行中的子任务重置为 pending，
        // 已成功的子任务保留，pipeline 会据此从断点续跑。
        this.database.sqlite
          .prepare(`
            UPDATE crawl_subtasks
            SET
              execution_status = 'pending',
              result_status = NULL,
              error_message = NULL,
              updated_at = @updatedAt
            WHERE task_id = @taskId
              AND NOT (execution_status = 'completed' AND result_status = 'success')
          `)
          .run({
            taskId: row.id,
            updatedAt: now,
          });

        if (row.status === 'pause_requested') {
          this.updateTaskStatus(row.id, 'paused', now);
        } else {
          this.updateTaskStatus(row.id, 'running', now);
          resumeIds.push(row.id);
        }
        this.recalculateTaskCounts(row.id);
      }
    });

    recover();

    return resumeIds;
  }

  listTasks(query: TaskQuery): AdminTaskListResponse {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize || 20)));
    const params: Record<string, string | number> = {};
    const where: string[] = ['1 = 1'];

    if (query.keyword) {
      params.keyword = `%${query.keyword.trim()}%`;
      where.push('(batch_code LIKE @keyword OR note LIKE @keyword OR created_by LIKE @keyword)');
    }

    if (query.generatedDate) {
      params.generatedDate = query.generatedDate;
      where.push('date(generated_at) = date(@generatedDate)');
    }

    if (query.createdType) {
      params.createdType = query.createdType;
      where.push('created_type = @createdType');
    }

    if (query.status) {
      params.status = query.status;
      where.push('status = @status');
    }

    const whereSql = where.join(' AND ');
    const total = (this.database.sqlite
      .prepare(`SELECT COUNT(*) AS count FROM crawl_tasks WHERE ${whereSql}`)
      .get(params) as { count: number }).count;
    const rows = this.database.sqlite
      .prepare(`
        SELECT
          id,
          batch_code AS batchCode,
          generated_at AS generatedAt,
          created_type AS createdType,
          status,
          note,
          created_by AS createdBy,
          pending_count AS pendingCount,
          success_count AS successCount,
          failed_count AS failedCount,
          total_count AS totalCount,
          updated_at AS updatedAt
        FROM crawl_tasks
        WHERE ${whereSql}
        ORDER BY generated_at DESC, id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all({
        ...params,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }) as TaskRow[];

    return {
      items: rows.map((row) => toTaskItem(row, this.getRunningProgress(row.id))),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  getStats(): AdminTaskStats {
    return {
      totalTasks: scalar(this.database, 'SELECT COUNT(*) FROM crawl_tasks'),
      runningTasks: scalar(this.database, "SELECT COUNT(*) FROM crawl_tasks WHERE status IN ('running', 'pause_requested', 'paused', 'stop_requested')"),
      completedTasks: scalar(this.database, "SELECT COUNT(*) FROM crawl_tasks WHERE status = 'completed'"),
      failedSubtasks: scalar(this.database, "SELECT COUNT(*) FROM crawl_subtasks WHERE result_status = 'failed'"),
    };
  }

  getTask(id: number): AdminTaskListItem | null {
    const row = this.database.sqlite
      .prepare(`
        SELECT
          id,
          batch_code AS batchCode,
          generated_at AS generatedAt,
          created_type AS createdType,
          status,
          note,
          created_by AS createdBy,
          pending_count AS pendingCount,
          success_count AS successCount,
          failed_count AS failedCount,
          total_count AS totalCount,
          updated_at AS updatedAt
        FROM crawl_tasks
        WHERE id = ?
      `)
      .get(id) as TaskRow | undefined;

    return row ? toTaskItem(row, this.getRunningProgress(row.id)) : null;
  }

  createManualTask(input: CreateManualTaskInput): AdminTaskListItem {
    return this.createTask({
      ...input,
      createdType: 'manual',
    });
  }

  createSystemTask(input: CreateManualTaskInput = { createdBy: 'system' }): AdminTaskListItem {
    return this.createTask({
      ...input,
      createdBy: input.createdBy || 'system',
      createdType: 'system',
    });
  }

  createMailboxUpdateTask(input: CreateManualTaskInput & { addressIds?: number[]; stageIds?: number[] }): AdminTaskListItem | null {
    const addressIds = [...new Set((input.addressIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    const stageIds = [...new Set((input.stageIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

    if (addressIds.length === 0 && stageIds.length === 0) {
      return null;
    }

    const addressPlaceholders = addressIds.map(() => '?').join(', ');
    const addresses = addressIds.length > 0
      ? this.database.sqlite
        .prepare(`
          SELECT
            a.id,
            a.source_id AS sourceId,
            a.name,
            a.slug,
            a.anytime_url AS anytimeUrl,
            a.country,
            a.state,
            a.state_name AS stateName,
            s.anytime_url AS stateUrl,
            a.city,
            a.street_address AS streetAddress,
            a.postal_code AS postalCode,
            a.full_address AS fullAddress,
            a.price_cents AS priceCents,
            a.price_currency AS priceCurrency,
            a.price_period AS pricePeriod,
            a.rdi,
            a.cmra,
            a.smarty_raw AS smartyRaw,
            a.smarty_checked_at AS smartyCheckedAt
          FROM addresses a
          LEFT JOIN states s ON s.code = a.state
          WHERE a.id IN (${addressPlaceholders})
            AND a.source = 'anytimemailbox'
            AND a.is_active = 1
        `)
        .all(...addressIds) as MailboxUpdateAddressRow[]
      : [];

    if (addresses.length !== addressIds.length) {
      return null;
    }

    const stagePlaceholders = stageIds.map(() => '?').join(', ');
    const stageRows = stageIds.length > 0
      ? this.database.sqlite
        .prepare(`
          SELECT id
          FROM crawl_discovered_addresses
          WHERE id IN (${stagePlaceholders})
            AND imported_address_id IS NULL
            AND crawl_status <> 'skipped'
        `)
        .all(...stageIds) as Array<{ id: number }>
      : [];

    if (stageRows.length !== stageIds.length) {
      return null;
    }

    const selectedCount = addresses.length + stageRows.length;
    const task = this.createTask({
      createdBy: input.createdBy,
      createdType: 'manual',
      note: input.note ?? `更新 ${selectedCount} 个地址的邮箱编号`,
      taskTypes: mailboxUpdateTaskTypes,
    });
    const now = new Date().toISOString();
    const insertStage = this.database.sqlite.prepare(`
      INSERT INTO crawl_discovered_addresses (
        task_id, source, source_id, state_name, state, state_url, state_location_count,
        name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
        postal_code, full_address, normalized_address_key, price_cents, price_currency,
        price_period, rdi, cmra, smarty_raw, smarty_checked_at, crawl_status,
        imported_address_id, created_at, updated_at
      ) VALUES (
        @taskId, 'anytimemailbox', @sourceId, @stateName, @state, @stateUrl, NULL,
        @name, @slug, @anytimeUrl, NULL, NULL, @country, @city, @streetAddress,
        @postalCode, @fullAddress, @normalizedAddressKey, @priceCents, @priceCurrency,
        @pricePeriod, @rdi, @cmra, @smartyRaw, @smartyCheckedAt, 'discovered',
        @importedAddressId, @now, @now
      )
    `);

    const seedStage = this.database.sqlite.transaction(() => {
      for (const address of addresses) {
        insertStage.run({
          taskId: task.id,
          sourceId: address.sourceId ?? sourceIdFromUrl(address.anytimeUrl),
          stateName: address.stateName,
          state: address.state,
          stateUrl: address.stateUrl ?? `https://www.anytimemailbox.com/l/usa/${slugify(address.stateName)}`,
          name: address.name,
          slug: address.slug,
          anytimeUrl: address.anytimeUrl,
          country: address.country,
          city: address.city,
          streetAddress: address.streetAddress,
          postalCode: address.postalCode,
          fullAddress: address.fullAddress,
          normalizedAddressKey: normalizeAddressKey({
            streetAddress: address.streetAddress,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
          }),
          priceCents: address.priceCents,
          priceCurrency: address.priceCurrency,
          pricePeriod: address.pricePeriod,
          rdi: address.rdi,
          cmra: address.cmra,
          smartyRaw: address.smartyRaw,
          smartyCheckedAt: address.smartyCheckedAt,
          importedAddressId: address.id,
          now,
        });
      }

      if (stageRows.length > 0) {
        const selectedStageIds = stageRows.map((row) => row.id).join(', ');

        this.database.sqlite
          .prepare(`
            INSERT INTO crawl_discovered_addresses (
              task_id, source, source_id, state_name, state, state_url, state_location_count,
              name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
              postal_code, full_address, normalized_address_key, price_cents, price_currency,
              price_period, rdi, cmra, smarty_raw, smarty_checked_at, crawl_status,
              imported_address_id, created_at, updated_at
            )
            SELECT
              @taskId, source, source_id, state_name, state, state_url, state_location_count,
              name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
              postal_code, full_address, normalized_address_key, price_cents, price_currency,
              price_period, rdi, cmra, smarty_raw, smarty_checked_at, 'discovered',
              NULL, @now, @now
            FROM crawl_discovered_addresses
            WHERE id IN (${selectedStageIds})
            ORDER BY id ASC
          `)
          .run({
            taskId: task.id,
            now,
          });
      }
    });
    seedStage();

    return this.getTask(task.id);
  }

  createSmartySyncTask(input: CreateManualTaskInput & { stageIds: number[] }): AdminTaskListItem | null {
    const stageIds = [...new Set(input.stageIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];

    if (stageIds.length === 0) {
      return null;
    }

    const placeholders = stageIds.map(() => '?').join(', ');
    const rows = this.database.sqlite
      .prepare(`
        SELECT id
        FROM crawl_discovered_addresses
        WHERE id IN (${placeholders})
          AND imported_address_id IS NULL
          AND crawl_status IN ('mailbox_fetched', 'smarty_pending', 'smarty_failed')
          AND (
            rdi IS NULL
            OR cmra IS NULL
            OR smarty_checked_at IS NULL
          )
      `)
      .all(...stageIds) as Array<{ id: number }>;

    if (rows.length !== stageIds.length) {
      return null;
    }

    const task = this.createTask({
      createdBy: input.createdBy,
      createdType: 'manual',
      note: input.note ?? `同步 ${rows.length} 个地址的 RDI/CMRA`,
      taskTypes: smartySyncTaskTypes,
    });
    const now = new Date().toISOString();
    const selectedStageIds = rows.map((row) => row.id).join(', ');

    this.database.sqlite
      .prepare(`
        INSERT INTO crawl_discovered_addresses (
          task_id, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
          rdi, cmra, smarty_raw, smarty_checked_at, smarty_error, smarty_source_address_id,
          crawl_status, error_message, imported_address_id, created_at, updated_at
        )
        SELECT
          @taskId, source, source_id, state_name, state, state_url, state_location_count,
          name, slug, anytime_url, signup_url, myear_url, country, city, street_address,
          postal_code, full_address, normalized_address_key, price_cents, price_currency,
          price_period, mailbox_min, mailbox_max, mailbox_count, mailbox_numbers_json,
          NULL, NULL, NULL, NULL, NULL, NULL,
          'mailbox_fetched', NULL, NULL, @now, @now
        FROM crawl_discovered_addresses
        WHERE id IN (${selectedStageIds})
        ORDER BY id ASC
      `)
      .run({
        taskId: task.id,
        now,
      });

    return this.getTask(task.id);
  }

  createTask(input: CreateTaskInput): AdminTaskListItem {
    const now = new Date().toISOString();
    const batchCode = createBatchCode(now);
    const note = input.note?.trim() || null;
    const selectedTaskTypes = input.taskTypes?.length ? input.taskTypes : taskTypes;
    const createTask = this.database.sqlite.transaction(() => {
      const result = this.database.sqlite
        .prepare(`
          INSERT INTO crawl_tasks (
            batch_code,
            generated_at,
            created_type,
            status,
            note,
            created_by,
            pending_count,
            success_count,
            failed_count,
            total_count,
            created_at,
            updated_at
          )
          VALUES (
            @batchCode,
            @now,
            @createdType,
            'running',
            @note,
            @createdBy,
            @pendingCount,
            0,
            0,
            @totalCount,
            @now,
            @now
          )
        `)
        .run({
          batchCode,
          now,
          createdType: input.createdType,
          note,
          createdBy: input.createdBy,
          pendingCount: selectedTaskTypes.length,
          totalCount: selectedTaskTypes.length,
        });

      const taskId = Number(result.lastInsertRowid);
      const insertSubtask = this.database.sqlite.prepare(`
        INSERT INTO crawl_subtasks (
          task_id,
          task_type,
          execution_status,
          result_status,
          error_message,
          created_at,
          updated_at
        )
        VALUES (@taskId, @taskType, 'pending', NULL, NULL, @now, @now)
      `);

      for (const taskType of selectedTaskTypes) {
        insertSubtask.run({ taskId, taskType, now });
      }

      return taskId;
    });
    const taskId = createTask();
    const task = this.getTask(taskId);

    if (!task) {
      throw new Error('TASK_CREATE_FAILED');
    }

    return task;
  }

  markSubtaskRunning(taskId: number, taskType: AdminSubtaskType) {
    this.updateSubtask(taskId, taskType, {
      executionStatus: 'running',
      resultStatus: null,
      errorMessage: null,
    });
  }

  markSubtaskSuccess(taskId: number, taskType: AdminSubtaskType, message?: string | null) {
    this.updateSubtask(taskId, taskType, {
      executionStatus: 'completed',
      resultStatus: 'success',
      errorMessage: message ?? null,
    });
  }

  markSubtaskFailed(taskId: number, taskType: AdminSubtaskType, error: unknown) {
    this.updateSubtask(taskId, taskType, {
      executionStatus: 'completed',
      resultStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  requestPause(taskId: number) {
    const task = this.getTask(taskId);
    if (!task || !['running', 'pause_requested', 'paused'].includes(task.status)) {
      return null;
    }

    if (task.status === 'running') {
      this.updateTaskStatus(taskId, 'pause_requested');
    }

    return this.getTask(taskId);
  }

  resumeTask(taskId: number) {
    const task = this.getTask(taskId);
    if (!task) {
      return null;
    }

    if (resumableTaskStatuses.includes(task.status)) {
      this.updateTaskStatus(taskId, 'running');
      return this.getTask(taskId);
    }

    if (task.status !== 'completed' || task.failedCount <= 0 || this.hasRunningTask()) {
      return null;
    }

    const now = new Date().toISOString();

    this.database.sqlite.transaction(() => {
      this.database.sqlite
        .prepare(`
          UPDATE crawl_subtasks
          SET
            execution_status = 'pending',
            result_status = NULL,
            error_message = NULL,
            updated_at = @updatedAt
          WHERE task_id = @taskId
            AND result_status = 'failed'
        `)
        .run({
          taskId,
          updatedAt: now,
        });

      this.updateTaskStatus(taskId, 'running', now);
      this.recalculateTaskCounts(taskId);
    })();

    return this.getTask(taskId);
  }

  requestStop(taskId: number, immediate = false) {
    const task = this.getTask(taskId);
    if (!task || !activeTaskStatuses.includes(task.status)) {
      return null;
    }

    if (immediate || task.status === 'paused') {
      this.markTaskStopped(taskId, 'Task stopped by administrator');
    } else {
      this.updateTaskStatus(taskId, 'stop_requested');
    }

    return this.getTask(taskId);
  }

  deleteTask(taskId: number) {
    const task = this.getTask(taskId);

    if (!task) {
      return 'not_found';
    }

    if (!deletableTaskStatuses.includes(task.status)) {
      return 'invalid_state';
    }

    this.database.sqlite.transaction(() => {
      this.database.sqlite.prepare('DELETE FROM crawl_discovered_addresses WHERE task_id = ?').run(taskId);
      this.database.sqlite.prepare('DELETE FROM crawl_subtasks WHERE task_id = ?').run(taskId);
      this.database.sqlite.prepare('DELETE FROM crawl_tasks WHERE id = ?').run(taskId);
    })();

    return 'deleted';
  }

  getTaskStatus(taskId: number): AdminTaskStatus | null {
    const row = this.database.sqlite
      .prepare('SELECT status FROM crawl_tasks WHERE id = ?')
      .get(taskId) as { status: AdminTaskStatus } | undefined;

    return row?.status ?? null;
  }

  hasSubtask(taskId: number, taskType: AdminSubtaskType) {
    return scalar(
      this.database,
      'SELECT COUNT(*) AS count FROM crawl_subtasks WHERE task_id = ? AND task_type = ?',
      [taskId, taskType],
    ) > 0;
  }

  isSubtaskSuccessful(taskId: number, taskType: AdminSubtaskType) {
    return scalar(
      this.database,
      `
        SELECT COUNT(*) AS count
        FROM crawl_subtasks
        WHERE task_id = ?
          AND task_type = ?
          AND execution_status = 'completed'
          AND result_status = 'success'
      `,
      [taskId, taskType],
    ) > 0;
  }

  markTaskPaused(taskId: number, taskType: AdminSubtaskType) {
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare(`
        UPDATE crawl_subtasks
        SET execution_status = 'paused', result_status = NULL, error_message = NULL, updated_at = @updatedAt
        WHERE task_id = @taskId AND task_type = @taskType
          AND execution_status != 'completed'
      `)
      .run({
        taskId,
        taskType,
        updatedAt: now,
      });
    this.updateTaskStatus(taskId, 'paused', now);
    this.recalculateTaskCounts(taskId);
  }

  markTaskStopped(taskId: number, message = 'Task stopped by administrator') {
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare(`
        UPDATE crawl_subtasks
        SET
          execution_status = 'completed',
          result_status = 'stopped',
          error_message = COALESCE(error_message, @message),
          updated_at = @updatedAt
        WHERE task_id = @taskId
          AND result_status IS NULL
      `)
      .run({
        taskId,
        message,
        updatedAt: now,
      });
    this.updateTaskStatus(taskId, 'stopped', now);
    this.recalculateTaskCounts(taskId);
  }

  completeTask(taskId: number) {
    this.recalculateTaskCounts(taskId, true);
  }

  recalculateTaskCounts(taskId: number, complete = false) {
    const row = this.database.sqlite
      .prepare(`
        SELECT
          SUM(CASE WHEN execution_status = 'pending' THEN 1 ELSE 0 END) AS pendingCount,
          SUM(CASE WHEN result_status = 'success' THEN 1 ELSE 0 END) AS successCount,
          SUM(CASE WHEN result_status = 'failed' THEN 1 ELSE 0 END) AS failedCount,
          COUNT(*) AS totalCount
        FROM crawl_subtasks
        WHERE task_id = ?
      `)
      .get(taskId) as {
        pendingCount: number | null;
        successCount: number | null;
        failedCount: number | null;
        totalCount: number;
      };
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare(`
        UPDATE crawl_tasks
        SET
          pending_count = @pendingCount,
          success_count = @successCount,
          failed_count = @failedCount,
          total_count = @totalCount,
          status = CASE WHEN @complete = 1 THEN 'completed' ELSE status END,
          updated_at = @updatedAt
        WHERE id = @taskId
      `)
      .run({
        taskId,
        pendingCount: row.pendingCount ?? 0,
        successCount: row.successCount ?? 0,
        failedCount: row.failedCount ?? 0,
        totalCount: row.totalCount,
        complete: complete ? 1 : 0,
        updatedAt: now,
      });
  }

  listSubtasks(taskId: number, pageInput?: number, pageSizeInput?: number): AdminTaskSubtasksResponse | null {
    const task = this.getTask(taskId);

    if (!task) {
      return null;
    }

    const page = Math.max(1, Number(pageInput || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSizeInput || 20)));
    const total = (this.database.sqlite
      .prepare('SELECT COUNT(*) AS count FROM crawl_subtasks WHERE task_id = ?')
      .get(taskId) as { count: number }).count;
    const rows = this.database.sqlite
      .prepare(`
        SELECT
          id,
          task_type AS taskType,
          created_at AS createdAt,
          execution_status AS executionStatus,
          result_status AS resultStatus,
          error_message AS errorMessage,
          updated_at AS updatedAt
        FROM crawl_subtasks
        WHERE task_id = @taskId
        ORDER BY created_at ASC, id ASC
        LIMIT @limit OFFSET @offset
      `)
      .all({
        taskId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }) as SubtaskRow[];

    return {
      task,
      items: rows.map((row) => toSubtaskItem(row, this.getSubtaskProgress(taskId, row.taskType, row.executionStatus))),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private getRunningProgress(taskId: number): AdminTaskProgress | null {
    const row = this.database.sqlite
      .prepare(`
        SELECT task_type AS taskType, execution_status AS executionStatus
        FROM crawl_subtasks
        WHERE task_id = ?
        ORDER BY
          CASE
            WHEN execution_status = 'running' THEN 0
            WHEN execution_status = 'paused' THEN 1
            WHEN execution_status = 'pending' THEN 2
            WHEN result_status = 'failed' THEN 3
            ELSE 4
          END ASC,
          CASE WHEN execution_status = 'completed' THEN id ELSE 0 END DESC,
          id ASC
        LIMIT 1
      `)
      .get(taskId) as Pick<SubtaskRow, 'taskType' | 'executionStatus'> | undefined;

    return row ? this.getSubtaskProgress(taskId, row.taskType, row.executionStatus) : null;
  }

  private getSubtaskProgress(
    taskId: number,
    taskType: AdminSubtaskType,
    executionStatus: AdminSubtaskExecutionStatus,
  ): AdminTaskProgress | null {
    switch (taskType) {
      case 'fetch_states': {
        const stateCount = scalar(this.database, 'SELECT COUNT(*) AS count FROM states WHERE anytime_url IS NOT NULL');
        return createProgress(
          taskType,
          executionStatus === 'completed' ? stateCount : 0,
          executionStatus === 'completed' && stateCount > 0 ? stateCount : null,
          stateCount > 0 ? `Updated ${stateCount} states` : 'Fetching state list',
        );
      }
      case 'fetch_names': {
        const stateCount = scalar(this.database, 'SELECT COUNT(*) AS count FROM states WHERE anytime_url IS NOT NULL');
        const locationTotal = scalar(this.database, 'SELECT COALESCE(SUM(location_count), 0) AS count FROM states');
        return createProgress(
          taskType,
          executionStatus === 'completed' ? locationTotal : 0,
          executionStatus === 'completed' && locationTotal > 0 ? locationTotal : null,
          executionStatus === 'completed'
            ? `Discovered ${locationTotal} address entries`
            : `Reading ${stateCount || 'unknown'} state pages`,
        );
      }
      case 'fetch_addresses': {
        const isTargetedAddressTask = !this.hasSubtask(taskId, 'fetch_names');
        const current = isTargetedAddressTask
          ? scalar(
              this.database,
              `
                SELECT COUNT(*) AS count
                FROM crawl_discovered_addresses
                WHERE task_id = ?
                  AND (myear_url IS NOT NULL OR crawl_status = 'skipped')
              `,
              [taskId],
            )
          : scalar(this.database, 'SELECT COUNT(*) AS count FROM crawl_discovered_addresses WHERE task_id = ?', [taskId]);
        const totalFromStates = isTargetedAddressTask
          ? 0
          : scalar(this.database, 'SELECT COALESCE(SUM(location_count), 0) AS count FROM states');
        const stageTotal = scalar(this.database, 'SELECT COUNT(*) AS count FROM crawl_discovered_addresses WHERE task_id = ?', [taskId]);
        const total = Math.max(current, totalFromStates, stageTotal);
        return createProgress(taskType, current, total > 0 ? total : null, `Fetched ${current} address details`);
      }
      case 'fetch_mailbox_numbers': {
        const total = scalar(
          this.database,
          'SELECT COUNT(*) AS count FROM crawl_discovered_addresses WHERE task_id = ? AND myear_url IS NOT NULL',
          [taskId],
        );
        const current = scalar(
          this.database,
          `
            SELECT COUNT(*) AS count
            FROM crawl_discovered_addresses
            WHERE task_id = ?
              AND myear_url IS NOT NULL
              AND crawl_status IN ('mailbox_fetched', 'smarty_reused', 'smarty_pending', 'smarty_failed', 'imported')
          `,
          [taskId],
        );
        return createProgress(taskType, current, total > 0 ? total : null, `Fetched ${current} mailbox ranges`);
      }
      case 'sync_smarty': {
        const total = scalar(
          this.database,
          `
            SELECT COUNT(*) AS count
            FROM crawl_discovered_addresses stage
            WHERE ${smartyCandidateWhereSql}
          `,
          [taskId],
        );
        const current = scalar(
          this.database,
          `
            SELECT COUNT(*) AS count
            FROM crawl_discovered_addresses stage
            WHERE ${smartyCandidateWhereSql}
              AND (
                stage.crawl_status = 'smarty_failed'
                OR (
                  stage.rdi IN ('Residential', 'Commercial')
                  AND stage.cmra IN ('Yes', 'No')
                  AND stage.smarty_checked_at IS NOT NULL
                  AND stage.smarty_source_address_id IS NULL
                )
              )
          `,
          [taskId],
        );
        const pending = scalar(
          this.database,
          "SELECT COUNT(*) AS count FROM crawl_discovered_addresses WHERE task_id = ? AND crawl_status = 'smarty_pending'",
          [taskId],
        );
        const suffix = pending > 0 ? `, pending Smarty ${pending}` : '';
        return createProgress(taskType, current, total > 0 ? total : null, `Synced ${current} Smarty results${suffix}`);
      }
      default:
        return null;
    }
  }

  private updateSubtask(taskId: number, taskType: AdminSubtaskType, input: {
    executionStatus: AdminSubtaskExecutionStatus;
    resultStatus: AdminSubtaskResultStatus | null;
    errorMessage: string | null;
  }) {
    const now = new Date().toISOString();

    this.database.sqlite
      .prepare(`
        UPDATE crawl_subtasks
        SET
          execution_status = @executionStatus,
          result_status = @resultStatus,
          error_message = @errorMessage,
          updated_at = @updatedAt
        WHERE task_id = @taskId AND task_type = @taskType
      `)
      .run({
        taskId,
        taskType,
        executionStatus: input.executionStatus,
        resultStatus: input.resultStatus,
        errorMessage: input.errorMessage,
        updatedAt: now,
      });
    this.recalculateTaskCounts(taskId);
  }

  private updateTaskStatus(taskId: number, status: AdminTaskStatus, updatedAt = new Date().toISOString()) {
    this.database.sqlite
      .prepare('UPDATE crawl_tasks SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, updatedAt, taskId);
  }
}

function toTaskItem(row: TaskRow, progress: AdminTaskProgress | null): AdminTaskListItem {
  return {
    id: row.id,
    batchCode: row.batchCode,
    generatedAt: row.generatedAt,
    createdType: row.createdType,
    status: row.status,
    note: row.note,
    createdBy: row.createdBy,
    pendingCount: row.pendingCount,
    successCount: row.successCount,
    failedCount: row.failedCount,
    totalCount: row.totalCount,
    progress,
    updatedAt: row.updatedAt,
  };
}

function toSubtaskItem(row: SubtaskRow, progress: AdminTaskProgress | null): AdminSubtaskListItem {
  return {
    id: row.id,
    taskType: row.taskType,
    createdAt: row.createdAt,
    executionStatus: row.executionStatus,
    resultStatus: row.resultStatus,
    errorMessage: row.errorMessage,
    progress,
    updatedAt: row.updatedAt,
  };
}

function createBatchCode(now: string) {
  const date = new Date(now);
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');

  return `TASK-${stamp}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function sourceIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').filter(Boolean).pop() ?? parsed.pathname;
  } catch {
    return url;
  }
}

function createProgress(
  taskType: AdminSubtaskType,
  currentInput: number,
  totalInput: number | null,
  message: string,
): AdminTaskProgress {
  const current = Math.max(0, currentInput);
  const total = totalInput && totalInput > 0 ? Math.max(current, totalInput) : null;

  return {
    taskType,
    current,
    total,
    percent: total ? Math.min(100, Math.round((current / total) * 100)) : null,
    message,
  };
}

function scalar(database: DatabaseContext, sql: string, params?: unknown[] | Record<string, unknown>) {
  const statement = database.sqlite.prepare(sql);
  const row = Array.isArray(params)
    ? statement.get(...params)
    : params
      ? statement.get(params)
      : statement.get() as Record<string, number> | undefined;

  if (!row) {
    return 0;
  }

  return Number(Object.values(row)[0] ?? 0);
}
