export interface PerformanceMetrics {
  fps: number;
  averageFrameTime: number;
  eventProcessingTime: number;
  memoryUsageMB: number;
  networkLatency: number;
  totalEvents: number;
  droppedFrames: number;
}
