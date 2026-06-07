const { Op } = require("sequelize");
const { resolvePrimaryCategory } = require("../config/categories");

function buildProductListWhere(query = {}) {
  const { category, minPrice, maxPrice, onSale, search } = query;
  const where = {};

  if (category && String(category).toLowerCase() !== "all") {
    where.category = resolvePrimaryCategory(category);
  }

  const min = parseFloat(minPrice);
  const max = parseFloat(maxPrice);
  if (!Number.isNaN(min) || !Number.isNaN(max)) {
    where.price = {};
    if (!Number.isNaN(min)) where.price[Op.gte] = min;
    if (!Number.isNaN(max)) where.price[Op.lte] = max;
  }

  if (onSale === "true" || onSale === true) {
    where.discount_percentage = { [Op.gt]: 0 };
  }

  const term = String(search || "").trim();
  if (term.length >= 2) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${term}%` } },
      { brand: { [Op.iLike]: `%${term}%` } },
      { description: { [Op.iLike]: `%${term}%` } },
    ];
  }

  return where;
}

function mergeWithCategoryWhere(categoryWhere, query = {}) {
  const listWhere = buildProductListWhere(query);
  if (!listWhere || Object.keys(listWhere).length === 0) {
    return categoryWhere;
  }
  return { [Op.and]: [categoryWhere, listWhere] };
}

function buildProductListOrder(sort) {
  switch (String(sort || "newest").toLowerCase()) {
    case "price_asc":
      return [["price", "ASC"]];
    case "price_desc":
      return [["price", "DESC"]];
    case "rating":
      return [
        ["rating", "DESC"],
        ["created_at", "DESC"],
      ];
    case "newest":
    default:
      return [["created_at", "DESC"]];
  }
}

module.exports = {
  buildProductListWhere,
  buildProductListOrder,
  mergeWithCategoryWhere,
};
