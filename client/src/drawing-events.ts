export interface Point {
  x: number;
  y: number;
  timestamp: number;
}

export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineCap: 'round' | 'square' | 'butt';
  lineJoin: 'round' | 'bevel' | 'miter';
  isEraser?: boolean;
}

export interface DrawingEvent {
  id: string;
  strokeId: string;
  type: 'line' | 'start' | 'end';
  userId: string;
  roomId: string;
  points: Point[];
  style: DrawingStyle;
  timestamp: number;
}

export function validatePoint(point: any): point is Point {
  return (
    typeof point === 'object' &&
    point !== null &&
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    typeof point.timestamp === 'number' &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.timestamp) &&
    point.timestamp > 0
  );
}

export function validateDrawingStyle(style: any): style is DrawingStyle {
  const validLineCaps = ['round', 'square', 'butt'];
  const validLineJoins = ['round', 'bevel', 'miter'];

  return (
    typeof style === 'object' &&
    style !== null &&
    typeof style.color === 'string' &&
    typeof style.lineWidth === 'number' &&
    typeof style.lineCap === 'string' &&
    typeof style.lineJoin === 'string' &&
    style.color.length > 0 &&
    Number.isFinite(style.lineWidth) &&
    style.lineWidth > 0 &&
    validLineCaps.includes(style.lineCap) &&
    validLineJoins.includes(style.lineJoin)
  );
}

export function validateDrawingEvent(event: any): event is DrawingEvent {
  const validTypes = ['line', 'start', 'end'];

  return (
    typeof event === 'object' &&
    event !== null &&
    typeof event.id === 'string' &&
    typeof event.strokeId === 'string' &&
    typeof event.type === 'string' &&
    typeof event.userId === 'string' &&
    typeof event.roomId === 'string' &&
    Array.isArray(event.points) &&
    typeof event.timestamp === 'number' &&
    event.id.length > 0 &&
    event.strokeId.length > 0 &&
    validTypes.includes(event.type) &&
    event.userId.length > 0 &&
    event.roomId.length > 0 &&
    event.points.every(validatePoint) &&
    validateDrawingStyle(event.style) &&
    Number.isFinite(event.timestamp) &&
    event.timestamp > 0
  );
}

export function sanitizePoint(point: Point): Point {
  const MAX_COORDINATE = 100000;
  const MIN_COORDINATE = -100000;

  return {
    x: Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, point.x)),
    y: Math.max(MIN_COORDINATE, Math.min(MAX_COORDINATE, point.y)),
    timestamp: Math.max(0, point.timestamp),
  };
}

export function sanitizeDrawingStyle(style: DrawingStyle): DrawingStyle {
  const MAX_LINE_WIDTH = 100;
  const MIN_LINE_WIDTH = 0.1;

  return {
    color: style.color.trim() || '#000000',
    lineWidth: Math.max(MIN_LINE_WIDTH, Math.min(MAX_LINE_WIDTH, style.lineWidth)),
    lineCap: style.lineCap,
    lineJoin: style.lineJoin,
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
    timestamp: Math.max(0, event.timestamp),
  };
}

export function createDrawingEvent(
  type: 'line' | 'start' | 'end',
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
