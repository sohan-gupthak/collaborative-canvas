import { Canvas } from './canvas.js';
import { WebSocketClient } from './websocket-client.js';
import { DrawingEvent } from './drawing-events.js';

console.log('Collaborative Drawing Canvas - Client Starting...');

const canvasElement = document.getElementById('drawing-canvas') as HTMLCanvasElement;

if (!canvasElement) {
  throw new Error('Canvas element not found');
}

// canvas instance
const canvas = new Canvas(canvasElement);

// WebSocket client instance
const wsClient = new WebSocketClient('http://localhost:3001');

// Get room ID from URL or use default one
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default-room';

// Connection state management
let isConnected = false;

const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');

function updateConnectionStatus(connected: boolean, message: string) {
  if (statusIndicator && statusText) {
    statusIndicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
    statusText.textContent = message;
  }
}

wsClient.onConnectionState((state) => {
  isConnected = state.isConnected;

  if (state.isConnected) {
    updateConnectionStatus(true, `Connected to room: ${state.roomId}`);
    console.log('Connected to WebSocket server, room:', state.roomId);

    canvas.setUserContext(state.userId, state.roomId || roomId);
  } else {
    updateConnectionStatus(false, state.lastError || 'Disconnected');
    console.log('Disconnected from WebSocket server');
  }
});

wsClient.onDrawingEvent((event: DrawingEvent) => {
  console.log('Received drawing event from user:', event.userId, event.type);

  canvas.renderDrawingEvent(event);
});

wsClient.onCursorEvent((cursor) => {
  console.log('Received cursor event from user:', cursor.userId, cursor.isActive);
  canvas.renderGhostCursor(cursor);
});

wsClient.onStateSync((state) => {
  console.log('Received state sync:', state);
  // TODO: Implement state synchronization in future tasks
});

wsClient.onUserLeft((data) => {
  console.log('User left room:', data.userId);
  canvas.removeGhostCursor(data.userId);
});

canvas.setOnDrawingEvent((event: DrawingEvent) => {
  console.log('Local drawing event:', event.type);

  if (isConnected) {
    wsClient.emitDrawingEvent(event);
  } else {
    console.warn('Cannot send drawing event: not connected to server');
  }
});

canvas.setOnCursorEvent((cursor) => {
  console.log('Local cursor event:', cursor.userId, cursor.isActive);

  if (isConnected) {
    wsClient.emitCursorEvent(cursor);
  }
});

// connection starts here
async function initializeConnection() {
  try {
    updateConnectionStatus(false, 'Connecting...');
    await wsClient.connect(roomId);
    console.log('Successfully connected to collaborative drawing session');
  } catch (error) {
    console.error('Failed to connect to server:', error);
    updateConnectionStatus(false, 'Connection failed - drawing locally only');
  }
}

initializeConnection();

window.addEventListener('beforeunload', () => {
  wsClient.disconnect();
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
