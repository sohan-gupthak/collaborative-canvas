import { io, Socket } from 'socket.io-client';
import { DrawingEvent, validateDrawingEvent } from './drawing-events.js';

export interface CursorEvent {
  userId: string;
  roomId: string;
  position: { x: number; y: number; timestamp: number };
  isActive: boolean;
  timestamp: number;
}

export interface ConnectionState {
  isConnected: boolean;
  roomId: string | null;
  userId: string;
  reconnectAttempts: number;
  lastError: string | null;
}

export interface ConnectionHealth {
  latency: number; // Average latency in ms
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  packetLoss: number; // Percentage 0-100
  lastPingTime: number;
}

export class WebSocketClient {
  private socket: Socket | null = null;
  private connectionState: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  private connectionHealth: ConnectionHealth = {
    latency: 0,
    quality: 'good',
    packetLoss: 0,
    lastPingTime: 0,
  };
  private pingTimes: number[] = [];
  private readonly MAX_PING_SAMPLES = 10;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 5000;

  // Event callbacks
  private onDrawingEventCallback?: (event: DrawingEvent) => void;
  private onCursorEventCallback?: (cursor: CursorEvent) => void;
  private onStateSyncCallback?: (state: any) => void;
  private onConnectionStateCallback?: (state: ConnectionState) => void;
  private onUserLeftCallback?: (data: { userId: string; timestamp: string }) => void;
  private onUndoAppliedCallback?: (data: {
    undoneEvents: DrawingEvent[];
    userId: string;
    timestamp: string;
  }) => void;
  private onRedoAppliedCallback?: (data: {
    redoneEvents: DrawingEvent[];
    userId: string;
    timestamp: string;
  }) => void;
  private onStateSyncFailedCallback?: (error: {
    message: string;
    code: string;
    errors?: string[];
  }) => void;
  private onCanvasClearedCallback?: (data: { userId: string; timestamp: string }) => void;
  private onRoomListCallback?: (data: { rooms: any[]; totalRooms: number }) => void;
  private onRoomInfoCallback?: (data: any) => void;
  private onUserJoinedCallback?: (data: { userId: string; timestamp: string }) => void;

  constructor(private serverUrl: string = 'http://localhost:3001') {
    this.connectionState = {
      isConnected: false,
      roomId: null,
      userId: this.generateUserId(),
      reconnectAttempts: 0,
      lastError: null,
    };
  }

