import { ToolbarController, type ToolbarCallbacks } from './ToolbarController.js';
import { RoomController, type RoomCallbacks, type RoomInfo } from './RoomController.js';
import { StatusController, type ActionCallbacks } from './StatusController.js';
import { KeyboardController, type KeyboardCallbacks } from './KeyboardController.js';

export interface UICallbacks {
  // Toolbar callbacks
  onColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onToolChange: (isEraser: boolean) => void;

  // Room callbacks
  onCreateRoom: (roomName: string) => Promise<void>;
  onJoinRoom: (roomName: string) => Promise<void>;
  onSwitchRoom: (roomId: string) => Promise<void>;
  onRefreshRooms: () => void;
  onRoomPanelOpened: () => void;

  // Action callbacks
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export class UICoordinator {
  private toolbarController: ToolbarController;
  private roomController: RoomController;
  private statusController: StatusController;
  private keyboardController: KeyboardController;

  constructor(callbacks: UICallbacks, currentRoomId: string) {
    const toolbarCallbacks: ToolbarCallbacks = {
      onColorChange: callbacks.onColorChange,
      onBrushSizeChange: callbacks.onBrushSizeChange,
      onToolChange: callbacks.onToolChange,
    };
    this.toolbarController = new ToolbarController(toolbarCallbacks);

    const roomCallbacks: RoomCallbacks = {
      onCreateRoom: callbacks.onCreateRoom,
      onJoinRoom: callbacks.onJoinRoom,
      onSwitchRoom: callbacks.onSwitchRoom,
      onRefreshRooms: callbacks.onRefreshRooms,
      onPanelOpened: callbacks.onRoomPanelOpened,
    };
    this.roomController = new RoomController(roomCallbacks, currentRoomId);

    const actionCallbacks: ActionCallbacks = {
      onUndo: callbacks.onUndo,
      onRedo: callbacks.onRedo,
      onClear: callbacks.onClear,
    };
    this.statusController = new StatusController(actionCallbacks);

    const keyboardCallbacks: KeyboardCallbacks = {
      onUndo: callbacks.onUndo,
      onRedo: callbacks.onRedo,
    };
    this.keyboardController = new KeyboardController(keyboardCallbacks);
  }

  // Tool bar Methods
  public setColor(color: string): void {
    this.toolbarController.setColor(color);
  }

  public setBrushSize(size: number): void {
    this.toolbarController.setBrushSize(size);
  }

  public setTool(isEraser: boolean): void {
    this.toolbarController.setTool(isEraser);
  }

  // Room Methods
  public updateRoomList(rooms: RoomInfo[]): void {
    this.roomController.updateRoomList(rooms);
  }

  public updateUserCount(count: number): void {
    this.roomController.updateUserCount(count);
  }

  public setCurrentRoomId(roomId: string): void {
    this.roomController.setCurrentRoomId(roomId);
  }

  // Status Methods
  public updateConnectionStatus(connected: boolean, message: string): void {
    this.statusController.updateConnectionStatus(connected, message);
  }

  public updatePerformanceMetrics(
    fps: number,
    latency: number,
    memoryMB: number,
    eventCount: number,
  ): void {
    this.statusController.updatePerformanceMetrics(fps, latency, memoryMB, eventCount);
  }

  public setActionsEnabled(enabled: boolean): void {
    this.statusController.setActionsEnabled(enabled);
  }

  public destroy(): void {
    this.toolbarController.destroy();
    this.roomController.destroy();
    this.statusController.destroy();
    this.keyboardController.destroy();
  }
}
