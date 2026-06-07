const { Product } = require("../models/Product");
const { CartItem } = require("../models/CartItem");
const { Order } = require("../models/Order");
const OrderItem = require("../models/OrderItem");

async function fulfillPaidOrder(session, { io } = {}) {
  const order = await Order.findOne({
    where: { stripe_session_id: session.id },
  });

  if (!order) {
    console.error("Order not found for session:", session.id);
    return null;
  }

  if (order.payment_status === "paid") {
    return order;
  }

  const lineItems = await OrderItem.findAll({
    where: { order_id: order.id },
  });

  if (lineItems.length > 0) {
    for (const item of lineItems) {
      const product = await Product.findByPk(item.product_id);
      if (!product) continue;
      const nextStock = Math.max(
        0,
        (product.stock_quantity || 0) - item.quantity
      );
      await product.update({ stock_quantity: nextStock });
      if (io) {
        io.emit("productStockUpdated", {
          productId: product.id,
          stock_quantity: nextStock,
        });
      }
    }
  } else if (order.product_id) {
    const product = await Product.findByPk(order.product_id);
    if (product) {
      const qty = order.quantity || 1;
      const nextStock = Math.max(0, (product.stock_quantity || 0) - qty);
      await product.update({ stock_quantity: nextStock });
      if (io) {
        io.emit("productStockUpdated", {
          productId: product.id,
          stock_quantity: nextStock,
        });
      }
    }
  }

  await CartItem.destroy({ where: { user_id: order.user_id } });

  await order.update({
    status: "processing",
    payment_status: "paid",
    stripe_payment_intent_id: session.payment_intent || order.stripe_payment_intent_id,
  });

  return order;
}

module.exports = { fulfillPaidOrder };
