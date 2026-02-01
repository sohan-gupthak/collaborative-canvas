import { Server } from 'socket.io';
import { StateManager } from './state-manager.js';
import { EventBatcher } from './event-batcher.js';
import type {
  DrawingEvent,
  CursorEvent,
  CanvasState,
  RoomInfo,
  StateStats,
  StateValidationResult,
} from './types/index.js';

export class Room {
  public readonly id: string;
  private readonly clients: Set<string>;
  private readonly cursors: Map<string, CursorEvent>;
  private readonly stateManager: StateManager;
  private readonly eventBatcher: EventBatcher;
  private readonly createdAt: Date;

  constructor(id: string) {
    this.id = id;
    this.clients = new Set();
    this.cursors = new Map();
    this.stateManager = new StateManager(id);
    this.eventBatcher = new EventBatcher();
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

  getInfo(): RoomInfo {
    return {
      id: this.id,
      clientCount: this.clients.size,
      cursorCount: this.cursors.size,
      createdAt: new Date(this.createdAt.getTime()),
      stateStats: this.stateManager.getStateStats(),
    };
  }

  validateState(): StateValidationResult {
    return this.stateManager.validateState();
  }

  getStateStats(): StateStats {
    return this.stateManager.getStateStats();
  }

  getCursors(): ReadonlyMap<string, CursorEvent> {
    return this.cursors;
  }

  getClients(): ReadonlySet<string> {
    return this.clients;
  }

  addDrawingEvent(event: DrawingEvent): void {
    this.stateManager.addDrawingEvent(event);
  }

  getCanvasState(): Readonly<CanvasState> {
    return this.stateManager.getCompleteState();
  }

  handleUndo(): DrawingEvent[] | null {
    return this.stateManager.undo();
  }

  handleRedo(): DrawingEvent[] | null {
    return this.stateManager.redo();
  }

  getDrawingHistory(): readonly DrawingEvent[] {
    return this.stateManager.reconstructCanvas();
  }

  clearCanvas(): void {
    this.stateManager.clearState();
    console.log(`[${new Date().toISOString()}] Canvas cleared in room ${this.id}`);
  }

  queueBroadcast(event: string, data: any, excludeSocket?: string): void {
    this.eventBatcher.enqueue(event, data, excludeSocket);
  }

  flushBatch(): void {
    this.eventBatcher.flush();
  }

  getBatchedEvents() {
    return this.eventBatcher.flush();
  }

  hasPendingEvents(): boolean {
    return this.eventBatcher.hasPendingEvents();
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

  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
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

  joinRoom(socketId: string, roomId: string, createIfNotExists: boolean = true): Room {
    // function to leaveRoom
    this.leaveRoom(socketId);

    let room = this.rooms.get(roomId);
    if (!room) {
      if (!createIfNotExists) {
        throw new Error(`Room '${roomId}' does not exist`);
      }
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

    if (event === 'drawing-event') {
      room.queueBroadcast(event, data, excludeSocket);
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

  flushAllBatches(): void {
    this.rooms.forEach((room, roomId) => {
      const batchedEvents = room.getBatchedEvents();
      if (batchedEvents.length > 0) {
        batchedEvents.forEach(({ event, data, excludeSocket }) => {
          if (excludeSocket) {
            this.io.to(roomId).except(excludeSocket).emit(event, data);
          } else {
            this.io.to(roomId).emit(event, data);
          }
        });
      }
    });
  }

  getRoomStats() {
    const stats = {
      totalRooms: this.rooms.size,
      totalClients: this.clientRooms.size,
      rooms: Array.from(this.rooms.values()).map((room) => room.getInfo()),
    };
    return stats;
  }

  getRoomState(roomId: string): CanvasState | null {
    const room = this.rooms.get(roomId);
    return room ? room.getCanvasState() : null;
  }

  handleClientDisconnect(socketId: string): void {
    this.leaveRoom(socketId);
  }
}
