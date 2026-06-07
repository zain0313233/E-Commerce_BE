#!/usr/bin/env node
/**
 * Replace picsum placeholder images with curated fashion photos.
 *
 * Usage:
 *   node scripts/refresh-product-images.js
 *   node scripts/refresh-product-images.js --all-seeded
 *   (default also replaces broken Unsplash URLs with Pexels pool)
 */
require("dotenv").config();
const sequelize = require("../config/db");
sequelize.options.logging = false;
const { refreshFashionProductImages } = require("../services/productSeeder");

async function main() {
  const allSeeded = process.argv.includes("--all-seeded");
  console.log(
    allSeeded
      ? "Updating images for ALL seeded products…"
      : "Updating picsum placeholder images only…"
  );

  const result = await refreshFashionProductImages({
    onlyPicsum: !allSeeded,
  });

  console.log("\n✅ Image refresh complete\n");
  console.log(JSON.stringify(result, null, 2));
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Refresh failed:", err);
  process.exit(1);
});
