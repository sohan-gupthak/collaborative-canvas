// Centralized location for all magic numbers and configuration values

export const CURSOR_INACTIVE_DELAY = 2000; // 2 seconds

export const BATCH_INTERVAL = 16; // ~60 FPS

export const PERFORMANCE_CHECK_INTERVAL = 1000; // 1 second

export const CONNECTION_CLEANUP_DELAY = 5000; // 5 seconds

export const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds

export const STATE_SYNC_INTERVAL = 30000; // 30 seconds

export const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000] as const;

export const MAX_BATCH_SIZE = 10; // 10 events

export const MAX_DRAWING_EVENTS = 10000; // 10,000 events

export const MAX_CURSOR_POSITIONS = 100; // 100 positions

export const MAX_STATE_SNAPSHOTS = 10; // 10 snapshots

export const MAX_UNDO_STACK_SIZE = 100; // 100 actions

export const MAX_REDO_STACK_SIZE = 100; // 100 actions

export const MAX_MEMORY_MB = 50; // 50 MB (garbage collection threshold)

export const MAX_CANVAS_WIDTH = 10000; // 10,000 pixels

export const MAX_CANVAS_HEIGHT = 10000; // 10,000 pixels

export const MIN_CANVAS_WIDTH = 100; // 100 pixels

export const MIN_CANVAS_HEIGHT = 100; // 100 pixels

export const MAX_COORDINATE = 100000; // 100,000 pixels

export const MIN_COORDINATE = -100000; // -100,000 pixels

export const MAX_LINE_WIDTH = 100; // 100 pixels

export const MIN_LINE_WIDTH = 0.1; // 0.1 pixels

export const DEFAULT_LINE_WIDTH = 2; // 2 pixels

export const DEFAULT_STROKE_COLOR = '#000000';

export const DEFAULT_LINE_CAP = 'round' as const;

export const DEFAULT_LINE_JOIN = 'round' as const;

export const SOCKET_TIMEOUT = 10000; // 10 seconds

export const MAX_RECONNECT_ATTEMPTS = 5; // 5 attempts

export const PING_INTERVAL = 25000; // 25 seconds

export const PING_TIMEOUT = 5000; // 5 seconds

export const MAX_FRAME_TIME = 16.67; // ~60 FPS

export const MEMORY_WARNING_THRESHOLD = 100; // 100 MB

export const MEMORY_CRITICAL_THRESHOLD = 250; // 250 MB

export const MAX_EVENT_PROCESSING_TIME = 10; // 10 ms

export const ACTIVE_CLASS = 'active';

export const DISABLED_CLASS = 'disabled';

export const ERROR_CLASS = 'error';

export const CURSOR_UPDATE_THROTTLE = 50; // 50 ms

export const VALID_LINE_CAPS = ['round', 'square', 'butt'] as const;

export const VALID_LINE_JOINS = ['round', 'bevel', 'miter'] as const;

export const VALID_EVENT_TYPES = ['line', 'start', 'end'] as const;

// Default application configuration
export const DEFAULT_CONFIG = {
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
  },
  drawing: {
    lineWidth: DEFAULT_LINE_WIDTH,
    strokeColor: DEFAULT_STROKE_COLOR,
    lineCap: DEFAULT_LINE_CAP,
    lineJoin: DEFAULT_LINE_JOIN,
  },
  performance: {
    enableMonitoring: true,
    checkInterval: PERFORMANCE_CHECK_INTERVAL,
    maxFrameTime: MAX_FRAME_TIME,
    memoryWarningThreshold: MEMORY_WARNING_THRESHOLD,
    memoryCriticalThreshold: MEMORY_CRITICAL_THRESHOLD,
  },
  network: {
    socketTimeout: SOCKET_TIMEOUT,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectDelays: RECONNECT_DELAYS,
    pingInterval: PING_INTERVAL,
    pingTimeout: PING_TIMEOUT,
    stateSyncInterval: STATE_SYNC_INTERVAL,
  },
  batch: {
    interval: BATCH_INTERVAL,
    maxSize: MAX_BATCH_SIZE,
  },
  limits: {
    maxDrawingEvents: MAX_DRAWING_EVENTS,
    maxCursorPositions: MAX_CURSOR_POSITIONS,
    maxStateSnapshots: MAX_STATE_SNAPSHOTS,
  },
} as const;

export type AppConfig = typeof DEFAULT_CONFIG;
