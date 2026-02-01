export interface ActionCallbacks {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export class StatusController {
  private statusIndicator: HTMLElement | null;
  private statusText: HTMLElement | null;
  private fpsElement: HTMLElement | null;
  private latencyElement: HTMLElement | null;
  private memoryElement: HTMLElement | null;
  private eventsElement: HTMLElement | null;

  // Action buttons (undo/redo/clear)
  private undoBtn: HTMLButtonElement | null;
  private redoBtn: HTMLButtonElement | null;
  private clearBtn: HTMLButtonElement | null;
  private undoBtnDt: HTMLButtonElement | null;
  private redoBtnDt: HTMLButtonElement | null;
  private clearBtnDt: HTMLButtonElement | null;

  private actionCallbacks: ActionCallbacks;

  constructor(actionCallbacks: ActionCallbacks) {
    this.actionCallbacks = actionCallbacks;

    // Get status display elements
    this.statusIndicator = document.getElementById('status-indicator');
    this.statusText = document.getElementById('status-text');
    this.fpsElement = document.getElementById('metric-fps');
    this.latencyElement = document.getElementById('metric-latency');
    this.memoryElement = document.getElementById('metric-memory');
    this.eventsElement = document.getElementById('metric-events');

    // Get action button elements
    this.undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    this.redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
    this.clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    this.undoBtnDt = document.getElementById('undo-btn-dt') as HTMLButtonElement;
    this.redoBtnDt = document.getElementById('redo-btn-dt') as HTMLButtonElement;
    this.clearBtnDt = document.getElementById('clear-btn-dt') as HTMLButtonElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Undo buttons
    if (this.undoBtn) {
      this.undoBtn.addEventListener('click', () => this.actionCallbacks.onUndo());
    }
    if (this.undoBtnDt) {
      this.undoBtnDt.addEventListener('click', () => this.actionCallbacks.onUndo());
    }

    // Redo buttons
    if (this.redoBtn) {
      this.redoBtn.addEventListener('click', () => this.actionCallbacks.onRedo());
    }
    if (this.redoBtnDt) {
      this.redoBtnDt.addEventListener('click', () => this.actionCallbacks.onRedo());
    }

    // Clear buttons
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.actionCallbacks.onClear());
    }
    if (this.clearBtnDt) {
      this.clearBtnDt.addEventListener('click', () => this.actionCallbacks.onClear());
    }
  }

  public updateConnectionStatus(connected: boolean, message: string): void {
    if (this.statusIndicator && this.statusText) {
      this.statusIndicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
      this.statusText.textContent = message;
    }
  }

  public updatePerformanceMetrics(
    fps: number,
    latency: number,
    memoryMB: number,
    eventCount: number,
  ): void {
    if (this.fpsElement) {
      this.fpsElement.textContent = fps.toFixed(0);
    }
    if (this.latencyElement) {
      this.latencyElement.textContent = latency.toFixed(0);
    }
    if (this.memoryElement) {
      this.memoryElement.textContent = memoryMB.toFixed(1);
    }
    if (this.eventsElement) {
      this.eventsElement.textContent = eventCount.toString();
    }
  }

  public setActionsEnabled(enabled: boolean): void {
    const disabled = !enabled;

    if (this.undoBtn) this.undoBtn.disabled = disabled;
    if (this.redoBtn) this.redoBtn.disabled = disabled;
    if (this.undoBtnDt) this.undoBtnDt.disabled = disabled;
    if (this.redoBtnDt) this.redoBtnDt.disabled = disabled;
    // Note: Clear button intentionally not disabled - can clear locally when disconnected
  }

  public destroy(): void {
    // Event listeners will be automatically removed when elements are removed from DOM
  }
}
