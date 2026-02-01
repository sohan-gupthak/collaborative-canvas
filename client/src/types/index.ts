// Events
export type {
  Point,
  LineCap,
  LineJoin,
  DrawingStyle,
  DrawingEventType,
  DrawingEvent,
  DrawingStartEvent,
  DrawingLineEvent,
  DrawingEndEvent,
  TypedDrawingEvent,
  CursorPosition,
  CursorEvent,
  CreateDrawingEventOptions,
} from './events.js';

// State
export type {
  CanvasState,
  MutableCanvasState,
  MemoryStats,
  StateStats,
  StateValidationResult,
  StateSnapshot,
} from './state.js';

// Network
export type {
  ConnectionState,
  ConnectionQuality,
  ConnectionHealth,
  JoinRoomPayload,
  LeaveRoomPayload,
  UndoRequestPayload,
  RedoRequestPayload,
  ClearCanvasPayload,
  StateSyncRequestPayload,
  RoomInfoRequestPayload,
  PingPayload,
  PongPayload,
  UserLeftData,
  UserJoinedData,
  UndoAppliedData,
  RedoAppliedData,
  CanvasClearedData,
  StateSyncFailedData,
  RoomListData,
  RoomInfo,
  StateSyncData,
  SocketErrorResponse,
} from './network.js';

// Errors
export {
  ErrorCode,
  createError,
  isNetworkError,
  isRoomError,
  isStateError,
  isEventError,
} from './errors.js';

export type {
  BaseError,
  NetworkError,
  RoomError,
  StateError,
  EventError,
  AppError,
} from './errors.js';

// Callbacks
export type {
  DrawingEventCallback,
  CursorEventCallback,
  StateReconstructedCallback,
  StateValidationFailedCallback,
  ConnectionStateCallback,
  StateSyncCallback,
  UserLeftCallback,
  UserJoinedCallback,
  UndoAppliedCallback,
  RedoAppliedCallback,
  CanvasClearedCallback,
  StateSyncFailedCallback,
  RoomListCallback,
  RoomInfoCallback,
  MetricsUpdateCallback,
} from './callbacks.js';

// Performance
export type { PerformanceMetrics } from './performance.js';
