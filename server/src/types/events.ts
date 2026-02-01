export interface JoinRoomPayload {
  roomId: string;
  createIfNotExists?: boolean;
}

export interface DrawingEventPayload {
  id: string;
  strokeId?: string;
  type: 'line' | 'start' | 'end';
  points: Array<{ x: number; y: number; timestamp: number }>;
  style: {
    color: string;
    lineWidth: number;
    lineCap: 'round' | 'square' | 'butt';
    lineJoin: 'round' | 'bevel' | 'miter';
    isEraser?: boolean;
  };
  timestamp: number;
}

export interface CursorEventPayload {
  position: { x: number; y: number; timestamp: number };
  isActive: boolean;
}

export interface UndoRequestPayload {
  // Currently empty, but typed for future extensions
}

export interface RedoRequestPayload {
  // Currently empty, but typed for future extensions
}

export interface StateSyncRequestPayload {
  clientVersion?: number;
}

export interface RoomInfoRequestPayload {
  roomId: string;
}

export interface PingPayload {
  timestamp: number;
}
