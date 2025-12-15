-- Make the sample-images bucket public so images can be viewed
UPDATE storage.buckets
SET public = true
WHERE id = 'sample-images';

-- Add a policy to allow public read access to images
CREATE POLICY "Public can view sample images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sample-images');
