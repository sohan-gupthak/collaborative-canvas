import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './room-manager.js';

// Drawing event validation interfaces and functions TODO: need to create an seperate interface file
interface ValidationResult {
  isValid: boolean;
  error?: string;
}

function validateDrawingEventData(data: any): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Event data must be an object' };
  }

  if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
    return { isValid: false, error: 'Event ID must be a non-empty string' };
  }

  if (!data.type || !['line', 'start', 'end'].includes(data.type)) {
    return { isValid: false, error: 'Event type must be line, start, or end' };
  }

  if (!Array.isArray(data.points) || data.points.length === 0) {
    return { isValid: false, error: 'Points must be a non-empty array' };
  }

  // Validating points
  for (let i = 0; i < data.points.length; i++) {
    const point = data.points[i];
    if (!point || typeof point !== 'object') {
      return { isValid: false, error: `Point ${i} must be an object` };
    }
    if (
      typeof point.x !== 'number' ||
      typeof point.y !== 'number' ||
      typeof point.timestamp !== 'number'
    ) {
      return { isValid: false, error: `Point ${i} must have numeric x, y, and timestamp` };
    }
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(point.timestamp)
    ) {
      return { isValid: false, error: `Point ${i} coordinates must be finite numbers` };
    }
  }

  // Validating style
  if (!data.style || typeof data.style !== 'object') {
    return { isValid: false, error: 'Style must be an object' };
  }

  const style = data.style;
  if (typeof style.color !== 'string' || style.color.trim().length === 0) {
    return { isValid: false, error: 'Style color must be a non-empty string' };
  }

  if (
    typeof style.lineWidth !== 'number' ||
    !Number.isFinite(style.lineWidth) ||
    style.lineWidth <= 0
  ) {
    return { isValid: false, error: 'Style lineWidth must be a positive finite number' };
  }

  if (!['round', 'square', 'butt'].includes(style.lineCap)) {
    return { isValid: false, error: 'Style lineCap must be round, square, or butt' };
  }

  if (!['round', 'bevel', 'miter'].includes(style.lineJoin)) {
    return { isValid: false, error: 'Style lineJoin must be round, bevel, or miter' };
  }

  // Validating timestamp
  if (
    typeof data.timestamp !== 'number' ||
    !Number.isFinite(data.timestamp) ||
    data.timestamp <= 0
  ) {
    return { isValid: false, error: 'Timestamp must be a positive finite number' };
  }

  return { isValid: true };
}

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager(io);

app.use(cors());
app.use(express.json());

// using Map to store the connected clients
let connectionCount = 0;
const connectedClients = new Map<string, { id: string; connectedAt: Date; roomId?: string }>();

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connections: connectionCount,
    activeClients: connectedClients.size,
    roomStats: roomManager.getRoomStats(),
  });
});

