'use client';

import type {
  AddressSource,
  AdminIpostal1ImportPreviewResponse,
  AdminIpostal1ImportResponse,
  AdminSubtaskListItem,
  AdminSubtaskType,
  AdminTaskProgress,
  AdminTaskCreatedType,
  AdminTaskListItem,
  AdminTaskListResponse,
  AdminTaskStats,
  AdminTaskStatus,
  AdminTaskSubtasksResponse,
} from '@atmb/shared';
import { ADDRESS_SOURCES, PLATFORMS } from '@atmb/shared';
import { AlertCircle, Clock3, Eye, PauseCircle, PlayCircle, RefreshCw, Search, Square, Trash2, Upload } from 'lucide-react';
import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { PUBLIC_API_BASE_URL } from '../../lib/api';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { AdminToastStack, useAdminToasts } from './AdminToast';

interface Filters {
  keyword: string;
  generatedDate: string;
  createdType: '' | AdminTaskCreatedType;
  status: '' | AdminTaskStatus;
}

const initialFilters: Filters = {
  keyword: '',
  generatedDate: '',
  createdType: '',
  status: '',
};

const emptyStats: AdminTaskStats = {
  totalTasks: 0,
  runningTasks: 0,
  completedTasks: 0,
  failedSubtasks: 0,
};

const taskTypeCopy: Record<AdminSubtaskType, string> = {
  fetch_states: '获取州',
  fetch_names: '获取名称',
  fetch_addresses: '获取地址',
  fetch_mailbox_numbers: '获取编号',
  sync_smarty: '同步 Smarty',
};

const activeTaskStatuses: AdminTaskStatus[] = ['running', 'pause_requested', 'paused', 'stop_requested'];

