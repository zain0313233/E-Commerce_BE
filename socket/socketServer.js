const { Server } = require('socket.io');
const { Product } = require("../models/product");
const cache = require('../config/cache');

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const connectedUsers = new Map(); 
  const userSockets = new Map(); 

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register_user', (data) => {
      const { userId, userType } = data;
      
      connectedUsers.set(socket.id, {
        userId,
        userType,
        socketId: socket.id
      });
      
      userSockets.set(userId, socket.id);
      
      console.log(`${userType} ${userId} registered with socket ${socket.id}`);
      console.log('Active users:', Array.from(userSockets.keys()));
    });

    socket.on('join_chat', (data) => {
      const { userId, userType, supportUserId } = data;
      
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
      
      connectedUsers.set(socket.id, {
        userId,
        userType,
        roomId,
        socketId: socket.id,
        supportUserId
      });

      console.log(`${userType} ${userId} joined room: ${roomId}`);
      
      if (userType === 'customer') {
        console.log(`Looking for seller ${supportUserId}...`);
        console.log('Available sellers:', Array.from(userSockets.entries()));
        
        const sellerSocketId = userSockets.get(supportUserId);
        if (sellerSocketId) {
          console.log(`Found seller ${supportUserId} with socket ${sellerSocketId}`);
          
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
            userSockets.delete(supportUserId);
          }
        } else {
          console.log(`❌ Seller ${supportUserId} is not online`);
          console.log('Available users:', Array.from(userSockets.entries()));
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

    socket.on('productStockUpdated', async (data) => {
      const { productId, stock } = data;
      console.log(`Product stock updated: ${productId} - New stock: ${stock}`);
      
      try {
        const updatedProduct = await updateProductStock(productId, stock);
        console.log(`Product stock updated successfully: ${updatedProduct.title} - New stock: ${updatedProduct.stock_quantity}`);
        
        
        invalidateProductCache(productId, updatedProduct.user_id, updatedProduct.category);
        
        socket.broadcast.emit('productStockUpdated', { 
          productId, 
          stock,
          success: true,
          productName: updatedProduct.title
        });
      } catch (err) {
        console.error('Error updating product stock:', err);
        
        socket.emit('productStockUpdateError', {
          productId,
          error: err.message
        });
      }
    });

    socket.on('disconnect', () => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        console.log(`User ${userInfo.userId} (${userInfo.userType}) disconnected`);
        
        if (userInfo.roomId) {
          socket.to(userInfo.roomId).emit('user_left', {
            userId: userInfo.userId,
            userType: userInfo.userType,
            message: `${userInfo.userType} left the chat`
          });
        }
        
        connectedUsers.delete(socket.id);
        userSockets.delete(userInfo.userId);
      }
      console.log('User disconnected:', socket.id);
      console.log('Remaining active users:', Array.from(userSockets.keys()));
    });
  });

  return io;
}

async function updateProductStock(productId, stock) {
  try {
    const [updatedRows, [updatedProduct]] = await Product.update(
      { stock_quantity: stock },
      { 
        where: { id: productId },
        returning: true
      }
    );
    
    if (updatedRows === 0) {
      throw new Error('Product not found or no changes made');
    }
    
    console.log(`Product stock updated: ${updatedProduct.title} - New stock: ${updatedProduct.stock_quantity}`);
    return updatedProduct;
    
  } catch (err) {
    console.error('Error updating product stock:', err);
    throw err;
  }
}

function invalidateProductCache(productId, userId, category) {
  try {
    
    cache.del(`product_${productId}`);
    
    
    const allCacheKeys = cache.keys();
    
    allCacheKeys.forEach(key => {
      
      if (key.startsWith('products_all_') || 
          key.startsWith('products_new_')) {
        cache.del(key);
      }
      
      
      if (userId && key.startsWith(`products_user_${userId}_`)) {
        cache.del(key);
      }
      
      
      if (category && key.includes(`products_category_${category.toLowerCase()}`)) {
        cache.del(key);
      }
      
      
      if (key.startsWith('products_tag_')) {
        cache.del(key);
      }
    });
    
    console.log(`Cache invalidated for product ${productId}`);
    
  } catch (error) {
    console.error('Error invalidating cache:', error);
  }
}

module.exports = { initializeSocket };