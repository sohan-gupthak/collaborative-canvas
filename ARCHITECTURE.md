# Architecture Documentation

## Overview

Collaborative Canvas is a high-performance real-time collaborative drawing application built with a modular, production-ready architecture. The system is designed for smooth 60 FPS rendering, efficient real-time collaboration, and maintainable code following SOLID principles.

### Key Architecture Principles

- **Modular Design**: 19 server files, 15+ client files with clear separation of concerns
- **Type Safety**: 100% TypeScript coverage with readonly/frozen objects for immutability
- **Performance First**: Event batching, adaptive throttling, and efficient rendering
- **Scalability**: Room-based architecture with isolated state per session
- **Testability**: Independently testable modules with single responsibility

## Architecture Diagram

> **Visual Diagram**: See [ARCHITECTURE](assets/images/d2.png) for the complete architecture diagram showing client-server components, data flow, and system interactions.

## Client-Side Architecture

### UI Layer

The client uses a modular UI controller pattern for separation of concerns:

#### UICoordinator

- **Location**: `client/src/ui/UICoordinator.ts`
- **Responsibility**: Orchestrates all UI controllers and manages their lifecycle
- **Dependencies**: ToolbarController, RoomController, StatusController, KeyboardController

#### ToolbarController

- **Location**: `client/src/ui/ToolbarController.ts`
- **Responsibility**: Manages drawing tool controls (brush, eraser, color picker, size slider)
- **Features**: Tool selection, color changes, size adjustments
- **Events**: Emits tool change events to Canvas

#### RoomController

- **Location**: `client/src/ui/RoomController.ts`
- **Responsibility**: Handles room creation, joining, and browsing
- **Features**: Room list, create room, join room, shareable URLs
- **Integration**: WebSocketClient for room operations

#### StatusController

- **Location**: `client/src/ui/StatusController.ts`
- **Responsibility**: Displays real-time performance metrics and connection status
- **Metrics**: FPS, latency, memory usage, event count
- **Updates**: Every second from PerformanceMonitor

#### KeyboardController

- **Location**: `client/src/ui/KeyboardController.ts`
- **Responsibility**: Manages keyboard shortcuts
- **Shortcuts**: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+Shift+Z (redo)
- **Integration**: ClientStateManager for undo/redo

### Canvas Layer

#### Canvas.ts

- **Location**: `client/src/canvas.ts`
- **Responsibility**: Core drawing logic and event handling
- **Features**:
  - Dual canvas system (drawing + cursor overlay)
  - Mouse and touch event handling
  - Coordinate transformation (screen ↔ canvas)
  - Event throttling (adaptive 8-32ms)
  - Event batching (max 10 events)
  - Device pixel ratio handling
- **Performance**: Adaptive throttling based on connection quality

#### DrawingRenderer.ts

- **Location**: `client/src/drawing-renderer.ts`
- **Responsibility**: Optimized rendering engine
- **Features**:
  - requestAnimationFrame for smooth 60 FPS
  - Dirty rectangle tracking
  - Stroke rendering (start/line/end events)
  - Ghost cursor rendering with user colors
  - Context state management
- **Optimization**: Only redraws when needed, batches multiple updates

### State Management

#### ClientStateManager

- **Location**: `client/src/client-state-manager.ts`
- **Responsibility**: Local state management and synchronization
- **Features**:
  - Drawing event storage with chronological ordering
  - Undo/redo stack management
  - State validation
  - Version tracking
  - Memory usage estimation
  - Garbage collection (removes oldest 25% when threshold exceeded)
- **Limits**: 50MB memory, 5000 events, 100 undo/redo stack size

#### PerformanceMonitor

- **Location**: `client/src/performance-monitor.ts`
- **Responsibility**: Tracks performance metrics
- **Metrics**:
  - FPS (frames per second)
  - Average frame time
  - Event processing time
  - Memory usage (heap size)
  - Dropped frames
- **Reporting**: Console logging every second

### Network Layer

#### WebSocketClient

- **Location**: `client/src/websocket-client.ts`
- **Responsibility**: WebSocket communication wrapper
- **Features**:
  - Socket.io client management
  - Connection state tracking
  - Reconnection logic (exponential backoff, max 5 attempts)
  - Event filtering (excludes own events)
  - User ID generation
- **Events Emitted**: 11 socket events (join-room, drawing-event, cursor-event, etc.)
- **Events Received**: 13+ socket events with callbacks

