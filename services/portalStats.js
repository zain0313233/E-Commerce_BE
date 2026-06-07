const { Op, fn, col, literal } = require("sequelize");
const { User } = require("../models/User");
const { Order } = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const { Product } = require("../models/Product");
const { enrichOrders } = require("./orderPresenter");

async function getBuyerStats(userId) {
  const orders = await Order.findAll({
    where: { user_id: userId },
    order: [["ordered_at", "DESC"]],
  });

  const paid = orders.filter(
    (o) => o.payment_status === "paid" || o.status === "processing" || o.status === "shipped" || o.status === "delivered"
  );
  const totalSpent = paid.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);

  const byMonth = {};
  const ordersByMonth = {};
  orders.forEach((o) => {
    const d = new Date(o.ordered_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    ordersByMonth[key] = (ordersByMonth[key] || 0) + 1;
  });
  paid.forEach((o) => {
    const d = new Date(o.ordered_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + parseFloat(o.total_price || 0);
  });
  const spendingChart = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));
  const ordersChart = Object.entries(ordersByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({ month, orders: count }));

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyActivity = dayNames.map((day) => ({ day, orders: 0 }));
  orders.forEach((o) => {
    const day = dayNames[new Date(o.ordered_at).getDay()];
    const row = weeklyActivity.find((r) => r.day === day);
    if (row) row.orders += 1;
  });

  const recent = await enrichOrders(orders.slice(0, 5));

  return {
    total_orders: orders.length,
    paid_orders: paid.length,
    total_spent: Math.round(totalSpent * 100) / 100,
    pending_orders: orders.filter((o) => o.status === "pending").length,
    spending_chart: spendingChart,
    orders_chart: ordersChart,
    weekly_activity: weeklyActivity,
    recent_orders: recent,
  };
}

async function getSellerProductIds(sellerId) {
  const rows = await Product.findAll({
    where: { user_id: sellerId },
    attributes: ["id"],
  });
  return rows.map((r) => r.id);
}

async function getSellerOrderIds(productIds) {
  if (!productIds.length) return [];
  const items = await OrderItem.findAll({
    where: { product_id: { [Op.in]: productIds } },
    attributes: ["order_id"],
  });
  return [...new Set(items.map((i) => i.order_id))];
}

function isPaidOrder(order) {
  return (
    order.payment_status === "paid" ||
    ["processing", "shipped", "delivered"].includes(order.status)
  );
}

async function getSellerRevenueByOrder(sellerId, orderIds) {
  if (!orderIds.length) return new Map();

  const productIds = await getSellerProductIds(sellerId);
  if (!productIds.length) return new Map();

  const items = await OrderItem.findAll({
    where: {
      order_id: { [Op.in]: orderIds },
      product_id: { [Op.in]: productIds },
    },
    attributes: ["order_id", "price", "quantity"],
  });

  const byOrder = new Map();
  for (const item of items) {
    const line =
      parseFloat(item.price || 0) * (parseInt(item.quantity, 10) || 1);
    byOrder.set(item.order_id, (byOrder.get(item.order_id) || 0) + line);
  }
  return byOrder;
}

async function getSellerStats(sellerId) {
  const productIds = await getSellerProductIds(sellerId);
  const orderIds = await getSellerOrderIds(productIds);

  const productCount = productIds.length;
  let orders = [];
  if (orderIds.length) {
    orders = await Order.findAll({
      where: { id: { [Op.in]: orderIds } },
      order: [["ordered_at", "DESC"]],
    });
  }

  const paid = orders.filter(isPaidOrder);
  const revenueByOrder = await getSellerRevenueByOrder(
    sellerId,
    paid.map((o) => o.id)
  );
  const revenue = paid.reduce(
    (s, o) => s + (revenueByOrder.get(o.id) || 0),
    0
  );

  const byMonth = {};
  paid.forEach((o) => {
    const sellerPart = revenueByOrder.get(o.id) || 0;
    if (sellerPart <= 0) return;
    const d = new Date(o.ordered_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { revenue: 0, orders: 0 };
    byMonth[key].revenue += sellerPart;
    byMonth[key].orders += 1;
  });
  const revenueChart = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, row]) => ({
      month,
      revenue: Math.round(row.revenue * 100) / 100,
      orders: row.orders,
    }));

  const categoryRows = await Product.findAll({
    where: { user_id: sellerId },
    attributes: ["category", [fn("COUNT", col("id")), "count"]],
    group: ["category"],
    raw: true,
  });
  const categoryBreakdown = categoryRows
    .filter((r) => r.category)
    .map((r) => ({ name: r.category, value: parseInt(r.count, 10) }));

  const recent = await enrichOrders(orders.slice(0, 50));

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyActivity = dayNames.map((day) => ({ day, orders: 0 }));
  paid.forEach((o) => {
    const day = dayNames[new Date(o.ordered_at).getDay()];
    const row = weeklyActivity.find((r) => r.day === day);
    if (row) row.orders += 1;
  });

  return {
    product_count: productCount,
    order_count: orders.length,
    paid_orders: paid.length,
    revenue: Math.round(revenue * 100) / 100,
    revenue_chart: revenueChart.length
      ? revenueChart
      : [{ month: "N/A", revenue: 0, orders: 0 }],
    category_breakdown: categoryBreakdown,
    weekly_activity: weeklyActivity,
    recent_orders: recent,
  };
}

