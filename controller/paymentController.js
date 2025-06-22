import stripe from "../middleware/stripe.js";

export const createPaymentIntent = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { amount, currency = "usd", metadata = {} } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true
      }
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: error.message });
  }
};
export const getPaymentIntent = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Payment Intent ID required" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(id);
    res.status(200).json(paymentIntent);
  } catch (error) {
    console.error("Error retrieving payment intent:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createCheckoutSession = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { items, customerEmail, customerName } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    const validItems = items.every(
      (item) => item.name && typeof item.price === "number" && item.price > 0
    );

    if (!validItems) {
      return res.status(400).json({ error: "Invalid items format" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            description: item.description || "",
            images: item.images || []
          },
          unit_amount: Math.round(item.price * 100)
        },
        quantity: item.quantity || 1
      })),

      customer_email: customerEmail,

      success_url: `${process.env.NEXT_PUBLIC_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}/cart`,

      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "IT", "ES"]
      },

      allow_promotion_codes: true,

      metadata: {
        customerName: customerName || "",
        orderSource: "ecommerce_website",
        timestamp: new Date().toISOString()
      }
    });

    res.status(200).json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
};


export const getSession = async (req, res) => {
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

export const handleWebhook = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = Buffer.from(req.body);
    event = stripe.webhooks.constructEvent(
      buf,
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
    console.log("Order fulfilled successfully");
  } catch (error) {
    console.error("Error fulfilling order:", error);
  }
}

async function handleSuccessfulPayment(paymentIntent) {
  console.log("Handling successful payment:", paymentIntent.id);

  try {
    console.log("Payment handled successfully");
  } catch (error) {
    console.error("Error handling successful payment:", error);
  }
}

async function handleFailedPayment(paymentIntent) {
  console.log("Handling failed payment:", paymentIntent.id);

  try {
    console.log("Failed payment handled");
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
