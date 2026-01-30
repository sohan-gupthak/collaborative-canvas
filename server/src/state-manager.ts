import { DrawingEvent } from './room-manager';

export interface CanvasState {
  drawingEvents: DrawingEvent[];
  undoStack: DrawingEvent[];
  redoStack: DrawingEvent[];
  version: number;
}

export interface CompressedState {
  events: DrawingEvent[];
  version: number;
  compressedAt: number;
  originalSize: number;
  compressedSize: number;
}

export class StateManager {
  private drawingHistory: DrawingEvent[] = [];
  private undoStack: DrawingEvent[] = [];
  private redoStack: DrawingEvent[] = [];
  private version: number = 0;
  private readonly roomId: string;
  private readonly maxHistorySize: number;
  private readonly compressionThreshold: number;

  constructor(roomId: string, maxHistorySize: number = 10000, compressionThreshold: number = 1000) {
    this.roomId = roomId;
    this.maxHistorySize = maxHistorySize;
    this.compressionThreshold = compressionThreshold;
  }

  addDrawingEvent(event: DrawingEvent): void {
    if (event.roomId !== this.roomId) {
      throw new Error(
        `Event room ID ${event.roomId} does not match state manager room ID ${this.roomId}`,
      );
    }

    const insertIndex = this.findInsertionIndex(event.timestamp);
    this.drawingHistory.splice(insertIndex, 0, event);

    this.redoStack = []; // we are clearing redoStack when new drawing added

    this.version++;

    // Trigger compression if threshold is reached
    if (this.drawingHistory.length > this.compressionThreshold) {
      this.compressHistory();
    }

    console.log(
      `[${new Date().toISOString()}] Added drawing event to room ${this.roomId}, history size: ${this.drawingHistory.length}, version: ${this.version}`,
    );
  }

  private findInsertionIndex(timestamp: number): number {
    let left = 0;
    let right = this.drawingHistory.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.drawingHistory[mid].timestamp <= timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  undo(): DrawingEvent | null {
    if (this.drawingHistory.length === 0) {
      return null;
    }

    // Removing the most recent event from drawing history and adding to undo stack
    const eventToUndo = this.drawingHistory.pop()!;

    this.undoStack.push(eventToUndo);

    this.version++;

    console.log(
      `[${new Date().toISOString()}] Undo operation in room ${this.roomId}, event: ${eventToUndo.id}, version: ${this.version}`,
    );

    return eventToUndo;
  }

  redo(): DrawingEvent | null {
    if (this.undoStack.length === 0) {
      return null;
    }

    // Removing from undo stack
    const eventToRedo = this.undoStack.pop()!;

    const insertIndex = this.findInsertionIndex(eventToRedo.timestamp);
    this.drawingHistory.splice(insertIndex, 0, eventToRedo);

    this.version++;

    console.log(
      `[${new Date().toISOString()}] Redo operation in room ${this.roomId}, event: ${eventToRedo.id}, version: ${this.version}`,
    );

    return eventToRedo;
  }

  getCompleteState(): CanvasState {
    return {
      drawingEvents: [...this.drawingHistory], // Create a copy to prevent external modification
      undoStack: [...this.undoStack],
      redoStack: [...this.redoStack],
      version: this.version,
    };
  }

  reconstructCanvas(): DrawingEvent[] {
    return [...this.drawingHistory];
  }

  compressHistory(): CompressedState {
    const originalSize = this.calculateStateSize();

    // Remove old events if we exceed max history size
    if (this.drawingHistory.length > this.maxHistorySize) {
      const eventsToRemove = this.drawingHistory.length - this.maxHistorySize;
      this.drawingHistory.splice(0, eventsToRemove);
      console.log(
        `[${new Date().toISOString()}] Removed ${eventsToRemove} old events from room ${this.roomId} history`,
      );
    }

    // Compress undo stack if it's too large
    const maxUndoSize = Math.floor(this.maxHistorySize * 0.1); // Keeping 10% of max history as undo
    if (this.undoStack.length > maxUndoSize) {
      const undoToRemove = this.undoStack.length - maxUndoSize;
      this.undoStack.splice(0, undoToRemove);
      console.log(
        `[${new Date().toISOString()}] Compressed undo stack in room ${this.roomId}, removed ${undoToRemove} entries`,
      );
    }

    const compressedSize = this.calculateStateSize();
    const compressionResult: CompressedState = {
      events: [...this.drawingHistory],
      version: this.version,
      compressedAt: Date.now(),
      originalSize,
      compressedSize,
    };

    console.log(
      `[${new Date().toISOString()}] Compressed state for room ${this.roomId}: ${originalSize} -> ${compressedSize} bytes (${((1 - compressedSize / originalSize) * 100).toFixed(1)}% reduction)`,
    );

    return compressionResult;
  }

  private calculateStateSize(): number {
    const stateJson = JSON.stringify({
      drawingEvents: this.drawingHistory,
      undoStack: this.undoStack,
      redoStack: this.redoStack,
    });
    return Buffer.byteLength(stateJson, 'utf8');
  }

  validateState(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (let i = 1; i < this.drawingHistory.length; i++) {
      if (this.drawingHistory[i].timestamp < this.drawingHistory[i - 1].timestamp) {
        errors.push(`Drawing history not in chronological order at index ${i}`);
      }
    }

    const invalidRoomEvents = this.drawingHistory.filter((event) => event.roomId !== this.roomId);
    if (invalidRoomEvents.length > 0) {
      errors.push(`Found ${invalidRoomEvents.length} events with incorrect room ID`);
    }

    const eventIds = new Set<string>();
    const duplicateIds: string[] = [];

    for (const event of this.drawingHistory) {
      if (eventIds.has(event.id)) {
        duplicateIds.push(event.id);
      } else {
        eventIds.add(event.id);
      }
    }

    if (duplicateIds.length > 0) {
      errors.push(`Found duplicate event IDs: ${duplicateIds.join(', ')}`);
    }

    // Check version consistency
    if (this.version < 0) {
      errors.push('Version number is negative');
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      console.warn(
        `[${new Date().toISOString()}] State validation failed for room ${this.roomId}:`,
        errors,
      );
    }

    return { isValid, errors };
  }

  getStateStats() {
    return {
      roomId: this.roomId,
      historySize: this.drawingHistory.length,
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      version: this.version,
      memoryUsage: this.calculateStateSize(),
      oldestEvent: this.drawingHistory.length > 0 ? this.drawingHistory[0].timestamp : null,
      newestEvent:
        this.drawingHistory.length > 0
          ? this.drawingHistory[this.drawingHistory.length - 1].timestamp
          : null,
    };
  }

  clearState(): void {
    this.drawingHistory = [];
    this.undoStack = [];
    this.redoStack = [];
    this.version = 0;
    console.log(`[${new Date().toISOString()}] Cleared all state for room ${this.roomId}`);
  }
}
