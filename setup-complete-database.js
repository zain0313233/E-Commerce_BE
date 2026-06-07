require('dotenv').config();
const { Pool } = require('pg');
const sequelize = require('./config/db');

async function setupDatabase() {
  console.log('🚀 Setting up complete database...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  });

  try {
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    // Step 1: Create schema
    console.log('📦 Creating ecommerce schema...');
    try {
      await client.query('CREATE SCHEMA IF NOT EXISTS ecommerce;');
      console.log('✅ Schema created/verified\n');
    } catch (err) {
      console.log('⚠️  Schema already exists\n');
    }

    client.release();
    await pool.end();

    // Step 2: Use Sequelize to create all tables
    console.log('📊 Creating tables using Sequelize...');
    console.log('   This will create: users, products, orders, cart_items, reviews, order_items\n');

    try {
      // Import all models
      require('./models/User');
      require('./models/Product');
      require('./models/Order');
      require('./models/CartItem');
      require('./models/Review');
      require('./models/OrderItem');

      // Sync all models (create tables)
      await sequelize.sync({ alter: true });
      console.log('✅ All tables created successfully!\n');

      // Verify tables
      console.log('📋 Verifying tables...');
      const [tables] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'ecommerce'
        ORDER BY table_name;
      `);

      console.log('✅ Tables in ecommerce schema:');
      tables.forEach(t => console.log(`   - ${t.table_name}`));

      // Verify user columns
      console.log('\n📋 Verifying users table columns...');
      const [columns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'ecommerce' 
          AND table_name = 'users'
        ORDER BY ordinal_position;
      `);

      console.log('✅ Users table columns:');
      console.table(columns);

      console.log('\n🎉 Database setup completed successfully!');
      console.log('\n✨ Your marketplace database is ready!');
      console.log('\nYou can now:');
      console.log('  1. Start the backend: npm run dev');
      console.log('  2. Test signup at: http://localhost:3000/signup');
      console.log('  3. Create seller accounts with shop names\n');

      process.exit(0);

    } catch (err) {
      console.error('❌ Error creating tables:', err.message);
      throw err;
    }

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase();
