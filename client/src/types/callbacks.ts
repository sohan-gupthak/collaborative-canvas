import type { DrawingEvent, CursorEvent } from './events.js';
import type {
  ConnectionState,
  StateSyncData,
  UserLeftData,
  UserJoinedData,
  UndoAppliedData,
  RedoAppliedData,
  CanvasClearedData,
  StateSyncFailedData,
  RoomListData,
  RoomInfo,
} from './network.js';
import type { PerformanceMetrics } from './performance.js';

// Drawing Callbacks
export type DrawingEventCallback = (event: DrawingEvent) => void;
export type CursorEventCallback = (cursor: CursorEvent) => void;

// State Callbacks
export type StateReconstructedCallback = (events: DrawingEvent[]) => void;
export type StateValidationFailedCallback = (errors: string[]) => void;

// Network Callbacks
export type ConnectionStateCallback = (state: ConnectionState) => void;
export type StateSyncCallback = (state: StateSyncData) => void;
export type UserLeftCallback = (data: UserLeftData) => void;
export type UserJoinedCallback = (data: UserJoinedData) => void;
export type UndoAppliedCallback = (data: UndoAppliedData) => void;
export type RedoAppliedCallback = (data: RedoAppliedData) => void;
export type CanvasClearedCallback = (data: CanvasClearedData) => void;
export type StateSyncFailedCallback = (data: StateSyncFailedData) => void;
export type RoomListCallback = (data: RoomListData) => void;
export type RoomInfoCallback = (data: RoomInfo) => void;

// Performance Callbacks
export type MetricsUpdateCallback = (metrics: PerformanceMetrics) => void;
