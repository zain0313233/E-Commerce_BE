require("dotenv").config();
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { Product } = require("../models/Product");
const { CATALOG_CATEGORIES } = require("../config/categories");
const { getFashionImageUrl } = require("../config/fashionProductImages");

const BRANDS = [
  "NovaWear",
  "UrbanLine",
  "PeakStyle",
  "Lumen",
  "Craft & Co",
  "North Ridge",
  "Velvet Lane",
  "Pulse",
  "Aster",
  "Mainline",
];

const ADJECTIVES = [
  "Premium",
  "Classic",
  "Essential",
  "Modern",
  "Pro",
  "Lite",
  "Studio",
  "Heritage",
  "Active",
  "Eco",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundPrice(n) {
  return Math.round(n * 100) / 100;
}

function buildImageUrl(categorySlug, subcategory, index) {
  return getFashionImageUrl(categorySlug, subcategory, index);
}

function generateProductRecord(categoryDef, subcategory, index) {
  const adj = pick(ADJECTIVES);
  const brand = pick(BRANDS);
  const title = `${adj} ${brand} ${subcategory.replace(/-/g, " ")} ${index + 1}`;
  const basePrice =
    categoryDef.slug === "electronics"
      ? randomBetween(49, 1299)
      : categoryDef.slug === "watches"
        ? randomBetween(79, 899)
        : categoryDef.slug === "beauty-makeup"
          ? randomBetween(8, 120)
          : randomBetween(15, 280);

  const discount =
    Math.random() > 0.65 ? roundPrice(randomBetween(5, 35)) : null;
  const seedKey = `seed:${categoryDef.slug}:${subcategory}:${String(index).padStart(4, "0")}`;

  return {
    title,
    description: `Portfolio demo listing for ${categoryDef.label} — ${subcategory}. ${brand} quality build with fast shipping and easy returns. Ideal for storefront, cart, and checkout testing.`,
    price: basePrice,
    discount_percentage: discount,
    category: categoryDef.slug,
    brand,
    image_url: buildImageUrl(categoryDef.slug, subcategory, index),
    thumbnail_url: buildImageUrl(categoryDef.slug, subcategory, index),
    stock_quantity: randomBetween(5, 120),
    rating: roundPrice(3.5 + Math.random() * 1.5),
    tags: [
      categoryDef.route,
      categoryDef.slug,
      subcategory,
      brand.toLowerCase().replace(/\s+/g, "-"),
      `route:${categoryDef.route}`,
    ],
    user_id: null,
    seed_key: seedKey,
    created_at: new Date(
      Date.now() - randomBetween(0, 90) * 24 * 60 * 60 * 1000
    ),
  };
}

/**
 * Generate flat array of product rows for seeding.
 */
function generateCatalogBatch({ perCategory = 500 } = {}) {
  const rows = [];
  for (const categoryDef of CATALOG_CATEGORIES) {
    const subs = categoryDef.subcategories;
    const perSub = Math.ceil(perCategory / subs.length);
    let count = 0;
    for (const sub of subs) {
      for (let i = 0; i < perSub && count < perCategory; i += 1) {
        rows.push(generateProductRecord(categoryDef, sub, i));
        count += 1;
      }
    }
  }
  return rows;
}

async function bulkInsertProducts(rows, { batchSize = 500 } = {}) {
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    try {
      const result = await Product.bulkCreate(chunk, {
        ignoreDuplicates: true,
        validate: true,
      });
      inserted += result.length;
      skipped += chunk.length - result.length;
    } catch (err) {
      if (err.name === "SequelizeUniqueConstraintError") {
        skipped += chunk.length;
      } else {
        throw err;
      }
    }
  }

  return { inserted, skipped };
}

async function seedCatalog({
  perCategory = 500,
  clearSeeded = false,
  batchSize = 500,
} = {}) {
  const started = Date.now();

  if (clearSeeded) {
    await Product.destroy({
      where: {
        seed_key: { [Op.ne]: null },
      },
    });
  }

  const rows = generateCatalogBatch({ perCategory });
  const { inserted, skipped } = await bulkInsertProducts(rows, { batchSize });

  const [counts] = await sequelize.query(`
    SELECT category, COUNT(*)::int AS count
    FROM ecommerce.products
    WHERE seed_key IS NOT NULL
    GROUP BY category
    ORDER BY category;
  `);

  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

  return {
    success: true,
    requestedPerCategory: perCategory,
    generated: rows.length,
    inserted,
    skippedDuplicates: skipped,
    elapsedSeconds: elapsedSec,
    approximateRatePerMinute: Math.round((inserted / (elapsedSec / 60)) || 0),
    breakdownByCategory: counts,
    totalCategories: CATALOG_CATEGORIES.length,
  };
}

function resolveFashionUrlForRow(row) {
  const parts = (row.seed_key || "").split(":");
  const sub = parts[2] || "item";
  const idx = parseInt(parts[3], 10) || row.id % 500;
  return getFashionImageUrl(row.category, sub, idx);
}

async function bulkUpdateProductImages(rows) {
  if (!rows.length) return 0;

  const ids = [];
  const urls = [];
  for (const row of rows) {
    const url = resolveFashionUrlForRow(row);
    ids.push(row.id);
    urls.push(url);
  }

  await sequelize.query(
    `UPDATE ecommerce.products AS p
     SET image_url = v.url, thumbnail_url = v.url
     FROM (
       SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS url
     ) AS v
     WHERE p.id = v.id`,
    { bind: [ids, urls] }
  );

  return rows.length;
}

/**
 * Replace picsum (or all seeded) product images with curated fashion URLs.
 */
async function refreshFashionProductImages({
  onlyPicsum = true,
  batchSize = 500,
} = {}) {
  const where = onlyPicsum
    ? {
        [Op.or]: [
          { image_url: { [Op.like]: "%picsum.photos%" } },
          { image_url: { [Op.like]: "%fastly.picsum%" } },
          { image_url: { [Op.like]: "%images.unsplash.com%" } },
        ],
      }
    : { seed_key: { [Op.ne]: null } };

  const matched = await Product.count({ where });
  let updated = 0;

  if (onlyPicsum) {
    // Rows leave the filter after update — always fetch the next batch from the top.
    while (true) {
      const rows = await Product.findAll({
        where,
        attributes: ["id", "category", "seed_key"],
        limit: batchSize,
        order: [["id", "ASC"]],
        raw: true,
      });
      if (!rows.length) break;

      updated += await bulkUpdateProductImages(rows);
    }
  } else {
    let lastId = 0;
    while (true) {
      const rows = await Product.findAll({
        where: { ...where, id: { [Op.gt]: lastId } },
        attributes: ["id", "category", "seed_key"],
        limit: batchSize,
        order: [["id", "ASC"]],
        raw: true,
      });
      if (!rows.length) break;

      updated += await bulkUpdateProductImages(rows);
      lastId = rows[rows.length - 1].id;
    }
  }

  return { updated, matched };
}

module.exports = {
  generateCatalogBatch,
  bulkInsertProducts,
  seedCatalog,
  refreshFashionProductImages,
};
