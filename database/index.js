require("dotenv").config();
const { Pool } = require("pg");
const dbConfig = {
  user: process.env.POSTGRE_USER,
  host: process.env.POSTGRE_HOST,
  database: process.env.POSTGRE_DATABASE,
  password: process.env.POSTGRE_PASSWORD,
  port: parseInt(process.env.POSTGRE_PORT || "5432"),
  max: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "10000"),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || "2000"
  ),
  ssl: false
  // ssl: process.env.POSTGRE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  // ssl: { rejectUnauthorized: false }
};
const pool = new Pool(dbConfig);
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("Database connection successful");
    const result = await client.query("SELECT NOW()");
    console.log("Current time from database:", result.rows[0]);
    client.release();
  } catch (err) {
    console.error("Database connection error:", err);
    process.exit(-1);
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
