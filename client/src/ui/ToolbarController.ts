export interface ToolbarCallbacks {
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onToolChange: (isEraser: boolean) => void;
}

export class ToolbarController {
  private colorPicker: HTMLInputElement | null;
  private colorPickerDesktop: HTMLInputElement | null;
  private brushSizeSlider: HTMLInputElement | null;
  private brushSizeValue: HTMLSpanElement | null;
  private brushSizeSliderDesktop: HTMLInputElement | null;
  private brushSizeValueDesktop: HTMLSpanElement | null;
  private toolBrush: HTMLInputElement | null;
  private toolEraser: HTMLInputElement | null;

  private callbacks: ToolbarCallbacks;

  constructor(callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;

    // Get DOM elements
    this.colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    this.colorPickerDesktop = document.getElementById('color-picker-desktop') as HTMLInputElement;
    this.brushSizeSlider = document.getElementById('brush-size') as HTMLInputElement;
    this.brushSizeValue = document.getElementById('brush-size-value') as HTMLSpanElement;
    this.brushSizeSliderDesktop = document.getElementById('brush-size-desktop') as HTMLInputElement;
    this.brushSizeValueDesktop = document.getElementById(
      'brush-size-value-desktop',
    ) as HTMLSpanElement;
    this.toolBrush = document.getElementById('tool-brush') as HTMLInputElement;
    this.toolEraser = document.getElementById('tool-eraser') as HTMLInputElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Color picker - Mobile
    if (this.colorPicker) {
      this.colorPicker.addEventListener('input', (event) => {
        const color = (event.target as HTMLInputElement).value;
        this.callbacks.onColorChange(color);
        // Sync with desktop color picker
        if (this.colorPickerDesktop) {
          this.colorPickerDesktop.value = color;
        }
        console.log('Color changed to:', color);
      });
    }

    // Color picker - Desktop
    if (this.colorPickerDesktop) {
      this.colorPickerDesktop.addEventListener('input', (event) => {
        const color = (event.target as HTMLInputElement).value;
        this.callbacks.onColorChange(color);
        // Sync with mobile color picker
        if (this.colorPicker) {
          this.colorPicker.value = color;
        }
        console.log('Color changed to (desktop):', color);
      });
    }

    // Brush size slider - Mobile
    if (this.brushSizeSlider && this.brushSizeValue) {
      this.brushSizeSlider.addEventListener('input', (event) => {
        const size = parseInt((event.target as HTMLInputElement).value, 10);
        this.callbacks.onBrushSizeChange(size);
        this.brushSizeValue!.textContent = size.toString();
        // Sync with desktop slider
        if (this.brushSizeSliderDesktop) {
          this.brushSizeSliderDesktop.value = size.toString();
        }
        if (this.brushSizeValueDesktop) {
          this.brushSizeValueDesktop.textContent = size.toString();
        }
        console.log('Brush size changed to:', size);
      });
    }

    // Brush size slider - Desktop
    if (this.brushSizeSliderDesktop && this.brushSizeValueDesktop) {
      this.brushSizeSliderDesktop.addEventListener('input', (event) => {
        const size = parseInt((event.target as HTMLInputElement).value, 10);
        this.callbacks.onBrushSizeChange(size);
        this.brushSizeValueDesktop!.textContent = size.toString();
        // Sync with mobile slider
        if (this.brushSizeSlider) {
          this.brushSizeSlider.value = size.toString();
        }
        if (this.brushSizeValue) {
          this.brushSizeValue.textContent = size.toString();
        }
        console.log('Brush size changed to (desktop):', size);
      });
    }

    if (this.toolBrush) {
      this.toolBrush.addEventListener('change', () => {
        if (this.toolBrush!.checked) {
          this.callbacks.onToolChange(false); // Not eraser
          console.log('Tool switched to: Brush');
        }
      });
    }

    if (this.toolEraser) {
      this.toolEraser.addEventListener('change', () => {
        if (this.toolEraser!.checked) {
          this.callbacks.onToolChange(true); // Is eraser
          console.log('Tool switched to: Eraser');
        }
      });
    }
  }

  public setColor(color: string): void {
    if (this.colorPicker) {
      this.colorPicker.value = color;
    }
    if (this.colorPickerDesktop) {
      this.colorPickerDesktop.value = color;
    }
  }

  public setBrushSize(size: number): void {
    const sizeStr = size.toString();
    if (this.brushSizeSlider) {
      this.brushSizeSlider.value = sizeStr;
    }
    if (this.brushSizeValue) {
      this.brushSizeValue.textContent = sizeStr;
    }
    if (this.brushSizeSliderDesktop) {
      this.brushSizeSliderDesktop.value = sizeStr;
    }
    if (this.brushSizeValueDesktop) {
      this.brushSizeValueDesktop.textContent = sizeStr;
    }
  }

  public setTool(isEraser: boolean): void {
    if (isEraser) {
      if (this.toolEraser) {
        this.toolEraser.checked = true;
      }
    } else {
      if (this.toolBrush) {
        this.toolBrush.checked = true;
      }
    }
  }

  public destroy(): void {
    // Event listeners will be automatically removed when elements are removed from DOM
  }
}
