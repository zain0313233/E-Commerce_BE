#!/usr/bin/env node
/**
 * Scan products in batches of 10; fix missing/broken image_url via Tavily + category pools.
 *
 * Usage:
 *   node scripts/fix-broken-product-images.js
 *   node scripts/fix-broken-product-images.js --limit=100
 *   node scripts/fix-broken-product-images.js --offset=500 --batch=10
 *   node scripts/fix-broken-product-images.js --dry-run
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const sequelize = require("../config/db");
const { Product } = require("../models/Product");
const { getFashionImageUrl } = require("../config/fashionProductImages");
const { isImageUrlReachable } = require("../services/imageUrlValidator");
const {
  findWorkingImageForProduct,
  sleep,
} = require("../services/tavilyImageSearch");

sequelize.options.logging = false;

const BATCH_DEFAULT = 10;
const TAVILY_DELAY_MS = 700;

function parseArgs() {
  const args = process.argv.slice(2);
  const getNum = (flag, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${flag}=`));
    return hit ? parseInt(hit.split("=")[1], 10) : fallback;
  };
  return {
    batch: getNum("batch", BATCH_DEFAULT),
    limit: getNum("limit", 0),
    offset: getNum("offset", 0),
    dryRun: args.includes("--dry-run"),
    useTavily: !args.includes("--no-tavily"),
  };
}

function resolveFallbackUrl(product) {
  const parts = (product.seed_key || "").split(":");
  const sub = parts[2] || "item";
  const idx = parseInt(parts[3], 10) || product.id % 500;
  return getFashionImageUrl(product.category, sub, idx);
}

async function resolveImageForProduct(product, useTavily) {
  const current = product.image_url;
  if (current && (await isImageUrlReachable(current))) {
    return { url: current, action: "ok" };
  }

  const fallback = resolveFallbackUrl(product);
  if (fallback && (await isImageUrlReachable(fallback))) {
    return { url: fallback, action: "pool" };
  }

  if (useTavily && process.env.TAVILY_API_KEY) {
    const found = await findWorkingImageForProduct(product);
    if (found?.url) {
      return { url: found.url, action: "tavily", query: found.query };
    }
    await sleep(TAVILY_DELAY_MS);
  }

  if (fallback) {
    return { url: fallback, action: "pool-forced" };
  }

  return { url: null, action: "failed" };
}

async function main() {
  const { batch, limit, offset, dryRun, useTavily } = parseArgs();
  const total = await Product.count();
  const end = limit > 0 ? Math.min(offset + limit, total) : total;

  console.log(
    `Scanning products ${offset + 1}–${end} of ${total} (batch=${batch}, tavily=${useTavily}, dryRun=${dryRun})`
  );

  const stats = { ok: 0, pool: 0, tavily: 0, failed: 0, updated: 0 };
  let cursor = offset;

  while (cursor < end) {
    const take = Math.min(batch, end - cursor);
    const rows = await Product.findAll({
      attributes: ["id", "title", "category", "image_url", "seed_key"],
      order: [["id", "ASC"]],
      limit: take,
      offset: cursor,
      raw: true,
    });

    if (!rows.length) break;

    for (const product of rows) {
      const result = await resolveImageForProduct(product, useTavily);
      stats[result.action] = (stats[result.action] || 0) + 1;

      const needsUpdate =
        result.url && result.url !== product.image_url && result.action !== "ok";

      if (needsUpdate) {
        stats.updated += 1;
        if (!dryRun) {
          await Product.update(
            { image_url: result.url, thumbnail_url: result.url },
            { where: { id: product.id } }
          );
        }
        console.log(
          `[${product.id}] ${result.action} → ${result.url.slice(0, 72)}…`
        );
      }
    }

    cursor += take;
    if (cursor % 100 === 0 || cursor >= end) {
      console.log(`Progress ${cursor}/${end}`, stats);
    }
  }

  const reportPath = path.join(
    __dirname,
    "..",
    "logs",
    `fix-images-${Date.now()}.json`
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ stats, offset, end, total }, null, 2));

  console.log("\nDone.", stats);
  console.log("Report:", reportPath);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
