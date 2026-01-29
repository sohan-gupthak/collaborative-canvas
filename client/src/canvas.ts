import { Point, DrawingStyle, DrawingEvent, createDrawingEvent } from './drawing-events.js';
import { DrawingRenderer } from './drawing-renderer.js';

export class Canvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: DrawingRenderer;
  private devicePixelRatio: number;
  private isDrawing: boolean = false;
  private currentPath: Point[] = [];
  private defaultStyle: DrawingStyle = {
    color: '#000000',
    lineWidth: 2,
    lineCap: 'round',
    lineJoin: 'round',
  };
  private onDrawingEventCallback?: (event: DrawingEvent) => void;
  private userId: string = 'local-user';
  private roomId: string = 'default-room';

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }

    this.ctx = context;
    this.renderer = new DrawingRenderer(context);
    this.devicePixelRatio = window.devicePixelRatio || 1;

    this.setupCanvas();
    this.setupEventListeners();
    this.setupDrawingEventListeners();
  }

  public setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();

    // Set actual canvas size in memory (scaled for device pixel ratio)
    this.canvas.width = rect.width * this.devicePixelRatio;
    this.canvas.height = rect.height * this.devicePixelRatio;

    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

    this.applyDrawingStyle(this.defaultStyle);
  }

  public screenToCanvas(screenPoint: { x: number; y: number }): Point {
    const rect = this.canvas.getBoundingClientRect();

    // Convert screen coordinates to canvas coordinates
    const canvasX = screenPoint.x - rect.left;
    const canvasY = screenPoint.y - rect.top;

    return {
      x: canvasX,
      y: canvasY,
      timestamp: Date.now(),
    };
  }

  public canvasToScreen(canvasPoint: Point): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();

    // canvas to screen coordinates
    return {
      x: canvasPoint.x + rect.left,
      y: canvasPoint.y + rect.top,
    };
  }

  private applyDrawingStyle(style: DrawingStyle): void {
    this.ctx.strokeStyle = style.color;
    this.ctx.lineWidth = style.lineWidth;
    this.ctx.lineCap = style.lineCap;
    this.ctx.lineJoin = style.lineJoin;
  }

  public renderDrawingEvent(event: DrawingEvent): void {
    this.renderer.renderDrawingEvent(event);
  }

  public clearCanvas(): void {
    const dimensions = this.getDimensions();
    this.renderer.clearCanvas(dimensions.width, dimensions.height);
  }

  public getDimensions(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => {
      this.devicePixelRatio = window.devicePixelRatio || 1;
      this.setupCanvas();
    });
  }

  public getDevicePixelRatio(): number {
    return this.devicePixelRatio;
  }

  public getCanvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  private setupDrawingEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Touch events for mobile support (future enhancement)
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), {
      passive: false,
    });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
  }

  public startDrawing(point: Point): void {
    this.isDrawing = true;
    this.currentPath = [point];

    // Draw initial point
    this.drawPoint(point);

    this.emitDrawingEvent('start', [point]);
  }

  public continueDrawing(point: Point): void {
    if (!this.isDrawing) return;

    this.currentPath.push(point);

    // Draw line from previous point to current point
    if (this.currentPath.length >= 2) {
      const prevPoint = this.currentPath[this.currentPath.length - 2];
      this.drawLine(prevPoint, point);
    }

    this.emitDrawingEvent('line', [point]);
  }

  public endDrawing(): void {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    // Emit drawing end event with complete path
    this.emitDrawingEvent('end', [...this.currentPath]);

    this.currentPath = [];
  }

  private drawPoint(point: Point): void {
    this.ctx.save();
    this.applyDrawingStyle(this.defaultStyle);

    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, this.defaultStyle.lineWidth / 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.restore();
  }

  // Draws a line between two points
  private drawLine(from: Point, to: Point): void {
    this.ctx.save();
    this.applyDrawingStyle(this.defaultStyle);

    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private emitDrawingEvent(type: 'line' | 'start' | 'end', points: Point[]): void {
    if (!this.onDrawingEventCallback) return;

    const event = createDrawingEvent(type, this.userId, this.roomId, points, {
      ...this.defaultStyle,
    });

    this.onDrawingEventCallback(event);
  }

  // callback for when a drawing event occurs
  public setOnDrawingEvent(callback: (event: DrawingEvent) => void): void {
    this.onDrawingEventCallback = callback;
  }

  public setUserContext(userId: string, roomId: string): void {
    this.userId = userId;
    this.roomId = roomId;
  }

  // Mouse event handlers
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const point = this.screenToCanvas({ x: event.clientX, y: event.clientY });
    this.startDrawing(point);
  }

  private handleMouseMove(event: MouseEvent): void {
    event.preventDefault();
    if (!this.isDrawing) return;

    const point = this.screenToCanvas({ x: event.clientX, y: event.clientY });
    this.continueDrawing(point);
  }

  private handleMouseUp(event: MouseEvent): void {
    event.preventDefault();
    this.endDrawing();
  }

  // Touch event handlers
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const point = this.screenToCanvas({ x: touch.clientX, y: touch.clientY });
    this.startDrawing(point);
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length !== 1 || !this.isDrawing) return;

    const touch = event.touches[0];
    const point = this.screenToCanvas({ x: touch.clientX, y: touch.clientY });
    this.continueDrawing(point);
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.endDrawing();
  }
}
