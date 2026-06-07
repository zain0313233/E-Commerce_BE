-- Run on Neon (schema ecommerce)
CREATE TABLE IF NOT EXISTS ecommerce.chat_messages (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(120) NOT NULL,
  sender_id INTEGER NOT NULL REFERENCES ecommerce.users(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'seller')),
  message TEXT NOT NULL,
  product_id INTEGER REFERENCES ecommerce.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
  ON ecommerce.chat_messages (room_id, created_at);