export function TaskManagement() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminTaskListResponse | null>(null);
  const [stats, setStats] = useState<AdminTaskStats>(emptyStats);
  const [selectedTask, setSelectedTask] = useState<AdminTaskListItem | null>(null);
  const [subtaskPage, setSubtaskPage] = useState(1);
  const [subtasks, setSubtasks] = useState<AdminTaskSubtasksResponse | null>(null);
  const [createPlatform, setCreatePlatform] = useState<AddressSource>('anytimemailbox');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [taskPendingDeletion, setTaskPendingDeletion] = useState<AdminTaskListItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const importInputRef = useRef<HTMLInputElement>(null);
  // null = 空闲；0–99 上传中；100 = 上传完成、服务端解析中
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importPreview, setImportPreview] = useState<AdminIpostal1ImportPreviewResponse | null>(null);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const { toasts, showToast, dismissToast } = useAdminToasts();

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '20');
    if (appliedFilters.keyword) params.set('keyword', appliedFilters.keyword);
    if (appliedFilters.generatedDate) params.set('generatedDate', appliedFilters.generatedDate);
    if (appliedFilters.createdType) params.set('createdType', appliedFilters.createdType);
    if (appliedFilters.status) params.set('status', appliedFilters.status);
    return params.toString();
  }, [appliedFilters, page]);
  const hasRunningTaskInView = useMemo(
    () => Boolean(
      list?.items.some((task) => activeTaskStatuses.includes(task.status))
      || (selectedTask ? activeTaskStatuses.includes(selectedTask.status) : false),
    ),
    [list?.items, selectedTask?.status],
  );

  async function loadData() {
    const [tasksResponse, statsResponse] = await Promise.all([
      fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks?${query}`, { credentials: 'include' }),
      fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks/stats`, { credentials: 'include' }),
    ]);

    if (tasksResponse.ok) {
      setList((await tasksResponse.json()) as AdminTaskListResponse);
    }
    if (statsResponse.ok) {
      setStats((await statsResponse.json()) as AdminTaskStats);
    }
  }

  async function loadSubtasks(taskId: number, nextPage: number) {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks/${taskId}/subtasks?page=${nextPage}&pageSize=20`, {
      credentials: 'include',
    });

    if (response.ok) {
      const body = (await response.json()) as AdminTaskSubtasksResponse;
      setSubtasks(body);
      setSelectedTask(body.task);
    }
  }

  useEffect(() => {
    startTransition(loadData);
  }, [query]);

  useEffect(() => {
    if (!selectedTask) return;
    startTransition(() => loadSubtasks(selectedTask.id, subtaskPage));
  }, [selectedTask?.id, subtaskPage]);

  useEffect(() => {
    if (!hasRunningTaskInView) return;

    const timer = window.setInterval(() => {
      startTransition(async () => {
        await loadData();
        if (selectedTask) {
          await loadSubtasks(selectedTask.id, subtaskPage);
        }
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [hasRunningTaskInView, query, selectedTask?.id, subtaskPage]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function resetSearch() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  }

  // 第一步：上传并解析，只拿统计结果，等人工确认
  async function importIpostal1Export(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportProgress(0);
    try {
      const result = await uploadIpostal1Export(file, setImportProgress);
      const payload = result.body as AdminIpostal1ImportPreviewResponse | { message?: string } | null;

      if (!result.ok || !payload || !('stats' in payload)) {
        showToast((payload as { message?: string } | null)?.message ?? '上传失败，请检查文件后重试。', 'error');
        return;
      }

      setImportPreview(payload);
    } finally {
      setImportProgress(null);
    }
  }

  // 第二步：确认后才创建任务、写入暂存并进入执行队列
  async function confirmIpostal1Import() {
    if (!importPreview) return;

    setIsConfirmingImport(true);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks/ipostal1-import/${importPreview.uploadId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => null)) as AdminIpostal1ImportResponse | { message?: string } | null;

      if (!response.ok || !payload || !('item' in payload)) {
        showToast((payload as { message?: string } | null)?.message ?? '导入失败，请稍后重试。', 'error');
        return;
      }

      setImportPreview(null);
      setPage(1);
      await loadData();
      showToast(`导入任务 ${payload.item.batchCode} 已创建并进入执行队列，待同步 ${payload.stats.staged} 个地址。`, 'success');
    } finally {
      setIsConfirmingImport(false);
    }
  }

  function cancelIpostal1Import() {
    if (!importPreview) return;
    void fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks/ipostal1-import/${importPreview.uploadId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setImportPreview(null);
    showToast('已取消导入，未创建任务。', 'success');
  }

  function createTask() {
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          note: createPlatform === 'anytimemailbox' ? '手动创建任务' : `手动创建任务（${PLATFORMS[createPlatform].label}）`,
          platform: createPlatform,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '创建任务失败，请稍后重试。', 'error');
        return;
      }

      setPage(1);
      await loadData();
      showToast('手动任务已创建，可在任务列表查看执行进度。', 'success');
    });
  }

  function controlTask(task: AdminTaskListItem, action: 'pause' | 'resume' | 'stop') {
    const isRetryingFailedTask = action === 'resume' && task.status === 'completed' && task.failedCount > 0;
    const actionCopy = {
      pause: '暂停',
      resume: isRetryingFailedTask ? '继续失败任务' : '继续',
      stop: '停止',
    }[action];

    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks/${task.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? `${actionCopy}任务失败，请稍后重试。`, 'error');
        return;
      }

      await loadData();
      if (selectedTask?.id === task.id) {
        await loadSubtasks(task.id, subtaskPage);
      }
      showToast(isRetryingFailedTask ? '失败任务已重新进入执行队列。' : `任务已${actionCopy}。`, 'success');
    });
  }

  function deleteTask(task: AdminTaskListItem) {
    startTransition(async () => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/api/admin/tasks/${task.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        showToast(body?.message ?? '删除任务失败，请稍后重试。', 'error');
        return;
      }

      setTaskPendingDeletion(null);
      if (selectedTask?.id === task.id) {
        closeSubtasks();
      }
      if ((list?.items.length ?? 0) <= 1 && page > 1) {
        setPage(page - 1);
      } else {
        await loadData();
      }
      showToast('任务已删除。', 'success');
    });
  }

  function openSubtasks(task: AdminTaskListItem) {
    setSelectedTask(task);
    setSubtaskPage(1);
    setSubtasks(null);
  }

  function closeSubtasks() {
    setSelectedTask(null);
    setSubtasks(null);
    setSubtaskPage(1);
  }

  return (
    <main className="admin-page">
      <AdminToastStack toasts={toasts} onDismiss={dismissToast} />
      <section className="admin-page-heading">
        <div>
          <p className="admin-kicker">任务管理</p>
          <p>查看地址数据更新任务的生成时间、创建方式、执行状态和子任务进度。每个任务可进入弹窗查看获取州、获取名称、获取地址、获取编号和同步 Smarty 的子任务结果。</p>
        </div>
        <div className="admin-page-actions">
          <button disabled={isPending} type="button" onClick={() => startTransition(loadData)}>
            <RefreshCw size={16} aria-hidden="true" />
            刷新任务
          </button>
          <button
            disabled={importProgress !== null}
            type="button"
            title="上传按约定格式抓取的 iPostal1 导出文件，确认统计后创建只含“同步 Smarty”的导入任务"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            {importProgress === null
              ? '导入 iPostal1 离线数据'
              : importProgress < 100
                ? `上传中 ${importProgress}%`
                : '解析中…'}
          </button>
          {importProgress !== null ? (
            <span className="admin-upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={importProgress}>
              <span style={{ width: `${importProgress}%` }} />
            </span>
          ) : null}
          <input ref={importInputRef} accept="application/json,.json" hidden type="file" onChange={(event) => void importIpostal1Export(event)} />
          <label className="admin-inline-field">
            <span>平台</span>
            <select value={createPlatform} onChange={(event) => setCreatePlatform(event.target.value as AddressSource)}>
              {ADDRESS_SOURCES.map((source) => (
                <option key={source} value={source}>{PLATFORMS[source].label}</option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={isPending} type="button" onClick={() => setConfirmCreateOpen(true)}>
            <Clock3 size={16} aria-hidden="true" />
            手动创建任务
          </button>
        </div>
      </section>

      <section className="admin-stats-grid" aria-label="任务统计">
        <Stat label="任务总数" value={stats.totalTasks} />
        <Stat label="执行中" value={stats.runningTasks} />
        <Stat label="执行完毕" value={stats.completedTasks} />
        <Stat label="失败子任务" value={stats.failedSubtasks} />
      </section>

      <form className="admin-filter-panel task-filter-panel" onSubmit={submitSearch}>
        <div className="admin-filter-title">筛选任务</div>
        <label className="wide">
          <span>关键词</span>
          <div className="admin-input-with-icon">
            <Search size={16} aria-hidden="true" />
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="任务编号、备注、创建人"
            />
          </div>
        </label>
        <label>
          <span>生成时间</span>
          <input
            type="date"
            value={filters.generatedDate}
            onChange={(event) => setFilters((current) => ({ ...current, generatedDate: event.target.value }))}
          />
        </label>
        <label>
          <span>任务创建</span>
          <select
            value={filters.createdType}
            onChange={(event) => setFilters((current) => ({ ...current, createdType: event.target.value as Filters['createdType'] }))}
          >
            <option value="">全部</option>
            <option value="manual">手动创建</option>
            <option value="system">系统自动</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as Filters['status'] }))}
          >
            <option value="">全部</option>
            <option value="running">执行中</option>
            <option value="pause_requested">暂停中</option>
            <option value="paused">已暂停</option>
            <option value="stop_requested">停止中</option>
            <option value="stopped">已停止</option>
            <option value="completed">执行完毕</option>
          </select>
        </label>
        <div className="admin-filter-actions">
          <button className="primary" type="submit">搜索</button>
          <button type="button" onClick={resetSearch}>重置</button>
        </div>
      </form>

      <section className="admin-table-card">
        <div className="admin-table-head">
          <strong>任务列表</strong>
          <span>{isPending ? '加载中' : `共 ${list?.total ?? 0} 个任务批次`}</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-address-table admin-task-table">
            <thead>
              <tr>
                <th>任务批次</th>
                <th>任务生成时间</th>
                <th>任务创建</th>
                <th>平台</th>
                <th>状态</th>
                <th>子任务</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {(list?.items ?? []).map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.batchCode}</strong>
                    {task.note ? <span className="task-note">{task.note}</span> : null}
                  </td>
                  <td>{formatDateTime(task.generatedAt)}</td>
                  <td>
                    <Badge tone={task.createdType === 'manual' ? 'blue' : 'green'}>
                      {createdTypeLabel(task.createdType)}
                    </Badge>
                    <span className="task-created-by">{task.createdBy}</span>
                  </td>
                  <td>
                    <Badge tone={task.platform === 'ipostal1' ? 'blue' : 'green'}>{PLATFORMS[task.platform]?.label ?? task.platform}</Badge>
                  </td>
                  <td>
                    <Badge tone={taskStatusTone(task.status)}>
                      {taskStatusLabel(task.status)}
                    </Badge>
                  </td>
                  <td>
                    <TaskCountGroup task={task} />
                  </td>
                  <td>
                    <TaskActions
                      task={task}
                      disabled={isPending}
                      onOpen={() => openSubtasks(task)}
                      onControl={(action) => controlTask(task, action)}
                      onDelete={() => setTaskPendingDeletion(task)}
                    />
                  </td>
                </tr>
              ))}
              {list && list.items.length === 0 ? (
                <tr>
                  <td className="admin-empty-cell" colSpan={7}>暂无符合条件的任务</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination
          page={list?.page ?? page}
          totalPages={list?.totalPages ?? 1}
          total={list?.total ?? 0}
          label="任务批次"
          onPageChange={setPage}
        />
      </section>

      {selectedTask ? (
        <SubtasksDialog
          response={subtasks}
          fallbackTask={selectedTask}
          page={subtaskPage}
          onClose={closeSubtasks}
          onPageChange={setSubtaskPage}
        />
      ) : null}
      {importPreview ? (
        <AdminConfirmDialog
          title="确认导入 iPostal1 离线数据？"
          description={<Ipostal1ImportSummary preview={importPreview} />}
          content={<Ipostal1ImportDetails details={importPreview.details} />}
          size="wide"
          confirmText="创建导入任务"
          isPending={isConfirmingImport}
          onCancel={cancelIpostal1Import}
          onConfirm={() => void confirmIpostal1Import()}
        />
      ) : null}
      {confirmCreateOpen ? (
        <AdminConfirmDialog
          title={`确认创建 ${PLATFORMS[createPlatform].label} 手动任务？`}
          description={createPlatform === 'ipostal1'
            ? '系统会创建 iPostal1 抓取任务：从 iPostal1 各州接口获取地址（跳过 ATMB 已收录的地址），然后同步 Smarty 数据。'
            : '系统会创建一批新的抓取任务，并开始获取州、名称、地址、邮箱编号和 Smarty 数据。'}
          confirmText="创建任务"
          isPending={isPending}
          onCancel={() => setConfirmCreateOpen(false)}
          onConfirm={() => {
            setConfirmCreateOpen(false);
            createTask();
          }}
        />
      ) : null}
      {taskPendingDeletion ? (
        <AdminConfirmDialog
          title="确认删除任务？"
          description={`将删除任务 ${taskPendingDeletion.batchCode} 及其子任务和暂存抓取数据，此操作不可恢复。`}
          confirmText="删除任务"
          tone="danger"
          isPending={isPending}
          onCancel={() => setTaskPendingDeletion(null)}
          onConfirm={() => deleteTask(taskPendingDeletion)}
        />
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat-card">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function TaskActions({
  task,
  disabled,
  onOpen,
  onControl,
  onDelete,
}: {
  task: AdminTaskListItem;
  disabled: boolean;
  onOpen: () => void;
  onControl: (action: 'pause' | 'resume' | 'stop') => void;
  onDelete: () => void;
}) {
  const canRetryFailedTask = task.status === 'completed' && task.failedCount > 0;
  const canDeleteTask = task.status === 'completed' || task.status === 'stopped';

  return (
    <div className="task-actions">
      <button className="text-action" type="button" onClick={onOpen}>
        <Eye size={15} aria-hidden="true" />
        查看子任务
      </button>
      {task.status === 'running' ? (
        <button className="text-action muted" disabled={disabled} type="button" onClick={() => onControl('pause')}>
          <PauseCircle size={15} aria-hidden="true" />
          暂停
        </button>
      ) : null}
      {task.status === 'paused' ? (
        <button className="text-action muted" disabled={disabled} type="button" onClick={() => onControl('resume')}>
          <PlayCircle size={15} aria-hidden="true" />
          继续
        </button>
      ) : null}
      {canRetryFailedTask ? (
        <button className="text-action muted" disabled={disabled} type="button" onClick={() => onControl('resume')}>
          <PlayCircle size={15} aria-hidden="true" />
          继续失败任务
        </button>
      ) : null}
      {task.status === 'running' || task.status === 'pause_requested' || task.status === 'paused' ? (
        <button className="text-action danger" disabled={disabled} type="button" onClick={() => onControl('stop')}>
          <Square size={15} aria-hidden="true" />
          停止
        </button>
      ) : null}
      {canDeleteTask ? (
        <button className="text-action danger" disabled={disabled} type="button" onClick={onDelete}>
          <Trash2 size={15} aria-hidden="true" />
          删除
        </button>
      ) : null}
    </div>
  );
}

function TaskCountGroup({ task }: { task: AdminTaskListItem }) {
  return (
    <div className="task-count-stack">
      <div className="task-count-grid">
        <CountPill label="待执行" value={task.pendingCount} tone="pending" />
        <CountPill label="成功" value={task.successCount} tone="success" />
        <CountPill label="失败" value={task.failedCount} tone="fail" />
        <CountPill label="总数" value={task.totalCount} tone="total" />
      </div>
      {task.progress ? <TaskProgress progress={task.progress} compact /> : null}
    </div>
  );
}

function CountPill({ label, value, tone }: { label: string; value: number; tone: 'pending' | 'success' | 'fail' | 'total' }) {
  return (
    <span className={`task-count-pill ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function SubtasksDialog({
  response,
  fallbackTask,
  page,
  onClose,
  onPageChange,
}: {
  response: AdminTaskSubtasksResponse | null;
  fallbackTask: AdminTaskListItem;
  page: number;
  onClose: () => void;
  onPageChange: (page: number) => void;
}) {
  const task = response?.task ?? fallbackTask;

  return (
    <div className="admin-modal-backdrop">
      <section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="subtasks-title">
        <div className="admin-dialog-heading">
          <div>
            <h2 id="subtasks-title">查看子任务</h2>
            <span>{task.batchCode} · {task.note ?? '任务明细'}</span>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </div>

        <div className="task-dialog-summary">
          <SummaryItem label="任务生成时间" value={formatDateTime(task.generatedAt)} />
          <SummaryItem label="创建方式" value={createdTypeLabel(task.createdType)} />
          <SummaryItem label="平台" value={PLATFORMS[task.platform]?.label ?? task.platform} />
          <SummaryItem label="待执行数" value={String(task.pendingCount)} />
          <SummaryItem label="成功数" value={String(task.successCount)} />
          <SummaryItem label="失败数" value={String(task.failedCount)} />
          <SummaryItem label="总数" value={String(task.totalCount)} />
        </div>

        <div className="admin-table-wrap">
          <table className="admin-address-table task-subtask-table">
            <thead>
              <tr>
                <th>任务类型</th>
                <th>进度</th>
                <th>创建时间</th>
                <th>执行状态</th>
                <th>任务状态</th>
              </tr>
            </thead>
            <tbody>
              {(response?.items ?? []).map((subtask) => (
                <tr key={subtask.id}>
                  <td>{taskTypeCopy[subtask.taskType]}</td>
                  <td>
                    <TaskProgress progress={subtask.progress} />
                  </td>
                  <td>{formatDateTime(subtask.createdAt)}</td>
                  <td>
                    <Badge tone={executionTone(subtask.executionStatus)}>
                      {executionStatusLabel(subtask.executionStatus)}
                    </Badge>
                  </td>
                  <td>
                    <SubtaskResult item={subtask} />
                  </td>
                </tr>
              ))}
              {response && response.items.length === 0 ? (
                <tr>
                  <td className="admin-empty-cell" colSpan={5}>暂无子任务</td>
                </tr>
              ) : null}
              {!response ? (
                <tr>
                  <td className="admin-empty-cell" colSpan={5}>正在加载子任务</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <Pagination
          page={response?.page ?? page}
          totalPages={response?.totalPages ?? 1}
          total={response?.total ?? 0}
          label="子任务"
          onPageChange={onPageChange}
        />
      </section>
    </div>
  );
}

// fetch 拿不到上传进度，用 XMLHttpRequest 以便显示百分比
function uploadIpostal1Export(file: File, onProgress: (percent: number) => void) {
  return new Promise<{ ok: boolean; body: unknown }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${PUBLIC_API_BASE_URL}/api/admin/tasks/ipostal1-import`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.upload.onload = () => onProgress(100);
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, body });
    };
    xhr.onerror = () => resolve({ ok: false, body: null });

    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

const IMPORT_WARNINGS_PREVIEW_LIMIT = 8;

function Ipostal1ImportSummary({ preview }: { preview: AdminIpostal1ImportPreviewResponse }) {
  const { stats } = preview;
  const shownWarnings = stats.warnings.slice(0, IMPORT_WARNINGS_PREVIEW_LIMIT);

  return (
    <span className="admin-import-summary">
      {preview.fetchedAt ? <span>抓取时间：{preview.fetchedAt}</span> : null}
      <span>成功解析的州：<strong>{stats.states}</strong></span>
      <span>解析到的地点：<strong>{stats.parsed}</strong></span>
      <span>跳过 ATMB 已收录：<strong>{stats.skippedAtmb}</strong></span>
      <span>跳过已存在的 iPostal1：<strong>{stats.skippedExisting}</strong></span>
      <span>将写入待同步：<strong>{stats.staged}</strong></span>
      {stats.warnings.length > 0 ? (
        <span className="admin-import-warnings">
          告警 {stats.warnings.length} 条：
          {shownWarnings.map((warning) => <span key={warning}>{warning}</span>)}
          {stats.warnings.length > shownWarnings.length ? <span>…其余 {stats.warnings.length - shownWarnings.length} 条见浏览器控制台</span> : null}
        </span>
      ) : null}
      <span>确认后会创建 iPostal1 任务并进入执行队列，开始同步 Smarty（消耗额度）；取消则不保留任何数据。</span>
    </span>
  );
}

const IMPORT_DETAILS_PAGE_SIZE = 50;

// 临时核对用：分页列出“判定为 ATMB 重复而跳过”的对照和“将写入待同步”的地址，避免几千行一次渲染卡住页面
type ImportDetailsView = 'duplicates' | 'existing' | 'staged';

function Ipostal1ImportDetails({ details }: { details: AdminIpostal1ImportPreviewResponse['details'] }) {
  const [view, setView] = useState<ImportDetailsView>(details.duplicates.length > 0 ? 'duplicates' : 'staged');
  const [page, setPage] = useState(1);
  const rows = view === 'duplicates' ? details.duplicates : view === 'existing' ? details.existing : details.staged;
  const totalPages = Math.max(1, Math.ceil(rows.length / IMPORT_DETAILS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * IMPORT_DETAILS_PAGE_SIZE;
  const pageRows = rows.slice(start, start + IMPORT_DETAILS_PAGE_SIZE);

  function switchView(next: ImportDetailsView) {
    setView(next);
    setPage(1);
  }

  return (
    <div className="admin-import-details">
      <div className="admin-import-details-tabs">
        <button className={view === 'duplicates' ? 'active' : undefined} type="button" onClick={() => switchView('duplicates')}>
          跳过（ATMB 已收录）{details.duplicates.length}
        </button>
        <button className={view === 'existing' ? 'active' : undefined} type="button" onClick={() => switchView('existing')}>
          跳过（iPostal1 已存在）{details.existing.length}
        </button>
        <button className={view === 'staged' ? 'active' : undefined} type="button" onClick={() => switchView('staged')}>
          将写入待同步 {details.staged.length}
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-address-table">
          <thead>
            <tr>
              <th>#</th>
              <th>iPostal1 地址</th>
              {view === 'duplicates' ? <th>匹配到的 ATMB 地址</th> : null}
            </tr>
          </thead>
          <tbody>
            {view === 'duplicates'
              ? (pageRows as AdminIpostal1ImportPreviewResponse['details']['duplicates']).map((row, index) => (
                <tr key={row.ipostal1.storeId}>
                  <td>{start + index + 1}</td>
                  <td>
                    <a className="address-table-link" href={row.ipostal1.detailUrl} rel="noreferrer" target="_blank">
                      {row.ipostal1.streetAddress}
                      <br />
                      {row.ipostal1.city}, {row.ipostal1.state} {row.ipostal1.postalCode}
                    </a>
                  </td>
                  <td>
                    <a className="address-table-link" href={row.atmb.anytimeUrl} rel="noreferrer" target="_blank">
                      {row.atmb.name}
                      <br />
                      {row.atmb.streetAddress}
                      <br />
                      {row.atmb.city}, {row.atmb.state} {row.atmb.postalCode}
                    </a>
                  </td>
                </tr>
              ))
              : (pageRows as AdminIpostal1ImportPreviewResponse['details']['staged']).map((row, index) => (
                <tr key={row.storeId}>
                  <td>{start + index + 1}</td>
                  <td>
                    <a className="address-table-link" href={row.detailUrl} rel="noreferrer" target="_blank">
                      {row.name}
                      <br />
                      {row.streetAddress}
                      <br />
                      {row.city}, {row.state} {row.postalCode}
                    </a>
                  </td>
                </tr>
              ))}
            {rows.length === 0 ? (
              <tr>
                <td className="admin-empty-cell" colSpan={view === 'duplicates' ? 3 : 2}>没有记录</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <span>共 {rows.length} 条，第 {currentPage} / {totalPages} 页</span>
        <div>
          <button disabled={currentPage <= 1} type="button" onClick={() => setPage(currentPage - 1)}>上一页</button>
          <button disabled={currentPage >= totalPages} type="button" onClick={() => setPage(currentPage + 1)}>下一页</button>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TaskProgress({ progress, compact = false }: { progress: AdminTaskProgress | null; compact?: boolean }) {
  if (!progress) {
    return <span className="task-progress-empty">等待执行</span>;
  }

  const progressText = progress.total
    ? `${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}`
    : progress.current.toLocaleString();

  return (
    <div className={`task-progress ${compact ? 'compact' : ''}`}>
      <div className="task-progress-meta">
        <span>{taskTypeCopy[progress.taskType]}：{progress.message}</span>
        <strong>{progress.percent !== null ? `${progress.percent}%` : progressText}</strong>
      </div>
      {progress.percent !== null ? (
        <div className="task-progress-track" aria-hidden="true">
          <span style={{ width: `${progress.percent}%` }} />
        </div>
      ) : null}
      {progress.percent !== null && !compact ? <em>{progressText}</em> : null}
    </div>
  );
}

function SubtaskResult({ item }: { item: AdminSubtaskListItem }) {
  if (!item.resultStatus) {
    return <Badge tone="amber">待产出</Badge>;
  }

  if (item.resultStatus === 'success') {
    return <Badge tone="green">成功</Badge>;
  }

  if (item.resultStatus === 'stopped') {
    return <Badge tone="blue">已停止</Badge>;
  }

  return (
    <span className="task-error-wrap">
      <Badge tone="red">失败</Badge>
      <span className="task-error-trigger" tabIndex={0}>
        <AlertCircle size={16} aria-hidden="true" />
        <span className="task-error-tooltip">
          <strong>失败信息</strong>
          {item.errorMessage ?? '暂无失败信息'}
        </span>
      </span>
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  label,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="admin-pagination">
      <span>第 {page} 页，共 {total} 个{label}；每页 20 条</span>
      <div>
        <button disabled={page <= 1} type="button" onClick={() => onPageChange(Math.max(1, page - 1))}>上一页</button>
        <button className="page-number" disabled type="button">{page} / {totalPages}</button>
        <button disabled={page >= totalPages} type="button" onClick={() => onPageChange(page + 1)}>下一页</button>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: 'green' | 'amber' | 'blue' | 'red' }) {
  return <span className={`admin-badge ${tone}`}>{children}</span>;
}

function createdTypeLabel(type: AdminTaskCreatedType) {
  return type === 'manual' ? '手动创建' : '系统自动';
}

function taskStatusLabel(status: AdminTaskStatus) {
  switch (status) {
    case 'running':
      return '执行中';
    case 'pause_requested':
      return '暂停中';
    case 'paused':
      return '已暂停';
    case 'stop_requested':
      return '停止中';
    case 'stopped':
      return '已停止';
    case 'completed':
      return '执行完毕';
    default:
      return status;
  }
}

function taskStatusTone(status: AdminTaskStatus): 'green' | 'amber' | 'blue' | 'red' {
  if (status === 'completed') return 'green';
  if (status === 'stopped' || status === 'paused') return 'blue';
  if (status === 'stop_requested') return 'red';
  return 'amber';
}

function executionStatusLabel(status: AdminSubtaskListItem['executionStatus']) {
  if (status === 'pending') return '待执行';
  if (status === 'running') return '执行中';
  if (status === 'paused') return '已暂停';
  return '执行完毕';
}

function executionTone(status: AdminSubtaskListItem['executionStatus']): 'green' | 'amber' | 'blue' | 'red' {
  if (status === 'completed') return 'green';
  if (status === 'running') return 'amber';
  if (status === 'paused') return 'blue';
  return 'blue';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
