import { DrawingEvent, DrawingStyle, Point } from './drawing-events.js';
import { CursorEvent } from './websocket-client.js';

export class DrawingRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(context: CanvasRenderingContext2D) {
    this.ctx = context;
  }

  public renderDrawingEvent(event: DrawingEvent): void {
    if (!event.points || event.points.length === 0) {
      return;
    }

    // Save current context state
    this.ctx.save();

    try {
      this.applyDrawingStyle(event.style);

      this.ctx.beginPath();

      if (event.points.length === 1) {
        // Single point - draw a small circle
        this.renderSinglePoint(event.points[0], event.style);
      } else {
        // Multiple points - draw connected line segments
        this.renderMultiplePoints(event.points);
      }
    } finally {
      // we are restoring the context state every single time
      this.ctx.restore();
    }
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
}
