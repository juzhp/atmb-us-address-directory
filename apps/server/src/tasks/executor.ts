import PQueue from 'p-queue';

import type { CrawlPipeline } from '../crawl/pipeline.js';

export class QueuedTaskExecutor {
  private readonly queue = new PQueue({ concurrency: 1 });
  private readonly controllers = new Map<number, AbortController>();

  constructor(private readonly pipeline: CrawlPipeline) {}

  enqueue(taskId: number) {
    const promise = this.queue.add(async () => {
      const controller = new AbortController();
      this.controllers.set(taskId, controller);

      try {
        await this.pipeline.runTask(taskId, { signal: controller.signal });
      } finally {
        this.controllers.delete(taskId);
      }
    });

    promise.catch((error) => {
      console.error(`Task ${taskId} failed`, error);
    });

    return promise;
  }

  requestStop(taskId: number) {
    this.controllers.get(taskId)?.abort();
  }
}
