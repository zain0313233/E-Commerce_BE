/**
 * Store taxonomy: DB `category` = primary slug; tags include route:* for UI pages.
 */
const CATALOG_CATEGORIES = [
  {
    slug: "men-fashion",
    label: "Men Fashion",
    route: "men",
    subcategories: ["shirts", "pants", "jackets", "activewear", "accessories"],
  },
  {
    slug: "women-fashion",
    label: "Women Fashion",
    route: "women",
    subcategories: ["dresses", "tops", "skirts", "activewear", "handbags"],
  },
  {
    slug: "unisex-fashion",
    label: "Unisex / General Fashion",
    route: "unisex",
    subcategories: ["basics", "outerwear", "loungewear", "caps", "socks"],
  },
  {
    slug: "watches",
    label: "Watches",
    route: "watches",
    subcategories: ["analog", "digital", "smartwatch", "luxury", "sport"],
  },
  {
    slug: "shoes",
    label: "Shoes",
    route: "shoes",
    subcategories: ["sneakers", "boots", "heels", "sandals", "formal"],
  },
  {
    slug: "clothing",
    label: "Clothing",
    route: "clothing",
    subcategories: ["casual", "formal", "seasonal", "kids", "plus-size"],
  },
  {
    slug: "beauty-makeup",
    label: "Makeup & Beauty",
    route: "beauty",
    subcategories: ["makeup", "skincare", "fragrance", "haircare", "tools"],
  },
  {
    slug: "electronics",
    label: "Electronics",
    route: "electronics",
    subcategories: ["phones", "laptops", "audio", "wearables", "accessories"],
  },
  {
    slug: "home-general",
    label: "Home & Living",
    route: "home",
    subcategories: ["decor", "kitchen", "furniture", "lighting", "storage"],
  },
  {
    slug: "accessories",
    label: "Accessories & Other",
    route: "accessories",
    subcategories: ["bags", "belts", "jewelry", "sunglasses", "misc"],
  },
];

/** URL segment (men, women, shoes) → primary category slug */
const ROUTE_ALIASES = {
  men: "men-fashion",
  women: "women-fashion",
  woman: "women-fashion",
  womens: "women-fashion",
  unisex: "unisex-fashion",
  general: "unisex-fashion",
  watches: "watches",
  watch: "watches",
  shoes: "shoes",
  footwear: "shoes",
  clothing: "clothing",
  clothes: "clothing",
  beauty: "beauty-makeup",
  makeup: "beauty-makeup",
  cosmetics: "beauty-makeup",
  electronics: "electronics",
  tech: "electronics",
  home: "home-general",
  living: "home-general",
  accessories: "accessories",
  other: "accessories",
};

function resolvePrimaryCategory(routeOrSlug) {
  const key = String(routeOrSlug || "").trim().toLowerCase();
  if (ROUTE_ALIASES[key]) return ROUTE_ALIASES[key];
  const found = CATALOG_CATEGORIES.find((c) => c.slug === key);
  return found ? found.slug : key;
}

function resolveStoreRoute(routeOrSlug) {
  const key = String(routeOrSlug || "").trim().toLowerCase();
  const byAlias = Object.entries(ROUTE_ALIASES).find(([alias]) => alias === key);
  if (byAlias) {
    const cat = CATALOG_CATEGORIES.find((c) => c.slug === byAlias[1]);
    return cat?.route || key;
  }
  const found = CATALOG_CATEGORIES.find(
    (c) => c.slug === key || c.route === key
  );
  return found?.route || key;
}

function getCategoryDefinition(routeOrSlug) {
  const primary = resolvePrimaryCategory(routeOrSlug);
  return CATALOG_CATEGORIES.find((c) => c.slug === primary) || null;
}

module.exports = {
  CATALOG_CATEGORIES,
  ROUTE_ALIASES,
  resolvePrimaryCategory,
  resolveStoreRoute,
  getCategoryDefinition,
};
