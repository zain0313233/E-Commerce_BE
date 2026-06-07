#!/usr/bin/env node
/**
 * Bulk seed catalog for portfolio / demo.
 *
 * Usage:
 *   node scripts/seed-products.js
 *   node scripts/seed-products.js --per-category=500
 *   node scripts/seed-products.js --per-category=500 --clear
 *   node scripts/seed-products.js --sync-only
 */
require("dotenv").config();
const sequelize = require("../config/db");
const { seedCatalog } = require("../services/productSeeder");
const { ensureProductSchema } = require("../services/ensureProductSchema");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    perCategory: 500,
    clear: false,
    syncOnly: false,
  };
  for (const arg of args) {
    if (arg === "--clear") opts.clear = true;
    if (arg === "--sync-only") opts.syncOnly = true;
    if (arg.startsWith("--per-category=")) {
      opts.perCategory = Math.min(
        600,
        Math.max(1, parseInt(arg.split("=")[1], 10) || 500)
      );
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log("Verifying schema (seed_key + indexes)…");
  await ensureProductSchema(sequelize);

  if (opts.syncOnly) {
    console.log("Schema verification complete.");
    process.exit(0);
  }

  console.log(
    `Seeding ~${opts.perCategory * 10} products (${opts.perCategory} per category × 10 categories)…`
  );
  if (opts.clear) console.log("Clearing previous seeded rows (seed_key IS NOT NULL)…");

  const result = await seedCatalog({
    perCategory: opts.perCategory,
    clearSeeded: opts.clear,
    batchSize: 500,
  });

  console.log("\n✅ Seed complete\n");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
