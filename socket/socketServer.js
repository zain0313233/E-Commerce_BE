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
      
      // Update or set the socket mapping
      userSockets.set(userId, socket.id);
      
      console.log(`${userType} ${userId} registered with socket ${socket.id}`);
      console.log('Active users:', Array.from(userSockets.keys()));
    });

    socket.on('join_chat', (data) => {
      const { userId, userType, supportUserId } = data;
      
      // Create consistent room ID format
      let roomId;
      if (userType === 'customer') {
        roomId = `chat_${supportUserId}_${userId}`;
      } else if (userType === 'seller') {
        roomId = `chat_${userId}_${supportUserId}`;
      }
      
      socket.join(roomId);
      socket.userId = userId;
      socket.userType = userType;
      socket.roomId = roomId;
      socket.supportUserId = supportUserId;
      
      // Update user info with room details
      connectedUsers.set(socket.id, {
        userId,
        userType,
        roomId,
        socketId: socket.id,
        supportUserId
      });

      console.log(`${userType} ${userId} joined room: ${roomId}`);
      
      // If customer joins, notify the seller
      if (userType === 'customer') {
        console.log(`Looking for seller ${supportUserId}...`);
        console.log('Available sellers:', Array.from(userSockets.entries()));
        
        const sellerSocketId = userSockets.get(supportUserId);
        if (sellerSocketId) {
          console.log(`Found seller ${supportUserId} with socket ${sellerSocketId}`);
          
          // Check if the socket still exists and is connected
          const sellerSocket = io.sockets.sockets.get(sellerSocketId);
          if (sellerSocket && sellerSocket.connected) {
            const notificationData = {
              customerId: userId,
              supportUserId: supportUserId,
              roomId: roomId,
              message: `New chat request from customer ${userId}`,
              timestamp: new Date().toISOString()
            };
            
            sellerSocket.emit('new_chat_request', notificationData);
            console.log(`✅ Notification sent to seller ${supportUserId}:`, notificationData);
          } else {
            console.log(`❌ Seller socket ${sellerSocketId} is not connected`);
            // Clean up stale socket reference
            userSockets.delete(supportUserId);
          }
        } else {
          console.log(`❌ Seller ${supportUserId} is not online`);
          console.log('Available users:', Array.from(userSockets.entries()));
        }
      }
      
      // Notify other users in the room
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

      // Send to all users in the room including sender
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
        console.log(`User ${userInfo.userId} (${userInfo.userType}) disconnected`);
        
        // Notify room if user was in a chat
        if (userInfo.roomId) {
          socket.to(userInfo.roomId).emit('user_left', {
            userId: userInfo.userId,
            userType: userInfo.userType,
            message: `${userInfo.userType} left the chat`
          });
        }
        
        // Clean up maps
        connectedUsers.delete(socket.id);
        userSockets.delete(userInfo.userId);
      }
      console.log('User disconnected:', socket.id);
      console.log('Remaining active users:', Array.from(userSockets.keys()));
    });
  });

  return io;
}

module.exports = { initializeSocket };