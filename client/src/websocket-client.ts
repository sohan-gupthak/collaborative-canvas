import { io, Socket } from 'socket.io-client';
import { validateDrawingEvent } from './drawing-events.js';
import type {
  DrawingEvent,
  CursorEvent,
  ConnectionState,
  ConnectionHealth,
  ConnectionStateCallback,
  DrawingEventCallback,
  CursorEventCallback,
  StateSyncCallback,
  UserLeftCallback,
  UserJoinedCallback,
  UndoAppliedCallback,
  RedoAppliedCallback,
  StateSyncFailedCallback,
  CanvasClearedCallback,
  RoomListCallback,
  RoomInfoCallback,
  JoinRoomPayload,
  UndoRequestPayload,
  RedoRequestPayload,
  ClearCanvasPayload,
  StateSyncRequestPayload,
  RoomInfoRequestPayload,
  PingPayload,
  PongPayload,
  SocketErrorResponse,
} from './types/index.js';
import {
  CONNECTION_CLEANUP_DELAY,
  SOCKET_TIMEOUT,
  MAX_RECONNECT_ATTEMPTS,
  HEALTH_CHECK_INTERVAL,
} from './config/constants.js';

// Re-export for backward compatibility
export type { CursorEvent, ConnectionState, ConnectionHealth } from './types/index.js';

export class WebSocketClient {
  private socket: Socket | null = null;
  private connectionState: ConnectionState;
  private reconnectTimer: NodeJS.Timeout | null = null;
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

  // Event callbacks
  private onDrawingEventCallback?: DrawingEventCallback;
  private onCursorEventCallback?: CursorEventCallback;
  private onStateSyncCallback?: StateSyncCallback;
  private onConnectionStateCallback?: ConnectionStateCallback;
  private onUserLeftCallback?: UserLeftCallback;
  private onUndoAppliedCallback?: UndoAppliedCallback;
  private onRedoAppliedCallback?: RedoAppliedCallback;
  private onStateSyncFailedCallback?: StateSyncFailedCallback;
  private onCanvasClearedCallback?: CanvasClearedCallback;
  private onRoomListCallback?: RoomListCallback;
  private onRoomInfoCallback?: RoomInfoCallback;
  private onUserJoinedCallback?: UserJoinedCallback;

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
          transports: ['websocket'],
          upgrade: false,
          timeout: SOCKET_TIMEOUT,
          reconnection: true,
          reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
          secure: this.serverUrl.startsWith('https'),
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

    const payload: JoinRoomPayload = {
      roomId,
      userId: this.connectionState.userId,
      createIfNotExists,
    };

    this.socket.emit('join-room', payload);

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

    const payload: UndoRequestPayload = {
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId,
    };

