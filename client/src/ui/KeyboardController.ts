export interface KeyboardCallbacks {
  onUndo: () => void;
  onRedo: () => void;
}

export class KeyboardController {
  private callbacks: KeyboardCallbacks;
  private keydownHandler: (event: KeyboardEvent) => void;

  constructor(callbacks: KeyboardCallbacks) {
    this.callbacks = callbacks;

    // Create bound handler for removal later
    this.keydownHandler = this.handleKeydown.bind(this);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', this.keydownHandler);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Ctrl+Z or Cmd+Z for undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      console.log('Undo keyboard shortcut triggered');
      this.callbacks.onUndo();
      return;
    }

    // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
    if (
      ((event.ctrlKey || event.metaKey) && event.key === 'y') ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Z')
    ) {
      event.preventDefault();
      console.log('Redo keyboard shortcut triggered');
      this.callbacks.onRedo();
      return;
    }
  }

  public destroy(): void {
    document.removeEventListener('keydown', this.keydownHandler);
  }
}
