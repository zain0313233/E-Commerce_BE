const OrderItem = require("../models/OrderItem");
const { Product } = require("../models/Product");
const { Op } = require("sequelize");

const TRACKING_STEPS = [
  { key: "placed", label: "Order placed", statuses: ["pending"] },
  { key: "confirmed", label: "Payment confirmed", statuses: ["processing"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
];

function buildTracking(status) {
  const cancelled = status === "cancelled" || status === "failed";
  if (cancelled) {
    return {
      steps: [
        { key: "placed", label: "Order placed", done: true, current: false },
        { key: "cancelled", label: "Cancelled", done: true, current: true },
      ],
      currentStep: "cancelled",
    };
  }

  const order = ["pending", "processing", "shipped", "delivered"];
  const idx = Math.max(0, order.indexOf(status));
  const steps = TRACKING_STEPS.map((step, i) => ({
    key: step.key,
    label: step.label,
    done: i <= idx,
    current: i === idx,
  }));

  return { steps, currentStep: TRACKING_STEPS[idx]?.key || "placed" };
}

async function enrichOrders(orders) {
  if (!orders.length) return [];

  const orderIds = orders.map((o) => o.id);
  const items = await OrderItem.findAll({
    where: { order_id: { [Op.in]: orderIds } },
  });

  const productIds = [
    ...new Set([
      ...items.map((i) => i.product_id),
      ...orders.map((o) => o.product_id).filter(Boolean),
    ]),
  ];
  const products = productIds.length
    ? await Product.findAll({ where: { id: productIds } })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  return orders.map((order) => {
    const json = order.toJSON ? order.toJSON() : order;
    let lineItems = items
      .filter((i) => i.order_id === order.id)
      .map((i) => {
        const p = productMap.get(i.product_id);
        const unit = parseFloat(i.price) || parseFloat(p?.price) || 0;
        const qty = i.quantity || 1;
        return {
          id: i.id,
          product_id: i.product_id,
          quantity: qty,
          unit_price: unit,
          line_total: unit * qty,
          product_title: p?.title || "Product",
          product_image: p?.image_url || null,
          product_category: p?.category || null,
        };
      });

    if (!lineItems.length && json.product_id) {
      const p = productMap.get(json.product_id);
      const unit = parseFloat(json.total_price) / (json.quantity || 1);
      lineItems = [
        {
          id: null,
          product_id: json.product_id,
          quantity: json.quantity || 1,
          unit_price: unit,
          line_total: parseFloat(json.total_price) || 0,
          product_title: p?.title || "Product",
          product_image: p?.image_url || null,
          product_category: p?.category || null,
        },
      ];
    }

    const itemCount = lineItems.reduce((s, it) => s + it.quantity, 0);
    const tracking = buildTracking(json.status);

    return {
      ...json,
      order_number: `ORD-${String(json.id).padStart(5, "0")}`,
      items: lineItems,
      item_count: itemCount,
      tracking,
      payment_label:
        json.payment_status === "paid"
          ? "Paid"
          : json.payment_status || "Pending",
    };
  });
}

module.exports = {
  enrichOrders,
  buildTracking,
  TRACKING_STEPS,
};
