const Stripe = require("stripe");
const sequelize = require("../config/db");
const { Product } = require("../models/Product");
const { CartItem } = require("../models/CartItem");
const { Order } = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const { unitPrice } = require("./pricing");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

async function loadCartLines(userId) {
  const cartRows = await CartItem.findAll({
    where: { user_id: userId },
    order: [["added_at", "ASC"]],
  });

  if (!cartRows.length) {
    return { lines: [], subtotal: 0, itemCount: 0 };
  }

  const productIds = [...new Set(cartRows.map((r) => r.product_id))];
  const products = await Product.findAll({ where: { id: productIds } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = [];
  let subtotal = 0;
  let itemCount = 0;

  for (const row of cartRows) {
    const product = byId.get(row.product_id);
    if (!product) {
      throw new Error(`Product ${row.product_id} is no longer available`);
    }
    const qty = row.quantity;
    const price = unitPrice(product);
    if (product.stock_quantity < qty) {
      throw new Error(
        `Insufficient stock for "${product.title}" (requested ${qty}, available ${product.stock_quantity})`
      );
    }
    subtotal += price * qty;
    itemCount += qty;
    lines.push({
      cartId: row.id,
      product,
      quantity: qty,
      unitAmount: price,
      lineTotal: price * qty,
    });
  }

  return { lines, subtotal, itemCount };
}

async function createCartCheckoutSession({
  userId,
  customerEmail,
  shippingAddress,
  paymentMethod = "credit_card",
}) {
  const { lines, subtotal, itemCount } = await loadCartLines(userId);

  if (!lines.length) {
    const err = new Error("Your cart is empty");
    err.status = 400;
    throw err;
  }

  const domain = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

  return sequelize.transaction(async (t) => {
    const order = await Order.create(
      {
        user_id: userId,
        product_id: null,
        quantity: itemCount,
        total_price: subtotal,
        status: "pending",
        payment_method: paymentMethod,
        shipping_address: shippingAddress || "Collected at Stripe checkout",
        ordered_at: new Date(),
      },
      { transaction: t }
    );

    for (const line of lines) {
      await OrderItem.create(
        {
          order_id: order.id,
          product_id: line.product.id,
          quantity: line.quantity,
          price: line.unitAmount,
        },
        { transaction: t }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items: lines.map((line) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: line.product.title,
            description: (line.product.description || "").slice(0, 200),
            images: line.product.image_url
              ? [line.product.image_url]
              : [],
          },
          unit_amount: Math.round(line.unitAmount * 100),
        },
        quantity: line.quantity,
      })),
      success_url: `${domain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/cart`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "IT", "ES"],
      },
      allow_promotion_codes: true,
      metadata: {
        user_id: String(userId),
        order_id: String(order.id),
        order_type: "cart",
        orderSource: "ecommerce_website",
      },
    });

    await order.update({ stripe_session_id: session.id }, { transaction: t });

    return { session, order, subtotal, itemCount };
  });
}

async function createSingleItemCheckoutSession({
  userId,
  customerEmail,
  productId,
  quantity = 1,
  shippingAddress,
  paymentMethod = "credit_card",
}) {
  const product = await Product.findByPk(productId);
  if (!product) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }

  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  if (product.stock_quantity < qty) {
    const err = new Error(
      `Insufficient stock for "${product.title}" (requested ${qty}, available ${product.stock_quantity})`
    );
    err.status = 400;
    throw err;
  }

  const unitAmount = unitPrice(product);
  const lineTotal = unitAmount * qty;
  const domain = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

  return sequelize.transaction(async (t) => {
    const order = await Order.create(
      {
        user_id: userId,
        product_id: product.id,
        quantity: qty,
        total_price: lineTotal,
        status: "pending",
        payment_method: paymentMethod,
        shipping_address: shippingAddress || "Collected at Stripe checkout",
        ordered_at: new Date(),
      },
      { transaction: t }
    );

    await OrderItem.create(
      {
        order_id: order.id,
        product_id: product.id,
        quantity: qty,
        price: unitAmount,
      },
      { transaction: t }
    );

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: product.title,
              description: (product.description || "").slice(0, 200),
              images: product.image_url ? [product.image_url] : [],
            },
            unit_amount: Math.round(unitAmount * 100),
          },
          quantity: qty,
        },
      ],
      success_url: `${domain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/cart`,
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "DE", "FR", "IT", "ES"],
      },
      allow_promotion_codes: true,
      metadata: {
        user_id: String(userId),
        product_id: String(product.id),
        order_id: String(order.id),
        order_type: "single",
        orderSource: "ecommerce_website",
      },
    });

    await order.update({ stripe_session_id: session.id }, { transaction: t });

    return { session, order, subtotal: lineTotal, itemCount: qty };
  });
}

module.exports = {
  loadCartLines,
  createCartCheckoutSession,
  createSingleItemCheckoutSession,
};
