# Collaborative Drawing Canvas

A real-time collaborative drawing application built with TypeScript, Node.js, and Socket.io (so far only implemented basic canvas drawing with websocket support TODO: undo/redo operations and room creation/management).

## Project Structure

```
├── client/          # Frontend application (Vite + TypeScript)
├── server/          # Backend server (Node.js + Socket.io)
├── package.json     # Root workspace configuration
└── README.md        # This file
```

## Setup Instructions

### Prerequisites

- Node.js v23.11.1
- npm 9+

### Installation

1. Install dependencies for all packages:

```bash
# Recommended: Use nvm to manage Node.js versions
nvm install v23.11.1
nvm use v23.11.1
```

```bash
npm run install:all
```

Or install individually:

```bash
# Root dependencies
npm install

# Client dependencies
cd client && npm install

# Server dependencies
cd server && npm install
```

### Development

Start both client and server in development mode:

```bash
# Terminal 1 - Start server
npm run dev:server

# Terminal 2 - Start client
npm run dev:client
```

The client will be available at `http://localhost:3000` and the server at `http://localhost:3001`.

### Testing (TODO: need to implement unit tests)

Run tests for both client and server:

```bash
npm run test:all
```

Or run individually:

```bash
npm run test:client  # Vitest tests
npm run test:server  # Jest tests
```

### Building

Build both client and server for production:

```bash
npm run build:all
```

## Technology Stack

- **Client**: TypeScript, Vite, Vitest, Socket.io-client
- **Server**: Node.js, TypeScript, Express, Socket.io, Jest
- **Real-time Communication**: WebSocket via Socket.io
- **Testing**: Vitest (client), Jest (server)
