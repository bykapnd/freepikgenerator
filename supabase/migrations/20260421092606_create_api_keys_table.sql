/*
  # Create API Keys Management Table

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key)
      - `name` (text) - friendly label for the key
      - `key` (text) - the actual Freepik API key (encrypted at rest)
      - `is_active` (boolean) - whether this key is available for use
      - `usage_count` (integer) - how many times this key has been used
      - `last_used_at` (timestamptz) - when the key was last used
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `api_keys` table
    - Only service role can access keys (edge functions use service role)
    - Admin read policy via a separate admin_sessions approach

  3. Notes
    - Keys are rotated round-robin based on usage_count (least used first)
    - is_active flag allows disabling keys without deleting them
*/

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only service role (used by edge functions) can access api_keys
-- No anon/authenticated access - all operations go through edge functions
CREATE POLICY "Service role full access to api_keys"
  ON api_keys
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert api_keys"
  ON api_keys
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update api_keys"
  ON api_keys
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete api_keys"
  ON api_keys
  FOR DELETE
  TO service_role
  USING (true);

-- Index for efficient key rotation queries
CREATE INDEX IF NOT EXISTS idx_api_keys_active_usage ON api_keys(is_active, usage_count) WHERE is_active = true;
