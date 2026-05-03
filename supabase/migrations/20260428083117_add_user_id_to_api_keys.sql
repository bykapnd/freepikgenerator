/*
  # Add user_id to api_keys for per-user API key management

  1. Modified Tables
    - `api_keys`
      - Add `user_id` (uuid, nullable, references auth.users)
      - Add index on user_id for efficient per-user queries

  2. Notes
    - Existing keys without user_id remain accessible to admins
    - Each user manages their own keys independently
    - user_id is nullable to support legacy shared/admin keys
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON api_keys(user_id, is_active, usage_count) WHERE is_active = true;
