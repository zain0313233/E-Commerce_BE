-- Run on Neon after 003_chat_messages.sql
ALTER TABLE ecommerce.chat_messages
  ALTER COLUMN message DROP NOT NULL;

ALTER TABLE ecommerce.chat_messages
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS media_duration INTEGER;
