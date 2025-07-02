const stripe = require("../middleware/stripe.js");
const { Order } = require("../models/Order");
// this controller is not in use now but in future

const getSession = async (req, res) => {
  const { session_id } = req.params;

  if (!session_id) {
    return res.status(400).json({ error: "Session ID required" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items", "customer"]
    });
    res.status(200).json(session);
  } catch (error) {
    console.error("Error retrieving session:", error);
    res.status(500).json({ error: error.message });
  }
};

const handleWebhook = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
   
    const body = req.body;
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        console.log("✅ Payment successful:", session.id);
        await fulfillOrder(session);
        break;

      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        console.log("✅ Payment intent succeeded:", paymentIntent.id);
        await handleSuccessfulPayment(paymentIntent);
        break;

      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;
        console.log("❌ Payment failed:", failedPayment.id);
        await handleFailedPayment(failedPayment);
        break;

      case "invoice.payment_succeeded":
        const invoice = event.data.object;
        console.log("✅ Invoice payment succeeded:", invoice.id);
        await handleInvoicePayment(invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  res.json({ received: true });
};

async function fulfillOrder(session) {
  console.log("Fulfilling order for session:", session.id);

  try {
   
    const order = await Order.findOne({
      where: { stripe_session_id: session.id }
    });

    if (!order) {
      console.error("Order not found for session:", session.id);
      return;
    }


    await order.update({
      status: "completed",
      payment_status: "paid",
      stripe_payment_intent_id: session.payment_intent,
      updated_at: new Date()
    });

    console.log("Order fulfilled successfully:", order.id);
    

  } catch (error) {
    console.error("Error fulfilling order:", error);
  }
}

async function handleSuccessfulPayment(paymentIntent) {
  console.log("Handling successful payment:", paymentIntent.id);

  try {
  
    const order = await Order.findOne({
      where: { stripe_payment_intent_id: paymentIntent.id }
    });

    if (order) {
      await order.update({
        status: "completed",
        payment_status: "paid",
        updated_at: new Date()
      });
      console.log("Payment handled successfully for order:", order.id);
    }
  } catch (error) {
    console.error("Error handling successful payment:", error);
  }
}

async function handleFailedPayment(paymentIntent) {
  console.log("Handling failed payment:", paymentIntent.id);

  try {
   
    const order = await Order.findOne({
      where: { stripe_payment_intent_id: paymentIntent.id }
    });

    if (order) {
      await order.update({
        status: "failed",
        payment_status: "failed",
        updated_at: new Date()
      });
      console.log("Failed payment handled for order:", order.id);
    }
  } catch (error) {
    console.error("Error handling failed payment:", error);
  }
}

async function handleInvoicePayment(invoice) {
  console.log("Handling invoice payment:", invoice.id);

  try {
    
    console.log("Invoice payment handled successfully");
  } catch (error) {
    console.error("Error handling invoice payment:", error);
  }
}

module.exports = {
  getSession,
  handleWebhook
};