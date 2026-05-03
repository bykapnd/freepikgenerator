/*
  # Create motion-control-inputs storage bucket

  Public bucket for storing character images and reference videos
  uploaded by users for motion control video generation.
  Files are publicly readable so Freepik API can fetch them by URL.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'motion-control-inputs',
  'motion-control-inputs',
  true,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/webp',
    'video/mp4','video/quicktime','video/webm','video/x-m4v'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can upload motion control inputs'
  ) THEN
    CREATE POLICY "Anyone can upload motion control inputs"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'motion-control-inputs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can read motion control inputs'
  ) THEN
    CREATE POLICY "Anyone can read motion control inputs"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'motion-control-inputs');
  END IF;
END $$;