#### Connection Health Monitoring

- **Ping/Pong**: Latency measurement every 5 seconds
- **Quality Classification**:
  - Excellent: < 50ms
  - Good: 50-150ms
  - Fair: 150-300ms
  - Poor: > 300ms
- **Adaptation**: Affects event throttling intervals

### Type System

**Location**: `client/src/types/`

- **events.ts**: Drawing and cursor event types
- **state.ts**: Canvas state types
- **network.ts**: WebSocket payload types
- **callbacks.ts**: Callback function signatures
- **performance.ts**: Performance metric types
- **errors.ts**: Error type hierarchy
- **index.ts**: Central type exports

### Configuration

**Location**: `client/src/config/constants.ts`

Centralized configuration for:

- Event throttling intervals
- Memory limits
- Health check intervals
- Connection timeouts
- Max reconnect attempts

## Server-Side Architecture

### API Layer

#### server.ts

- **Location**: `server/src/server.ts` (132 lines)
- **Responsibility**: Express + Socket.io server setup
- **Features**:
  - CORS configuration
  - Socket.io initialization
  - Connection handling with clean handler delegation
  - Health endpoint (`/health`)
  - Error handling (uncaughtException, unhandledRejection)
- **Architecture**: Delegates to handlers, no inline logic

#### Health Endpoint

- **Route**: `GET /health`
- **Response**:
  - Status
  - Timestamp
  - Total connections (lifetime)
  - Active clients
  - Average session duration
  - Room statistics

### Event Handlers

**Location**: `server/src/handlers/`

All handlers are pure functions that take socket, managers, and data as parameters.

#### room-handlers.ts (4 functions)

- `handleJoinRoom`: Join or create room, send state sync
- `handleLeaveRoom`: Leave current room, notify others
- `handleRequestRoomList`: Send list of available rooms
- `handleRequestRoomInfo`: Send info about specific room

#### drawing-handlers.ts (2 functions)

- `handleDrawingEvent`: Validate and broadcast drawing events
- `handleCursorEvent`: Broadcast cursor position updates

#### state-handlers.ts (4 functions)

- `handleUndoRequest`: Process undo operation, broadcast result
- `handleRedoRequest`: Process redo operation, broadcast result
- `handleClearCanvas`: Clear canvas, broadcast to all
- `handleRequestStateSync`: Send complete or partial state sync

#### connection-handlers.ts (3 functions)

- `handlePing`: Respond to ping with pong
- `handleDisconnect`: Clean up client, broadcast user-left
- `handleSocketError`: Log socket errors

### Core Services

#### ConnectionManager

- **Location**: `server/src/connection-manager.ts` (160 lines)
- **Responsibility**: Centralized client connection tracking
- **Features**:
  - Client registration and removal
  - Session duration tracking
  - Connection statistics
  - Client info updates (e.g., room joins)
- **Statistics**: Total connections, active clients, average session duration, oldest connection

#### RoomManager

- **Location**: `server/src/room-manager.ts` (240 lines)
- **Responsibility**: Room and client management
- **Features**:
  - Room creation and deletion
  - Client join/leave operations
  - Event broadcasting to rooms
  - Empty room cleanup
  - Room statistics
- **Architecture**: Uses Room class with encapsulated StateManager

#### StateManager

- **Location**: `server/src/state-manager.ts` (266 lines)
- **Responsibility**: Drawing state management with undo/redo
- **Features**:
  - Chronological event ordering (binary search insertion)
  - Undo/redo by strokeId
  - History compression (removes old events)
  - State validation
  - Version tracking
  - Memory usage calculation
- **Limits**: 10,000 max events, 1,000 compression threshold, 10% undo ratio
- **Immutability**: Returns frozen objects with `Object.freeze()`

#### EventBatcher

- **Location**: `server/src/event-batcher.ts` (95 lines)
- **Responsibility**: Performance optimization through event batching
- **Features**:
  - Event queue management
  - Automatic flush when max size reached (20 events)
  - Timer-based flush (16ms for 60 FPS)
  - Manual flush support
  - Clear for cleanup
- **Configuration**: Configurable interval and batch size from constants

### Validation Layer

**Location**: `server/src/validation/`

#### drawing-event-validator.ts

- **Lines**: 90-line comprehensive validation function
- **Validates**:
  - Event type (line/start/end)
  - Points array (length, coordinate bounds)
  - Style properties (color, lineWidth, lineCap, lineJoin)
  - Required fields (id, strokeId, userId, etc.)
  - Timestamps