    this.socket.emit('undo-request', payload);
  }

  // emits a redo request to the server
  public emitRedoRequest(): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot emit redo request: not connected');
      return;
    }

    const payload: RedoRequestPayload = {
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId,
    };

    this.socket.emit('redo-request', payload);
  }

  // requests state synchronization from server
  public requestStateSync(clientVersion?: number): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot request state sync: not connected');
      return;
    }

    const payload: StateSyncRequestPayload = {
      clientVersion,
      timestamp: new Date().toISOString(),
    };

    this.socket.emit('request-state-sync', payload);
  }

  // emits a clear canvas request to the server
  public emitClearCanvas(): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[WebSocketClient] Cannot emit clear canvas: not connected');
      return;
    }

    const payload: ClearCanvasPayload = {
      userId: this.connectionState.userId,
      roomId: this.connectionState.roomId,
      timestamp: new Date().toISOString(),
    };

    this.socket.emit('clear-canvas', payload);
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

    const payload: RoomInfoRequestPayload = { roomId };
    this.socket.emit('request-room-info', payload);
  }

  public async switchRoom(newRoomId: string, createIfNotExists: boolean = true): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Cannot switch room: not connected');
    }

    const socket = this.socket; // reference for closure

    return new Promise((resolve, reject) => {
      const errorHandler = (error: SocketErrorResponse) => {
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

      const payload: JoinRoomPayload = {
        roomId: newRoomId,
        userId: this.connectionState.userId,
        createIfNotExists,
      };

      socket.emit('join-room', payload);

      this.connectionState.roomId = newRoomId;
      console.log(`[WebSocketClient] Switching to room: ${newRoomId}`);

      setTimeout(() => {
        socket.off('error', errorHandler);
        socket.off('room-joined', successHandler);
        reject(new Error('Room switch timeout'));
      }, CONNECTION_CLEANUP_DELAY);
    });
  }

  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('drawing-event', (rawEvent: unknown) => {
      // Validate and narrow type first
      if (!validateDrawingEvent(rawEvent)) {
        console.warn('[WebSocketClient] Received invalid drawing event:', rawEvent);
        return;
      }

      if (!this.onDrawingEventCallback) {
        return;
      }

      // Don't process our own events
      if (rawEvent.userId !== this.connectionState.userId) {
        this.onDrawingEventCallback(rawEvent);
      }
    });

    this.socket.on('cursor-event', (cursor: CursorEvent) => {
      if (this.onCursorEventCallback && cursor.userId !== this.connectionState.userId) {
        this.onCursorEventCallback(cursor);
      }
    });

    this.socket.on('state-sync', (state: unknown) => {
      if (this.onStateSyncCallback) {
        this.onStateSyncCallback(state as Parameters<StateSyncCallback>[0]);
      }
    });

    this.socket.on('room-joined', (data: unknown) => {
      console.log(`[WebSocketClient] Room join confirmed:`, data);
    });

    this.socket.on('user-left', (data: unknown) => {
      console.log(`[WebSocketClient] User left room:`, data);
      if (this.onUserLeftCallback) {
        this.onUserLeftCallback(data as Parameters<UserLeftCallback>[0]);
      }
    });

    this.socket.on('undo-applied', (data: unknown) => {
      console.log(`[WebSocketClient] Undo applied:`, data);
      if (this.onUndoAppliedCallback) {
        this.onUndoAppliedCallback(data as Parameters<UndoAppliedCallback>[0]);
      }
    });

    this.socket.on('redo-applied', (data: unknown) => {
      console.log(`[WebSocketClient] Redo applied:`, data);
      if (this.onRedoAppliedCallback) {
        this.onRedoAppliedCallback(data as Parameters<RedoAppliedCallback>[0]);
      }
    });

    this.socket.on('state-sync-failed', (error: unknown) => {
      console.error(`[WebSocketClient] State sync failed:`, error);
      if (this.onStateSyncFailedCallback) {
        this.onStateSyncFailedCallback(error as Parameters<StateSyncFailedCallback>[0]);
      }
    });

    this.socket.on('canvas-cleared', (data: unknown) => {
      console.log(`[WebSocketClient] Canvas cleared:`, data);
      if (this.onCanvasClearedCallback) {
        this.onCanvasClearedCallback(data as Parameters<CanvasClearedCallback>[0]);
      }
    });

    this.socket.on('room-list', (data: unknown) => {
      console.log(`[WebSocketClient] Received room list:`, data);
      if (this.onRoomListCallback) {
        this.onRoomListCallback(data as Parameters<RoomListCallback>[0]);
      }
    });

    this.socket.on('room-info', (data: unknown) => {
      console.log(`[WebSocketClient] Received room info:`, data);
      if (this.onRoomInfoCallback) {
        this.onRoomInfoCallback(data as Parameters<RoomInfoCallback>[0]);
      }
    });

    this.socket.on('user-joined', (data: unknown) => {
      console.log(`[WebSocketClient] User joined room:`, data);
      if (this.onUserJoinedCallback) {
        this.onUserJoinedCallback(data as Parameters<UserJoinedCallback>[0]);
      }
    });

    this.socket.on('error', (error: SocketErrorResponse) => {
      console.error('[WebSocketClient] Socket error:', error);
      this.connectionState.lastError = error.message || 'Unknown socket error';
      this.notifyConnectionStateChange();
    });
  }

  // attempts to reconnect to the server
  private attemptReconnection(roomId: string): void {
    if (this.connectionState.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocketClient] Max reconnection attempts reached');
      this.connectionState.lastError = 'Max reconnection attempts reached';
      this.notifyConnectionStateChange();
      return;
    }

    this.connectionState.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1);

    console.log(
      `[WebSocketClient] Attempting reconnection ${this.connectionState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`,
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
  public onDrawingEvent(callback: DrawingEventCallback): void {
    this.onDrawingEventCallback = callback;
  }

  public onCursorEvent(callback: CursorEventCallback): void {
    this.onCursorEventCallback = callback;
  }

  public onStateSync(callback: StateSyncCallback): void {
    this.onStateSyncCallback = callback;
  }

  public onConnectionState(callback: ConnectionStateCallback): void {
    this.onConnectionStateCallback = callback;
  }

  public onUserLeft(callback: UserLeftCallback): void {
    this.onUserLeftCallback = callback;
  }

  public onUndoApplied(callback: UndoAppliedCallback): void {
    this.onUndoAppliedCallback = callback;
  }

  public onRedoApplied(callback: RedoAppliedCallback): void {
    this.onRedoAppliedCallback = callback;
  }

  public onStateSyncFailed(callback: StateSyncFailedCallback): void {
    this.onStateSyncFailedCallback = callback;
  }

  public onCanvasCleared(callback: CanvasClearedCallback): void {
    this.onCanvasClearedCallback = callback;
  }

  public onRoomList(callback: RoomListCallback): void {
    this.onRoomListCallback = callback;
  }

  public onRoomInfo(callback: RoomInfoCallback): void {
    this.onRoomInfoCallback = callback;
  }

  public onUserJoined(callback: UserJoinedCallback): void {
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
    }, HEALTH_CHECK_INTERVAL);
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

    const payload: PingPayload = { timestamp: startTime };
    this.socket.emit('ping', payload);

    const pongListener = (data: PongPayload) => {
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
