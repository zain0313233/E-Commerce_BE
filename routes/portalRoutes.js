const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  getBuyerStats,
  getSellerStats,
  getAdminOverview,
  listAdminUsers,
  listAdminOrders,
  listAdminProducts,
} = require("../services/portalStats");

const router = express.Router();

router.get(
  "/buyer/stats",
  authenticateToken,
  requireRole("customer"),
  async (req, res) => {
    try {
      const stats = await getBuyerStats(req.user.id);
      return res.json({ success: true, stats });
    } catch (e) {
      console.error("buyer stats:", e);
      return res.status(500).json({ success: false, message: "Failed to load stats" });
    }
  }
);

router.get(
  "/seller/stats",
  authenticateToken,
  requireRole("seller"),
  async (req, res) => {
    try {
      const stats = await getSellerStats(req.user.id);
      return res.json({ success: true, stats });
    } catch (e) {
      console.error("seller stats:", e);
      return res.status(500).json({ success: false, message: "Failed to load stats" });
    }
  }
);

router.get(
  "/admin/overview",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const overview = await getAdminOverview();
      return res.json({ success: true, overview });
    } catch (e) {
      console.error("admin overview:", e);
      return res.status(500).json({ success: false, message: "Failed to load overview" });
    }
  }
);

router.get(
  "/admin/users",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
      const offset = parseInt(req.query.offset, 10) || 0;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const resolvedOffset =
        req.query.offset != null ? offset : (page - 1) * limit;
      const data = await listAdminUsers({
        limit,
        offset: resolvedOffset,
        search: req.query.search || "",
        role: req.query.role || "all",
      });
      return res.json({ success: true, ...data });
    } catch (e) {
      console.error("admin users:", e);
      return res.status(500).json({ success: false, message: "Failed to load users" });
    }
  }
);

router.get(
  "/admin/orders",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const limit = Math.min(100, parseInt(req.query.limit, 10) || 15);
      const offset = parseInt(req.query.offset, 10) || 0;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const resolvedOffset =
        req.query.offset != null ? offset : (page - 1) * limit;
      const data = await listAdminOrders({
        limit,
        offset: resolvedOffset,
        search: req.query.search || "",
        status: req.query.status || "all",
      });
      return res.json({ success: true, ...data });
    } catch (e) {
      console.error("admin orders:", e);
      return res.status(500).json({ success: false, message: "Failed to load orders" });
    }
  }
);

router.get(
  "/admin/products",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
      const offset = parseInt(req.query.offset, 10) || 0;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const resolvedOffset =
        req.query.offset != null ? offset : (page - 1) * limit;
      const data = await listAdminProducts({
        limit,
        offset: resolvedOffset,
        search: req.query.search || "",
        category: req.query.category || "",
        stock: req.query.stock || "all",
      });
      return res.json({ success: true, ...data });
    } catch (e) {
      console.error("admin products:", e);
      return res.status(500).json({ success: false, message: "Failed to load products" });
    }
  }
);

module.exports = router;