async function getAdminOverview() {
  const [userCount, orderCount, productCount, customerCount, sellerCount] =
    await Promise.all([
      User.count(),
      Order.count(),
      Product.count(),
      User.count({ where: { role: "customer" } }),
      User.count({ where: { role: "seller" } }),
    ]);

  const paidOrders = await Order.findAll({
    where: {
      [Op.or]: [
        { payment_status: "paid" },
        { status: { [Op.in]: ["processing", "shipped", "delivered"] } },
      ],
    },
    attributes: ["total_price", "ordered_at"],
  });
  const gmv = paidOrders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);

  const gmvByMonth = {};
  paidOrders.forEach((o) => {
    const d = new Date(o.ordered_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    gmvByMonth[key] = (gmvByMonth[key] || 0) + parseFloat(o.total_price || 0);
  });
  const gmvChart = Object.entries(gmvByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, revenue]) => ({
      month,
      revenue: Math.round(revenue * 100) / 100,
    }));

  const allOrders = await Order.findAll({
    attributes: ["ordered_at"],
  });
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyActivity = dayNames.map((day) => ({ day, orders: 0 }));
  allOrders.forEach((o) => {
    const day = dayNames[new Date(o.ordered_at).getDay()];
    const row = weeklyActivity.find((r) => r.day === day);
    if (row) row.orders += 1;
  });

  const recentOrders = await Order.findAll({
    order: [["ordered_at", "DESC"]],
    limit: 10,
  });
  const enrichedRecent = await enrichOrders(recentOrders);

  const recentUsers = await User.findAll({
    attributes: ["id", "name", "email", "role", "created_at"],
    order: [["created_at", "DESC"]],
    limit: 8,
  });

  const ordersByStatus = await Order.findAll({
    attributes: ["status", [fn("COUNT", col("id")), "count"]],
    group: ["status"],
    raw: true,
  });

  return {
    users: userCount,
    customers: customerCount,
    sellers: sellerCount,
    orders: orderCount,
    products: productCount,
    gmv: Math.round(gmv * 100) / 100,
    gmv_chart: gmvChart,
    user_breakdown: [
      { name: "Buyers", value: customerCount },
      { name: "Sellers", value: sellerCount },
    ],
    weekly_activity: weeklyActivity,
    orders_by_status: ordersByStatus.map((r) => ({
      status: r.status,
      count: parseInt(r.count, 10),
    })),
    recent_orders: enrichedRecent,
    recent_users: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
    })),
  };
}

function buildAdminUserWhere({ search = "", role = "all" } = {}) {
  const conditions = [];
  const term = String(search || "").trim();

  if (term) {
    conditions.push({
      [Op.or]: [
        { name: { [Op.iLike]: `%${term}%` } },
        { email: { [Op.iLike]: `%${term}%` } },
        { shop_name: { [Op.iLike]: `%${term}%` } },
      ],
    });
  }

  if (role && role !== "all") {
    conditions.push({ role });
  }

  return conditions.length ? { [Op.and]: conditions } : {};
}

async function listAdminUsers({
  limit = 20,
  offset = 0,
  search = "",
  role = "all",
} = {}) {
  const where = buildAdminUserWhere({ search, role });
  const safeLimit = Math.max(1, limit);

  const [rows, filteredTotal, catalogTotal, customerCount, sellerCount, adminCount] =
    await Promise.all([
      User.findAll({
        attributes: [
          "id",
          "name",
          "email",
          "role",
          "phone",
          "shop_name",
          "seller_verified",
          "profile_complete",
          "created_at",
        ],
        where,
        order: [["created_at", "DESC"]],
        limit: safeLimit,
        offset,
      }),
      User.count({ where }),
      User.count(),
      User.count({ where: { role: "customer" } }),
      User.count({ where: { role: "seller" } }),
      User.count({ where: { role: "admin" } }),
    ]);

  return {
    users: rows,
    total: filteredTotal,
    catalog_total: catalogTotal,
    limit: safeLimit,
    offset,
    page: Math.floor(offset / safeLimit) + 1,
    total_pages: Math.max(1, Math.ceil(filteredTotal / safeLimit)),
    stats: {
      catalog_total: catalogTotal,
      customers: customerCount,
      sellers: sellerCount,
      admins: adminCount,
    },
  };
}

