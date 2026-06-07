-- Run in Supabase Dashboard → SQL Editor (project: E-Commerce app)
-- Bucket: product-images (public)

-- Public read for product images
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Backend uses service_role key and bypasses RLS for uploads.
-- Optional: allow authenticated users to upload into their folder
CREATE POLICY "Authenticated upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');
