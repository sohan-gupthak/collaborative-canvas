import { DrawingEvent, validateDrawingEvent } from './drawing-events.js';

export interface CanvasState {
  drawingEvents: DrawingEvent[];
  undoStack: DrawingEvent[];
  redoStack: DrawingEvent[];
  version: number;
}

export interface StateSyncData {
  roomId: string;
  canvasState: CanvasState;
  drawingHistory: DrawingEvent[];
  version: number;
  clientVersion?: number;
  isComplete: boolean;
  timestamp: string;
}

export interface StateValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ClientStateManager {
  private currentState: CanvasState;
  private roomId: string | null = null;
  private onStateReconstructedCallback?: (events: DrawingEvent[]) => void;
  private onStateValidationFailedCallback?: (errors: string[]) => void;

  constructor() {
    this.currentState = {
      drawingEvents: [],
      undoStack: [],
      redoStack: [],
      version: 0,
    };
  }

  // Handle state synchronization from server
  public handleStateSync(syncData: StateSyncData): void {
    console.log(
      `[ClientStateManager] Handling state sync for room ${syncData.roomId}, version ${syncData.version}, complete: ${syncData.isComplete}`,
    );

    const validation = this.validateStateSyncData(syncData);
    if (!validation.isValid) {
      console.error('[ClientStateManager] State sync validation failed:', validation.errors);
      if (this.onStateValidationFailedCallback) {
        this.onStateValidationFailedCallback(validation.errors);
      }
      return;
    }

    this.roomId = syncData.roomId;

    if (syncData.isComplete) {
      this.reconstructCompleteState(syncData);
    } else {
      this.updatePartialState(syncData);
    }

    console.log(
      `[ClientStateManager] State sync completed. Canvas has ${this.currentState.drawingEvents.length} events, version ${this.currentState.version}`,
    );
  }

  private reconstructCompleteState(syncData: StateSyncData): void {
    this.currentState = {
      drawingEvents: [...syncData.canvasState.drawingEvents],
      undoStack: [...syncData.canvasState.undoStack],
      redoStack: [...syncData.canvasState.redoStack],
      version: syncData.canvasState.version,
    };

    // getting events to render - prefer drawingHistory if available, otherwise use drawingEvents
    const eventsToRender =
      syncData.drawingHistory.length > 0
        ? syncData.drawingHistory
        : syncData.canvasState.drawingEvents;

    // Validate chronological order
    this.ensureChronologicalOrder(eventsToRender);

    if (this.onStateReconstructedCallback) {
      this.onStateReconstructedCallback(eventsToRender);
    }

    console.log(
      `[ClientStateManager] Complete state reconstructed: ${eventsToRender.length} events to render`,
    );
  }

  private updatePartialState(syncData: StateSyncData): void {
    // For now, treat partial updates as complete reconstruction
    this.reconstructCompleteState(syncData);
  }

  private validateStateSyncData(syncData: StateSyncData): StateValidationResult {
    const errors: string[] = [];

    if (!syncData || typeof syncData !== 'object') {
      errors.push('State sync data must be an object');
      return { isValid: false, errors };
    }

    if (!syncData.roomId || typeof syncData.roomId !== 'string') {
      errors.push('Room ID must be a non-empty string');
    }

    if (!syncData.canvasState || typeof syncData.canvasState !== 'object') {
      errors.push('Canvas state must be an object');
    } else {
      // Validate canvas state structure
      if (!Array.isArray(syncData.canvasState.drawingEvents)) {
        errors.push('Drawing events must be an array');
      } else {
        // Validate each drawing event
        for (let i = 0; i < syncData.canvasState.drawingEvents.length; i++) {
          const event = syncData.canvasState.drawingEvents[i];
          if (!validateDrawingEvent(event)) {
            errors.push(`Invalid drawing event at index ${i}`);
          }
        }
      }

      if (!Array.isArray(syncData.canvasState.undoStack)) {
        errors.push('Undo stack must be an array');
      }

      if (!Array.isArray(syncData.canvasState.redoStack)) {
        errors.push('Redo stack must be an array');
      }

      if (typeof syncData.canvasState.version !== 'number' || syncData.canvasState.version < 0) {
        errors.push('Version must be a non-negative number');
      }
    }

    if (!Array.isArray(syncData.drawingHistory)) {
      errors.push('Drawing history must be an array');
    } else {
      // Validate drawing history events
      for (let i = 0; i < syncData.drawingHistory.length; i++) {
        const event = syncData.drawingHistory[i];
        if (!validateDrawingEvent(event)) {
          errors.push(`Invalid drawing history event at index ${i}`);
        }
      }
    }

    if (typeof syncData.version !== 'number' || syncData.version < 0) {
      errors.push('Sync version must be a non-negative number');
    }

    if (typeof syncData.isComplete !== 'boolean') {
      errors.push('isComplete must be a boolean');
    }

    return { isValid: errors.length === 0, errors };
  }