- **Returns**: ValidationResult with isValid and error message

#### room-validator.ts

- **Validates**: Room ID format and length
- **Rules**: Non-empty string, max length from constants

### Type System

**Location**: `server/src/types/`

- **domain.ts**: Core domain models (DrawingEvent, CanvasState, ClientInfo, etc.) with readonly properties
- **events.ts**: Client→Server event payloads (JoinRoomPayload, DrawingEventPayload, etc.)
- **responses.ts**: Server→Client response types (StateSyncResponse, RoomJoinedResponse, etc.)
- **validation.ts**: Validation result types
- **index.ts**: Central type exports

### Configuration

**Location**: `server/src/config/constants.ts`

Four constant groups:

#### PERFORMANCE

- `BATCH_INTERVAL_MS`: 16ms (60 FPS)
- `MAX_BATCH_SIZE`: 20 events
- `PING_INTERVAL_MS`: 10 seconds
- `PING_TIMEOUT_MS`: 20 seconds

#### STATE_LIMITS

- `MAX_HISTORY_SIZE`: 10,000 events
- `COMPRESSION_THRESHOLD`: 1,000 events
- `MAX_UNDO_RATIO`: 0.1 (10%)

#### VALIDATION

- Valid event types: line, start, end
- Valid line caps: round, square, butt
- Valid line joins: round, bevel, miter
- Coordinate limits: -1,000,000 to 1,000,000
- LineWidth limits: 1 to 100

#### ERROR_CODES

13 error codes for consistent error handling:

- INVALID_ROOM_ID
- ROOM_NOT_FOUND
- NOT_IN_ROOM
- INVALID_DRAWING_EVENT
- And 9 more...

## Data Flow

### Drawing Event Flow

1. **User Input** → Canvas captures mouse/touch event
2. **Coordinate Transform** → Screen coordinates converted to canvas coordinates
3. **Event Creation** → DrawingEvent created (type: start/line/end)
4. **Local Render** → DrawingRenderer renders on local canvas
5. **State Update** → ClientStateManager stores event
6. **Network Send** → WebSocketClient emits to server
7. **Server Validation** → Handler validates event with ValidationLayer
8. **Server Broadcast** → RoomManager broadcasts to other clients (via EventBatcher)
9. **Client Receive** → Other clients receive event via WebSocketClient
10. **Remote Render** → DrawingRenderer renders on remote canvas

### State Synchronization Flow

1. **Client Joins** → Emits join-room with roomId
2. **Server Creates/Finds Room** → RoomManager handles join
3. **State Retrieval** → Room gets complete state from StateManager
4. **Validation** → StateManager validates state integrity
5. **Send State** → Server emits state-sync with all drawing events + history
6. **Client Receives** → ClientStateManager processes state-sync
7. **Canvas Rebuild** → Canvas clears and re-renders all events
8. **Version Update** → Client version synced with server

### Undo/Redo Flow

1. **User Action** → Keyboard shortcut or button click
2. **Request Send** → WebSocketClient emits undo-request/redo-request
3. **Server Process** → StateManager finds all events with same strokeId
4. **State Update** → Events moved between history and undo/redo stacks
5. **Version Increment** → Version number updated
6. **Broadcast** → Server broadcasts undo-applied/redo-applied to ALL clients
7. **All Clients Update** → All clients remove/restore events
8. **Canvas Re-render** → All clients redraw canvas

### Performance Optimization Flow

1. **Event Throttling** → Client batches events (8-32ms adaptive)
2. **Network Send** → Batch sent when timer expires or max size reached
3. **Server Batching** → EventBatcher queues events
4. **Periodic Flush** → Server flushes every 16ms (~60 FPS)
5. **Broadcast** → Batched events sent to all clients
6. **Client Rendering** → requestAnimationFrame batches renders
7. **Memory Check** → ClientStateManager monitors memory usage
8. **Garbage Collection** → Auto cleanup when threshold exceeded

## Design Patterns

### Observer Pattern

- **Usage**: Callback system for events
- **Example**: Canvas notifies ClientStateManager of drawing events
- **Benefit**: Loose coupling between components

### Strategy Pattern

- **Usage**: Different validation strategies for events
- **Example**: DrawingEventValidator vs RoomValidator
- **Benefit**: Extensible validation logic

### Facade Pattern

