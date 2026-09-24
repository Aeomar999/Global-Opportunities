import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust for production
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a personal room based on user ID for direct messages
    socket.on('join_user', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} joined room user_${userId}`);
    });

    // Join a specific chat channel or community
    socket.on('join_channel', (channelId) => {
      socket.join(`channel_${channelId}`);
      console.log(`Socket ${socket.id} joined channel_${channelId}`);
    });

    // Handle sending messages
    socket.on('send_message', (data) => {
      const { channelId, message } = data;
      // Broadcast to the channel
      io.to(`channel_${channelId}`).emit('receive_message', message);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};
