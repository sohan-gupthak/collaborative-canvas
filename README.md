# Sketch Live - Collaborative Drawing Canvas

A high-performance real-time collaborative drawing application built with TypeScript, Node.js, and Socket.io. Features include multi-user drawing sessions, room management, undo/redo operations, and comprehensive performance optimizations for smooth 60 FPS rendering.

## Features

### Core Functionality

- **Real-time Collaborative Drawing** - Multiple users can draw simultaneously with instant synchronization
- **Drawing Tools** - Brush and eraser with customizable colors and sizes (1-50px)
- **Undo/Redo** - Full operation history with state management
- **Clear Canvas** - Reset drawing board for all users in a room
- **Ghost Cursors** - See other users' cursor positions in real-time with color-coded indicators

### Room Management

- **Multiple Rooms** - Create and join separate drawing sessions
- **User Tracking** - Real-time user count and participant list
- **Shareable Links** - Copy room URLs to invite collaborators
- **Room List** - Browse and join available rooms

### Performance Optimizations

- **60 FPS Rendering** - Smooth drawing with event throttling and batching
- **Adaptive Frequency** - Dynamic adjustment based on connection quality (8-32ms intervals)
- **Memory Management** - Automatic garbage collection with 50MB threshold
- **Dirty Rectangle Optimization** - Efficient canvas updates using requestAnimationFrame (TODO: optimize to only redraw individual rects)
- **Real-time Metrics** - Live performance monitoring (FPS, latency, memory, event count)
- **Connection Health** - Ping/pong latency tracking with quality classification

### User Experience

- **Responsive Design** - Works on desktop and touch devices
- **Connection Status** - Visual indicator for WebSocket connection state
- **Keyboard Support** - Shortcuts for common operations
- **Intuitive UI** - Clean toolbar and controls with FontAwesome icons

## Project Structure

```
├── client/                    # Frontend application (Vite + TypeScript)
│   ├── src/
│   │   ├── ui/               # UI controllers (Phase 3 refactoring)
│   │   │   ├── UICoordinator.ts      # Main UI coordinator
│   │   │   ├── ToolbarController.ts  # Drawing tools controls
│   │   │   ├── RoomController.ts     # Room management UI
│   │   │   ├── StatusController.ts   # Status and metrics display
│   │   │   └── KeyboardController.ts # Keyboard shortcuts
│   │   ├── types/            # TypeScript type definitions
│   │   │   ├── index.ts      # Central type exports
│   │   │   ├── events.ts     # Drawing and cursor event types
│   │   │   ├── state.ts      # Canvas state types
│   │   │   ├── network.ts    # WebSocket payload types
│   │   │   ├── callbacks.ts  # Callback function signatures
│   │   │   ├── performance.ts # Performance metric types
│   │   │   └── errors.ts     # Error type hierarchy
│   │   ├── config/
│   │   │   └── constants.ts  # Application constants and config
│   │   ├── canvas.ts         # Canvas rendering and interaction
│   │   ├── drawing-renderer.ts   # Optimized rendering engine
│   │   ├── drawing-events.ts     # Event validation and utilities
│   │   ├── websocket-client.ts   # WebSocket communication
│   │   ├── client-state-manager.ts   # State management
│   │   ├── performance-monitor.ts    # Performance tracking
│   │   └── main.ts           # Application entry point
│   ├── styles/
│   │   └── style.css         # Application styles
│   ├── index.html
│   └── package.json
├── server/                    # Backend server (Node.js + Socket.io)
│   ├── src/
│   │   ├── server.ts         # Express + Socket.io server
│   │   ├── room-manager.ts   # Room and client management
│   │   └── state-manager.ts  # Server-side state management
│   └── package.json
├── PERFORMANCE_OPTIMIZATIONS.md  # Performance implementation details
├── package.json               # Root workspace configuration
└── README.md                  # This file
```

## Setup Instructions

### Prerequisites

- Node.js v20+ (Recommended: v23.11.1)
- npm 9+

### Installation

1. Install dependencies for all packages:

```bash
# Recommended: Use nvm to manage Node.js versions
nvm install v23.11.1
nvm use v23.11.1
```

```bash
npm run install:all
```

Or install individually:

```bash
# Root dependencies
npm install

# Client dependencies
cd client && npm install

# Server dependencies
cd server && npm install
```

2. Set up environment variables:

