import { Point, DrawingStyle, DrawingEvent, createDrawingEvent } from './drawing-events.js';
import { DrawingRenderer } from './drawing-renderer.js';
import { CursorEvent } from './websocket-client.js';

export class Canvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cursorOverlay: HTMLCanvasElement;
  private cursorCtx: CanvasRenderingContext2D;
  private renderer: DrawingRenderer;
  private cursorRenderer: DrawingRenderer;
  private devicePixelRatio: number;
  private isDrawing: boolean = false;
  private currentPath: Point[] = [];
  private currentStrokeStyle: DrawingStyle | null = null;
  private defaultStyle: DrawingStyle = {
    color: '#000000',
    lineWidth: 2,
    lineCap: 'round',
    lineJoin: 'round',
    isEraser: false,
  };
  private currentColor: string = '#000000';
  private currentLineWidth: number = 2;
  private isEraserMode: boolean = false;
  private onDrawingEventCallback?: (event: DrawingEvent) => void;
  private onCursorEventCallback?: (cursor: CursorEvent) => void;
  private userId: string = 'local-user';
  private roomId: string = 'default-room';
  private currentStrokeId: string | null = null;
  private lastCursorPosition: Point | null = null;
  private cursorActivityTimer: NodeJS.Timeout | null = null;
  private readonly CURSOR_INACTIVE_DELAY = 2000; // currently set to 2s
  private lastCursorEmitTime = 0;
  private readonly CURSOR_EMIT_INTERVAL = 50; // Throttle cursor to 20 updates/sec
  private ghostCursors: Map<string, CursorEvent> = new Map();
  private userColors: Map<string, string> = new Map();

  private eventBatchQueue: DrawingEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private batchInterval = 16; // ~60 FPS (16ms) - adaptive
  private readonly MAX_BATCH_SIZE = 10;
  private lastEmitTime = 0;
  private minEmitInterval = 16; // Throttle to 60 events/second - adaptive

  private connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'good';

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }

    this.ctx = context;
    this.renderer = new DrawingRenderer(context);

    this.cursorOverlay = document.getElementById('cursor-overlay') as HTMLCanvasElement;
    if (!this.cursorOverlay) {
      throw new Error('Cursor overlay canvas not found');
    }

    const cursorContext = this.cursorOverlay.getContext('2d');
    if (!cursorContext) {
      throw new Error('Failed to get 2D context from cursor overlay canvas');
    }

    this.cursorCtx = cursorContext;
    this.cursorRenderer = new DrawingRenderer(cursorContext);
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

    // Setup cursor overlay with same dimensions
    this.cursorOverlay.width = rect.width * this.devicePixelRatio;
    this.cursorOverlay.height = rect.height * this.devicePixelRatio;

    this.cursorCtx.scale(this.devicePixelRatio, this.devicePixelRatio);

    this.cursorOverlay.style.width = rect.width + 'px';
    this.cursorOverlay.style.height = rect.height + 'px';

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

  public renderDrawingEvent(event: DrawingEvent): void {
    this.renderer.renderDrawingEvent(event);
  }

  public renderGhostCursor(cursor: CursorEvent): void {
    if (cursor.userId === this.userId) {
      return;
    }

    if (cursor.isActive) {
      this.ghostCursors.set(cursor.userId, cursor);

      // Generate an consistent color for user if not exists
      if (!this.userColors.has(cursor.userId)) {
        this.userColors.set(cursor.userId, this.generateUserColor(cursor.userId));
      }
    } else {
      this.ghostCursors.delete(cursor.userId);
    }

    this.rerenderGhostCursors();
  }

  public removeGhostCursor(userId: string): void {
    this.ghostCursors.delete(userId);
    this.userColors.delete(userId);
    this.rerenderGhostCursors();
  }

  private rerenderGhostCursors(): void {
    const dimensions = this.getDimensions();
    this.cursorRenderer.clearCanvas(dimensions.width, dimensions.height);

    // Render each active ghost cursor on the overlay
    this.ghostCursors.forEach((cursor, userId) => {
      if (cursor.isActive) {
        const color = this.userColors.get(userId) || this.generateUserColor(userId);
        this.cursorRenderer.renderGhostCursor(cursor, color);
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

  public clearCanvas(): void {
    const dimensions = this.getDimensions();
    this.renderer.clearCanvas(dimensions.width, dimensions.height);
    this.renderer.clearAllEvents();
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

  public setColor(color: string): void {
    this.currentColor = color;
    this.updateDefaultStyle();
  }

  public getColor(): string {
    return this.currentColor;
  }

  public setBrushSize(size: number): void {
    this.currentLineWidth = Math.max(1, Math.min(50, size));
    this.updateDefaultStyle();
  }

  public getBrushSize(): number {
    return this.currentLineWidth;
  }

  public setEraserMode(enabled: boolean): void {
    this.isEraserMode = enabled;
    this.updateDefaultStyle();
  }

  public isEraser(): boolean {
    return this.isEraserMode;
  }

  private updateDefaultStyle(): void {
    this.defaultStyle = {
      color: this.isEraserMode ? '#ffffff' : this.currentColor,
      lineWidth: this.currentLineWidth,
      lineCap: 'round',
      lineJoin: 'round',
      isEraser: this.isEraserMode,
    };
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
    this.currentStrokeId = this.generateStrokeId();

    this.currentStrokeStyle = {
      color: this.isEraserMode ? '#ffffff' : this.currentColor,
      lineWidth: this.currentLineWidth,
      lineCap: 'round',
      lineJoin: 'round',
      isEraser: this.isEraserMode,
    };

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
    this.currentStrokeId = null;
    this.currentStrokeStyle = null;
  }

  private drawPoint(point: Point): void {
    const styleToUse = this.currentStrokeStyle || this.defaultStyle;
    this.ctx.save();
    this.applyDrawingStyle(styleToUse);

    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, styleToUse.lineWidth / 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.restore();
  }

  // Draws a line between two points
  private drawLine(from: Point, to: Point): void {
    const styleToUse = this.currentStrokeStyle || this.defaultStyle;
    this.ctx.save();
    this.applyDrawingStyle(styleToUse);

    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private emitDrawingEvent(type: 'line' | 'start' | 'end', points: Point[]): void {
    if (!this.onDrawingEventCallback) return;

    const styleToUse = this.currentStrokeStyle || this.defaultStyle;
    const event = createDrawingEvent(
      type,
      this.userId,
      this.roomId,
      points,
      {
        ...styleToUse,
      },
      this.currentStrokeId || undefined,
    );

    const now = Date.now();
    const timeSinceLastEmit = now - this.lastEmitTime;

    if (type === 'start' || type === 'end') {
      this.flushEventBatch();
      this.onDrawingEventCallback(event);
      this.lastEmitTime = now;
      return;
    }

    if (type === 'line') {
      this.eventBatchQueue.push(event);

      if (
        timeSinceLastEmit >= this.minEmitInterval ||
        this.eventBatchQueue.length >= this.MAX_BATCH_SIZE
      ) {
        this.flushEventBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(
          () => {
            this.flushEventBatch();
          },
          Math.min(this.batchInterval, this.minEmitInterval - timeSinceLastEmit),
        );
      }
    }
  }

  private flushEventBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.eventBatchQueue.length > 0 && this.onDrawingEventCallback) {
      this.eventBatchQueue.forEach((event) => {
        this.onDrawingEventCallback!(event);
      });
      this.eventBatchQueue = [];
      this.lastEmitTime = Date.now();
    }
  }

  private generateStrokeId(): string {
    return `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // callback for when a drawing event occurs
  public setOnDrawingEvent(callback: (event: DrawingEvent) => void): void {
    this.onDrawingEventCallback = callback;
  }

  // callback for when a cursor event occurs
  public setOnCursorEvent(callback: (cursor: CursorEvent) => void): void {
    this.onCursorEventCallback = callback;
  }

  public setUserContext(userId: string, roomId: string): void {
    this.userId = userId;
    this.roomId = roomId;
  }

  private emitCursorEvent(position: Point, isActive: boolean): void {
    if (!this.onCursorEventCallback) return;

    const now = Date.now();
    const timeSinceLastEmit = now - this.lastCursorEmitTime;

    if (!isActive || timeSinceLastEmit >= this.CURSOR_EMIT_INTERVAL) {
      const cursorEvent: CursorEvent = {
        userId: this.userId,
        roomId: this.roomId,
        position: {
          x: position.x,
          y: position.y,
          timestamp: Date.now(),
        },
        isActive,
        timestamp: Date.now(),
      };

      this.onCursorEventCallback(cursorEvent);
      this.lastCursorPosition = position;
      this.lastCursorEmitTime = now;
    }
  }

  private handleCursorMovement(position: Point): void {
    this.emitCursorEvent(position, true);

    if (this.cursorActivityTimer) {
      clearTimeout(this.cursorActivityTimer);
    }

    // Set timer to mark cursor as inactive after delay
    this.cursorActivityTimer = setTimeout(() => {
      if (this.lastCursorPosition) {
        this.emitCursorEvent(this.lastCursorPosition, false);
      }
    }, this.CURSOR_INACTIVE_DELAY);
  }

  // Mouse event handlers
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const point = this.screenToCanvas({ x: event.clientX, y: event.clientY });
    this.handleCursorMovement(point);
    this.startDrawing(point);
  }

  private handleMouseMove(event: MouseEvent): void {
    event.preventDefault();
    const point = this.screenToCanvas({ x: event.clientX, y: event.clientY });
    this.handleCursorMovement(point);

    if (this.isDrawing) {
      this.continueDrawing(point);
    }
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
    this.handleCursorMovement(point);
    this.startDrawing(point);
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const point = this.screenToCanvas({ x: touch.clientX, y: touch.clientY });
    this.handleCursorMovement(point);

    if (this.isDrawing) {
      this.continueDrawing(point);
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.endDrawing();
  }

  public updateConnectionQuality(quality: 'excellent' | 'good' | 'fair' | 'poor'): void {
    if (this.connectionQuality === quality) return; // No change

    this.connectionQuality = quality;

    switch (quality) {
      case 'excellent':
        this.minEmitInterval = 5; // Very fast for excellent connections
        this.batchInterval = 5;
        break;
      case 'good':
        this.minEmitInterval = 8; // Fast for good connections
        this.batchInterval = 8;
        break;
      case 'fair':
        this.minEmitInterval = 16; // Normal for fair connections
        this.batchInterval = 16;
        break;
      case 'poor':
        this.minEmitInterval = 24; // Slower for poor connections
        this.batchInterval = 24;
        break;
    }

    console.log(
      `Adjusted event frequency for ${this.connectionQuality} connection: ${this.minEmitInterval}ms interval`,
    );
  }
}
