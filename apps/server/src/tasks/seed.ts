import type { DatabaseContext } from '@atmb/db';
import type {
  AdminSubtaskExecutionStatus,
  AdminSubtaskResultStatus,
  AdminSubtaskType,
  AdminTaskCreatedType,
  AdminTaskStatus,
} from '@atmb/shared';

interface SeedTask {
  batchCode: string;
  generatedAt: string;
  createdType: AdminTaskCreatedType;
  status: AdminTaskStatus;
  note: string;
  createdBy: string;
  subtasks: Array<{
    taskType: AdminSubtaskType;
    executionStatus: AdminSubtaskExecutionStatus;
    resultStatus: AdminSubtaskResultStatus | null;
    errorMessage?: string | null;
  }>;
}

const seedTasks: SeedTask[] = [
  {
    batchCode: 'TASK-202606060830-AUTO01',
    generatedAt: '2026-06-06T08:30:00.000Z',
    createdType: 'system',
    status: 'completed',
    note: '系统自动更新任务',
    createdBy: '系统自动',
    subtasks: [
      { taskType: 'fetch_states', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_names', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_addresses', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_mailbox_numbers', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'sync_smarty', executionStatus: 'completed', resultStatus: 'success' },
    ],
  },
  {
    batchCode: 'TASK-202606050830-FAIL01',
    generatedAt: '2026-06-05T08:30:00.000Z',
    createdType: 'system',
    status: 'completed',
    note: '自动监控编号失败',
    createdBy: '系统自动',
    subtasks: [
      { taskType: 'fetch_states', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_names', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_addresses', executionStatus: 'completed', resultStatus: 'success' },
      {
        taskType: 'fetch_mailbox_numbers',
        executionStatus: 'completed',
        resultStatus: 'failed',
        errorMessage: '#f_boxid 未返回可用 option，可能是 Signup 页面限流或该地址暂时不可租用。',
      },
      { taskType: 'sync_smarty', executionStatus: 'completed', resultStatus: 'success' },
    ],
  },
  {
    batchCode: 'TASK-202606041430-MAN01',
    generatedAt: '2026-06-04T14:30:00.000Z',
    createdType: 'manual',
    status: 'completed',
    note: '管理员手动创建任务',
    createdBy: '管理员',
    subtasks: [
      { taskType: 'fetch_states', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_names', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_addresses', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'fetch_mailbox_numbers', executionStatus: 'completed', resultStatus: 'success' },
      { taskType: 'sync_smarty', executionStatus: 'completed', resultStatus: 'success' },
    ],
  },
];

export function seedDevelopmentTasks(database: DatabaseContext) {
  const row = database.sqlite.prepare('SELECT COUNT(*) AS count FROM crawl_tasks').get() as { count: number };

  if (row.count > 0) {
    return;
  }

  const insertTask = database.sqlite.prepare(`
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
      @generatedAt,
      @createdType,
      @status,
      @note,
      @createdBy,
      @pendingCount,
      @successCount,
      @failedCount,
      @totalCount,
      @generatedAt,
      @generatedAt
    )
  `);
  const insertSubtask = database.sqlite.prepare(`
    INSERT INTO crawl_subtasks (
      task_id,
      task_type,
      execution_status,
      result_status,
      error_message,
      created_at,
      updated_at
    )
    VALUES (
      @taskId,
      @taskType,
      @executionStatus,
      @resultStatus,
      @errorMessage,
      @generatedAt,
      @generatedAt
    )
  `);
  const seed = database.sqlite.transaction(() => {
    for (const task of seedTasks) {
      const pendingCount = task.subtasks.filter((subtask) => subtask.executionStatus === 'pending').length;
      const successCount = task.subtasks.filter((subtask) => subtask.resultStatus === 'success').length;
      const failedCount = task.subtasks.filter((subtask) => subtask.resultStatus === 'failed').length;
      const result = insertTask.run({
        ...task,
        pendingCount,
        successCount,
        failedCount,
        totalCount: task.subtasks.length,
      });
      const taskId = Number(result.lastInsertRowid);

      for (const subtask of task.subtasks) {
        insertSubtask.run({
          taskId,
          taskType: subtask.taskType,
          executionStatus: subtask.executionStatus,
          resultStatus: subtask.resultStatus,
          errorMessage: subtask.errorMessage ?? null,
          generatedAt: task.generatedAt,
        });
      }
    }
  });

  seed();
}
