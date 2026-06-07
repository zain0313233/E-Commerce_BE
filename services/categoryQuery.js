const { Op } = require("sequelize");
const {
  resolvePrimaryCategory,
  getCategoryDefinition,
} = require("../config/categories");

/**
 * Fast, index-friendly filter: exact `category` slug (all seeded rows use this).
 * Legacy DummyJSON rows may use womens- or mens- prefixes (tight patterns only).
 */
function buildCategoryWhere(routeOrSlug) {
  const primary = resolvePrimaryCategory(routeOrSlug);
  const def = getCategoryDefinition(routeOrSlug);
  const route = def?.route || String(routeOrSlug).toLowerCase();

  const orConditions = [{ category: primary }];

  if (route === "women" || primary === "women-fashion") {
    orConditions.push(
      { category: { [Op.iLike]: "womens-%" } },
      { category: { [Op.iLike]: "women-%" } }
    );
  } else if (route === "men" || primary === "men-fashion") {
    orConditions.push({ category: { [Op.iLike]: "mens-%" } });
  } else if (route === "shoes" || primary === "shoes") {
    orConditions.push({ category: { [Op.iLike]: "%shoe%" } });
  }

  return { [Op.or]: orConditions };
}

function getPrimaryCategoryOnly(routeOrSlug) {
  return { category: resolvePrimaryCategory(routeOrSlug) };
}

module.exports = { buildCategoryWhere, getPrimaryCategoryOnly, resolvePrimaryCategory };
