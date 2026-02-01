export interface Point {
  readonly x: number;
  readonly y: number;
  readonly timestamp: number;
}

export interface DrawingStyle {
  readonly color: string;
  readonly lineWidth: number;
  readonly lineCap: 'round' | 'square' | 'butt';
  readonly lineJoin: 'round' | 'bevel' | 'miter';
  readonly isEraser?: boolean;
}

export interface DrawingEvent {
  readonly id: string;
  readonly strokeId: string;
  readonly type: 'line' | 'start' | 'end';
  readonly userId: string;
  readonly roomId: string;
  readonly points: readonly Point[];
  readonly style: DrawingStyle;
  readonly timestamp: number;
  readonly serverTimestamp?: number;
  readonly receivedAt?: string;
  readonly originalTimestamp?: number;
}

export interface CursorEvent {
  readonly userId: string;
  readonly roomId: string;
  readonly position: Point;
  readonly isActive: boolean;
  readonly timestamp: number;
}

export interface CanvasState {
  readonly drawingEvents: readonly DrawingEvent[];
  readonly undoStack: readonly DrawingEvent[];
  readonly redoStack: readonly DrawingEvent[];
  readonly version: number;
}

export interface CompressedState {
  readonly events: readonly DrawingEvent[];
  readonly version: number;
  readonly compressedAt: number;
  readonly originalSize: number;
  readonly compressedSize: number;
}

export interface StateStats {
  readonly roomId: string;
  readonly historySize: number;
  readonly undoStackSize: number;
  readonly redoStackSize: number;
  readonly version: number;
  readonly memoryUsage: number;
  readonly oldestEvent: number | null;
  readonly newestEvent: number | null;
}

export interface RoomInfo {
  readonly id: string;
  readonly clientCount: number;
  readonly cursorCount: number;
  readonly createdAt: Date;
  readonly stateStats: StateStats;
}

export interface ClientInfo {
  readonly id: string;
  readonly connectedAt: Date;
  roomId?: string;
}
