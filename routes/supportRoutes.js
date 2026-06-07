const express = require("express");
const rateLimit = require("express-rate-limit");
const { handleSupportChat } = require("../services/aiSupportService");

const router = express.Router();

const supportChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.SUPPORT_CHAT_RATE_LIMIT || "30", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many messages. Please wait a moment and try again.",
  },
});

router.post("/chat", supportChatLimiter, async (req, res) => {
  try {
    const { message, productContextId, history } = req.body || {};
    const result = await handleSupportChat({
      message,
      productContextId: productContextId || null,
      history: Array.isArray(history) ? history.slice(-10) : [],
    });
    return res.json({ success: true, ...result });
  } catch (e) {
    console.error("support chat:", e);
    return res.status(500).json({
      success: false,
      message: "Assistant is temporarily unavailable. Try again shortly.",
    });
  }
});

router.get("/help", (_req, res) => {
  const { HELP_TOPICS } = require("../services/aiSupportService");
  return res.json({ success: true, topics: HELP_TOPICS });
});

module.exports = router;
