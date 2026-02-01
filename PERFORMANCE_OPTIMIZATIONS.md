# Performance Optimizations

This document describes the performance optimizations implemented in the collaborative drawing application to meet the requirements specified in Requirement 7.

## Overview

The application implements comprehensive performance optimizations across client-side rendering, network communication, and memory management to ensure smooth real-time collaboration even under high load.

## 1. Client-Side Event Throttling

**Location**: `client/src/canvas.ts`, `client/src/config/constants.ts`

### Implementation

- Events are throttled to target 60 FPS (16ms intervals by default)
- Drawing events are queued in `eventBatchQueue`
- Events are flushed when:
  - Throttle interval has passed
  - Batch size reaches maximum (10 events)
  - Timer expires (adaptive based on connection quality)
- Configuration centralized in `config/constants.ts`

### Key Features

- `start` and `end` events are emitted immediately for responsiveness
- Only `line` events are batched for optimization
- Adaptive intervals based on connection quality (8-32ms)
- Type-safe configuration from centralized constants

```typescript
// Adaptive intervals from config/constants.ts
private minEmitInterval = 16; // Default ~60 FPS
private batchInterval = 16;
private readonly MAX_BATCH_SIZE = 10;
```

## 2. Server-Side Event Batching

**Location**: `server/src/event-batcher.ts`, `server/src/room-manager.ts`

### Implementation

- Dedicated `EventBatcher` class handles event queuing and batching
- Server queues drawing events instead of broadcasting immediately
- Events are batched and flushed every 16ms (~60 FPS)
- Reduces network overhead by combining multiple events

### Key Features

- `BATCH_INTERVAL = 16ms` for 60 FPS target (from `config/constants.ts`)
- `MAX_BATCH_SIZE = 20` events per batch
- Only drawing events are batched; other events sent immediately
- Automatic flush via `setInterval` in `server.ts`
- Reusable and independently testable batching logic

```typescript
// EventBatcher class provides clean interface
export class EventBatcher {
  enqueue(event: string, data: any, excludeSocket?: string): void;
  flush(): BatchedEvent[];
  hasPendingEvents(): boolean;
}

// In server.ts
setInterval(() => {
  roomManager.flushAllBatches();
}, PERFORMANCE.BATCH_INTERVAL_MS);
```

## 3. Connection Health Monitoring

**Location**: `client/src/websocket-client.ts`, `server/src/handlers/connection-handlers.ts`

### Implementation

- Ping/pong mechanism to measure round-trip latency
- Rolling average of last 10 latency samples
- Connection quality classification:
  - **Excellent**: < 50ms
  - **Good**: 50-150ms
  - **Fair**: 150-300ms
  - **Poor**: > 300ms
- Dedicated connection handler for ping/pong events

### Key Features

- Health checks run every 5 seconds
- Latency tracked with timestamps
- Quality affects adaptive event frequency
- Modular handler architecture for maintainability

```typescript
interface ConnectionHealth {
  latency: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  packetLoss: number;
  lastPingTime: number;
}
```

## 4. Adaptive Event Frequency

**Location**: `client/src/canvas.ts`, `client/src/main.ts`, `client/src/ui/StatusController.ts`

### Implementation

- Event throttling adjusts dynamically based on connection quality
- Main loop monitors health and updates canvas every 5 seconds
- Intervals scale from 8ms (excellent) to 32ms (poor)
- `StatusController` displays real-time connection metrics
- Modular UI architecture separates concerns

### Interval Mapping

| Connection Quality | Min Interval | Target FPS | Use Case                     |
| ------------------ | ------------ | ---------- | ---------------------------- |
| Excellent          | 8ms          | ~120 FPS   | Low latency, high bandwidth  |
| Good               | 16ms         | ~60 FPS    | Normal conditions            |
| Fair               | 24ms         | ~40 FPS    | Moderate latency             |
| Poor               | 32ms         | ~30 FPS    | High latency, save bandwidth |

```typescript
// In main.ts - monitor and adjust every 5 seconds
setInterval(() => {
  if (isConnected) {
    const health = wsClient.getConnectionHealth();
    canvas.updateConnectionQuality(health.quality);
  }
}, 5000);
```

## 5. Memory Usage Monitoring

**Location**: `client/src/client-state-manager.ts`, `client/src/types/performance.ts`

### Implementation

- Tracks memory usage of drawing events, undo/redo stacks
- Estimates memory in bytes and MB
- Provides detailed statistics via `getMemoryStats()`
- Type-safe metrics defined in `types/performance.ts`

### Metrics Tracked

- **Drawing Events Count**: Total events in current state
- **Undo Stack Size**: Number of undoable operations
- **Redo Stack Size**: Number of redoable operations
- **Total Points**: Sum of all point coordinates
- **Estimated Size**: Calculated memory usage in MB

```typescript
// From types/performance.ts
interface MemoryStats {
  estimatedSizeBytes: number;
  estimatedSizeMB: number;
  drawingEventsCount: number;
  undoStackSize: number;
  redoStackSize: number;
  totalPoints: number;
}
```

## 6. Garbage Collection

**Location**: `client/src/client-state-manager.ts`, `server/src/state-manager.ts`

### Implementation

