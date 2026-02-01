import type { ClientInfo } from './types/index.js';

export interface ConnectionStats {
  totalConnections: number;
  activeClients: number;
  averageSessionDuration: number;
  oldestConnection: Date | null;
}

// ConnectionManager - Manages client connections and their states
export class ConnectionManager {
  private readonly connectedClients: Map<string, ClientInfo>;
  private connectionCount: number;

  constructor() {
    this.connectedClients = new Map();
    this.connectionCount = 0;
  }

  addClient(socketId: string): ClientInfo {
    this.connectionCount++;
    const clientInfo: ClientInfo = {
      id: socketId,
      connectedAt: new Date(),
    };
    this.connectedClients.set(socketId, clientInfo);

    console.log(
      `[${new Date().toISOString()}] Client connected: ${socketId} (Total connections: ${this.connectionCount})`,
    );

    return clientInfo;
  }

  removeClient(socketId: string): ClientInfo | undefined {
    const clientInfo = this.connectedClients.get(socketId);
    this.connectedClients.delete(socketId);

    if (clientInfo) {
      const sessionDuration = Date.now() - clientInfo.connectedAt.getTime();
      console.log(
        `[${new Date().toISOString()}] Client disconnected: ${socketId}, session duration: ${sessionDuration}ms`,
      );

      if (clientInfo.roomId) {
        console.log(
          `[${new Date().toISOString()}] Client ${socketId} was in room: ${clientInfo.roomId}`,
        );
      }
    }

    return clientInfo;
  }

  getClient(socketId: string): ClientInfo | undefined {
    return this.connectedClients.get(socketId);
  }

  updateClient(socketId: string, updates: Partial<ClientInfo>): ClientInfo | undefined {
    const clientInfo = this.connectedClients.get(socketId);
    if (!clientInfo) {
      return undefined;
    }

    const updatedInfo = { ...clientInfo, ...updates };
    this.connectedClients.set(socketId, updatedInfo);
    return updatedInfo;
  }

  hasClient(socketId: string): boolean {
    return this.connectedClients.has(socketId);
  }

  getTotalConnectionCount(): number {
    return this.connectionCount;
  }

  getActiveClientCount(): number {
    return this.connectedClients.size;
  }

  getAllClients(): ReadonlyMap<string, ClientInfo> {
    return this.connectedClients;
  }

  getStats(): ConnectionStats {
    const clients = Array.from(this.connectedClients.values());

    let totalDuration = 0;
    let oldestConnection: Date | null = null;

    for (const client of clients) {
      totalDuration += Date.now() - client.connectedAt.getTime();

      if (!oldestConnection || client.connectedAt < oldestConnection) {
        oldestConnection = client.connectedAt;
      }
    }

    const averageSessionDuration = clients.length > 0 ? totalDuration / clients.length : 0;

    return {
      totalConnections: this.connectionCount,
      activeClients: this.connectedClients.size,
      averageSessionDuration,
      oldestConnection,
    };
  }

  getClientsInRoom(roomId: string): ClientInfo[] {
    return Array.from(this.connectedClients.values()).filter((client) => client.roomId === roomId);
  }

  clear(): void {
    this.connectedClients.clear();
    console.log(`[${new Date().toISOString()}] Cleared all client connections`);
  }
}
