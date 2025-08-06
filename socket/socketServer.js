const { Server } = require('socket.io');

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_chat', (data) => {
      const { userId, userType } = data;
      const roomId = `chat_${userId}`;
      
      socket.join(roomId);
      socket.userId = userId;
      socket.userType = userType;
      socket.roomId = roomId;
      
      connectedUsers.set(socket.id, {
        userId,
        userType,
        roomId,
        socketId: socket.id
      });

      console.log(`${userType} ${userId} joined room: ${roomId}`);
      
      socket.to(roomId).emit('user_joined', {
        userId,
        userType,
        message: `${userType} joined the chat`
      });
    });

    socket.on('send_message', (data) => {
      const userInfo = connectedUsers.get(socket.id);
      
      if (!userInfo) {
        socket.emit('error', { message: 'User not in any chat room' });
        return;
      }

      const messageData = {
        id: Date.now() + Math.random(),
        message: data.message,
        senderId: userInfo.userId,
        senderType: userInfo.userType,
        timestamp: new Date().toISOString(),
        roomId: userInfo.roomId
      };

      io.to(userInfo.roomId).emit('receive_message', messageData);
      
      console.log('Message sent in room:', userInfo.roomId, messageData);
    });

    socket.on('typing', (data) => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        socket.to(userInfo.roomId).emit('user_typing', {
          userId: userInfo.userId,
          userType: userInfo.userType,
          isTyping: data.isTyping
        });
      }
    });

    socket.on('disconnect', () => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        socket.to(userInfo.roomId).emit('user_left', {
          userId: userInfo.userId,
          userType: userInfo.userType,
          message: `${userInfo.userType} left the chat`
        });
        connectedUsers.delete(socket.id);
      }
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = { initializeSocket };