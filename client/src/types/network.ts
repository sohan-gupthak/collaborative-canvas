import type { DrawingEvent } from './events.js';
import type { CanvasState } from './state.js';

// Connection State
export interface ConnectionState {
  isConnected: boolean;
  roomId: string | null;
  userId: string;
  reconnectAttempts: number;
  lastError: string | null;
}

// Connection Quality
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface ConnectionHealth {
  latency: number; // Average latency in ms
  quality: ConnectionQuality;
  packetLoss: number; // Percentage 0-100
  lastPingTime: number;
}

// Socket Event Payloads
export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  createIfNotExists: boolean;
}

export interface LeaveRoomPayload {
  userId: string;
  roomId: string;
}

export interface UndoRequestPayload {
  userId: string;
  roomId: string | null;
}

export interface RedoRequestPayload {
  userId: string;
  roomId: string | null;
}

export interface ClearCanvasPayload {
  userId: string;
  roomId: string | null;
  timestamp: string;
}

export interface StateSyncRequestPayload {
  clientVersion?: number;
  timestamp: string;
}

export interface RoomInfoRequestPayload {
  roomId: string;
}

export interface PingPayload {
  timestamp: number;
}

export interface PongPayload {
  timestamp: number;
}

// Socket Event Responses
export interface UserLeftData {
  userId: string;
  timestamp: string;
}

export interface UserJoinedData {
  userId: string;
  timestamp: string;
}

export interface UndoAppliedData {
  undoneEvents: DrawingEvent[];
  userId: string;
  timestamp: string;
}

export interface RedoAppliedData {
  redoneEvents: DrawingEvent[];
  userId: string;
  timestamp: string;
}

export interface CanvasClearedData {
  userId: string;
  timestamp: string;
}

export interface StateSyncFailedData {
  message: string;
  code: string;
  errors?: string[];
}

export interface RoomListData {
  rooms: RoomInfo[];
  totalRooms: number;
}

export interface RoomInfo {
  id: string;
  clientCount: number;
  stateStats: {
    historySize: number;
    undoStackSize: number;
    redoStackSize: number;
  };
  exists?: boolean;
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

// Socket Error Response
export interface SocketErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
