ALTER TABLE ecommerce.users
ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_profile_complete ON ecommerce.users(profile_complete);
