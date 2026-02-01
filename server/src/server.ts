import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './room-manager.js';
import { ConnectionManager } from './connection-manager.js';
import { PERFORMANCE } from './config/constants.js';
import {
  handleJoinRoom,
  handleLeaveRoom,
  handleRequestRoomList,
  handleRequestRoomInfo,
  handleDrawingEvent,
  handleCursorEvent,
  handleUndoRequest,
  handleRedoRequest,
  handleClearCanvas,
  handleRequestStateSync,
  handlePing,
  handleDisconnect,
  handleSocketError,
} from './handlers/index.js';

dotenv.config();

const app = express();

app.set('trust proxy', 1);

const server = createServer(app);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
  : ['http://localhost:3000'];

console.log('[Server] Allowed origins:', allowedOrigins);
console.log('[Server] Environment:', process.env.NODE_ENV);
console.log('[Server] Port:', process.env.PORT || 3001);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
  pingInterval: PERFORMANCE.PING_INTERVAL_MS,
  pingTimeout: PERFORMANCE.PING_TIMEOUT_MS,
  perMessageDeflate: false,
});

const roomManager = new RoomManager(io);
const connectionManager = new ConnectionManager();

// Performance optimization - flush batched events every 16ms (~60 FPS)
setInterval(() => {
  roomManager.flushAllBatches();
}, PERFORMANCE.BATCH_INTERVAL_MS);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

app.use(express.json());

app.get('/health', (_req, res) => {
  const connectionStats = connectionManager.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connections: connectionStats.totalConnections,
    activeClients: connectionStats.activeClients,
    averageSessionDuration: connectionStats.averageSessionDuration,
    roomStats: roomManager.getRoomStats(),
  });
});

io.on('connection', (socket) => {
  const clientInfo = connectionManager.addClient(socket.id);

  // Room event handlers
  socket.on('join-room', (data) => handleJoinRoom(socket, roomManager, clientInfo, data));
  socket.on('leave-room', () => handleLeaveRoom(socket, roomManager, clientInfo));
  socket.on('request-room-list', () => handleRequestRoomList(socket, roomManager));
  socket.on('request-room-info', (data) => handleRequestRoomInfo(socket, roomManager, data));

  // Drawing event handlers
  socket.on('drawing-event', (data) => handleDrawingEvent(socket, roomManager, data));
  socket.on('cursor-event', (data) => handleCursorEvent(socket, roomManager, data));

  // State management handlers
  socket.on('undo-request', () => handleUndoRequest(socket, roomManager));
  socket.on('redo-request', () => handleRedoRequest(socket, roomManager));
  socket.on('clear-canvas', () => handleClearCanvas(socket, roomManager));
  socket.on('request-state-sync', (data) => handleRequestStateSync(socket, roomManager, data));

  // Connection handlers
  socket.on('ping', (data) => handlePing(socket, data));
  socket.on('error', (error) => handleSocketError(socket, error));
  socket.on('disconnect', (reason) =>
    handleDisconnect(socket, roomManager, connectionManager, reason),
  );
});

process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(
    `[${new Date().toISOString()}] Unhandled Rejection at:`,
    promise,
    'reason:',
    reason,
  );
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Collaborative Drawing Server running on port ${PORT}`);
  console.log(`[${new Date().toISOString()}] Socket.io server ready for connections`);
  console.log(`[${new Date().toISOString()}] Allowed origins:`, allowedOrigins);
});

export { app, server, io, connectionManager, roomManager };
