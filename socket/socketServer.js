const { Server } = require('socket.io');

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const connectedUsers = new Map(); // socketId -> userInfo
  const userSockets = new Map(); // userId -> socketId

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Register user when they connect
    socket.on('register_user', (data) => {
      const { userId, userType } = data;
      
      // Store user info
      connectedUsers.set(socket.id, {
        userId,
        userType,
        socketId: socket.id
      });
      
      userSockets.set(userId, socket.id);
      
      console.log(`${userType} ${userId} registered`);
    });

    socket.on('join_chat', (data) => {
      const { userId, userType, supportUserId } = data;
      let roomId;
      
      if (userType === 'customer') {
        roomId = `chat_${supportUserId}_${userId}`;
      } else {
        roomId = `chat_${supportUserId}_${userId}`; // Keep consistent format
      }
      
      socket.join(roomId);
      socket.userId = userId;
      socket.userType = userType;
      socket.roomId = roomId;
      socket.supportUserId = supportUserId;
      
      connectedUsers.set(socket.id, {
        userId,
        userType,
        roomId,
        socketId: socket.id,
        supportUserId
      });

      console.log(`${userType} ${userId} joined room: ${roomId}`);
      
      // If customer joins, notify the seller specifically
      if (userType === 'customer') {
        console.log(`Notifying seller ${supportUserId} about new chat from customer ${userId}`);
        
        // Check if seller is online
        const sellerSocketId = userSockets.get(supportUserId);
        if (sellerSocketId) {
          io.to(sellerSocketId).emit('new_chat_request', {
            customerId: userId,
            supportUserId: supportUserId,
            roomId: roomId,
            message: `New chat request from customer ${userId}`
          });
          console.log(`Notification sent to seller ${supportUserId}`);
        } else {
          console.log(`Seller ${supportUserId} is not online`);
        }
      }
      
      socket.to(roomId).emit('user_joined', {
        userId,
        userType,
        supportUserId,
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
        
        // Clean up maps
        connectedUsers.delete(socket.id);
        userSockets.delete(userInfo.userId);
      }
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = { initializeSocket };