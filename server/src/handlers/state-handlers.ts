import type { Socket } from 'socket.io';
import type { RoomManager } from '../room-manager.js';
import { ERROR_CODES } from '../config/constants.js';

export function handleUndoRequest(socket: Socket, roomManager: RoomManager): void {
  try {
    const currentRoom = roomManager.getClientRoom(socket.id);
    if (!currentRoom) {
      socket.emit('error', { message: 'Not in a room', code: ERROR_CODES.NOT_IN_ROOM });
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Undo request from ${socket.id} in room ${currentRoom.id}`,
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
      code: ERROR_CODES.UNDO_REQUEST_ERROR,
    });
  }
}

export function handleRedoRequest(socket: Socket, roomManager: RoomManager): void {
  try {
    const currentRoom = roomManager.getClientRoom(socket.id);
    if (!currentRoom) {
      socket.emit('error', { message: 'Not in a room', code: ERROR_CODES.NOT_IN_ROOM });
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Redo request from ${socket.id} in room ${currentRoom.id}`,
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
      code: ERROR_CODES.REDO_REQUEST_ERROR,
    });
  }
}

export function handleClearCanvas(socket: Socket, roomManager: RoomManager): void {
  try {
    const currentRoom = roomManager.getClientRoom(socket.id);
    if (!currentRoom) {
      socket.emit('error', { message: 'Not in a room', code: ERROR_CODES.NOT_IN_ROOM });
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
      code: ERROR_CODES.CLEAR_CANVAS_ERROR,
    });
  }
}

export function handleRequestStateSync(socket: Socket, roomManager: RoomManager, data: any): void {
  try {
    const currentRoom = roomManager.getClientRoom(socket.id);
    if (!currentRoom) {
      socket.emit('error', { message: 'Not in a room', code: ERROR_CODES.NOT_IN_ROOM });
      return;
    }

    const { clientVersion } = data || {};

    const canvasState = currentRoom.getCanvasState();
    const drawingHistory = currentRoom.getDrawingHistory();

    const validation = currentRoom.validateState();
    if (!validation.isValid) {
      console.error(
        `[${new Date().toISOString()}] State validation failed for room ${currentRoom.id}:`,
        validation.errors,
      );
      socket.emit('state-sync-failed', {
        message: 'Room state is corrupted',
        code: ERROR_CODES.INVALID_ROOM_STATE,
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
      code: ERROR_CODES.STATE_SYNC_ERROR,
      timestamp: new Date().toISOString(),
    });
  }
}
