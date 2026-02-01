export interface RoomInfo {
  id: string;
  clientCount: number;
  historySize: number;
}

export interface RoomCallbacks {
  onCreateRoom: (roomName: string) => Promise<void>;
  onJoinRoom: (roomName: string) => Promise<void>;
  onSwitchRoom: (roomId: string) => Promise<void>;
  onRefreshRooms: () => void;
  onPanelOpened: () => void;
}

export class RoomController {
  private roomPanel: HTMLElement | null;
  private toggleRoomPanelBtn: HTMLButtonElement | null;
  private closeRoomPanelBtn: HTMLButtonElement | null;
  private createRoomBtn: HTMLButtonElement | null;
  private joinRoomBtn: HTMLButtonElement | null;
  private newRoomNameInput: HTMLInputElement | null;
  private joinRoomNameInput: HTMLInputElement | null;
  private refreshRoomsBtn: HTMLButtonElement | null;
  private roomListElement: HTMLElement | null;
  private currentRoomNameElement: HTMLElement | null;
  private roomUserCountElement: HTMLElement | null;
  private copyRoomUrlBtn: HTMLButtonElement | null;

  private callbacks: RoomCallbacks;
  private currentRoomId: string;

  constructor(callbacks: RoomCallbacks, currentRoomId: string) {
    this.callbacks = callbacks;
    this.currentRoomId = currentRoomId;

    // Get DOM elements
    this.roomPanel = document.getElementById('room-panel') as HTMLElement;
    this.toggleRoomPanelBtn = document.getElementById('toggle-room-panel') as HTMLButtonElement;
    this.closeRoomPanelBtn = document.getElementById('close-room-panel') as HTMLButtonElement;
    this.createRoomBtn = document.getElementById('create-room-btn') as HTMLButtonElement;
    this.joinRoomBtn = document.getElementById('join-room-btn') as HTMLButtonElement;
    this.newRoomNameInput = document.getElementById('new-room-name') as HTMLInputElement;
    this.joinRoomNameInput = document.getElementById('join-room-name') as HTMLInputElement;
    this.refreshRoomsBtn = document.getElementById('refresh-rooms-btn') as HTMLButtonElement;
    this.roomListElement = document.getElementById('room-list') as HTMLElement;
    this.currentRoomNameElement = document.getElementById('current-room-name') as HTMLElement;
    this.roomUserCountElement = document.getElementById('room-user-count') as HTMLElement;
    this.copyRoomUrlBtn = document.getElementById('copy-room-url') as HTMLButtonElement;

    this.setupEventListeners();
    this.updateCurrentRoomDisplay();
  }

  private setupEventListeners(): void {
    if (this.toggleRoomPanelBtn) {
      this.toggleRoomPanelBtn.addEventListener('click', () => {
        this.roomPanel?.classList.toggle('hidden');
        if (!this.roomPanel?.classList.contains('hidden')) {
          this.callbacks.onPanelOpened();
        }
      });
    }

    if (this.closeRoomPanelBtn) {
      this.closeRoomPanelBtn.addEventListener('click', () => {
        this.roomPanel?.classList.add('hidden');
      });
    }

    if (this.createRoomBtn && this.newRoomNameInput) {
      this.createRoomBtn.addEventListener('click', async () => {
        await this.handleCreateRoom();
      });

      this.newRoomNameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          this.handleCreateRoom();
        }
      });
    }

    if (this.joinRoomBtn && this.joinRoomNameInput) {
      this.joinRoomBtn.addEventListener('click', async () => {
        await this.handleJoinRoom();
      });

      this.joinRoomNameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          this.handleJoinRoom();
        }
      });
    }

    if (this.refreshRoomsBtn) {
      this.refreshRoomsBtn.addEventListener('click', () => {
        this.callbacks.onRefreshRooms();
      });
    }

    if (this.copyRoomUrlBtn) {
      this.copyRoomUrlBtn.addEventListener('click', async () => {
        await this.handleCopyRoomUrl();
      });
    }
  }

  private async handleCreateRoom(): Promise<void> {
    if (!this.newRoomNameInput) return;

    const roomName = this.newRoomNameInput.value.trim();
    if (!roomName) {
      alert('Please enter a room name');
      return;
    }

    try {
      await this.callbacks.onCreateRoom(roomName);
      this.newRoomNameInput.value = '';
      this.roomPanel?.classList.add('hidden');
      window.history.pushState({}, '', `?room=${encodeURIComponent(roomName)}`);
      location.reload(); // Reload to reinitialize with new room
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room');
    }
  }

  private async handleJoinRoom(): Promise<void> {
    if (!this.joinRoomNameInput) return;

    const roomName = this.joinRoomNameInput.value.trim();
    if (!roomName) {
      alert('Please enter a room name');
      return;
    }

    try {
      await this.callbacks.onJoinRoom(roomName);
      this.joinRoomNameInput.value = '';
      this.roomPanel?.classList.add('hidden');
      window.history.pushState({}, '', `?room=${encodeURIComponent(roomName)}`);
      location.reload(); // Reload to reinitialize with new room
    } catch (error) {
      console.error('Failed to join room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join room';
      alert(errorMessage);
    }
  }

  private async handleCopyRoomUrl(): Promise<void> {
    if (!this.copyRoomUrlBtn) return;

    const roomUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(roomUrl);
      const icon = this.copyRoomUrlBtn.querySelector('i');
      if (icon) {
        icon.className = 'fas fa-check';
        setTimeout(() => {
          icon.className = 'fas fa-link';
        }, 2000);
      }
      console.log('Room URL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy room URL:', error);
      alert('Failed to copy URL');
    }
  }

  public updateRoomList(rooms: RoomInfo[]): void {
    if (!this.roomListElement) return;

    if (rooms.length === 0) {
      this.roomListElement.innerHTML = '<div class="room-list-empty">No rooms available</div>';
      return;
    }

    this.roomListElement.innerHTML = rooms
      .map(
        (room) => `
      <div class="room-item ${room.id === this.currentRoomId ? 'active' : ''}" data-room-id="${room.id}">
        <div class="room-item-header">
          <span class="room-item-name">${room.id}</span>
          <span class="room-item-users"><i class="fa-solid fa-people-group"></i> ${room.clientCount}</span>
        </div>
        <div class="room-item-info">${room.historySize} drawings</div>
      </div>
    `,
      )
      .join('');

    // Added click handlers to room items
    this.roomListElement.querySelectorAll('.room-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const targetRoomId = item.getAttribute('data-room-id');
        if (targetRoomId && targetRoomId !== this.currentRoomId) {
          try {
            await this.callbacks.onSwitchRoom(targetRoomId);
            window.history.pushState({}, '', `?room=${encodeURIComponent(targetRoomId)}`);
            location.reload();
          } catch (error) {
            console.error('Failed to switch room:', error);
          }
        }
      });
    });
  }

  public updateCurrentRoomDisplay(): void {
    if (this.currentRoomNameElement) {
      this.currentRoomNameElement.textContent = this.currentRoomId;
    }
  }

  public updateUserCount(count: number): void {
    if (this.roomUserCountElement) {
      this.roomUserCountElement.innerHTML = `<i class="fa-solid fa-people-group"></i> ${count}`;
    }
  }

  public setCurrentRoomId(roomId: string): void {
    this.currentRoomId = roomId;
    this.updateCurrentRoomDisplay();
  }

  public destroy(): void {
    // Event listeners will be automatically removed when elements are removed from DOM
  }
}
