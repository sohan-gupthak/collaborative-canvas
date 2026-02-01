import { PERFORMANCE } from './config/constants.js';

export interface BatchedEvent {
  event: string;
  data: any;
  excludeSocket?: string;
}

export class EventBatcher {
  private readonly queue: BatchedEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchInterval: number;
  private readonly maxBatchSize: number;

  constructor(
    batchInterval: number = PERFORMANCE.BATCH_INTERVAL_MS,
    maxBatchSize: number = PERFORMANCE.MAX_BATCH_SIZE,
  ) {
    this.batchInterval = batchInterval;
    this.maxBatchSize = maxBatchSize;
  }

  enqueue(event: string, data: any, excludeSocket?: string): void {
    this.queue.push({ event, data, excludeSocket });

    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flush();
      }, this.batchInterval);
    }
  }

  flush(): BatchedEvent[] {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.queue.length === 0) {
      return [];
    }

    return this.queue.splice(0);
  }

  getBatchSize(): number {
    return this.queue.length;
  }

  hasPendingEvents(): boolean {
    return this.queue.length > 0;
  }

  clear(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.queue.length = 0;
  }
}
