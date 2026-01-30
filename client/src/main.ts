import { Canvas } from './canvas.js';
import { WebSocketClient } from './websocket-client.js';
import { DrawingEvent } from './drawing-events.js';
import { ClientStateManager } from './client-state-manager.js';

console.log('Collaborative Drawing Canvas - Client Starting...');

const canvasElement = document.getElementById('drawing-canvas') as HTMLCanvasElement;

if (!canvasElement) {
  throw new Error('Canvas element not found');
}

// canvas instance
const canvas = new Canvas(canvasElement);

// WebSocket client instance
const wsClient = new WebSocketClient('http://localhost:3001');

// Client state manager instance
const stateManager = new ClientStateManager();

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
  updateUndoRedoButtons();
});

wsClient.onRedoApplied((data) => {
  console.log('Redo applied by user:', data.userId, 'events:', data.redoneEvents.length);
  stateManager.handleRedo(data.redoneEvents);
  updateUndoRedoButtons();
});

wsClient.onCanvasCleared((data) => {
  console.log('Canvas cleared by user:', data.userId);
  stateManager.clearState();
  canvas.clearCanvas();
  updateUndoRedoButtons();
});

stateManager.onStateReconstructed((events: DrawingEvent[]) => {
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

  stateManager.addDrawingEvent(event);

  if (isConnected) {
    wsClient.emitDrawingEvent(event);
  } else {
    console.warn('Cannot send drawing event: not connected to server');
  }

  updateUndoRedoButtons();
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

// Undo/Redo UI Controls
const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;

function updateUndoRedoButtons() {
  // For now, we are using enable/disable based on connection status
  if (undoBtn && redoBtn) {
    undoBtn.disabled = !isConnected;
    redoBtn.disabled = !isConnected;
  }
}

if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    if (isConnected) {
      console.log('Undo button clicked');
      wsClient.emitUndoRequest();
    }
  });
}

if (redoBtn) {
  redoBtn.addEventListener('click', () => {
    if (isConnected) {
      console.log('Redo button clicked');
      wsClient.emitRedoRequest();
    }
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (isConnected) {
      console.log('Clear button clicked');
      wsClient.emitClearCanvas();
    } else {
      console.log('Clear button clicked - clearing locally (not connected)');
      stateManager.clearState();
      canvas.clearCanvas();
    }
  });
}

// Drawing tool controls
const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
const brushSizeSlider = document.getElementById('brush-size') as HTMLInputElement;
const brushSizeValue = document.getElementById('brush-size-value') as HTMLSpanElement;
const toolBrush = document.getElementById('tool-brush') as HTMLInputElement;
const toolEraser = document.getElementById('tool-eraser') as HTMLInputElement;

if (colorPicker) {
  colorPicker.addEventListener('input', (event) => {
    const color = (event.target as HTMLInputElement).value;
    canvas.setColor(color);
    console.log('Color changed to:', color);
  });
}

if (brushSizeSlider && brushSizeValue) {
  brushSizeSlider.addEventListener('input', (event) => {
    const size = parseInt((event.target as HTMLInputElement).value, 10);
    canvas.setBrushSize(size);
    brushSizeValue.textContent = size.toString();
    console.log('Brush size changed to:', size);
  });
}

if (toolBrush) {
  toolBrush.addEventListener('change', () => {
    if (toolBrush.checked) {
      canvas.setEraserMode(false);
      console.log('Tool switched to: Brush');
    }
  });
}

if (toolEraser) {
  toolEraser.addEventListener('change', () => {
    if (toolEraser.checked) {
      canvas.setEraserMode(true);
      console.log('Tool switched to: Eraser');
    }
  });
}

// Keyboard shortcuts for undo/redo
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  // Ctrl+Z or Cmd+Z for undo
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault();
    if (isConnected) {
      console.log('Undo keyboard shortcut triggered');
      wsClient.emitUndoRequest();
    }
  }

  // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
  if (
    ((event.ctrlKey || event.metaKey) && event.key === 'y') ||
    ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Z')
  ) {
    event.preventDefault();
    if (isConnected) {
      console.log('Redo keyboard shortcut triggered');
      wsClient.emitRedoRequest();
    }
  }
});

wsClient.onConnectionState((state) => {
  isConnected = state.isConnected;

  if (state.isConnected) {
    updateConnectionStatus(true, `Connected to room: ${state.roomId}`);
    console.log('Connected to WebSocket server, room:', state.roomId);

    canvas.setUserContext(state.userId, state.roomId || roomId);
    updateUndoRedoButtons();
  } else {
    updateConnectionStatus(false, state.lastError || 'Disconnected');
    console.log('Disconnected from WebSocket server');
    updateUndoRedoButtons();
  }
});

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
