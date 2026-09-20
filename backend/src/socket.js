let ioInstance = null;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'].filter(Boolean);
  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Client joins the specific event room when opening its seat map
    socket.on('join:event', (eventId) => {
      socket.join(`event:${eventId}`);
      console.log(`[Socket] ${socket.id} joined room event:${eventId}`);
    });

    // Client leaves room when navigating away
    socket.on('leave:event', (eventId) => {
      socket.leave(`event:${eventId}`);
      console.log(`[Socket] ${socket.id} left room event:${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized. Call initSocket first.');
  }
  return ioInstance;
};

module.exports = { initSocket, getIO };