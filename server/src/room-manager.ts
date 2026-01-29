import { Server } from 'socket.io';

export interface CursorEvent {
  userId: string;
  roomId: string;
  position: { x: number; y: number; timestamp: number };
  isActive: boolean;
  timestamp: number;
}

export interface DrawingEvent {
  id: string;
  type: 'line' | 'start' | 'end';
  userId: string;
  roomId: string;
  points: Array<{ x: number; y: number; timestamp: number }>;
  style: {
    color: string;
    lineWidth: number;
    lineCap: 'round' | 'square' | 'butt';
    lineJoin: 'round' | 'bevel' | 'miter';
  };
  timestamp: number;
}

export class Room {
  public readonly id: string;
  public readonly clients: Set<string>;
  public readonly cursors: Map<string, CursorEvent>;
  private readonly createdAt: Date;

  constructor(id: string) {
    this.id = id;
    this.clients = new Set();
    this.cursors = new Map();
    this.createdAt = new Date();
  }

  addClient(socketId: string): void {
    this.clients.add(socketId);
    console.log(
      `[${new Date().toISOString()}] Client ${socketId} added to room ${this.id} (${this.clients.size} clients)`,
    );
  }

  removeClient(socketId: string): void {
    this.clients.delete(socketId);
    this.cursors.delete(socketId);
    console.log(
      `[${new Date().toISOString()}] Client ${socketId} removed from room ${this.id} (${this.clients.size} clients)`,
    );
  }

  hasClient(socketId: string): boolean {
    return this.clients.has(socketId);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  updateCursor(socketId: string, cursor: CursorEvent): void {
    this.cursors.set(socketId, cursor);
  }

  removeCursor(socketId: string): void {
    this.cursors.delete(socketId);
  }

  getInfo() {
    return {
      id: this.id,
      clientCount: this.clients.size,
      cursorCount: this.cursors.size,
      createdAt: this.createdAt,
    };
  }
}

export class RoomManager {
  private readonly rooms: Map<string, Room>;
  private readonly clientRooms: Map<string, string>; // socketId -> roomId
  private readonly io: Server;

  constructor(io: Server) {
    this.rooms = new Map();
    this.clientRooms = new Map();
    this.io = io;
  }

  createRoom(roomId: string): Room {
    if (this.rooms.has(roomId)) {
      console.log(`[${new Date().toISOString()}] Room ${roomId} already exists`);
      return this.rooms.get(roomId)!;
    }

    const room = new Room(roomId);
    this.rooms.set(roomId, room);
    console.log(`[${new Date().toISOString()}] Created new room: ${roomId}`);
    return room;
  }

  joinRoom(socketId: string, roomId: string): Room {
    // function to leaveRoom
    this.leaveRoom(socketId);

    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }

    room.addClient(socketId);
    this.clientRooms.set(socketId, roomId);

    // Join Socket.io room for broadcasting
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(roomId);
      console.log(
        `[${new Date().toISOString()}] Socket ${socketId} joined Socket.io room ${roomId}`,
      );
    }

    return room;
  }

  leaveRoom(socketId: string): void {
    const currentRoomId = this.clientRooms.get(socketId);
    if (!currentRoomId) {
      return; // Client doesnot present in any of the room
    }

    const room = this.rooms.get(currentRoomId);
    if (room) {
      room.removeClient(socketId);

      // Cleaning up empty rooms
      if (room.getClientCount() === 0) {
        this.rooms.delete(currentRoomId);
        console.log(`[${new Date().toISOString()}] Deleted empty room: ${currentRoomId}`);
      }
    }

    this.clientRooms.delete(socketId);

    // Leave Socket.io room
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(currentRoomId);
      console.log(
        `[${new Date().toISOString()}] Socket ${socketId} left Socket.io room ${currentRoomId}`,
      );
    }
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getClientRoom(socketId: string): Room | undefined {
    const roomId = this.clientRooms.get(socketId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  broadcastToRoom(roomId: string, event: string, data: any, excludeSocket?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(
        `[${new Date().toISOString()}] Attempted to broadcast to non-existent room: ${roomId}`,
      );
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Broadcasting ${event} to room ${roomId} (${room.getClientCount()} clients)`,
    );

    if (excludeSocket) {
      this.io.to(roomId).except(excludeSocket).emit(event, data);
    } else {
      this.io.to(roomId).emit(event, data);
    }
  }

  getRoomStats() {
    const stats = {
      totalRooms: this.rooms.size,
      totalClients: this.clientRooms.size,
      rooms: Array.from(this.rooms.values()).map((room) => room.getInfo()),
    };
    return stats;
  }

  handleClientDisconnect(socketId: string): void {
    this.leaveRoom(socketId);
  }
}
