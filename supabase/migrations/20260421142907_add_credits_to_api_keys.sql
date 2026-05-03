/*
  # Add credits column to api_keys table

  1. Changes
    - `api_keys` table
      - Add `credits` (numeric, default 0) — stores the credit balance for each API key

  2. Notes
    - credits represents the remaining Freepik credit balance for each key
    - Default is 0; admin manually sets the credit amount per key
    - Total credits across all active keys will be shown as a dashboard stat
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'credits'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN credits numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
