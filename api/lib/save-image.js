import { supabaseAdmin } from './supabase-admin.js';

export async function saveImageToStorage(imageUrl, bookId, filename) {
  if (!supabaseAdmin) return null;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const path = `${bookId}/${filename}`;

    const { error } = await supabaseAdmin.storage
      .from('book-images')
      .upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.warn('Storage upload failed:', error.message);
      return null;
    }

    const { data } = supabaseAdmin.storage
      .from('book-images')
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (err) {
    console.warn('Image save failed:', err.message);
    return null;
  }
}
