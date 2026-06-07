require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  });

  try {
    // Test connection
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_add_seller_fields.sql');
    console.log('📄 Reading migration file:', migrationPath);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements (remove comments and empty lines)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comment-only statements
      if (statement.startsWith('--') || statement.length < 10) {
        continue;
      }

      console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const result = await client.query(statement);
        
        // Show results if it's a SELECT statement
        if (statement.trim().toUpperCase().startsWith('SELECT')) {
          console.log('   Result:', result.rows);
        } else {
          console.log('   ✅ Success');
        }
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log('   ⚠️  Column already exists, skipping...');
        } else {
          throw err;
        }
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 Verifying new columns...');

    // Verify columns were added
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'ecommerce' 
        AND table_name = 'users'
        AND column_name IN ('shop_name', 'shop_description', 'shop_logo_url', 'seller_verified', 'seller_rating', 'total_sales')
      ORDER BY column_name;
    `;

    const verifyResult = await client.query(verifyQuery);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✅ New columns added:');
      console.table(verifyResult.rows);
    } else {
      console.log('\n⚠️  Warning: Could not verify columns. Please check manually.');
    }

    client.release();
    await pool.end();

    console.log('\n✨ All done! Your database is ready for marketplace features.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run migration
runMigration();
