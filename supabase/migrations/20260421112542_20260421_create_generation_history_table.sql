/*
  # Create generation history table

  1. New Tables
    - `generation_history`
      - `id` (uuid, primary key)
      - `type` (text: 'image' or 'video')
      - `prompt` (text)
      - `status` (text: 'pending', 'processing', 'completed', 'failed')
      - `model` (text)
      - `parameters` (jsonb: aspect_ratio, resolution, format, etc)
      - `result_url` (text, nullable)
      - `error_message` (text, nullable)
      - `cost` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `generation_history` table
    - Add policy for authenticated users to view their own generations (public for now)
*/

CREATE TABLE IF NOT EXISTS generation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('image', 'video')),
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model text,
  parameters jsonb,
  result_url text,
  error_message text,
  cost numeric(10, 2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view generation history"
  ON generation_history
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create generation history"
  ON generation_history
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update generation history"
  ON generation_history
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
