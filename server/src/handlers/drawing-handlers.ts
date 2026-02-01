import type { Socket } from 'socket.io';
import type { RoomManager } from '../room-manager.js';
import { validateDrawingEventData } from '../validation/index.js';
import { ERROR_CODES } from '../config/constants.js';

export function handleDrawingEvent(socket: Socket, roomManager: RoomManager, data: any): void {
  try {
    const currentRoom = roomManager.getClientRoom(socket.id);
    if (!currentRoom) {
      socket.emit('error', { message: 'Not in a room', code: ERROR_CODES.NOT_IN_ROOM });
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
        code: ERROR_CODES.INVALID_DRAWING_EVENT,
      });
      return;
    }

    const serverTimestamp = Date.now();
    const processedEvent = {
      ...data,
      strokeId: data.strokeId || data.id,
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
      code: ERROR_CODES.DRAWING_EVENT_ERROR,
    });
  }
}

export function handleCursorEvent(socket: Socket, roomManager: RoomManager, data: any): void {
  try {
    const currentRoom = roomManager.getClientRoom(socket.id);
    if (!currentRoom) {
      socket.emit('error', { message: 'Not in a room', code: ERROR_CODES.NOT_IN_ROOM });
      return;
    }

    const cursorEvent = {
      ...data,
      userId: socket.id,
      roomId: currentRoom.id,
      timestamp: Date.now(),
    };

    // Updating cursor in room
    currentRoom.updateCursor(socket.id, cursorEvent);

    console.log(
      `[${new Date().toISOString()}] Cursor event from ${socket.id} in room ${currentRoom.id}:`,
      data,
    );

    roomManager.broadcastToRoom(currentRoom.id, 'cursor-event', cursorEvent, socket.id);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error processing cursor event from ${socket.id}:`,
      error,
    );
    socket.emit('error', {
      message: 'Failed to process cursor event',
      code: ERROR_CODES.CURSOR_EVENT_ERROR,
    });
  }
}
