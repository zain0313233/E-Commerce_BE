const { Op } = require("sequelize");
const { ChatMessage } = require("../models/ChatMessage");
const { User } = require("../models/User");
const { Product } = require("../models/Product");

function buildRoomId(sellerId, customerId) {
  return `chat_${sellerId}_${customerId}`;
}

function parseRoomId(roomId) {
  const match = String(roomId).match(/^chat_(\d+)_(\d+)$/);
  if (!match) return null;
  return { sellerId: parseInt(match[1], 10), customerId: parseInt(match[2], 10) };
}

async function saveMessage({
  roomId,
  senderId,
  senderType,
  message = "",
  productId = null,
  mediaType = null,
  mediaUrl = null,
  fileName = null,
  mediaDuration = null,
}) {
  const text = (message || "").trim();
  if (!text && !mediaUrl) {
    throw new Error("Message or media is required");
  }

  const row = await ChatMessage.create({
    room_id: roomId,
    sender_id: senderId,
    sender_type: senderType,
    message: text || null,
    media_type: mediaType || null,
    media_url: mediaUrl || null,
    file_name: fileName || null,
    media_duration: mediaDuration || null,
    product_id: productId,
    created_at: new Date(),
  });
  return formatMessage(row);
}

async function getRoomMessages(roomId, { limit = 100 } = {}) {
  const rows = await ChatMessage.findAll({
    where: { room_id: roomId },
    order: [["created_at", "ASC"]],
    limit,
  });
  return rows.map(formatMessage);
}

function previewText(row) {
  const json = row.toJSON ? row.toJSON() : row;
  if (json.media_type === "image") return "📷 Photo";
  if (json.media_type === "video") return "🎬 Video";
  if (json.media_type === "voice" || json.media_type === "audio") return "🎤 Voice note";
  if (json.media_type === "document") return `📄 ${json.file_name || "Document"}`;
  return json.message || "";
}

function formatMessage(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return {
    id: json.id,
    message: json.message || "",
    senderId: json.sender_id,
    senderType: json.sender_type,
    timestamp: json.created_at,
    roomId: json.room_id,
    productId: json.product_id,
    mediaType: json.media_type || null,
    mediaUrl: json.media_url || null,
    fileName: json.file_name || null,
    mediaDuration: json.media_duration || null,
  };
}

async function getSellerConversations(sellerId) {
  const prefix = `chat_${sellerId}_`;
  const rows = await ChatMessage.findAll({
    where: { room_id: { [Op.like]: `${prefix}%` } },
    order: [["created_at", "DESC"]],
  });

  const byRoom = new Map();
  for (const row of rows) {
    if (!byRoom.has(row.room_id)) {
      byRoom.set(row.room_id, row);
    }
  }

  const conversations = [];
  for (const [roomId, lastRow] of byRoom) {
    const parsed = parseRoomId(roomId);
    if (!parsed) continue;
    const customer = await User.findByPk(parsed.customerId, {
      attributes: ["id", "name", "email"],
    });
    const count = await ChatMessage.count({ where: { room_id: roomId } });
    conversations.push({
      roomId,
      customerId: parsed.customerId,
      customerName: customer?.name || `Customer #${parsed.customerId}`,
      customerEmail: customer?.email,
      lastMessage: previewText(lastRow),
      lastAt: lastRow.created_at,
      messageCount: count,
    });
  }

  conversations.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  return conversations;
}

async function getCustomerConversations(customerId) {
  const rows = await ChatMessage.findAll({
    where: {
      room_id: { [Op.like]: `%_${customerId}` },
    },
    order: [["created_at", "DESC"]],
  });

  const byRoom = new Map();
  for (const row of rows) {
    if (!row.room_id.endsWith(`_${customerId}`)) continue;
    if (!byRoom.has(row.room_id)) byRoom.set(row.room_id, row);
  }

  const conversations = [];
  for (const [roomId, lastRow] of byRoom) {
    const parsed = parseRoomId(roomId);
    if (!parsed || parsed.customerId !== customerId) continue;
    const seller = await User.findByPk(parsed.sellerId, {
      attributes: ["id", "name", "shop_name"],
    });
    let productTitle = null;
    if (lastRow.product_id) {
      const p = await Product.findByPk(lastRow.product_id, {
        attributes: ["title"],
      });
      productTitle = p?.title;
    }
    conversations.push({
      roomId,
      sellerId: parsed.sellerId,
      sellerName: seller?.shop_name || seller?.name || `Seller #${parsed.sellerId}`,
      lastMessage: previewText(lastRow),
      lastAt: lastRow.created_at,
      productTitle,
    });
  }

  conversations.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  return conversations;
}

async function getAdminConversations() {
  const rows = await ChatMessage.findAll({
    order: [["created_at", "DESC"]],
    limit: 500,
  });

  const byRoom = new Map();
  for (const row of rows) {
    if (!byRoom.has(row.room_id)) {
      byRoom.set(row.room_id, row);
    }
  }

  const conversations = [];
  for (const [roomId, lastRow] of byRoom) {
    const parsed = parseRoomId(roomId);
    if (!parsed) continue;
    const [seller, customer] = await Promise.all([
      User.findByPk(parsed.sellerId, {
        attributes: ["id", "name", "shop_name", "email"],
      }),
      User.findByPk(parsed.customerId, {
        attributes: ["id", "name", "email"],
      }),
    ]);
    conversations.push({
      roomId,
      sellerId: parsed.sellerId,
      sellerName: seller?.shop_name || seller?.name || `Seller #${parsed.sellerId}`,
      customerId: parsed.customerId,
      customerName: customer?.name || `Customer #${parsed.customerId}`,
      lastMessage: previewText(lastRow),
      lastAt: lastRow.created_at,
    });
  }

  conversations.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  return conversations;
}

function userCanAccessRoom(user, roomId) {
  const parsed = parseRoomId(roomId);
  if (!parsed) return false;
  if (user.role === "admin") return true;
  if (user.role === "seller" && user.id === parsed.sellerId) return true;
  if (user.role === "customer" && user.id === parsed.customerId) return true;
  return false;
}

async function validateChatJoin({ user, supportUserId, productId }) {
  const otherId = parseInt(supportUserId, 10);
  if (!otherId || Number.isNaN(otherId)) {
    return { ok: false, message: "Invalid participant" };
  }

  if (otherId === user.id) {
    return { ok: false, message: "Cannot chat with yourself" };
  }

  const other = await User.findByPk(otherId, { attributes: ["id", "role"] });
  if (!other) {
    return { ok: false, message: "User not found" };
  }

  if (user.role === "customer") {
    if (other.role !== "seller") {
      return { ok: false, message: "Customers can only chat with sellers" };
    }
    if (productId) {
      const product = await Product.findByPk(productId, {
        attributes: ["id", "user_id"],
      });
      if (!product || product.user_id !== otherId) {
        return { ok: false, message: "Product does not belong to this seller" };
      }
    }
    return { ok: true };
  }

  if (user.role === "seller") {
    if (other.role !== "customer") {
      return { ok: false, message: "Sellers can only chat with customers" };
    }
    return { ok: true };
  }

  if (user.role === "admin") {
    return { ok: true };
  }

  return { ok: false, message: "Chat not available for this role" };
}

module.exports = {
  buildRoomId,
  parseRoomId,
  saveMessage,
  getRoomMessages,
  getSellerConversations,
  getCustomerConversations,
  getAdminConversations,
  userCanAccessRoom,
  validateChatJoin,
  formatMessage,
};
