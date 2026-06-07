const Stripe = require("stripe");
const { Order } = require("../models/Order");
const { fulfillPaidOrder } = require("../services/orderFulfillment");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const getSession = async (req, res) => {
  const { session_id } = req.params;

  if (!session_id) {
    return res.status(400).json({ error: "Session ID required" });
  }

  try {
    const order = await Order.findOne({
      where: { stripe_session_id: session_id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const isOwner = String(order.user_id) === String(req.user.id);
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items"],
    });

    return res.status(200).json({
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_email,
      line_items: session.line_items,
    });
  } catch (error) {
    console.error("Error retrieving session:", error);
    res.status(500).json({ error: "Failed to retrieve session" });
  }
};

const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const rawBody = req.rawBody || req.body;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await fulfillPaidOrder(session, { io: req.io });
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const order = await Order.findOne({
          where: { stripe_payment_intent_id: paymentIntent.id },
        });
        if (order) {
          await order.update({
            status: "failed",
            payment_status: "failed",
          });
        }
        break;
      }
      default:
        break;
    }
    return res.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
};

module.exports = {
  getSession,
  handleWebhook,
};
