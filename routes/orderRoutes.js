const express = require("express");
const router = express.Router();
const Stripe =require('stripe');
const { Order } = require("../models/Order");


router.post("/create-order", async (req, res) => {
  try {
    const {
      user_id,
      customer_email,
      product_name,
      product_description,
      product_image,
      product_id,
      total_price,
      status,
      payment_method,
      shipping_address,
      quantity
    } = req.body;
     const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16', 
   });
    if (!user_id || !product_id) {
      return res.status(400).json({
        message: "user id and product id required"
      });
    }

    const items = [
      { 
        name: product_name,
        description: product_description,
        images: product_image ? [product_image] : [], 
        price: total_price, 
        quantity: quantity || 1
      }
    ];

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

      customer_email: customer_email,

      success_url: `${process.env.NEXT_PUBLIC_DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN}/cart`,

      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "IT", "ES"]
      },

      allow_promotion_codes: true,

      metadata: {
        user_id: user_id.toString(),
        product_id: product_id.toString(), 
        orderSource: "ecommerce_website",
        timestamp: new Date().toISOString()
      }
    });

   
    const newOrder = await Order.create({
      user_id: user_id,
      product_id: product_id,
      total_price: total_price,
      status:status, 
      payment_method: payment_method,
      shipping_address: shipping_address,
      quantity: quantity,
      stripe_session_id: session.id, 
      ordered_at: new Date()
    });

    if (newOrder) {
      console.log("Order created with ID:", newOrder.id);
    }

    return res.status(201).json({
      message: "order created successfully",
      sessionId: session.id,
      url: session.url,
      order: newOrder
    });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

router.get("/get-orders/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "User ID required"
      });
    }

    const orders = await Order.findAll({
      where: { user_id: id },
      order: [['ordered_at', 'DESC']] 
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        message: "No orders found for this user",
        orders: []
      });
    }

    return res.status(200).json({
      message: "Orders retrieved successfully",
      orders: orders
    });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

router.get("/get-order", async (req, res) => {
  try {
    const { order_id, user_id } = req.query;

    if (!user_id || !order_id) {
      return res.status(400).json({
        message: "User ID and Order ID required"
      });
    }

    const order = await Order.findOne({
      where: {
        user_id: user_id,
        id: order_id
      }
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
        order: null
      });
    }

    return res.status(200).json({
      message: "Order retrieved successfully",
      order: order
    });
  } catch (error) {
    console.error("Error occurred:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});


router.put("/update-order-status", async (req, res) => {
  try {
    const { stripe_session_id, status, payment_status } = req.body;

    if (!stripe_session_id || !status) {
      return res.status(400).json({
        message: "Stripe session ID and status required"
      });
    }

    const order = await Order.findOne({
      where: { stripe_session_id: stripe_session_id }
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    await order.update({
      status: status,
      payment_status: payment_status || null,
      updated_at: new Date()
    });

    return res.status(200).json({
      message: "Order status updated successfully",
      order: order
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router;