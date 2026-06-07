/**
 * Safe migrations for products table (avoids Sequelize alter + UNIQUE SQL bug).
 */
async function ensureProductSchema(sequelize) {
  await sequelize.query("CREATE SCHEMA IF NOT EXISTS ecommerce;");

  const [tables] = await sequelize.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ecommerce' AND table_name = 'products'
    LIMIT 1;
  `);

  if (tables.length === 0) {
    throw new Error(
      'Table ecommerce.products does not exist. Run: node setup-complete-database.js'
    );
  }

  await sequelize.query(`
    ALTER TABLE ecommerce.products
    ADD COLUMN IF NOT EXISTS seed_key VARCHAR(160);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS products_category_idx
    ON ecommerce.products (category);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS products_category_created_at_idx
    ON ecommerce.products (category, created_at DESC);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS products_brand_idx
    ON ecommerce.products (brand);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS products_created_at_idx
    ON ecommerce.products (created_at);
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS products_seed_key_unique
    ON ecommerce.products (seed_key)
    WHERE seed_key IS NOT NULL;
  `);

  console.log("✅ Product schema verified (seed_key + indexes)");
}

module.exports = { ensureProductSchema };
