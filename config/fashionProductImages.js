/**
 * Product image pools — Pexels CDN (stable hotlink URLs).
 * Square crop for product cards.
 */
const P = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop`;

const POOLS = {
  "men-fashion": [
    P(1183266),
    P(1040945),
    P(3771836),
    P(1926769),
    P(1300575),
    P(1124468),
    P(2983464),
    P(7671166),
    P(6311651),
    P(1043474),
    P(1182825),
    P(3258767),
  ],
  "women-fashion": [
    P(985635),
    P(1462637),
    P(1536619),
    P(1926769),
    P(1126993),
    P(994523),
    P(2065873),
    P(6311392),
    P(7671166),
    P(1036623),
    P(1485031),
    P(1124468),
  ],
  shoes: [
    P(2529148),
    P(1598505),
    P(1032110),
    P(1464625),
    P(19090),
    P(2529157),
    P(1456708),
    P(3359959),
    P(1478440),
    P(1084711),
    P(1598508),
    P(2529147),
  ],
  watches: [
    P(2789580),
    P(19081994),
    P(169677),
    P(997877),
    P(19081994),
    P(169677),
    P(2988210),
    P(19081994),
  ],
  "beauty-makeup": [
    P(3373736),
    P(3685530),
    P(2533266),
    P(4465124),
    P(3993449),
    P(3785079),
    P(2533266),
    P(3685530),
  ],
  beauty: [
    P(3373736),
    P(3685530),
    P(2533266),
    P(4465124),
    P(3993449),
    P(3785079),
  ],
  electronics: [
    P(3945689),
    P(1810503),
    P(3412537),
    P(4158),
    P(1810591),
    P(39284),
    P(163117),
    P(356056),
  ],
  "home-general": [
    P(1571460),
    P(1080721),
    P(276583),
    P(276724),
    P(1571463),
    P(1080696),
    P(1571453),
    P(1080721),
  ],
  accessories: [
    P(1152077),
    P(1027130),
    P(169308),
    P(1152077),
    P(291762),
    P(1027130),
    P(169308),
    P(1152077),
  ],
  "unisex-fashion": [
    P(1043474),
    P(1182825),
    P(3258767),
    P(1926769),
    P(7671166),
    P(6311651),
    P(1124468),
    P(2983464),
  ],
  clothing: [
    P(1043474),
    P(1182825),
    P(985635),
    P(1462637),
    P(1926769),
    P(1124468),
    P(2983464),
    P(3258767),
  ],
};

const DEFAULT_POOL = POOLS["unisex-fashion"];

/** Optional Tavily-enriched URLs per category (filled by scripts/warm-category-images-tavily.js) */
let tavilyPool = {};
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  tavilyPool = require("./categoryImageCache.json");
} catch {
  tavilyPool = {};
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getPoolForCategory(categorySlug) {
  const extra = Array.isArray(tavilyPool[categorySlug])
    ? tavilyPool[categorySlug]
    : [];
  const base = POOLS[categorySlug] || DEFAULT_POOL;
  return extra.length ? [...extra, ...base] : base;
}

/**
 * Pick a stable fashion image for a product row.
 */
function getFashionImageUrl(categorySlug, subcategory = "item", index = 0) {
  const pool = getPoolForCategory(categorySlug);
  const key = `${categorySlug}:${subcategory}:${index}`;
  const idx = (hashString(key) + index) % pool.length;
  return pool[idx];
}

function setTavilyPoolCache(cache) {
  tavilyPool = cache || {};
}

module.exports = {
  POOLS,
  getFashionImageUrl,
  getPoolForCategory,
  setTavilyPoolCache,
};
