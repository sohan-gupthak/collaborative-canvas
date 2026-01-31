import { Canvas } from './canvas.js';
import { WebSocketClient } from './websocket-client.js';
import { DrawingEvent } from './drawing-events.js';
import { ClientStateManager } from './client-state-manager.js';
import { PerformanceMonitor } from './performance-monitor.js';

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

  perfMonitor.recordEvent();

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

wsClient.onConnectionState((state) => {
  isConnected = state.isConnected;

  if (state.isConnected) {
    updateConnectionStatus(true, `Connected to room: ${state.roomId}`);
    console.log('Connected to WebSocket server, room:', state.roomId);

    canvas.setUserContext(state.userId, state.roomId || roomId);
    updateUndoRedoButtons();

    if (state.roomId) {
      wsClient.requestRoomInfo(state.roomId);
    }
  } else {
    updateConnectionStatus(false, state.lastError || 'Disconnected');
    console.log('Disconnected from WebSocket server');
    updateUndoRedoButtons();
  }
});

setInterval(() => {
  if (isConnected) {
    const health = wsClient.getConnectionHealth();
    canvas.updateConnectionQuality(health.quality);
  }
}, 5000);

function updatePerformanceUI(fps: number, latency: number, memoryMB: number, eventCount: number) {
  const fpsElement = document.getElementById('metric-fps');
  const latencyElement = document.getElementById('metric-latency');
  const memoryElement = document.getElementById('metric-memory');
  const eventsElement = document.getElementById('metric-events');

  if (fpsElement) fpsElement.textContent = fps.toFixed(0);
  if (latencyElement) latencyElement.textContent = latency.toFixed(0);
  if (memoryElement) memoryElement.textContent = memoryMB.toFixed(1);
  if (eventsElement) eventsElement.textContent = eventCount.toString();
}

