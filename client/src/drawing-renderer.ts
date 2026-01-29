import { DrawingEvent, DrawingStyle, Point } from './drawing-events.js';

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
    this.ctx.strokeStyle = style.color;
    this.ctx.fillStyle = style.color;
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
}
