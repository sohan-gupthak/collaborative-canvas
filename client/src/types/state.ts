import type { DrawingEvent } from './events.js';

// Canvas State
export interface CanvasState {
  readonly drawingEvents: readonly DrawingEvent[];
  readonly undoStack: readonly DrawingEvent[];
  readonly redoStack: readonly DrawingEvent[];
  readonly version: number;
}

// Mutable version for internal use
export interface MutableCanvasState {
  drawingEvents: DrawingEvent[];
  undoStack: DrawingEvent[];
  redoStack: DrawingEvent[];
  version: number;
}

// Memory Statistics
export interface MemoryStats {
  estimatedSizeBytes: number;
  estimatedSizeMB: number;
  drawingEventsCount: number;
  undoStackSize: number;
  redoStackSize: number;
  totalPoints: number;
}

// State Statistics
export interface StateStats {
  roomId: string | null;
  version: number;
  drawingEventsCount: number;
  undoStackSize: number;
  redoStackSize: number;
  oldestEvent: number | null;
  newestEvent: number | null;
}

// Validation Result
export interface StateValidationResult {
  isValid: boolean;
  errors: string[];
}

// State Snapshot (for debugging)
export interface StateSnapshot {
  timestamp: string;
  state: CanvasState;
  stats: StateStats;
  memoryStats: MemoryStats;
}
