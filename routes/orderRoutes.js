const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const { Order } = require("../models/Order");
const { getSession } = require("../controller/paymentController");
const {
  createCartCheckoutSession,
  createSingleItemCheckoutSession,
} = require("../services/checkoutService");
const { enrichOrders } = require("../services/orderPresenter");
const { rateLimitPayments } = require("../middleware/stripe");


router.post(
  "/create-checkout-from-cart",
  authenticateToken,
  rateLimitPayments(),
  async (req, res) => {
    try {
      const { shipping_address, payment_method } = req.body;
      const result = await createCartCheckoutSession({
        userId: req.user.id,
        customerEmail: req.user.email,
        shippingAddress: shipping_address,
        paymentMethod: payment_method || "credit_card",
      });

      return res.status(201).json({
        message: "Checkout session created",
        sessionId: result.session.id,
        url: result.session.url,
        order: result.order,
        subtotal: result.subtotal,
        itemCount: result.itemCount,
      });
    } catch (error) {
      console.error("create-checkout-from-cart", error);
      const status = error.status || 500;
      return res.status(status).json({
        message: error.message || "Checkout failed",
      });
    }
  }
);

router.post(
  "/create-order",
  authenticateToken,
  rateLimitPayments(),
  async (req, res) => {
    try {
      const { product_id, quantity, shipping_address, payment_method } = req.body;

      if (!product_id) {
        return res.status(400).json({ message: "product id required" });
      }

      const result = await createSingleItemCheckoutSession({
        userId: req.user.id,
        customerEmail: req.user.email,
        productId: product_id,
        quantity,
        shippingAddress: shipping_address,
        paymentMethod: payment_method || "credit_card",
      });

      return res.status(201).json({
        message: "order created successfully",
        sessionId: result.session.id,
        url: result.session.url,
        order: result.order,
        subtotal: result.subtotal,
        itemCount: result.itemCount,
      });
    } catch (error) {
      console.error("create-order", error);
      const status = error.status || 500;
      return res.status(status).json({
        message: error.message || "Internal server error",
      });
    }
  }
);

router.get("/session/:session_id", authenticateToken, getSession);

router.get("/get-orders/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.user.id) !== String(id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const orders = await Order.findAll({
      where: { user_id: id },
      order: [["ordered_at", "DESC"]],
    });

    const ordersJson = await enrichOrders(orders);

    return res.status(200).json({
      message: "Orders retrieved successfully",
      orders: ordersJson,
    });
  } catch (error) {
    console.error("get-orders error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/detail/:orderId", authenticateToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.orderId, user_id: req.user.id },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const [enriched] = await enrichOrders([order]);
    return res.status(200).json({
      success: true,
      order: enriched,
    });
  } catch (error) {
    console.error("order detail error:", error);
    return res.status(500).json({ success: false, message: "Failed to load order" });
  }
});

router.get("/get-order", authenticateToken, async (req, res) => {
  try {
    const { order_id, user_id } = req.query;

    if (String(req.user.id) !== String(user_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!order_id) {
      return res.status(400).json({ message: "Order ID required" });
    }

    const order = await Order.findOne({
      where: { user_id: req.user.id, id: order_id },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found", order: null });
    }

    const [enriched] = await enrichOrders([order]);
    return res.status(200).json({
      message: "Order retrieved successfully",
      order: enriched,
    });
  } catch (error) {
    console.error("get-order error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


router.put(
  "/update-order-status",
  authenticateToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { stripe_session_id, status, payment_status } = req.body;

      if (!stripe_session_id || !status) {
        return res.status(400).json({
          message: "Stripe session ID and status required",
        });
      }

      const allowed = ["pending", "processing", "shipped", "delivered", "cancelled", "failed"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid order status" });
      }

      const order = await Order.findOne({
        where: { stripe_session_id },
      });

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      await order.update({
        status,
        payment_status: payment_status || order.payment_status,
      });

      return res.status(200).json({
        message: "Order status updated successfully",
        order,
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      return res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;