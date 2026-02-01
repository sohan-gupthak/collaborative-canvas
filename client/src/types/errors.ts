export enum ErrorCode {
  // Network errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTION_FAILED = 'RECONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',

  // Room errors
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_JOIN_FAILED = 'ROOM_JOIN_FAILED',
  ROOM_SWITCH_FAILED = 'ROOM_SWITCH_FAILED',

  // State errors
  STATE_SYNC_FAILED = 'STATE_SYNC_FAILED',
  STATE_VALIDATION_FAILED = 'STATE_VALIDATION_FAILED',
  INVALID_STATE_DATA = 'INVALID_STATE_DATA',

  // Event errors
  INVALID_EVENT = 'INVALID_EVENT',
  EVENT_VALIDATION_FAILED = 'EVENT_VALIDATION_FAILED',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface BaseError {
  code: ErrorCode;
  message: string;
  timestamp: string;
}

export interface NetworkError extends BaseError {
  code:
    | ErrorCode.CONNECTION_FAILED
    | ErrorCode.DISCONNECTED
    | ErrorCode.RECONNECTION_FAILED
    | ErrorCode.TIMEOUT;
  details?: {
    attemptNumber?: number;
    maxAttempts?: number;
    lastKnownState?: string;
  };
}

export interface RoomError extends BaseError {
  code: ErrorCode.ROOM_NOT_FOUND | ErrorCode.ROOM_JOIN_FAILED | ErrorCode.ROOM_SWITCH_FAILED;
  roomId?: string;
}

export interface StateError extends BaseError {
  code:
    | ErrorCode.STATE_SYNC_FAILED
    | ErrorCode.STATE_VALIDATION_FAILED
    | ErrorCode.INVALID_STATE_DATA;
  errors?: string[];
  version?: number;
}

export interface EventError extends BaseError {
  code: ErrorCode.INVALID_EVENT | ErrorCode.EVENT_VALIDATION_FAILED;
  eventId?: string;
  validationErrors?: string[];
}

export type AppError = NetworkError | RoomError | StateError | EventError | BaseError;

export function createError(
  code: ErrorCode,
  message: string,
  additionalData?: Record<string, unknown>,
): AppError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    ...additionalData,
  } as AppError;
}

export function isNetworkError(error: AppError): error is NetworkError {
  return [
    ErrorCode.CONNECTION_FAILED,
    ErrorCode.DISCONNECTED,
    ErrorCode.RECONNECTION_FAILED,
    ErrorCode.TIMEOUT,
  ].includes(error.code);
}

export function isRoomError(error: AppError): error is RoomError {
  return [
    ErrorCode.ROOM_NOT_FOUND,
    ErrorCode.ROOM_JOIN_FAILED,
    ErrorCode.ROOM_SWITCH_FAILED,
  ].includes(error.code);
}

export function isStateError(error: AppError): error is StateError {
  return [
    ErrorCode.STATE_SYNC_FAILED,
    ErrorCode.STATE_VALIDATION_FAILED,
    ErrorCode.INVALID_STATE_DATA,
  ].includes(error.code);
}

export function isEventError(error: AppError): error is EventError {
  return [ErrorCode.INVALID_EVENT, ErrorCode.EVENT_VALIDATION_FAILED].includes(error.code);
}
