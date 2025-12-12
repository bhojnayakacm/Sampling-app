import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper function to upload image to Supabase Storage
export async function uploadSampleImage(
  file: File,
  requestId: string
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${requestId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('sample-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Get public URL
  const { data } = supabase.storage
    .from('sample-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Helper function to delete image from Supabase Storage
export async function deleteSampleImage(imageUrl: string): Promise<void> {
  const fileName = imageUrl.split('/').pop();
  if (!fileName) return;

  const { error } = await supabase.storage
    .from('sample-images')
    .remove([fileName]);

  if (error) {
    console.error('Error deleting image:', error);
  }
}
