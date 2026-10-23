-- Update messages table to store encrypted payloads across devices
-- This migration ensures the schema matches the cloud-based implementation
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL UNIQUE, -- Key derived from email (e.g., lowercase email)
  payload TEXT,                    -- AES-256 encrypted blob (optional if using storage_path)
  storage_path TEXT,               -- Path to encrypted blob in Supabase Storage
  expiry TEXT NOT NULL,            -- '1h', '24h', '7d', or 'burn'
  is_package BOOLEAN DEFAULT TRUE,
  timestamp BIGINT NOT NULL,        -- Unix timestamp of creation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (anyone can share a message)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous inserts' AND tablename = 'messages'
    ) THEN
        CREATE POLICY "Allow anonymous inserts" ON messages FOR INSERT TO anon WITH CHECK (true);
    END IF;
END
$$;

-- Allow anonymous selects by identifier (needed for retrieval)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous select by identifier' AND tablename = 'messages'
    ) THEN
        CREATE POLICY "Allow anonymous select by identifier" ON messages FOR SELECT TO anon USING (true);
    END IF;
END
$$;

-- Allow anonymous deletes (needed for 'burn' and cleanup)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous delete' AND tablename = 'messages'
    ) THEN
        CREATE POLICY "Allow anonymous delete" ON messages FOR DELETE TO anon USING (true);
    END IF;
END
$$;

-- Index the identifier for fast lookups
CREATE INDEX IF NOT EXISTS idx_messages_identifier ON messages(identifier);

-- Storage bucket setup (if not exists)
-- This requires the 'storage' schema to be present
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for the 'vault' bucket
-- These policies allow anonymous users to interact with the vault bucket objects

-- Allow anonymous upload
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous upload' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Allow anonymous upload" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'vault');
    END IF;
END
$$;

-- Allow anonymous download
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous download' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Allow anonymous download" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'vault');
    END IF;
END
$$;

-- Allow anonymous delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow anonymous delete' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Allow anonymous delete" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'vault');
    END IF;
END
$$;