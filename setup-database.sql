-- ============================================
-- E-COMMERCE DATABASE SETUP
-- ============================================
-- Run this in your Neon SQL Editor
-- https://console.neon.tech → SQL Editor

-- Create the ecommerce schema
CREATE SCHEMA IF NOT EXISTS ecommerce;

-- Set search path to include ecommerce schema
SET search_path TO ecommerce, public;

-- Verify schema was created
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'ecommerce';

-- Show all schemas
SELECT schema_name 
FROM information_schema.schemata 
ORDER BY schema_name;

-- ============================================
-- TABLES WILL BE CREATED BY SEQUELIZE
-- ============================================
-- Your Sequelize models will automatically create:
-- - users
-- - products
-- - orders
-- - cart_items
-- - reviews
-- - order_items

-- ============================================
-- GRANT PERMISSIONS (if needed)
-- ============================================
GRANT ALL ON SCHEMA ecommerce TO neondb_owner;
GRANT ALL ON ALL TABLES IN SCHEMA ecommerce TO neondb_owner;
GRANT ALL ON ALL SEQUENCES IN SCHEMA ecommerce TO neondb_owner;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA ecommerce 
GRANT ALL ON TABLES TO neondb_owner;

ALTER DEFAULT PRIVILEGES IN SCHEMA ecommerce 
GRANT ALL ON SEQUENCES TO neondb_owner;

-- Success message
SELECT 'Schema ecommerce created successfully!' AS status;
