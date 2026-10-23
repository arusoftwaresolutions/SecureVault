-- Add payload column to messages table for inline encrypted data storage
-- This serves as a fallback when Supabase Storage is unavailable or files exceed limits

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  payload TEXT, -- Base64-encoded encrypted data (fallback when storage unavailable)
  storage_path TEXT, -- Reference to Supabase Storage path (primary method)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for quick lookup by email
CREATE INDEX IF NOT EXISTS idx_messages_email ON messages(email);

-- Index for expiry-based cleanup
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at);

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public endpoint)
CREATE POLICY "Allow public inserts" ON messages
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anyone to select (public retrieval)
CREATE POLICY "Allow public selects" ON messages
  FOR SELECT TO anon
  USING (expires_at > NOW());

-- Auto-delete expired rows via scheduled job (optional, handled client-side too)
CREATE OR REPLACE FUNCTION delete_expired_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