perfMonitor.onMetricsUpdate((metrics) => {
  const memoryStats = stateManager.getMemoryStats();
  const health = wsClient.getConnectionHealth();

  updatePerformanceUI(
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
const undoBtnDt = document.getElementById('undo-btn-dt') as HTMLButtonElement;
const redoBtnDt = document.getElementById('redo-btn-dt') as HTMLButtonElement;
const clearBtnDt = document.getElementById('clear-btn-dt') as HTMLButtonElement;

function updateUndoRedoButtons() {
  const disabled = !isConnected;

  if (undoBtn) undoBtn.disabled = disabled;
  if (redoBtn) redoBtn.disabled = disabled;
  if (undoBtnDt) undoBtnDt.disabled = disabled;
  if (redoBtnDt) redoBtnDt.disabled = disabled;
}

function handleUndo() {
  if (isConnected) {
    console.log('Undo button clicked');
    wsClient.emitUndoRequest();
  }
}

function handleRedo() {
  if (isConnected) {
    console.log('Redo button clicked');
    wsClient.emitRedoRequest();
  }
}

function handleClear() {
  if (isConnected) {
    console.log('Clear button clicked');
    wsClient.emitClearCanvas();
  } else {
    console.log('Clear button clicked - clearing locally (not connected)');
    stateManager.clearState();
    canvas.clearCanvas();
  }
}

if (undoBtn) undoBtn.addEventListener('click', handleUndo);
if (redoBtn) redoBtn.addEventListener('click', handleRedo);
if (clearBtn) clearBtn.addEventListener('click', handleClear);

if (undoBtnDt) undoBtnDt.addEventListener('click', handleUndo);
if (redoBtnDt) redoBtnDt.addEventListener('click', handleRedo);
if (clearBtnDt) clearBtnDt.addEventListener('click', handleClear);

// Drawing tool controls
const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
const brushSizeSlider = document.getElementById('brush-size') as HTMLInputElement;
const brushSizeValue = document.getElementById('brush-size-value') as HTMLSpanElement;
const toolBrush = document.getElementById('tool-brush') as HTMLInputElement;
const toolEraser = document.getElementById('tool-eraser') as HTMLInputElement;

const colorPickerDesktop = document.getElementById('color-picker-desktop') as HTMLInputElement;
const brushSizeSliderDesktop = document.getElementById('brush-size-desktop') as HTMLInputElement;
const brushSizeValueDesktop = document.getElementById(
  'brush-size-value-desktop',
) as HTMLSpanElement;

if (colorPicker) {
  colorPicker.addEventListener('input', (event) => {
    const color = (event.target as HTMLInputElement).value;
    canvas.setColor(color);
    if (colorPickerDesktop) colorPickerDesktop.value = color;
    console.log('Color changed to:', color);
  });
}

if (colorPickerDesktop) {
  colorPickerDesktop.addEventListener('input', (event) => {
    const color = (event.target as HTMLInputElement).value;
    canvas.setColor(color);
    if (colorPicker) colorPicker.value = color;
    console.log('Color changed to (desktop):', color);
  });
}

if (brushSizeSlider && brushSizeValue) {
  brushSizeSlider.addEventListener('input', (event) => {
    const size = parseInt((event.target as HTMLInputElement).value, 10);
    canvas.setBrushSize(size);
    brushSizeValue.textContent = size.toString();
    if (brushSizeSliderDesktop) brushSizeSliderDesktop.value = size.toString();
    if (brushSizeValueDesktop) brushSizeValueDesktop.textContent = size.toString();
    console.log('Brush size changed to:', size);
  });
}

if (brushSizeSliderDesktop && brushSizeValueDesktop) {
  brushSizeSliderDesktop.addEventListener('input', (event) => {
    const size = parseInt((event.target as HTMLInputElement).value, 10);
    canvas.setBrushSize(size);
    brushSizeValueDesktop.textContent = size.toString();
    if (brushSizeSlider) brushSizeSlider.value = size.toString();
    if (brushSizeValue) brushSizeValue.textContent = size.toString();
    console.log('Brush size changed to (desktop):', size);
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

// Room Management UI
const roomPanel = document.getElementById('room-panel') as HTMLElement;
const toggleRoomPanelBtn = document.getElementById('toggle-room-panel') as HTMLButtonElement;
const closeRoomPanelBtn = document.getElementById('close-room-panel') as HTMLButtonElement;
const createRoomBtn = document.getElementById('create-room-btn') as HTMLButtonElement;
const joinRoomBtn = document.getElementById('join-room-btn') as HTMLButtonElement;
const newRoomNameInput = document.getElementById('new-room-name') as HTMLInputElement;
const joinRoomNameInput = document.getElementById('join-room-name') as HTMLInputElement;
const refreshRoomsBtn = document.getElementById('refresh-rooms-btn') as HTMLButtonElement;
const roomListElement = document.getElementById('room-list') as HTMLElement;
const currentRoomNameElement = document.getElementById('current-room-name') as HTMLElement;
const roomUserCountElement = document.getElementById('room-user-count') as HTMLElement;
const copyRoomUrlBtn = document.getElementById('copy-room-url') as HTMLButtonElement;

if (toggleRoomPanelBtn) {
  toggleRoomPanelBtn.addEventListener('click', () => {
    roomPanel?.classList.toggle('hidden');
    if (!roomPanel?.classList.contains('hidden')) {
      wsClient.requestRoomList();
    }
  });
}

if (closeRoomPanelBtn) {
  closeRoomPanelBtn.addEventListener('click', () => {
    roomPanel?.classList.add('hidden');
  });
}

if (createRoomBtn && newRoomNameInput) {
  createRoomBtn.addEventListener('click', async () => {
    const roomName = newRoomNameInput.value.trim();
    if (!roomName) {
      alert('Please enter a room name');
      return;
    }

    try {
      await wsClient.switchRoom(roomName);
      newRoomNameInput.value = '';
      roomPanel?.classList.add('hidden');
      window.history.pushState({}, '', `?room=${encodeURIComponent(roomName)}`);
      location.reload(); // Reload to reinitialize with new room
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room');
    }
  });

  newRoomNameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      createRoomBtn.click();
    }
  });
}

if (joinRoomBtn && joinRoomNameInput) {
  joinRoomBtn.addEventListener('click', async () => {
    const roomName = joinRoomNameInput.value.trim();
    if (!roomName) {
      alert('Please enter a room name');
      return;
    }

    try {
      await wsClient.switchRoom(roomName, false); // Don't create if doesn't exist
      joinRoomNameInput.value = '';
      roomPanel?.classList.add('hidden');
      window.history.pushState({}, '', `?room=${encodeURIComponent(roomName)}`);
      location.reload(); // Reload to reinitialize with new room
    } catch (error) {
      console.error('Failed to join room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join room';
      alert(errorMessage);
    }
  });

  joinRoomNameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      joinRoomBtn.click();
    }
  });
}

if (refreshRoomsBtn) {
  refreshRoomsBtn.addEventListener('click', () => {
    wsClient.requestRoomList();
  });
}

if (copyRoomUrlBtn) {
  copyRoomUrlBtn.addEventListener('click', async () => {
    const roomUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(roomUrl);
      const icon = copyRoomUrlBtn.querySelector('i');
      if (icon) {
        icon.className = 'fas fa-check';
        setTimeout(() => {
          icon.className = 'fas fa-link';
        }, 2000);
      }
      console.log('Room URL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy room URL:', error);
      alert('Failed to copy URL');
    }
  });
}

wsClient.onRoomList((data) => {
  if (!roomListElement) return;

  if (data.rooms.length === 0) {
    roomListElement.innerHTML = '<div class="room-list-empty">No rooms available</div>';
    return;
  }

  roomListElement.innerHTML = data.rooms
    .map(
      (room) => `
    <div class="room-item ${room.id === roomId ? 'active' : ''}" data-room-id="${room.id}">
      <div class="room-item-header">
        <span class="room-item-name">${room.id}</span>
        <span class="room-item-users"><i class="fa-solid fa-people-group"></i> ${room.clientCount}</span>
      </div>
      <div class="room-item-info">${room.stateStats.historySize} drawings</div>
    </div>
  `,
    )
    .join('');

  roomListElement.querySelectorAll('.room-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const targetRoomId = item.getAttribute('data-room-id');
      if (targetRoomId && targetRoomId !== roomId) {
        try {
          await wsClient.switchRoom(targetRoomId);
          window.history.pushState({}, '', `?room=${encodeURIComponent(targetRoomId)}`);
          location.reload();
        } catch (error) {
          console.error('Failed to switch room:', error);
        }
      }
    });
  });
});

wsClient.onUserJoined((data) => {
  console.log('New user joined room:', data.userId);
  // Update user count
  wsClient.requestRoomInfo(roomId);
});

wsClient.onRoomInfo((data) => {
  if (data.exists && roomUserCountElement) {
    roomUserCountElement.innerHTML = `<i class="fa-solid fa-people-group"></i> ${data.clientCount}`;
  }
});

if (currentRoomNameElement) {
  currentRoomNameElement.textContent = roomId;
}

window.addEventListener('beforeunload', () => {
  perfMonitor.stopMonitoring();
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
