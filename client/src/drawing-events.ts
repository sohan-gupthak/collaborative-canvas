export type {
  Point,
  DrawingStyle,
  DrawingEvent,
  DrawingEventType,
  LineCap,
  LineJoin,
} from './types/index.js';

import type {
  Point,
  DrawingStyle,
  DrawingEvent,
  LineCap,
  LineJoin,
  DrawingEventType,
} from './types/index.js';
import {
  VALID_LINE_CAPS,
  VALID_LINE_JOINS,
  VALID_EVENT_TYPES,
  MAX_COORDINATE,
  MIN_COORDINATE,
  MAX_LINE_WIDTH,
  MIN_LINE_WIDTH,
  DEFAULT_STROKE_COLOR,
} from './config/constants.js';

export function validatePoint(point: unknown): point is Point {
  if (typeof point !== 'object' || point === null) {
    return false;
  }

  const p = point as Record<string, unknown>;

  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.timestamp === 'number' &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Number.isFinite(p.timestamp) &&
    p.timestamp > 0
  );
}

export function validateDrawingStyle(style: unknown): style is DrawingStyle {
  if (typeof style !== 'object' || style === null) {
    return false;
  }

  const s = style as Record<string, unknown>;

  return (
    typeof s.color === 'string' &&
    typeof s.lineWidth === 'number' &&
    typeof s.lineCap === 'string' &&
    typeof s.lineJoin === 'string' &&
    s.color.length > 0 &&
    Number.isFinite(s.lineWidth) &&
    s.lineWidth > 0 &&
    VALID_LINE_CAPS.includes(s.lineCap as LineCap) &&
    VALID_LINE_JOINS.includes(s.lineJoin as LineJoin)
  );
}

export function validateDrawingEvent(event: unknown): event is DrawingEvent {
  if (typeof event !== 'object' || event === null) {
    return false;
  }

  const e = event as Record<string, unknown>;

  return (
    typeof e.id === 'string' &&
    typeof e.strokeId === 'string' &&
    typeof e.type === 'string' &&
    typeof e.userId === 'string' &&
    typeof e.roomId === 'string' &&
    Array.isArray(e.points) &&
    typeof e.timestamp === 'number' &&
    e.id.length > 0 &&
    e.strokeId.length > 0 &&
    VALID_EVENT_TYPES.includes(e.type as DrawingEventType) &&
    e.userId.length > 0 &&
    e.roomId.length > 0 &&
    e.points.every(validatePoint) &&
    validateDrawingStyle(e.style) &&
    Number.isFinite(e.timestamp) &&
    e.timestamp > 0
  );
}

export function sanitizePoint(point: Point): Point {
  return {
    x: Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, point.x)),
    y: Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, point.y)),
    timestamp: Math.max(0, point.timestamp),
  };
}

export function sanitizeDrawingStyle(style: DrawingStyle): DrawingStyle {
  return {
    color: style.color.trim() || DEFAULT_STROKE_COLOR,
    lineWidth: Math.max(MIN_LINE_WIDTH, Math.min(MAX_LINE_WIDTH, style.lineWidth)),
    lineCap: style.lineCap,
    lineJoin: style.lineJoin,
    isEraser: style.isEraser,
  };
}

export function sanitizeDrawingEvent(event: DrawingEvent): DrawingEvent {
  return {
    id: event.id.trim(),
    strokeId: event.strokeId.trim(),
    type: event.type,
    userId: event.userId.trim(),
    roomId: event.roomId.trim(),
    points: event.points.map(sanitizePoint),
    style: sanitizeDrawingStyle(event.style),
    timestamp: event.timestamp,
  };
}

export function createDrawingEvent(
  type: DrawingEventType,
  userId: string,
  roomId: string,
  points: Point[],
  style: DrawingStyle,
  strokeId?: string,
): DrawingEvent {
  const event: DrawingEvent = {
    id: generateEventId(),
    strokeId: strokeId || generateEventId(),
    type,
    userId: userId.trim(),
    roomId: roomId.trim(),
    points: points.map(sanitizePoint),
    style: sanitizeDrawingStyle(style),
    timestamp: Date.now(),
  };

  return sanitizeDrawingEvent(event);
}

export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function serializeDrawingEvent(event: DrawingEvent): string {
  if (!validateDrawingEvent(event)) {
    throw new Error('Invalid drawing event cannot be serialized');
  }

  return JSON.stringify(event);
}

export function deserializeDrawingEvent(json: string): DrawingEvent {
  try {
    const parsed = JSON.parse(json);

    if (!validateDrawingEvent(parsed)) {
      throw new Error('Invalid drawing event format');
    }

    return sanitizeDrawingEvent(parsed);
  } catch (error) {
    throw new Error(
      `Failed to deserialize drawing event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