  private ensureChronologicalOrder(events: DrawingEvent[]): void {
    events.sort((a, b) => a.timestamp - b.timestamp);
  }

  public requestStateSync(websocketClient: any): void {
    if (!websocketClient || !websocketClient.isConnected()) {
      console.warn('[ClientStateManager] Cannot request state sync: not connected');
      return;
    }

    const request = {
      clientVersion: this.currentState.version,
      timestamp: new Date().toISOString(),
    };

    if (websocketClient.socket && websocketClient.socket.emit) {
      websocketClient.socket.emit('request-state-sync', request);
      console.log(
        `[ClientStateManager] Requested state sync with client version ${this.currentState.version}`,
      );
    }
  }

  public addDrawingEvent(event: DrawingEvent): void {
    if (!validateDrawingEvent(event)) {
      console.error('[ClientStateManager] Cannot add invalid drawing event:', event);
      return;
    }

    // Insert in chronological order
    const insertIndex = this.findInsertionIndex(event.timestamp);
    this.currentState.drawingEvents.splice(insertIndex, 0, event);

    // Clear redo stack when new event is added
    this.currentState.redoStack = [];

    this.currentState.version++;

    console.log(
      `[ClientStateManager] Added drawing event locally, version ${this.currentState.version}`,
    );
  }

  private findInsertionIndex(timestamp: number): number {
    let left = 0;
    let right = this.currentState.drawingEvents.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.currentState.drawingEvents[mid].timestamp <= timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  public handleUndo(undoneEvents: DrawingEvent[]): void {
    undoneEvents.forEach((undoneEvent) => {
      const eventIndex = this.currentState.drawingEvents.findIndex((e) => e.id === undoneEvent.id);
      if (eventIndex !== -1) {
        this.currentState.drawingEvents.splice(eventIndex, 1);
        this.currentState.undoStack.push(undoneEvent);
      }
    });

    this.currentState.version++;

    console.log(`[ClientStateManager] Handled undo for ${undoneEvents.length} events`);

    if (this.onStateReconstructedCallback) {
      this.onStateReconstructedCallback(this.currentState.drawingEvents);
    }
  }

  public handleRedo(redoneEvents: DrawingEvent[]): void {
    redoneEvents.forEach((redoneEvent) => {
      const undoIndex = this.currentState.undoStack.findIndex((e) => e.id === redoneEvent.id);
      if (undoIndex !== -1) {
        this.currentState.undoStack.splice(undoIndex, 1);

        const insertIndex = this.findInsertionIndex(redoneEvent.timestamp);
        this.currentState.drawingEvents.splice(insertIndex, 0, redoneEvent);
      }
    });

    this.currentState.version++;

    console.log(`[ClientStateManager] Handled redo for ${redoneEvents.length} events`);

    if (this.onStateReconstructedCallback) {
      this.onStateReconstructedCallback(this.currentState.drawingEvents);
    }
  }

  public getCurrentState(): CanvasState {
    return {
      drawingEvents: [...this.currentState.drawingEvents],
      undoStack: [...this.currentState.undoStack],
      redoStack: [...this.currentState.redoStack],
      version: this.currentState.version,
    };
  }

  public getCurrentVersion(): number {
    return this.currentState.version;
  }

  public getCurrentRoomId(): string | null {
    return this.roomId;
  }

  public clearState(): void {
    this.currentState = {
      drawingEvents: [],
      undoStack: [],
      redoStack: [],
      version: 0,
    };
    this.roomId = null;
    console.log('[ClientStateManager] State cleared');
  }

  // Set callback for state reconstruction
  public onStateReconstructed(callback: (events: DrawingEvent[]) => void): void {
    this.onStateReconstructedCallback = callback;
  }

  // Set callback for state validation failures
  public onStateValidationFailed(callback: (errors: string[]) => void): void {
    this.onStateValidationFailedCallback = callback;
  }

  public getStateStats() {
    return {
      roomId: this.roomId,
      version: this.currentState.version,
      drawingEventsCount: this.currentState.drawingEvents.length,
      undoStackSize: this.currentState.undoStack.length,
      redoStackSize: this.currentState.redoStack.length,
      oldestEvent:
        this.currentState.drawingEvents.length > 0
          ? this.currentState.drawingEvents[0].timestamp
          : null,
      newestEvent:
        this.currentState.drawingEvents.length > 0
          ? this.currentState.drawingEvents[this.currentState.drawingEvents.length - 1].timestamp
          : null,
    };
  }
}
