import { Canvas } from './canvas.js';
import { WebSocketClient } from './websocket-client.js';
import { ClientStateManager } from './client-state-manager.js';
import { PerformanceMonitor } from './performance-monitor.js';
import { UICoordinator, type UICallbacks } from './ui/UICoordinator.js';
import type { DrawingEvent } from './types/index.js';

console.log('Collaborative Drawing Canvas - Client Starting...');

const canvasElement = document.getElementById('drawing-canvas') as HTMLCanvasElement;

if (!canvasElement) {
  throw new Error('Canvas element not found');
}

// canvas instance
const canvas = new Canvas(canvasElement);

// WebSocket client instance
const wsClient = new WebSocketClient(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');

// Client state manager instance
const stateManager = new ClientStateManager();

// Performance monitor instance
const perfMonitor = new PerformanceMonitor();

// Get room ID from URL or use default one
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default-room';

// Connection state management
let isConnected = false;

// Initialize UI Coordinator
const uiCallbacks: UICallbacks = {
  // Toolbar callbacks
  onColorChange: (color: string) => {
    canvas.setColor(color);
  },
  onBrushSizeChange: (size: number) => {
    canvas.setBrushSize(size);
  },
  onToolChange: (isEraser: boolean) => {
    canvas.setEraserMode(isEraser);
  },

  // Room callbacks
  onCreateRoom: async (roomName: string) => {
    await wsClient.switchRoom(roomName);
  },
  onJoinRoom: async (roomName: string) => {
    await wsClient.switchRoom(roomName, false); // Don't create if doesn't exist
  },
  onSwitchRoom: async (roomId: string) => {
    await wsClient.switchRoom(roomId);
  },
  onRefreshRooms: () => {
    wsClient.requestRoomList();
  },
  onRoomPanelOpened: () => {
    wsClient.requestRoomList();
  },

  // Action callbacks
  onUndo: () => {
    if (isConnected) {
      console.log('Undo button clicked');
      wsClient.emitUndoRequest();
    }
  },
  onRedo: () => {
    if (isConnected) {
      console.log('Redo button clicked');
      wsClient.emitRedoRequest();
    }
  },
  onClear: () => {
    if (isConnected) {
      console.log('Clear button clicked');
      wsClient.emitClearCanvas();
    } else {
      console.log('Clear button clicked - clearing locally (not connected)');
      stateManager.clearState();
      canvas.clearCanvas();
    }
  },
};

const uiCoordinator = new UICoordinator(uiCallbacks, roomId);

wsClient.onDrawingEvent((event: DrawingEvent) => {
  console.log('Received drawing event from user:', event.userId, event.type);

  stateManager.addDrawingEvent(event);

  canvas.renderDrawingEvent(event);
});

wsClient.onCursorEvent((cursor) => {
  console.log('Received cursor event from user:', cursor.userId, cursor.isActive);
  canvas.renderGhostCursor(cursor);
});

wsClient.onStateSync((state) => {
  console.log('Received state sync:', state);
  stateManager.handleStateSync(state);
});

wsClient.onUserLeft((data) => {
  console.log('User left room:', data.userId);
  canvas.removeGhostCursor(data.userId);
});

wsClient.onUndoApplied((data) => {
  console.log('Undo applied by user:', data.userId, 'events:', data.undoneEvents.length);
  stateManager.handleUndo(data.undoneEvents);
  uiCoordinator.setActionsEnabled(isConnected);
});

wsClient.onRedoApplied((data) => {
  console.log('Redo applied by user:', data.userId, 'events:', data.redoneEvents.length);
  stateManager.handleRedo(data.redoneEvents);
  uiCoordinator.setActionsEnabled(isConnected);
});

wsClient.onCanvasCleared((data) => {
  console.log('Canvas cleared by user:', data.userId);
  stateManager.clearState();
  canvas.clearCanvas();
  uiCoordinator.setActionsEnabled(isConnected);
});

stateManager.onStateReconstructed((events: readonly DrawingEvent[]) => {
  console.log('Reconstructing canvas with', events.length, 'events');
  canvas.clearCanvas();
  events.forEach((event) => {
    canvas.renderDrawingEvent(event);
  });
});

stateManager.onStateValidationFailed((errors: string[]) => {
  console.error('State validation failed:', errors);
  // TODO: Show error message to user
});

canvas.setOnDrawingEvent((event: DrawingEvent) => {
  console.log('Local drawing event:', event.type);

  perfMonitor.recordEvent();

  stateManager.addDrawingEvent(event);

  if (isConnected) {
    wsClient.emitDrawingEvent(event);
  } else {
    console.warn('Cannot send drawing event: not connected to server');
  }

  uiCoordinator.setActionsEnabled(isConnected);
});

canvas.setOnCursorEvent((cursor) => {
  console.log('Local cursor event:', cursor.userId, cursor.isActive);

  if (isConnected) {
    wsClient.emitCursorEvent(cursor);
  }
});

wsClient.onConnectionState((state) => {
  isConnected = state.isConnected;

  if (state.isConnected) {
    uiCoordinator.updateConnectionStatus(true, `Connected to room: ${state.roomId}`);
    console.log('Connected to WebSocket server, room:', state.roomId);

    canvas.setUserContext(state.userId, state.roomId || roomId);
    uiCoordinator.setActionsEnabled(true);

    if (state.roomId) {
      wsClient.requestRoomInfo(state.roomId);
    }
  } else {
    uiCoordinator.updateConnectionStatus(false, state.lastError || 'Disconnected');
    console.log('Disconnected from WebSocket server');
    uiCoordinator.setActionsEnabled(false);
  }
});

setInterval(() => {
  if (isConnected) {
    const health = wsClient.getConnectionHealth();
    canvas.updateConnectionQuality(health.quality);
  }
}, 5000);

perfMonitor.onMetricsUpdate((metrics) => {
  const memoryStats = stateManager.getMemoryStats();
  const health = wsClient.getConnectionHealth();

  uiCoordinator.updatePerformanceMetrics(
    metrics.fps,
    health.latency,
    memoryStats.estimatedSizeMB,
    memoryStats.drawingEventsCount,
  );
});

function animationLoop() {
  perfMonitor.recordFrame();
  requestAnimationFrame(animationLoop);
}
animationLoop();

// connection starts here
async function initializeConnection() {
  try {
    uiCoordinator.updateConnectionStatus(false, 'Connecting...');
    await wsClient.connect(roomId);
    console.log('Successfully connected to collaborative drawing session');
  } catch (error) {
    console.error('Failed to connect to server:', error);
    uiCoordinator.updateConnectionStatus(false, 'Connection failed - drawing locally only');
  }
}

initializeConnection();

// Setup room list handler
wsClient.onRoomList((data) => {
  const rooms = data.rooms.map((room) => ({
    id: room.id,
    clientCount: room.clientCount,
    historySize: room.stateStats.historySize,
  }));
  uiCoordinator.updateRoomList(rooms);
});

// Setup user joined handler
wsClient.onUserJoined((data) => {
  console.log('New user joined room:', data.userId);
  // Update user count
  wsClient.requestRoomInfo(roomId);
});

// Setup room info handler
wsClient.onRoomInfo((data) => {
  if (data.exists) {
    uiCoordinator.updateUserCount(data.clientCount);
  }
});

window.addEventListener('beforeunload', () => {
  perfMonitor.stopMonitoring();
  wsClient.disconnect();
  uiCoordinator.destroy();
});

// Handle visibility change (pause/resume connection)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('Page hidden - maintaining connection');
  } else {
    console.log('Page visible - ensuring connection');
    if (!isConnected) {
      initializeConnection();
    }
  }
});

console.log('Client initialization complete - collaborative drawing ready');
