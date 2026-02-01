// Core Drawing Types
export interface Point {
  x: number;
  y: number;
  timestamp: number;
}

export type LineCap = 'round' | 'square' | 'butt';
export type LineJoin = 'round' | 'bevel' | 'miter';

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineCap: LineCap;
  lineJoin: LineJoin;
  isEraser?: boolean;
}

export type DrawingEventType = 'line' | 'start' | 'end';

export interface DrawingEvent {
  id: string;
  strokeId: string;
  type: DrawingEventType;
  userId: string;
  roomId: string;
  points: Point[];
  style: DrawingStyle;
  timestamp: number;
}

// Discriminated Union for Drawing Events
export interface DrawingStartEvent extends DrawingEvent {
  type: 'start';
}

export interface DrawingLineEvent extends DrawingEvent {
  type: 'line';
}

export interface DrawingEndEvent extends DrawingEvent {
  type: 'end';
}

export type TypedDrawingEvent = DrawingStartEvent | DrawingLineEvent | DrawingEndEvent;

// Cursor Events
export interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
}

export interface CursorEvent {
  userId: string;
  roomId: string;
  position: CursorPosition;
  isActive: boolean;
  timestamp: number;
}

// Event Creation Options
export interface CreateDrawingEventOptions {
  type: DrawingEventType;
  userId: string;
  roomId: string;
  points: Point[];
  style: DrawingStyle;
  strokeId?: string;
}
