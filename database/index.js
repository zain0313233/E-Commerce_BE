require("dotenv").config();
const { Pool } = require("pg");

/** channel_binding=require breaks many Node/pg setups on Windows */
function normalizeDatabaseUrl(url) {
  if (!url) return url;
  return url
    .replace(/([?&])channel_binding=require&?/g, "$1")
    .replace(/[?&]$/, "");
}

// Check if DATABASE_URL is provided (Neon connection string)
if (process.env.DATABASE_URL) {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

  const pool = new Pool({
    connectionString,
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
    max: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "10000"),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || "15000")
  });

  async function testConnection() {
    const client = await pool.connect();
    try {
      console.log("Database connection successful");
      const result = await client.query("SELECT NOW()");
      console.log("Current time from database:", result.rows[0]);
    } finally {
      client.release();
    }
  }

  async function main() {
    try {
      await testConnection();
    } catch (err) {
      console.error("Error in main function:", err);
    } finally {
      await pool.end();
    }
  }

  module.exports = {
    pool,
    testConnection
  };

  if (require.main === module) {
    main();
  }
} else {
  // Use individual environment variables
  const sslEnabled = process.env.POSTGRE_SSL === 'true';
  
  const dbConfig = {
    user: process.env.POSTGRE_USER,
    host: process.env.POSTGRE_HOST,
    database: process.env.POSTGRE_DATABASE,
    password: process.env.POSTGRE_PASSWORD,
    port: parseInt(process.env.POSTGRE_PORT || "5432"),
    max: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "10000"),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || "15000"),
    ssl: sslEnabled ? { 
      require: true,
      rejectUnauthorized: false 
    } : false
  };

  const pool = new Pool(dbConfig);

  async function testConnection() {
    const client = await pool.connect();
    try {
      console.log("Database connection successful");
      const result = await client.query("SELECT NOW()");
      console.log("Current time from database:", result.rows[0]);
    } finally {
      client.release();
    }
  }

  async function main() {
    try {
      await testConnection();
    } catch (err) {
      console.error("Error in main function:", err);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }

  module.exports = {
    pool,
    testConnection
  };

  if (require.main === module) {
    main();
  }
}
