-- ============================================
-- ADD SELLER FIELDS TO USERS TABLE
-- ============================================
-- Run this in Neon SQL Editor to add marketplace seller fields

-- Add seller-specific columns
ALTER TABLE ecommerce.users 
ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shop_description TEXT,
ADD COLUMN IF NOT EXISTS shop_logo_url TEXT,
ADD COLUMN IF NOT EXISTS seller_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(3,2) CHECK (seller_rating >= 0 AND seller_rating <= 5),
ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_seller_verified ON ecommerce.users(seller_verified);
CREATE INDEX IF NOT EXISTS idx_users_shop_name ON ecommerce.users(shop_name);
CREATE INDEX IF NOT EXISTS idx_users_seller_rating ON ecommerce.users(seller_rating);

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'ecommerce' 
  AND table_name = 'users'
  AND column_name IN ('shop_name', 'shop_description', 'shop_logo_url', 'seller_verified', 'seller_rating', 'total_sales')
ORDER BY column_name;

-- Success message
SELECT 'Seller fields added successfully to users table!' AS status;
