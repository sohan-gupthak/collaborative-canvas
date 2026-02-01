import type { Socket } from 'socket.io';
import type { RoomManager } from '../room-manager.js';
import type { ConnectionManager } from '../connection-manager.js';

export function handlePing(socket: Socket, data: any): void {
  socket.emit('pong', { timestamp: data.timestamp });
}

export function handleDisconnect(
  socket: Socket,
  roomManager: RoomManager,
  connectionManager: ConnectionManager,
  reason: string,
): void {
  connectionManager.removeClient(socket.id);

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

  console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}, reason: ${reason}`);
}

export function handleSocketError(socket: Socket, error: Error): void {
  console.error(`[${new Date().toISOString()}] Socket error for client ${socket.id}:`, error);
}