function buildAdminOrderWhere({ search = "", status = "all" } = {}) {
  const conditions = [];
  const term = String(search || "").trim();

  if (term) {
    const orConditions = [{ order_number: { [Op.iLike]: `%${term}%` } }];
    const asNum = parseInt(term, 10);
    if (!Number.isNaN(asNum)) {
      orConditions.push({ user_id: asNum });
      orConditions.push({ id: asNum });
    }
    conditions.push({ [Op.or]: orConditions });
  }

  if (status && status !== "all") {
    conditions.push({ status });
  }

  return conditions.length ? { [Op.and]: conditions } : {};
}

async function listAdminOrders({
  limit = 15,
  offset = 0,
  search = "",
  status = "all",
} = {}) {
  const where = buildAdminOrderWhere({ search, status });
  const safeLimit = Math.max(1, limit);

  const [rows, filteredTotal, catalogTotal, pendingCount, paidCount] =
    await Promise.all([
      Order.findAll({
        where,
        order: [["ordered_at", "DESC"]],
        limit: safeLimit,
        offset,
      }),
      Order.count({ where }),
      Order.count(),
      Order.count({ where: { status: "pending" } }),
      Order.count({
        where: {
          [Op.or]: [
            { payment_status: "paid" },
            { status: { [Op.in]: ["processing", "shipped", "delivered"] } },
          ],
        },
      }),
    ]);

  const orders = await enrichOrders(rows);

  return {
    orders,
    total: filteredTotal,
    catalog_total: catalogTotal,
    limit: safeLimit,
    offset,
    page: Math.floor(offset / safeLimit) + 1,
    total_pages: Math.max(1, Math.ceil(filteredTotal / safeLimit)),
    stats: {
      catalog_total: catalogTotal,
      pending: pendingCount,
      paid: paidCount,
    },
  };
}

function buildAdminProductWhere({ search = "", category = "", stock = "all" } = {}) {
  const conditions = [];
  const term = String(search || "").trim();

  if (term) {
    const orConditions = [
      { title: { [Op.iLike]: `%${term}%` } },
      { category: { [Op.iLike]: `%${term}%` } },
    ];
    const asNum = parseInt(term, 10);
    if (!Number.isNaN(asNum)) {
      orConditions.push({ user_id: asNum });
    }
    conditions.push({ [Op.or]: orConditions });
  }

  if (category && category !== "all") {
    conditions.push({ category });
  }

  if (stock === "in") {
    conditions.push({ stock_quantity: { [Op.gt]: 0 } });
  } else if (stock === "out") {
    conditions.push({
      [Op.or]: [
        { stock_quantity: { [Op.lte]: 0 } },
        { stock_quantity: null },
      ],
    });
  }

  return conditions.length ? { [Op.and]: conditions } : {};
}

async function listAdminProducts({
  limit = 20,
  offset = 0,
  search = "",
  category = "",
  stock = "all",
} = {}) {
  const where = buildAdminProductWhere({ search, category, stock });

  const [rows, filteredTotal, catalogTotal, inStock, outOfStock, categoryRows] =
    await Promise.all([
      Product.findAll({
        attributes: [
          "id",
          "title",
          "price",
          "category",
          "stock_quantity",
          "user_id",
          "image_url",
          "created_at",
        ],
        where,
        order: [["created_at", "DESC"]],
        limit,
        offset,
      }),
      Product.count({ where }),
      Product.count(),
      Product.count({ where: { stock_quantity: { [Op.gt]: 0 } } }),
      Product.count({
        where: {
          [Op.or]: [
            { stock_quantity: { [Op.lte]: 0 } },
            { stock_quantity: null },
          ],
        },
      }),
      Product.findAll({
        attributes: ["category"],
        where: { category: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] } },
        group: ["category"],
        order: [["category", "ASC"]],
        raw: true,
      }),
    ]);

  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(filteredTotal / safeLimit));

  return {
    products: rows,
    total: filteredTotal,
    catalog_total: catalogTotal,
    limit: safeLimit,
    offset,
    page: Math.floor(offset / safeLimit) + 1,
    total_pages: totalPages,
    categories: categoryRows.map((r) => r.category).filter(Boolean),
    stats: {
      catalog_total: catalogTotal,
      in_stock: inStock,
      out_of_stock: outOfStock,
      categories: categoryRows.length,
    },
  };
}

module.exports = {
  getBuyerStats,
  getSellerStats,
  getAdminOverview,
  listAdminUsers,
  listAdminOrders,
  listAdminProducts,
  getSellerOrderIds,
  getSellerProductIds,
};
