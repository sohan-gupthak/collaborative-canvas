import type { PerformanceMetrics, MetricsUpdateCallback } from './types/index.js';
import { MAX_FRAME_TIME, PERFORMANCE_CHECK_INTERVAL } from './config/constants.js';

export type { PerformanceMetrics } from './types/index.js';

export class PerformanceMonitor {
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private frameTimes: number[] = [];
  private eventProcessingTimes: number[] = [];
  private droppedFrames = 0;
  private totalEvents = 0;
  private readonly MAX_SAMPLES = 60; // Keep last 60 samples
  private metricsUpdateCallback?: MetricsUpdateCallback;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
    }, PERFORMANCE_CHECK_INTERVAL);
  }

  public stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public recordFrame(): void {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.MAX_SAMPLES) {
      this.frameTimes.shift();
    }

    // Track dropped frames (frames that took longer than target)
    if (frameTime > MAX_FRAME_TIME * 1.5) {
      this.droppedFrames++;
    }

    this.frameCount++;
    this.lastFrameTime = now;
  }

  public recordEventProcessing(startTime: number, endTime: number): void {
    const processingTime = endTime - startTime;
    this.eventProcessingTimes.push(processingTime);
    if (this.eventProcessingTimes.length > this.MAX_SAMPLES) {
      this.eventProcessingTimes.shift();
    }
    this.totalEvents++;
  }

  public recordEvent(): void {
    this.totalEvents++;
  }

  private calculateFPS(): number {
    if (this.frameTimes.length === 0) return 0;

    const averageFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return averageFrameTime > 0 ? 1000 / averageFrameTime : 0;
  }

  private calculateAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  private calculateAverageEventProcessingTime(): number {
    if (this.eventProcessingTimes.length === 0) return 0;
    return this.eventProcessingTimes.reduce((a, b) => a + b, 0) / this.eventProcessingTimes.length;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  public getMetrics(): PerformanceMetrics {
    return {
      fps: parseFloat(this.calculateFPS().toFixed(2)),
      averageFrameTime: parseFloat(this.calculateAverageFrameTime().toFixed(2)),
      eventProcessingTime: parseFloat(this.calculateAverageEventProcessingTime().toFixed(2)),
      memoryUsageMB: parseFloat(this.getMemoryUsage().toFixed(2)),
      networkLatency: 0, // Will be set externally
      totalEvents: this.totalEvents,
      droppedFrames: this.droppedFrames,
    };
  }

  public setNetworkLatency(_latency: number): void {
    // For future enhancement use - network latency is currently tracked by websocket-client (TODO)
  }

  public onMetricsUpdate(callback: MetricsUpdateCallback): void {
    this.metricsUpdateCallback = callback;
  }

  private updateMetrics(): void {
    if (this.metricsUpdateCallback) {
      const metrics = this.getMetrics();
      this.metricsUpdateCallback(metrics);
    }
  }

  public reset(): void {
    this.frameCount = 0;
    this.frameTimes = [];
    this.eventProcessingTimes = [];
    this.droppedFrames = 0;
    this.totalEvents = 0;
    this.lastFrameTime = performance.now();
  }
}
