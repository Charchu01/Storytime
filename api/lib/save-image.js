import { supabaseAdmin } from './supabase-admin.js';
import sharp from 'sharp';

const TARGET_DIMENSIONS = {
  cover: { width: 1024, height: 1536, ratio: 2/3 },
  backCover: { width: 1024, height: 1536, ratio: 2/3 },
  spread: { width: 1536, height: 1152, ratio: 4/3 },
};

function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    // Block internal/metadata IPs and hostnames
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false;
    if (hostname.startsWith('169.254.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
    if (hostname === '[::1]') return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

export async function saveImageToStorage(imageUrl, bookId, filename) {
  if (!supabaseAdmin) return null;
  if (!isAllowedImageUrl(imageUrl)) {
    console.warn('SSRF_BLOCKED: Rejected URL:', imageUrl?.substring(0, 80));
    return null;
  }
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    let buffer = Buffer.from(await response.arrayBuffer());

    // Determine target dimensions from filename
    const pageType = filename.startsWith('cover') ? 'cover'
      : filename.startsWith('back') ? 'backCover'
      : 'spread';
    const target = TARGET_DIMENSIONS[pageType];

    // Validate and resize if needed
    try {
      const metadata = await sharp(buffer).metadata();
      const actualRatio = metadata.width / metadata.height;
      const expectedRatio = target.ratio;
      const ratioDiff = Math.abs(actualRatio - expectedRatio) / expectedRatio;

      if (ratioDiff > 0.05 || metadata.width !== target.width || metadata.height !== target.height) {
        buffer = await sharp(buffer)
          .resize(target.width, target.height, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toBuffer();
        console.log(`IMG_RESIZE: ${filename} ${metadata.width}x${metadata.height} → ${target.width}x${target.height} (ratio diff: ${(ratioDiff * 100).toFixed(1)}%)`);
      } else {
        // Dimensions correct, just ensure JPEG format and quality
        buffer = await sharp(buffer)
          .jpeg({ quality: 90 })
          .toBuffer();
      }
    } catch (sharpErr) {
      console.warn('Sharp processing failed, saving original:', sharpErr.message);
      // Fall through and save the original buffer
    }

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
