import type { DrawingEvent, StateStats } from './domain.js';

export interface ErrorResponse {
  message: string;
  code: string;
  details?: any;
}

export interface RoomJoinedResponse {
  roomId: string;
  clientCount: number;
  timestamp: string;
}

export interface StateSyncResponse {
  roomId: string;
  canvasState: {
    drawingEvents: DrawingEvent[];
    undoStack: DrawingEvent[];
    redoStack: DrawingEvent[];
    version: number;
  };
  drawingHistory: DrawingEvent[];
  version: number;
  clientVersion?: number;
  isComplete: boolean;
  timestamp: string;
}

export interface UserJoinedResponse {
  userId: string;
  timestamp: string;
}

export interface UserLeftResponse {
  userId: string;
  timestamp: string;
}

export interface UndoAppliedResponse {
  undoneEvents: DrawingEvent[];
  userId: string;
  roomId: string;
  timestamp: string;
}

export interface UndoFailedResponse {
  reason: string;
  timestamp: string;
}

export interface RedoAppliedResponse {
  redoneEvents: DrawingEvent[];
  userId: string;
  roomId: string;
  timestamp: string;
}

export interface RedoFailedResponse {
  reason: string;
  timestamp: string;
}

export interface CanvasClearedResponse {
  userId: string;
  roomId: string;
  timestamp: string;
}

export interface RoomListResponse {
  rooms: Array<{
    id: string;
    clientCount: number;
    stateStats: StateStats;
  }>;
  totalRooms: number;
  timestamp: string;
}

export interface RoomInfoResponse {
  exists: boolean;
  roomId: string;
  clientCount?: number;
  stateStats?: StateStats;
  timestamp: string;
}

export interface RoomLeftResponse {
  timestamp: string;
}

export interface StateSyncFailedResponse {
  message: string;
  code: string;
  errors?: string[];
  timestamp: string;
}

export interface PongResponse {
  timestamp: number;
}