io.on('connection', (socket) => {
  connectionCount++;
  const clientInfo: { id: string; connectedAt: Date; roomId?: string } = {
    id: socket.id,
    connectedAt: new Date(),
  };
  connectedClients.set(socket.id, clientInfo);

  console.log(
    `[${new Date().toISOString()}] Client connected: ${socket.id} (Total connections: ${connectionCount})`,
  );

  socket.on('join-room', (data) => {
    try {
      const { roomId } = data;
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID', code: 'INVALID_ROOM_ID' });
        return;
      }

      const room = roomManager.joinRoom(socket.id, roomId);
      clientInfo.roomId = roomId;

      // Get complete canvas state for new user
      const canvasState = room.getCanvasState();
      const drawingHistory = room.getDrawingHistory();

      const validation = room.stateManager.validateState();
      if (!validation.isValid) {
        console.error(
          `[${new Date().toISOString()}] State validation failed for room ${roomId}:`,
          validation.errors,
        );
        socket.emit('error', {
          message: 'Room state is corrupted',
          code: 'INVALID_ROOM_STATE',
          details: validation.errors,
        });
        return;
      }

      socket.emit('room-joined', {
        roomId: room.id,
        clientCount: room.getClientCount(),
        timestamp: new Date().toISOString(),
      });

      // Sending complete state synchronization to new user
      socket.emit('state-sync', {
        roomId: room.id,
        canvasState,
        drawingHistory,
        version: canvasState.version,
        timestamp: new Date().toISOString(),
        isComplete: true,
      });

      // Notify other clients in the room
      roomManager.broadcastToRoom(
        roomId,
        'user-joined',
        {
          userId: socket.id,
          timestamp: new Date().toISOString(),
        },
        socket.id,
      );

      console.log(
        `[${new Date().toISOString()}] Client ${socket.id} joined room ${roomId} and received state sync (${drawingHistory.length} events, version ${canvasState.version})`,
      );
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error joining room for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to join room', code: 'JOIN_ROOM_ERROR' });
    }
  });

  socket.on('leave-room', () => {
    try {
      const currentRoom = roomManager.getClientRoom(socket.id);
      if (currentRoom) {
        // Notify other clients in the room before leaving
        roomManager.broadcastToRoom(
          currentRoom.id,
          'user-left',
          {
            userId: socket.id,
            timestamp: new Date().toISOString(),
          },
          socket.id,
        );
      }

      roomManager.leaveRoom(socket.id);
      clientInfo.roomId = undefined;

      socket.emit('room-left', { timestamp: new Date().toISOString() });
      console.log(`[${new Date().toISOString()}] Client ${socket.id} left room`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error leaving room for ${socket.id}:`, error);
      socket.emit('error', { message: 'Failed to leave room', code: 'LEAVE_ROOM_ERROR' });
    }
  });

  // Drawing event reception, validation, and broadcasting
  socket.on('drawing-event', (data) => {
    try {
      const currentRoom = roomManager.getClientRoom(socket.id);
      if (!currentRoom) {
        socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
        return;
      }

      const validationResult = validateDrawingEventData(data);
      if (!validationResult.isValid) {
        console.warn(
          `[${new Date().toISOString()}] Invalid drawing event from ${socket.id}:`,
          validationResult.error,
        );
        socket.emit('error', {
          message: `Invalid drawing event: ${validationResult.error}`,
          code: 'INVALID_DRAWING_EVENT',
        });
        return;
      }

      const serverTimestamp = Date.now();
      const processedEvent = {
        ...data,
        userId: socket.id,
        roomId: currentRoom.id,
        serverTimestamp,
        receivedAt: new Date().toISOString(),
        originalTimestamp: data.timestamp,
      };

      currentRoom.addDrawingEvent(processedEvent);

      console.log(
        `[${new Date().toISOString()}] Valid drawing event from ${socket.id} in room ${currentRoom.id}: ${data.type}`,
      );

      roomManager.broadcastToRoom(currentRoom.id, 'drawing-event', processedEvent, socket.id);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error processing drawing event from ${socket.id}:`,
        error,
      );
      socket.emit('error', {
        message: 'Failed to process drawing event',
        code: 'DRAWING_EVENT_ERROR',
      });
    }
  });

  socket.on('cursor-event', (data) => {
    try {
      const currentRoom = roomManager.getClientRoom(socket.id);
      if (!currentRoom) {
        socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
        return;
      }

      const cursorEvent = {
        ...data,
        userId: socket.id,
        roomId: currentRoom.id,
        timestamp: new Date().toISOString(),
      };

      // Updating cursor in room
      currentRoom.updateCursor(socket.id, cursorEvent);

      console.log(
        `[${new Date().toISOString()}] Cursor event from ${socket.id} in room ${currentRoom.id}:`,
        data,
      );

      // Notify to all other clients in the room
      roomManager.broadcastToRoom(currentRoom.id, 'cursor-event', cursorEvent, socket.id);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error processing cursor event from ${socket.id}:`,
        error,
      );
      socket.emit('error', {
        message: 'Failed to process cursor event',
        code: 'CURSOR_EVENT_ERROR',
      });
    }
  });

  socket.on('undo-request', (data) => {
    try {
      const currentRoom = roomManager.getClientRoom(socket.id);
      if (!currentRoom) {
        socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
        return;
      }

      console.log(
        `[${new Date().toISOString()}] Undo request from ${socket.id} in room ${currentRoom.id}:`,
        data,
      );

      // Handling undo operation through state manager
      const undoneEvents = currentRoom.handleUndo();

      if (undoneEvents && undoneEvents.length > 0) {
        roomManager.broadcastToRoom(currentRoom.id, 'undo-applied', {
          undoneEvents,
          userId: socket.id,
          roomId: currentRoom.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        socket.emit('undo-failed', {
          reason: 'No events to undo',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error processing undo request from ${socket.id}:`,
        error,
      );
      socket.emit('error', {
        message: 'Failed to process undo request',
        code: 'UNDO_REQUEST_ERROR',
      });
    }
  });

  socket.on('redo-request', (data) => {
    try {
      const currentRoom = roomManager.getClientRoom(socket.id);
      if (!currentRoom) {
        socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
        return;
      }

      console.log(
        `[${new Date().toISOString()}] Redo request from ${socket.id} in room ${currentRoom.id}:`,
        data,
      );

      // Handling redo operation through state manager
      const redoneEvents = currentRoom.handleRedo();

      if (redoneEvents && redoneEvents.length > 0) {
        roomManager.broadcastToRoom(currentRoom.id, 'redo-applied', {
          redoneEvents,
          userId: socket.id,
          roomId: currentRoom.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        socket.emit('redo-failed', {
          reason: 'No events to redo',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error processing redo request from ${socket.id}:`,
        error,
      );
      socket.emit('error', {
        message: 'Failed to process redo request',
        code: 'REDO_REQUEST_ERROR',
      });
    }
  });

  socket.on('clear-canvas', () => {
    try {
      const currentRoom = roomManager.getClientRoom(socket.id);
      if (!currentRoom) {
        socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
        return;
      }

      console.log(
        `[${new Date().toISOString()}] Clear canvas request from ${socket.id} in room ${currentRoom.id}`,
      );

      currentRoom.clearCanvas();

      roomManager.broadcastToRoom(currentRoom.id, 'canvas-cleared', {
        userId: socket.id,
        roomId: currentRoom.id,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `[${new Date().toISOString()}] Canvas cleared in room ${currentRoom.id} by ${socket.id}`,
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error processing clear canvas from ${socket.id}:`,
        error,
      );
      socket.emit('error', {
        message: 'Failed to clear canvas',
        code: 'CLEAR_CANVAS_ERROR',
      });
    }
  });

  socket.on('request-state-sync', (data) => {
    try {
      const currentRoom = roomManager.getClientRoom(socket.id);
      if (!currentRoom) {
        socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
        return;
      }

      const { clientVersion } = data || {};

      const canvasState = currentRoom.getCanvasState();
      const drawingHistory = currentRoom.getDrawingHistory();

      const validation = currentRoom.stateManager.validateState();
      if (!validation.isValid) {
        console.error(
          `[${new Date().toISOString()}] State validation failed for room ${currentRoom.id}:`,
          validation.errors,
        );
        socket.emit('state-sync-failed', {
          message: 'Room state is corrupted',
          code: 'INVALID_ROOM_STATE',
          errors: validation.errors,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if client needs full sync or partial sync
      const needsFullSync = !clientVersion || clientVersion < canvasState.version;

      socket.emit('state-sync', {
        roomId: currentRoom.id,
        canvasState,
        drawingHistory: needsFullSync ? drawingHistory : [],
        version: canvasState.version,
        clientVersion,
        isComplete: needsFullSync,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `[${new Date().toISOString()}] State sync sent to ${socket.id} in room ${currentRoom.id} (client v${clientVersion} -> server v${canvasState.version}, full sync: ${needsFullSync})`,
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error processing state sync request from ${socket.id}:`,
        error,
      );
      socket.emit('state-sync-failed', {
        message: 'Failed to synchronize state',
        code: 'STATE_SYNC_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] Socket error for client ${socket.id}:`, error);
  });

  socket.on('disconnect', (reason) => {
    const clientInfo = connectedClients.get(socket.id);
    connectedClients.delete(socket.id);

    // handiling client Disconnect
    const currentRoom = roomManager.getClientRoom(socket.id);
    if (currentRoom) {
      roomManager.broadcastToRoom(
        currentRoom.id,
        'user-left',
        {
          userId: socket.id,
          timestamp: new Date().toISOString(),
        },
        socket.id,
      );
    }

    roomManager.handleClientDisconnect(socket.id);

    console.log(
      `[${new Date().toISOString()}] Client disconnected: ${socket.id}, reason: ${reason}`,
    );
    if (clientInfo) {
      const sessionDuration = Date.now() - clientInfo.connectedAt.getTime();
      console.log(
        `[${new Date().toISOString()}] Session duration for ${socket.id}: ${sessionDuration}ms`,
      );

      if (clientInfo.roomId) {
        console.log(
          `[${new Date().toISOString()}] Client ${socket.id} was in room: ${clientInfo.roomId}`,
        );
      }
    }
  });
});

process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(
    `[${new Date().toISOString()}] Unhandled Rejection at:`,
    promise,
    'reason:',
    reason,
  );
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Collaborative Drawing Server running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Socket.io server ready for connections`);
});

export { app, server, io, connectedClients, roomManager };
