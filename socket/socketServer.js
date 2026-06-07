const { Server } = require("socket.io");
const { Product } = require("../models/Product");
const cache = require("../config/cache");
const { authenticateSocket } = require("./socketAuth");
const { saveMessage, buildRoomId, validateChatJoin } = require("../services/chatService");

function getCorsOrigins() {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return ["http://localhost:3000", "http://localhost:3001"];
}

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: getCorsOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  const connectedUsers = new Map();
  const userSockets = new Map();

  io.on("connection", (socket) => {
    const { id: userId, role, name } = socket.user;
    const userType = role === "seller" ? "seller" : "customer";

    connectedUsers.set(socket.id, {
      userId,
      userType,
      userName: name,
      socketId: socket.id,
    });
    userSockets.set(userId, socket.id);

    socket.emit("connected", { userId, userType, userName: name });

    socket.on("join_chat", async (data) => {
      const { supportUserId, productId } = data || {};

      const validation = await validateChatJoin({
        user: socket.user,
        supportUserId,
        productId,
      });
      if (!validation.ok) {
        socket.emit("error", { message: validation.message });
        return;
      }

      let roomId;

      if (userType === "customer") {
        roomId = buildRoomId(supportUserId, userId);
      } else {
        roomId = buildRoomId(userId, supportUserId);
      }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.productId = productId || null;

      connectedUsers.set(socket.id, {
        userId,
        userType,
        userName: name,
        roomId,
        socketId: socket.id,
        supportUserId,
        productId: socket.productId,
      });

      if (userType === "customer") {
        const sellerSocketId = userSockets.get(Number(supportUserId));
        if (sellerSocketId) {
          const sellerSocket = io.sockets.sockets.get(sellerSocketId);
          if (sellerSocket?.connected) {
            sellerSocket.emit("new_chat_request", {
              customerId: userId,
              customerName: name,
              supportUserId: Number(supportUserId),
              roomId,
              productId: productId || null,
              message: `${name || "A customer"} wants to chat`,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          socket.emit("seller_offline", {
            message: "Seller is offline. Messages will be saved—they can reply when back.",
          });
        }
      }

      socket.to(roomId).emit("user_joined", {
        userId,
        userType,
        userName: name,
        roomId,
      });
    });

    socket.on("send_message", async (data) => {
      const userInfo = connectedUsers.get(socket.id);
      if (!userInfo?.roomId) {
        socket.emit("error", { message: "Join a chat room first" });
        return;
      }

      const text = (data?.message || "").trim();
      const mediaUrl = data?.mediaUrl || null;
      if (!text && !mediaUrl) return;

      try {
        const saved = await saveMessage({
          roomId: userInfo.roomId,
          senderId: userInfo.userId,
          senderType: userInfo.userType,
          message: text,
          productId: data?.productId || userInfo.productId || null,
          mediaType: data?.mediaType || null,
          mediaUrl,
          fileName: data?.fileName || null,
          mediaDuration: data?.mediaDuration || null,
        });

        io.to(userInfo.roomId).emit("receive_message", saved);
      } catch (err) {
        console.error("save message:", err);
        socket.emit("error", { message: "Could not save message" });
      }
    });

    socket.on("typing", (data) => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo?.roomId) {
        socket.to(userInfo.roomId).emit("user_typing", {
          userId: userInfo.userId,
          userType: userInfo.userType,
          userName: userInfo.userName,
          isTyping: Boolean(data?.isTyping),
        });
      }
    });

    socket.on("productStockUpdated", async (data) => {
      if (userType !== "seller") {
        socket.emit("error", { message: "Only sellers can update stock via chat" });
        return;
      }
      const { productId, stock } = data || {};
      try {
        const updatedProduct = await updateProductStock(productId, stock, userId);
        invalidateProductCache(
          productId,
          updatedProduct.user_id,
          updatedProduct.category
        );
        socket.broadcast.emit("productStockUpdated", {
          productId,
          stock,
          success: true,
          productName: updatedProduct.title,
        });
      } catch (err) {
        socket.emit("productStockUpdateError", {
          productId,
          error: err.message,
        });
      }
    });

    socket.on("disconnect", () => {
      const userInfo = connectedUsers.get(socket.id);
      if (userInfo?.roomId) {
        socket.to(userInfo.roomId).emit("user_left", {
          userId: userInfo.userId,
          userType: userInfo.userType,
          userName: userInfo.userName,
        });
      }
      connectedUsers.delete(socket.id);
      if (userInfo) userSockets.delete(userInfo.userId);
    });
  });

  return io;
}

async function updateProductStock(productId, stock, sellerId) {
  const product = await Product.findByPk(productId);
  if (!product) throw new Error("Product not found");
  if (String(product.user_id) !== String(sellerId)) {
    throw new Error("You can only update your own products");
  }
  const qty = Math.max(0, parseInt(stock, 10));
  if (Number.isNaN(qty)) throw new Error("Invalid stock quantity");
  await product.update({ stock_quantity: qty });
  return product;
}

function invalidateProductCache(productId, userId, category) {
  try {
    cache.del(`product_${productId}`);
    const allCacheKeys = cache.keys();
    allCacheKeys.forEach((key) => {
      if (key.startsWith("products_all_") || key.startsWith("products_new_")) {
        cache.del(key);
      }
      if (userId && key.startsWith(`products_user_${userId}_`)) {
        cache.del(key);
      }
      if (category && key.includes(`products_category_${category.toLowerCase()}`)) {
        cache.del(key);
      }
      if (key.startsWith("products_tag_")) {
        cache.del(key);
      }
    });
  } catch (error) {
    console.error("Error invalidating cache:", error);
  }
}

module.exports = { initializeSocket };
