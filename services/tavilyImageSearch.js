require("dotenv").config();
const axios = require("axios");
const { isImageUrlReachable } = require("./imageUrlValidator");
const { getCategoryDefinition } = require("../config/categories");

const TAVILY_URL = "https://api.tavily.com/search";

const CATEGORY_QUERIES = {
  "men-fashion": "men fashion clothing product photography white background ecommerce",
  "women-fashion": "women fashion dress outfit product photography ecommerce",
  "unisex-fashion": "unisex streetwear fashion product photo ecommerce",
  shoes: "sneakers shoes footwear product photography white background",
  watches: "luxury wristwatch product photography studio",
  "beauty-makeup": "makeup cosmetics beauty product photography",
  beauty: "makeup cosmetics beauty product photography",
  electronics: "electronics gadget product photography white background",
  "home-general": "home decor furniture product photography",
  accessories: "fashion accessories bag sunglasses product photo",
  clothing: "fashion apparel clothing product photography",
};

function normalizeImageCandidate(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return entry.trim();
  if (typeof entry.url === "string") return entry.url.trim();
  return null;
}

function collectCandidatesFromResponse(data) {
  const out = [];
  const seen = new Set();

  const push = (url) => {
    if (!url || seen.has(url)) return;
    if (!/^https?:\/\//i.test(url)) return;
    seen.add(url);
    out.push(url);
  };

  for (const img of data?.images || []) {
    push(normalizeImageCandidate(img));
  }

  for (const result of data?.results || []) {
    for (const img of result?.images || []) {
      push(normalizeImageCandidate(img));
    }
  }

  return out;
}

function buildSearchQuery(product) {
  const def = getCategoryDefinition(product.category);
  const label = def?.label || product.category || "fashion";
  const base =
    CATEGORY_QUERIES[product.category] ||
    CATEGORY_QUERIES[def?.slug] ||
    `${label} product photography ecommerce`;
  const title = (product.title || "").slice(0, 80);
  return `${base} ${title}`.trim();
}

async function tavilySearchImages(query, { maxResults = 5 } = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is missing from .env");
  }

  const { data } = await axios.post(
    TAVILY_URL,
    {
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_images: true,
      max_results: maxResults,
    },
    { timeout: 45000 }
  );

  return collectCandidatesFromResponse(data);
}

/**
 * Find first Tavily image URL that loads successfully.
 */
async function findWorkingImageForProduct(product, { delayMs = 400 } = {}) {
  const query = buildSearchQuery(product);
  const candidates = await tavilySearchImages(query);

  for (const url of candidates) {
    if (await isImageUrlReachable(url)) {
      return { url, query, source: "tavily" };
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, Math.min(delayMs, 200)));
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  CATEGORY_QUERIES,
  buildSearchQuery,
  tavilySearchImages,
  findWorkingImageForProduct,
  sleep,
};