  // connects to the WebSocket server and joins a room
  public async connect(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.socket) {
          this.socket.disconnect();
        }

        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnection: false, // currently we are handle reconnection manually
        });

        this.setupSocketEventListeners();

        this.socket.on('connect', () => {
          console.log(`[WebSocketClient] Connected to server: ${this.serverUrl}`);
          this.connectionState.isConnected = true;
          this.connectionState.reconnectAttempts = 0;
          this.connectionState.lastError = null;

          this.joinRoom(roomId);
          this.notifyConnectionStateChange();
          this.startHealthMonitoring();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('[WebSocketClient] Connection error:', error);
          this.connectionState.lastError = error.message;
          this.notifyConnectionStateChange();
          reject(new Error(`Failed to connect: ${error.message}`));
        });

        this.socket.on('disconnect', (reason) => {
          console.log(`[WebSocketClient] Disconnected: ${reason}`);
          this.connectionState.isConnected = false;
          this.connectionState.roomId = null;
          this.notifyConnectionStateChange();

          // Attempt reconnection if not manually disconnected
          if (reason !== 'io client disconnect') {
            this.attemptReconnection(roomId);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // disconnects from the WebSocket server
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHealthMonitoring();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionState.isConnected = false;
    this.connectionState.roomId = null;
    this.connectionState.reconnectAttempts = 0;
    this.notifyConnectionStateChange();
  }

  // joins a room on the server
  private joinRoom(roomId: string, createIfNotExists: boolean = true): void {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Cannot join room: not connected to server');
    }

    this.socket.emit('join-room', {
      roomId,
      userId: this.connectionState.userId,
      createIfNotExists,
    });

    this.connectionState.roomId = roomId;
    console.log(`[WebSocketClient] Joined room: ${roomId}`);
  }

  // emits a drawing event to the server
  public emitDrawingEvent(event: DrawingEvent): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot emit drawing event: not connected');
      return;
    }

    if (!validateDrawingEvent(event)) {
      console.error('[WebSocketClient] Invalid drawing event:', event);
      return;
    }

    const eventWithContext = {
      ...event,
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId || event.roomId,
    };

    this.socket.emit('drawing-event', eventWithContext);
    console.log(`[WebSocketClient] Emitted drawing event: ${event.type}`);
  }

  // emits a cursor event to the server
  public emitCursorEvent(cursor: CursorEvent): void {
    if (!this.socket || !this.socket.connected) {
      return; // Silently fail for cursor events as they're not critical
    }

    const cursorWithContext = {
      ...cursor,
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId || cursor.roomId,
    };

    this.socket.emit('cursor-event', cursorWithContext);
  }

  // emits an undo request to the server
  public emitUndoRequest(): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot emit undo request: not connected');
      return;
    }

    this.socket.emit('undo-request', {
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId,
    });
  }

  // emits a redo request to the server
  public emitRedoRequest(): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot emit redo request: not connected');
      return;
    }

    this.socket.emit('redo-request', {
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId,
    });
  }

  // requests state synchronization from server
  public requestStateSync(clientVersion?: number): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot request state sync: not connected');
      return;
    }

    this.socket.emit('request-state-sync', {
      clientVersion,
      timestamp: new Date().toISOString(),
    });
  }

  // emits a clear canvas request to the server
  public emitClearCanvas(): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot emit clear canvas: not connected');
      return;
    }

    this.socket.emit('clear-canvas', {
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId,
      timestamp: new Date().toISOString(),
    });
  }

  public requestRoomList(): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot request room list: not connected');
      return;
    }

    this.socket.emit('request-room-list');
  }

  public requestRoomInfo(roomId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot request room info: not connected');
      return;
    }

    this.socket.emit('request-room-info', { roomId });
  }

  public async switchRoom(newRoomId: string, createIfNotExists: boolean = true): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Cannot switch room: not connected');
    }

    const socket = this.socket; // reference for closure

    return new Promise((resolve, reject) => {
      const errorHandler = (error: any) => {
        if (error.code === 'ROOM_NOT_FOUND') {
          socket.off('error', errorHandler);
          socket.off('room-joined', successHandler);
          reject(new Error(error.message));
        }
      };

      const successHandler = () => {
        socket.off('error', errorHandler);
        socket.off('room-joined', successHandler);
        resolve();
      };

      socket.once('error', errorHandler);
      socket.once('room-joined', successHandler);

      socket.emit('leave-room');

      socket.emit('join-room', {
        roomId: newRoomId,
        userId: this.connectionState.userId,
        createIfNotExists,
      });

      this.connectionState.roomId = newRoomId;
      console.log(`[WebSocketClient] Switching to room: ${newRoomId}`);

      setTimeout(() => {
        socket.off('error', errorHandler);
        socket.off('room-joined', successHandler);
        reject(new Error('Room switch timeout'));
      }, 5000);
    });
  }

  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('drawing-event', (event: any) => {
      if (validateDrawingEvent(event) && this.onDrawingEventCallback) {
        // Don't process our own events
        if (event.userId !== this.connectionState.userId) {
          this.onDrawingEventCallback(event);
        }
      } else {
        console.warn('[WebSocketClient] Received invalid drawing event:', event);
      }
    });

    this.socket.on('cursor-event', (cursor: any) => {
      if (this.onCursorEventCallback && cursor.userId !== this.connectionState.userId) {
        this.onCursorEventCallback(cursor);
      }
    });

    this.socket.on('state-sync', (state: any) => {
      if (this.onStateSyncCallback) {
        this.onStateSyncCallback(state);
      }
    });

    this.socket.on('room-joined', (data: any) => {
      console.log(`[WebSocketClient] Room join confirmed:`, data);
    });

    this.socket.on('user-left', (data: any) => {
      console.log(`[WebSocketClient] User left room:`, data);
      if (this.onUserLeftCallback) {
        this.onUserLeftCallback(data);
      }
    });

    this.socket.on('undo-applied', (data: any) => {
      console.log(`[WebSocketClient] Undo applied:`, data);
      if (this.onUndoAppliedCallback) {
        this.onUndoAppliedCallback(data);
      }
    });

    this.socket.on('redo-applied', (data: any) => {
      console.log(`[WebSocketClient] Redo applied:`, data);
      if (this.onRedoAppliedCallback) {
        this.onRedoAppliedCallback(data);
      }
    });

    this.socket.on('state-sync-failed', (error: any) => {
      console.error(`[WebSocketClient] State sync failed:`, error);
      if (this.onStateSyncFailedCallback) {
        this.onStateSyncFailedCallback(error);
      }
    });

    this.socket.on('canvas-cleared', (data: any) => {
      console.log(`[WebSocketClient] Canvas cleared:`, data);
      if (this.onCanvasClearedCallback) {
        this.onCanvasClearedCallback(data);
      }
    });

    this.socket.on('room-list', (data: any) => {
      console.log(`[WebSocketClient] Received room list:`, data);
      if (this.onRoomListCallback) {
        this.onRoomListCallback(data);
      }
    });

    this.socket.on('room-info', (data: any) => {
      console.log(`[WebSocketClient] Received room info:`, data);
      if (this.onRoomInfoCallback) {
        this.onRoomInfoCallback(data);
      }
    });

    this.socket.on('user-joined', (data: any) => {
      console.log(`[WebSocketClient] User joined room:`, data);
      if (this.onUserJoinedCallback) {
        this.onUserJoinedCallback(data);
      }
    });

    this.socket.on('error', (error: any) => {
      console.error('[WebSocketClient] Socket error:', error);
      this.connectionState.lastError = error.message || 'Unknown socket error';
      this.notifyConnectionStateChange();
    });
  }

  // attempts to reconnect to the server
  private attemptReconnection(roomId: string): void {
    if (this.connectionState.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocketClient] Max reconnection attempts reached');
      this.connectionState.lastError = 'Max reconnection attempts reached';
      this.notifyConnectionStateChange();
      return;
    }

    this.connectionState.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1);

    console.log(
      `[WebSocketClient] Attempting reconnection ${this.connectionState.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(roomId);
      } catch (error) {
        console.error('[WebSocketClient] Reconnection failed:', error);
        this.attemptReconnection(roomId);
      }
    }, delay);
  }

  // generating random UserID
  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyConnectionStateChange(): void {
    if (this.onConnectionStateCallback) {
      this.onConnectionStateCallback({ ...this.connectionState });
    }
  }

  // Setters (Event Listeners)
  public onDrawingEvent(callback: (event: DrawingEvent) => void): void {
    this.onDrawingEventCallback = callback;
  }

  public onCursorEvent(callback: (cursor: CursorEvent) => void): void {
    this.onCursorEventCallback = callback;
  }

  public onStateSync(callback: (state: any) => void): void {
    this.onStateSyncCallback = callback;
  }

  public onConnectionState(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateCallback = callback;
  }

  public onUserLeft(callback: (data: { userId: string; timestamp: string }) => void): void {
    this.onUserLeftCallback = callback;
  }

  public onUndoApplied(
    callback: (data: { undoneEvents: DrawingEvent[]; userId: string; timestamp: string }) => void,
  ): void {
    this.onUndoAppliedCallback = callback;
  }

  public onRedoApplied(
    callback: (data: { redoneEvents: DrawingEvent[]; userId: string; timestamp: string }) => void,
  ): void {
    this.onRedoAppliedCallback = callback;
  }

  public onStateSyncFailed(
    callback: (error: { message: string; code: string; errors?: string[] }) => void,
  ): void {
    this.onStateSyncFailedCallback = callback;
  }

  public onCanvasCleared(callback: (data: { userId: string; timestamp: string }) => void): void {
    this.onCanvasClearedCallback = callback;
  }

  public onRoomList(callback: (data: { rooms: any[]; totalRooms: number }) => void): void {
    this.onRoomListCallback = callback;
  }

  public onRoomInfo(callback: (data: any) => void): void {
    this.onRoomInfoCallback = callback;
  }

  public onUserJoined(callback: (data: { userId: string; timestamp: string }) => void): void {
    this.onUserJoinedCallback = callback;
  }

  // Getters
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  public isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  public getCurrentRoomId(): string | null {
    return this.connectionState.roomId;
  }

  public getUserId(): string {
    return this.connectionState.userId;
  }

  public getConnectionHealth(): ConnectionHealth {
    return { ...this.connectionHealth };
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private performHealthCheck(): void {
    if (!this.socket || !this.socket.connected) {
      this.connectionHealth.quality = 'poor';
      return;
    }

    const startTime = Date.now();

    this.socket.emit('ping', { timestamp: startTime });

    const pongListener = (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp;
      this.recordLatency(latency);
      this.updateConnectionQuality();
    };

    this.socket.once('pong', pongListener);

    setTimeout(() => {
      this.socket?.off('pong', pongListener);
    }, 1000);
  }

  private recordLatency(latency: number): void {
    this.pingTimes.push(latency);

    if (this.pingTimes.length > this.MAX_PING_SAMPLES) {
      this.pingTimes.shift();
    }

    // Calculate average latency
    const sum = this.pingTimes.reduce((a, b) => a + b, 0);
    this.connectionHealth.latency = Math.round(sum / this.pingTimes.length);
    this.connectionHealth.lastPingTime = Date.now();
  }

  private updateConnectionQuality(): void {
    const latency = this.connectionHealth.latency;

    if (latency < 50) {
      this.connectionHealth.quality = 'excellent';
    } else if (latency < 100) {
      this.connectionHealth.quality = 'good';
    } else if (latency < 200) {
      this.connectionHealth.quality = 'fair';
    } else {
      this.connectionHealth.quality = 'poor';
    }
  }
}