**Client-Side:**

- Automatic cleanup when memory thresholds exceeded
- Removes oldest 25% of drawing events when triggered
- Trims undo/redo stacks to configured limits

**Server-Side:**

- History compression when threshold reached
- Maximum history size enforcement (from `config/constants.ts`)
- Undo stack compression (10% of max history retained)
- Automatic cleanup of old events

### Thresholds

**Client:**

- `MAX_MEMORY_MB = 50`: Maximum memory before cleanup
- `MAX_DRAWING_EVENTS = 5000`: Maximum event history
- `MAX_UNDO_STACK_SIZE = 100`: Maximum undo operations
- `MAX_REDO_STACK_SIZE = 100`: Maximum redo operations

**Server:**

- `MAX_HISTORY_SIZE = 10000`: Maximum drawing events per room
- `COMPRESSION_THRESHOLD = 1000`: Trigger compression after this many events
- `MAX_UNDO_RATIO = 0.1`: Keep 10% of max history as undo stack

### Cleanup Strategy

1. Check memory usage after each event added
2. If threshold exceeded, remove oldest 25% of events
3. Trim undo/redo stacks to max size
4. Log cleanup statistics

```typescript
private performGarbageCollection(): void {
  // Triggered automatically when limits exceeded
  // Removes old events while preserving recent history
}
```

## 7. Canvas Rendering Optimization

**Location**: `client/src/drawing-renderer.ts`

### Implementation

- Dirty rectangle tracking to identify changed regions
- `requestAnimationFrame` batching for smooth redraws
- Bounding box calculation for each drawing event

### Key Features

- Stores all events for potential re-rendering
- Calculates bounds for each stroke with padding
- Schedules renders using browser's animation frame
- Prevents duplicate frame requests

```typescript
interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### Optimization Benefits

- Reduces unnecessary canvas operations
- Batches multiple draws into single frame
- Synchronizes with browser refresh rate
- Smooth 60 FPS rendering

## 8. Performance Metrics Tracking

**Location**: `client/src/performance-monitor.ts`, `client/src/main.ts`, `client/src/ui/StatusController.ts`

### Implementation

- Comprehensive performance monitoring utility
- Tracks FPS, frame times, event processing
- Reports metrics every second to console
- `StatusController` displays real-time metrics in UI
- Type-safe metrics from `types/performance.ts`

### Metrics Collected

- **FPS**: Frames per second (calculated from frame times)
- **Average Frame Time**: Mean time between frames
- **Event Processing Time**: Time to process events
- **Memory Usage**: JavaScript heap usage (if available)
- **Network Latency**: From connection health monitoring
- **Total Events**: Count of all events processed
- **Dropped Frames**: Frames exceeding target time

### Integration

- Animation loop tracks frames continuously
- Metrics updated every 1 second
- Memory stats pulled from state manager
- Network latency from WebSocket client
- Event count tracked on each drawing event
- UI controllers provide clean separation of display logic

## Configuration

All performance parameters are centralized and can be tuned:

**Server Configuration** (`server/src/config/constants.ts`):

- `BATCH_INTERVAL_MS = 16`: Event batching interval (~60 FPS)
- `MAX_BATCH_SIZE = 20`: Maximum events per batch
- `PING_INTERVAL_MS = 10000`: Connection health check interval
- `PING_TIMEOUT_MS = 20000`: Connection timeout threshold
- `MAX_HISTORY_SIZE = 10000`: Maximum drawing events per room
- `COMPRESSION_THRESHOLD = 1000`: History compression trigger

**Client Configuration** (`client/src/config/constants.ts`):

- Event throttling constants: MIN_EMIT_INTERVAL, MAX_BATCH_SIZE
- Memory limits: MAX_MEMORY_MB, MAX_DRAWING_EVENTS
- Health check intervals: HEALTH_CHECK_INTERVAL
- Connection timeouts: SOCKET_TIMEOUT, MAX_RECONNECT_ATTEMPTS
- Performance monitoring: Performance metrics collection intervals

**Client Architecture**:

- **UI Controllers** (`client/src/ui/`): Modular UI management
  - `UICoordinator.ts`: Main UI coordinator
  - `ToolbarController.ts`: Drawing tools controls
  - `RoomController.ts`: Room management UI
  - `StatusController.ts`: Status and metrics display
  - `KeyboardController.ts`: Keyboard shortcuts
- **Type System** (`client/src/types/`): Type-safe definitions
  - `events.ts`: Drawing and cursor event types
  - `state.ts`: Canvas state types
  - `network.ts`: WebSocket payload types
  - `callbacks.ts`: Callback function signatures
  - `performance.ts`: Performance metric types
  - `errors.ts`: Error type hierarchy
- **Core Modules**: Canvas, renderer, state manager, WebSocket client, performance monitor

**Server Architecture**:

- Validation rules: `server/src/config/constants.ts` (VALIDATION constants)
- Error codes: `server/src/config/constants.ts` (ERROR_CODES)
- Type definitions: `server/src/types/` (domain, events, responses)
- Event handlers: `server/src/handlers/` (modular handler functions)
- Core services: `server/src/` (event-batcher, connection-manager, state-manager, room-manager)

---
