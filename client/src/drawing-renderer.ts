import type { DrawingEvent, DrawingStyle, Point, CursorEvent } from './types/index.js';

interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DrawingRenderer {
  private ctx: CanvasRenderingContext2D;
  private dirtyRects: DirtyRect[] = [];
  private pendingRenderFrame: number | null = null;
  private allEvents: DrawingEvent[] = [];
  private strokeLastPoints: Map<string, Point> = new Map();

  constructor(context: CanvasRenderingContext2D) {
    this.ctx = context;
  }

  public renderDrawingEvent(event: DrawingEvent): void {
    if (!event.points || event.points.length === 0) {
      return;
    }

    this.allEvents.push(event);

    const strokeId = event.strokeId || event.id;
    const lastPoint = this.strokeLastPoints.get(strokeId);

    let renderPoints = [...event.points];
    if (event.type === 'line' && lastPoint && event.points.length > 0) {
      renderPoints = [lastPoint, ...event.points];
    }

    if (event.type === 'end') {
      this.strokeLastPoints.delete(strokeId);
    } else if (event.points.length > 0) {
      this.strokeLastPoints.set(strokeId, event.points[event.points.length - 1]);
    }

    // Calculate bounding box for this event
    const bounds = this.calculateBounds(renderPoints, event.style);
    this.markDirty(bounds);

    this.ctx.save();

    try {
      this.applyDrawingStyle(event.style);

      this.ctx.beginPath();

      if (renderPoints.length === 1) {
        // Single point - draw a small circle
        this.renderSinglePoint(renderPoints[0], event.style);
      } else {
        // Multiple points - draw connected line segments
        this.renderMultiplePoints(renderPoints);
      }
    } finally {
      // we are restoring the context state every single time
      this.ctx.restore();
    }

    this.scheduleRender();
  }

  public renderDrawingEvents(events: DrawingEvent[]): void {
    for (const event of events) {
      this.renderDrawingEvent(event);
    }
  }

  private applyDrawingStyle(style: DrawingStyle): void {
    if (style.isEraser) {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
      this.ctx.fillStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = style.color;
      this.ctx.fillStyle = style.color;
    }
    this.ctx.lineWidth = style.lineWidth;
    this.ctx.lineCap = style.lineCap;
    this.ctx.lineJoin = style.lineJoin;
  }

  private renderSinglePoint(point: Point, style: DrawingStyle): void {
    const radius = style.lineWidth / 2;
    this.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private renderMultiplePoints(points: Point[]): void {
    // Move to first point (0, 0)
    this.ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }

    this.ctx.stroke();
  }

  public clearCanvas(width: number, height: number): void {
    this.ctx.clearRect(0, 0, width, height);
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public renderGhostCursor(cursor: CursorEvent, userColor: string): void {
    if (!cursor.isActive) {
      return; // Don't render inactive cursors
    }

    this.ctx.save();

    try {
      this.ctx.fillStyle = userColor;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;

      this.ctx.beginPath();
      this.ctx.arc(cursor.position.x, cursor.position.y, 8, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#000000';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        cursor.userId.substring(0, 8) + '...',
        cursor.position.x,
        cursor.position.y - 15,
      );
    } finally {
      this.ctx.restore();
    }
  }

  public clearGhostCursors(
    cursors: Map<string, CursorEvent>,
    userColors: Map<string, string>,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    // This is a simple approach - (TODO: in a production app need to use layers)
    this.clearCanvas(canvasWidth, canvasHeight);

    cursors.forEach((cursor, userId) => {
      if (cursor.isActive) {
        const color = userColors.get(userId) || this.generateUserColor(userId);
        this.renderGhostCursor(cursor, color);
      }
    });
  }

  private generateUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }

  private calculateBounds(points: Point[], style: DrawingStyle): DirtyRect {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const padding = style.lineWidth * 2;

    return {
      x: Math.floor(minX - padding),
      y: Math.floor(minY - padding),
      width: Math.ceil(maxX - minX + padding * 2),
      height: Math.ceil(maxY - minY + padding * 2),
    };
  }

  private markDirty(rect: DirtyRect): void {
    this.dirtyRects.push(rect);
  }

  private scheduleRender(): void {
    if (this.pendingRenderFrame !== null) {
      return;
    }

    this.pendingRenderFrame = requestAnimationFrame(() => {
      this.renderDirtyRegions();
      this.pendingRenderFrame = null;
    });
  }

  private renderDirtyRegions(): void {
    if (this.dirtyRects.length === 0) {
      return;
    }

    const mergedRect = this.mergeDirtyRects(); // TODO: optimize to only redraw individual rects

    this.dirtyRects = [];

    if (mergedRect.width > 0 && mergedRect.height > 0) {
      // Batched render scheduled via requestAnimationFrame
      void mergedRect;
    }
  }

  private mergeDirtyRects(): DirtyRect {
    if (this.dirtyRects.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = this.dirtyRects[0].x;
    let minY = this.dirtyRects[0].y;
    let maxX = this.dirtyRects[0].x + this.dirtyRects[0].width;
    let maxY = this.dirtyRects[0].y + this.dirtyRects[0].height;

    for (const rect of this.dirtyRects) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  public clearAllEvents(): void {
    this.allEvents = [];
    this.dirtyRects = [];
    this.strokeLastPoints.clear();
    if (this.pendingRenderFrame !== null) {
      cancelAnimationFrame(this.pendingRenderFrame);
      this.pendingRenderFrame = null;
    }
  }
}
