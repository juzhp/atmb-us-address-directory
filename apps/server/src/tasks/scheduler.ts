import cron, { type ScheduledTask } from 'node-cron';
import { ADDRESS_SOURCES, PLATFORMS, type UpdateFrequencyDays, type UpdateMinute } from '@atmb/shared';

import type { SettingsService } from '../settings/service.js';
import type { TaskService } from './service.js';

export interface UpdateScheduleLike {
  autoUpdateEnabled: boolean;
  updateFrequencyDays: UpdateFrequencyDays | null;
  updateHour: number;
  updateMinute: UpdateMinute;
}

export interface TaskExecutorLike {
  enqueue(taskId: number): void | Promise<void>;
  requestStop?(taskId: number): void;
}

export class TaskScheduler {
  private scheduledTask: ScheduledTask | null = null;
  private ticking = false;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly taskService: TaskService,
    private readonly executor: TaskExecutorLike,
  ) {}

  start() {
    if (this.scheduledTask) {
      return;
    }

    this.scheduledTask = cron.schedule('*/30 * * * *', () => {
      void this.tick();
    });
  }

  stop() {
    this.scheduledTask?.stop();
    this.scheduledTask = null;
  }

  async tick(now = new Date()) {
    if (this.ticking || this.taskService.hasRunningTask()) {
      return null;
    }

    const settings = this.settingsService.getUpdateSchedule();
    const lastSystemTaskAt = this.taskService.getLastSystemTaskGeneratedAt();

    if (!shouldCreateSystemTask(
      settings,
      lastSystemTaskAt ? new Date(lastSystemTaskAt) : null,
      now,
    )) {
      return null;
    }

    this.ticking = true;
    try {
      // 每个平台各建一个系统任务，执行器按入队顺序依次运行
      const tasks = [];
      for (const platform of ADDRESS_SOURCES) {
        const task = this.taskService.createSystemTask({
          createdBy: '系统自动',
          note: platform === 'anytimemailbox' ? '系统自动更新任务' : `系统自动更新任务（${PLATFORMS[platform].label}）`,
          platform,
        });
        await this.executor.enqueue(task.id);
        tasks.push(task);
      }

      return tasks[0] ?? null;
    } finally {
      this.ticking = false;
    }
  }
}

export function shouldCreateSystemTask(
  settings: UpdateScheduleLike,
  lastSystemTaskAt: Date | null,
  now: Date,
) {
  if (!settings.autoUpdateEnabled || !settings.updateFrequencyDays) {
    return false;
  }

  const todayScheduledAt = scheduledUtcForDate(now, settings.updateHour, settings.updateMinute);
  if (!lastSystemTaskAt) {
    return now >= todayScheduledAt;
  }

  const nextDueAt = nextDueAfter(
    lastSystemTaskAt,
    settings.updateFrequencyDays,
    settings.updateHour,
    settings.updateMinute,
  );

  return now >= nextDueAt;
}

function nextDueAfter(lastRunAt: Date, frequencyDays: number, hour: number, minute: number) {
  const next = scheduledUtcForDate(lastRunAt, hour, minute);

  while (next <= lastRunAt) {
    next.setUTCDate(next.getUTCDate() + frequencyDays);
  }

  return next;
}

function scheduledUtcForDate(date: Date, hour: number, minute: number) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute,
    0,
    0,
  ));
}
