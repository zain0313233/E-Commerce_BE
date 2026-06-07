#!/usr/bin/env node
/**
 * One Tavily search per category → saves verified image URLs to config/categoryImageCache.json
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { CATALOG_CATEGORIES } = require("../config/categories");
const {
  CATEGORY_QUERIES,
  tavilySearchImages,
  sleep,
} = require("../services/tavilyImageSearch");
const { isImageUrlReachable } = require("../services/imageUrlValidator");

const OUT = path.join(__dirname, "..", "config", "categoryImageCache.json");
const DELAY_MS = 1200;

async function main() {
  const cache = {};
  for (const cat of CATALOG_CATEGORIES) {
    const query =
      CATEGORY_QUERIES[cat.slug] ||
      `${cat.label} product photography ecommerce white background`;
    console.log(`Tavily: ${cat.slug} …`);
    try {
      const candidates = await tavilySearchImages(query, { maxResults: 8 });
      const good = [];
      for (const url of candidates) {
        if (good.length >= 12) break;
        if (await isImageUrlReachable(url)) good.push(url);
      }
      cache[cat.slug] = good;
      console.log(`  → ${good.length} images`);
    } catch (e) {
      console.warn(`  skip ${cat.slug}:`, e.message);
      cache[cat.slug] = [];
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUT, JSON.stringify(cache, null, 2));
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
