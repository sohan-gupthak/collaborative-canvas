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
  private toolBrushDesktop: HTMLInputElement | null;
  private toolEraserDesktop: HTMLInputElement | null;

  private callbacks: ToolbarCallbacks;

  constructor(callbacks: ToolbarCallbacks) {
    this.callbacks = callbacks;

    // Get DOM elements - Mobile
    this.colorPicker = document.getElementById('color-picker') as HTMLInputElement;
    this.brushSizeSlider = document.getElementById('brush-size') as HTMLInputElement;
    this.brushSizeValue = document.getElementById('brush-size-value') as HTMLSpanElement;
    this.toolBrush = document.getElementById('tool-brush') as HTMLInputElement;
    this.toolEraser = document.getElementById('tool-eraser') as HTMLInputElement;

    // Get DOM elements - Desktop
    this.colorPickerDesktop = document.getElementById('color-picker-desktop') as HTMLInputElement;
    this.brushSizeSliderDesktop = document.getElementById('brush-size-desktop') as HTMLInputElement;
    this.brushSizeValueDesktop = document.getElementById(
      'brush-size-value-desktop',
    ) as HTMLSpanElement;
    this.toolBrushDesktop = document.getElementById('tool-brush-desktop') as HTMLInputElement;
    this.toolEraserDesktop = document.getElementById('tool-eraser-desktop') as HTMLInputElement;

    console.log('[ToolbarController] Mobile toolBrush found:', this.toolBrush);
    console.log('[ToolbarController] Mobile toolEraser found:', this.toolEraser);
    console.log('[ToolbarController] Desktop toolBrushDesktop found:', this.toolBrushDesktop);
    console.log('[ToolbarController] Desktop toolEraserDesktop found:', this.toolEraserDesktop);

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
      const handleBrushChange = () => {
        console.log(
          '[ToolbarController] Mobile brush change triggered, checked:',
          this.toolBrush!.checked,
        );
        if (this.toolBrush!.checked) {
          this.callbacks.onToolChange(false); // Not eraser
          if (this.toolBrushDesktop) {
            this.toolBrushDesktop.checked = true;
          }
          console.log('Tool switched to: Brush');
        }
      };
      this.toolBrush.addEventListener('change', handleBrushChange);
      this.toolBrush.addEventListener('click', handleBrushChange);
    } else {
      console.log('[ToolbarController] Mobile toolBrush element not found!');
    }

    if (this.toolEraser) {
      const handleEraserChange = () => {
        console.log(
          '[ToolbarController] Mobile eraser change triggered, checked:',
          this.toolEraser!.checked,
        );
        if (this.toolEraser!.checked) {
          this.callbacks.onToolChange(true); // Is eraser
          if (this.toolEraserDesktop) {
            this.toolEraserDesktop.checked = true;
          }
          console.log('Tool switched to: Eraser');
        }
      };
      this.toolEraser.addEventListener('change', handleEraserChange);
      this.toolEraser.addEventListener('click', handleEraserChange);
    } else {
      console.log('[ToolbarController] Mobile toolEraser element not found!');
    }

    if (this.toolBrushDesktop) {
      const handleBrushChange = () => {
        console.log(
          '[ToolbarController] Desktop brush change triggered, checked:',
          this.toolBrushDesktop!.checked,
        );
        if (this.toolBrushDesktop!.checked) {
          this.callbacks.onToolChange(false); // Not eraser
          if (this.toolBrush) {
            this.toolBrush.checked = true;
          }
          console.log('Tool switched to: Brush (desktop)');
        }
      };
      this.toolBrushDesktop.addEventListener('change', handleBrushChange);
      this.toolBrushDesktop.addEventListener('click', handleBrushChange);
    } else {
      console.log('[ToolbarController] Desktop toolBrushDesktop element not found!');
    }

    if (this.toolEraserDesktop) {
      const handleEraserChange = () => {
        console.log(
          '[ToolbarController] Desktop eraser change triggered, checked:',
          this.toolEraserDesktop!.checked,
        );
        if (this.toolEraserDesktop!.checked) {
          this.callbacks.onToolChange(true); // Is eraser
          if (this.toolEraser) {
            this.toolEraser.checked = true;
          }
          console.log('Tool switched to: Eraser (desktop)');
        }
      };
      this.toolEraserDesktop.addEventListener('change', handleEraserChange);
      this.toolEraserDesktop.addEventListener('click', handleEraserChange);
    } else {
      console.log('[ToolbarController] Desktop toolEraserDesktop element not found!');
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
      if (this.toolEraserDesktop) {
        this.toolEraserDesktop.checked = true;
      }
    } else {
      if (this.toolBrush) {
        this.toolBrush.checked = true;
      }
      if (this.toolBrushDesktop) {
        this.toolBrushDesktop.checked = true;
      }
    }
  }

  public destroy(): void {
    // Event listeners will be automatically removed when elements are removed from DOM
  }
}
