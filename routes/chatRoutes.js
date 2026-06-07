const express = require("express");
const multer = require("multer");
const path = require("path");
const { authenticateToken } = require("../middleware/auth");
const {
  getRoomMessages,
  getSellerConversations,
  getCustomerConversations,
  getAdminConversations,
  userCanAccessRoom,
} = require("../services/chatService");
const { uploadBuffer } = require("../config/supabaseStorage");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function mediaTypeFromMime(mime) {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "voice";
  return "document";
}

function contentTypeFromMime(mime, fileName) {
  if (mime) return mime;
  const ext = path.extname(fileName || "").toLowerCase();
  const map = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".webm": "audio/webm",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
  };
  return map[ext] || "application/octet-stream";
}

router.get("/conversations", authenticateToken, async (req, res) => {
  try {
    let conversations = [];
    if (req.user.role === "seller") {
      conversations = await getSellerConversations(req.user.id);
    } else if (req.user.role === "customer") {
      conversations = await getCustomerConversations(req.user.id);
    } else if (req.user.role === "admin") {
      conversations = await getAdminConversations();
    } else {
      return res.status(403).json({ success: false, message: "Not supported for this role" });
    }
    return res.json({ success: true, conversations });
  } catch (e) {
    console.error("chat conversations:", e);
    return res.status(500).json({ success: false, message: "Failed to load conversations" });
  }
});

router.get("/messages/:roomId", authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!userCanAccessRoom(req.user, roomId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const messages = await getRoomMessages(roomId);
    return res.json({ success: true, messages, roomId });
  } catch (e) {
    console.error("chat messages:", e);
    return res.status(500).json({ success: false, message: "Failed to load messages" });
  }
});

router.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const { room_id: roomId, duration } = req.body;
      if (!roomId) {
        return res.status(400).json({ success: false, message: "room_id is required" });
      }
      if (!userCanAccessRoom(req.user, roomId)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: "file is required" });
      }

      const safeName = (req.file.originalname || "file")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 120);
      const filePath = `chat/${roomId}/${Date.now()}_${safeName}`;
      const mediaType = mediaTypeFromMime(req.file.mimetype);
      const contentType = contentTypeFromMime(req.file.mimetype, safeName);

      const mediaUrl = await uploadBuffer(
        req.file.buffer,
        filePath,
        contentType
      );

      if (!mediaUrl) {
        return res.status(500).json({ success: false, message: "Upload failed" });
      }

      return res.status(201).json({
        success: true,
        mediaType,
        mediaUrl,
        fileName: req.file.originalname || safeName,
        mediaDuration: duration ? parseInt(duration, 10) : null,
      });
    } catch (e) {
      console.error("chat upload:", e);
      return res.status(500).json({ success: false, message: "Upload failed" });
    }
  }
);

module.exports = router;
