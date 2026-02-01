import type { Socket } from 'socket.io';
import type { RoomManager } from '../room-manager.js';
import type { ClientInfo } from '../types/index.js';
import { ERROR_CODES } from '../config/constants.js';

export function handleJoinRoom(
  socket: Socket,
  roomManager: RoomManager,
  clientInfo: ClientInfo,
  data: any,
): void {
  try {
    const { roomId, createIfNotExists } = data;
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('error', { message: 'Invalid room ID', code: ERROR_CODES.INVALID_ROOM_ID });
      return;
    }

    if (createIfNotExists === false && !roomManager.hasRoom(roomId)) {
      socket.emit('error', {
        message: `Room '${roomId}' does not exist`,
        code: ERROR_CODES.ROOM_NOT_FOUND,
      });
      return;
    }

    const room = roomManager.joinRoom(socket.id, roomId, createIfNotExists !== false);
    clientInfo.roomId = roomId;

    // Get complete canvas state for new user
    const canvasState = room.getCanvasState();
    const drawingHistory = room.getDrawingHistory();

    const validation = room.validateState();
    if (!validation.isValid) {
      console.error(
        `[${new Date().toISOString()}] State validation failed for room ${roomId}:`,
        validation.errors,
      );
      socket.emit('error', {
        message: 'Room state is corrupted',
        code: ERROR_CODES.INVALID_ROOM_STATE,
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
    socket.emit('error', { message: 'Failed to join room', code: ERROR_CODES.JOIN_ROOM_ERROR });
  }
}

export function handleLeaveRoom(
  socket: Socket,
  roomManager: RoomManager,
  clientInfo: ClientInfo,
): void {
  try {
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

    roomManager.leaveRoom(socket.id);
    clientInfo.roomId = undefined;

    socket.emit('room-left', { timestamp: new Date().toISOString() });
    console.log(`[${new Date().toISOString()}] Client ${socket.id} left room`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error leaving room for ${socket.id}:`, error);
    socket.emit('error', { message: 'Failed to leave room', code: ERROR_CODES.LEAVE_ROOM_ERROR });
  }
}

export function handleRequestRoomList(socket: Socket, roomManager: RoomManager): void {
  try {
    const roomStats = roomManager.getRoomStats();
    const roomList = roomStats.rooms.map((room) => ({
      id: room.id,
      clientCount: room.clientCount,
      stateStats: room.stateStats,
    }));

    socket.emit('room-list', {
      rooms: roomList,
      totalRooms: roomStats.totalRooms,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[${new Date().toISOString()}] Sent room list to ${socket.id}: ${roomList.length} rooms`,
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error processing room list request from ${socket.id}:`,
      error,
    );
    socket.emit('error', {
      message: 'Failed to get room list',
      code: ERROR_CODES.ROOM_LIST_ERROR,
    });
  }
}

export function handleRequestRoomInfo(socket: Socket, roomManager: RoomManager, data: any): void {
  try {
    const { roomId } = data;
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('error', { message: 'Invalid room ID', code: ERROR_CODES.INVALID_ROOM_ID });
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      socket.emit('room-info', {
        exists: false,
        roomId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    socket.emit('room-info', {
      exists: true,
      roomId: room.id,
      clientCount: room.getClientCount(),
      stateStats: room.getStateStats(),
      timestamp: new Date().toISOString(),
    });

    console.log(`[${new Date().toISOString()}] Sent room info for ${roomId} to ${socket.id}`);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error processing room info request from ${socket.id}:`,
      error,
    );
    socket.emit('error', {
      message: 'Failed to get room info',
      code: ERROR_CODES.ROOM_INFO_ERROR,
    });
  }
}