```bash
# Copy example env files
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Edit the `.env` files as needed:

**Server (.env)**:

- `PORT` - Server port (default: 3001)
- `CLIENT_URL` - Client URL for CORS (default: http://localhost:3000)

**Client (.env)**:

- `VITE_PORT` - Client port (default: 3000)
- `VITE_SERVER_URL` - WebSocket server URL (default: http://localhost:3001)

### Development

Start both client and server in development mode:

```bash
# Terminal 1 - Start server
npm run dev:server

# Terminal 2 - Start client
npm run dev:client
```

The client will be available at the port specified in `client/.env` (default: `http://localhost:3000`) and the server at the port specified in `server/.env` (default: `http://localhost:3001`).

## Technology Stack

- **Client**: TypeScript, Vite, Socket.io-client, HTML5 Canvas
- **Server**: Node.js, TypeScript, Express, Socket.io
- **Real-time Communication**: WebSocket via Socket.io
- **Performance**: requestAnimationFrame, dirty rectangle tracking, event batching
- **Deployment**: Vercel (client), Railway (server)

## Performance Metrics

The application is optimized for smooth real-time collaboration:

- **Target FPS**: 60 FPS with adaptive throttling (8-32ms intervals)
- **Event Batching**: 16ms server flush interval (~60 FPS)
- **Memory Management**: Auto cleanup at 50MB threshold
- **Max Events**: 5000 drawing events with automatic garbage collection
- **Latency Tracking**: Continuous ping/pong monitoring with quality classification

View detailed performance implementation in [PERFORMANCE_OPTIMIZATIONS.md](PERFORMANCE_OPTIMIZATIONS.md).

## Usage

### Creating a Room

1. Click the **Room Settings** icon (⚙️) in the top right
2. Enter a room name in "Create New Room"
3. Click **Create** to generate a new drawing session
4. Share the URL with collaborators

### Joining a Room

**Option 1**: Use a shared link

- Open the room URL provided by another user

**Option 2**: Browse available rooms

1. Open Room Settings
2. Click **Refresh** to see available rooms
3. Click a room name to join

### Drawing Controls

- **Brush Tool**: Click to draw freehand strokes
- **Eraser Tool**: Remove existing drawings
- **Color Picker**: Choose any color for your brush
- **Brush Size**: Adjust from 1-50 pixels using the slider
- **Undo/Redo**: Revert or restore drawing operations
- **Clear Canvas**: Remove all drawings (affects all users in room)

### Performance Monitor

Real-time metrics displayed at the top center:

- **FPS**: Current frames per second
- **Latency**: Network round-trip time in milliseconds
- **Memory**: Estimated memory usage in MB
- **Events**: Total drawing events in current session

## Architecture

### Client-Side

- **Modular Architecture**: Separated UI controllers for toolbar, rooms, status, and keyboard shortcuts
- **Type Safety**: Comprehensive TypeScript type system with discriminated unions
- **Configuration Management**: Centralized constants for all tunable parameters
- **Canvas Management**: Dual canvas system (drawing + cursor overlay)
- **State Management**: Client-side state with automatic synchronization
- **Event Throttling**: Adaptive 60 FPS throttling based on connection quality
- **Memory Monitoring**: Automatic cleanup when thresholds exceeded

### Server-Side

- **Room Manager**: Handles multiple drawing sessions with isolated state
- **Event Batching**: Queues and flushes events every 16ms for optimization
- **State Synchronization**: Broadcasts canvas state to new room members
- **Connection Health**: Ping/pong mechanism for latency tracking

### WebSocket Events

**Client → Server**:

- `join-room` - Join or create a drawing room
- `drawing-event` - Broadcast drawing strokes
- `cursor-event` - Share cursor position
- `undo-request` - Request undo operation
- `redo-request` - Request redo operation
- `clear-canvas` - Clear all drawings
- `ping` - Latency measurement

**Server → Client**:

- `connection-state` - Connection status updates
- `drawing-event` - Receive drawing from other users
- `cursor-event` - Receive cursor positions
- `state-sync` - Full canvas state synchronization
- `undo-applied` - Undo operation result
- `redo-applied` - Redo operation result
- `canvas-cleared` - Canvas clear notification
- `user-left` - User disconnection notification
- `pong` - Latency response

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### WebSocket Connection Issues

- Ensure server URL in `.env` is correct
- Check CORS configuration in `server/src/server.ts`

### Performance Issues

- Check FPS in performance monitor
- Reduce brush size for complex drawings
- Clear canvas periodically to free memory
- Monitor network latency for connection quality

### Build Errors

- Clear `node_modules` and reinstall: `npm run install:all`
- Ensure Node.js version matches requirements (v20+ or v23.11.1)
- Check TypeScript compilation: `npm run build:all`