- **Usage**: UICoordinator provides simple interface to complex UI system
- **Example**: Single entry point for all UI operations
- **Benefit**: Simplified client code

### Singleton Pattern (Implicit)

- **Usage**: Single instance of managers
- **Example**: ConnectionManager, RoomManager
- **Benefit**: Centralized state management

### Factory Pattern

- **Usage**: Event creation functions
- **Example**: DrawingEvent creation in drawing-events.ts
- **Benefit**: Consistent event structure

### Command Pattern

- **Usage**: Undo/Redo operations
- **Example**: Undo stack stores reversible operations
- **Benefit**: Easy state rollback

## Technology Stack

### Frontend

- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Socket.io-client**: WebSocket communication
- **HTML5 Canvas**: Drawing surface
- **FontAwesome**: Icons

### Backend

- **Node.js**: Runtime environment
- **TypeScript**: Type-safe development
- **Express**: HTTP server
- **Socket.io**: WebSocket server
- **CORS**: Cross-origin resource sharing

### Communication

- **WebSocket**: Real-time bidirectional communication
- **Socket.io**: WebSocket wrapper with fallbacks
- **HTTP**: Health endpoint and static files

### Development

- **npm workspaces**: Monorepo management
- **ESLint**: Code linting
- **Prettier**: Code formatting

### Deployment

- **Vercel**: Client deployment
- **Railway**: Server deployment

## Performance Optimizations

### Client-Side

1. **Adaptive Throttling**: 8-32ms based on connection quality
2. **Event Batching**: Max 10 events per batch
3. **requestAnimationFrame**: Smooth 60 FPS rendering
4. **Dirty Rectangle**: Efficient canvas updates
5. **Memory Management**: Auto cleanup at 50MB threshold
6. **Coordinate Caching**: Minimize transformation calculations

### Server-Side

1. **Event Batching**: 16ms flush interval (60 FPS)
2. **Binary Search**: O(log n) event insertion
3. **History Compression**: Removes old events
4. **Defensive Copying**: Minimal object creation
5. **Socket.io Rooms**: Efficient broadcasting
6. **Connection Pooling**: Reuse connections

### Network

1. **WebSocket**: Low-latency communication
2. **Event Filtering**: Clients ignore own events
3. **Partial State Sync**: Only send deltas when possible
4. **Compression Threshold**: Large states trigger compression
5. **Ping/Pong**: Monitor connection health

## Security Considerations

### Input Validation

- All drawing events validated before processing
- Room IDs sanitized and validated
- Coordinate bounds enforced
- Style properties restricted to valid values

### Error Handling

- Try-catch blocks around critical operations
- Centralized error codes
- Graceful degradation
- Client-side validation before network send

### CORS Configuration

- Allowed origins specified in environment
- Credentials support
- Methods restricted

## Scalability

### Horizontal Scaling

- **Stateless Handlers**: Pure functions enable scaling
- **Room Isolation**: Rooms can be distributed across servers
- **Connection Manager**: Centralized client tracking

### Vertical Scaling

- **Event Batching**: Reduces CPU usage
- **Memory Limits**: Prevents memory leaks
- **History Compression**: Manages memory growth

### Future Considerations

- Redis for distributed state
- Load balancing across server instances
- Database for persistent storage
- CDN for static assets

## Deployment Architecture

### Development

```
Client (localhost:3000) ← WebSocket → Server (localhost:3001)
```

### Production

```
Client (Vercel CDN) ← WebSocket → Server (Railway)
         ↓                              ↓
    Static Assets                  Socket.io
                                    Express
```

## Monitoring and Observability

### Client-Side Metrics

- FPS (target: 60)
- Latency (ping/pong)
- Memory usage
- Event count
- Dropped frames

### Server-Side Metrics

- Active connections
- Total connections (lifetime)
- Average session duration
- Room count
- Events per second

### Health Checks

- `/health` endpoint
- Connection statistics
- Room statistics
- Version information

## Future Architecture Improvements

1. **Microservices**: Split into room service, state service, etc.
2. **Event Sourcing**: Store all events for replay
3. **CQRS**: Separate read and write models
4. **WebRTC**: Peer-to-peer communication for reduced latency
5. **GraphQL**: Flexible data fetching
6. **Service Mesh**: Better service-to-service communication
7. **Observability**: Distributed tracing, metrics, logging
8. **CI/CD**: Automated testing and deployment
9. **Database**: Persistent storage for drawings
10. **Authentication**: User accounts and permissions
