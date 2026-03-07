import Replicate from "replicate";
import { supabaseAdmin } from './lib/supabase-admin.js';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rl = rateLimit(req, { key: 'upload-photo', limit: 5, windowMs: 60000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', Math.ceil((rl.resetAt - Date.now()) / 1000));
    return res.status(429).json({
      error: 'Too many requests. Please try again in a moment.',
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
  }

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "REPLICATE_KEY not configured" });
  }

  const { photoDataUri } = req.body || {};
  if (!photoDataUri) {
    return res.status(400).json({ error: "photoDataUri is required" });
  }

  try {
    // Parse the data URI
    const commaIdx = photoDataUri.indexOf(",");
    if (commaIdx === -1) {
      return res.status(400).json({ error: "Invalid data URI format" });
    }
    const base64Data = photoDataUri.slice(commaIdx + 1);
    const mimeMatch = photoDataUri.match(/^data:(image\/[a-zA-Z+]+);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const buffer = Buffer.from(base64Data, "base64");

    // Strategy: Save to Supabase storage (permanent URL) as primary,
    // fall back to Replicate files (temporary URL) if Supabase unavailable.
    // Replicate models can fetch any public URL, so Supabase URLs work fine.
    let permanentUrl = null;

    // 1. Try Supabase storage first — permanent, never expires
    if (supabaseAdmin) {
      try {
        const photoId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const ext = mime === 'image/png' ? 'png' : 'jpg';
        const path = `hero-photos/${photoId}.${ext}`;

        const { error: uploadErr } = await supabaseAdmin.storage
          .from('book-images')
          .upload(path, buffer, {
            contentType: mime,
            upsert: true,
          });

        if (!uploadErr) {
          const { data } = supabaseAdmin.storage
            .from('book-images')
            .getPublicUrl(path);
          permanentUrl = data.publicUrl;
          console.log('PHOTO_UPLOAD: Saved to Supabase storage (permanent URL)');
        } else {
          console.warn('Supabase photo upload failed:', uploadErr.message);
        }
      } catch (sbErr) {
        console.warn('Supabase photo upload error:', sbErr.message);
      }
    }

    // 2. If Supabase failed, fall back to Replicate files (temporary URL)
    if (!permanentUrl) {
      const blob = new Blob([buffer], { type: mime });
      const replicate = new Replicate({ auth: apiKey });
      const file = await replicate.files.create(blob);

      if (!file?.urls?.get) {
        console.error("Unexpected file response:", JSON.stringify(file));
        return res.status(500).json({ error: "Upload succeeded but no URL returned" });
      }

      permanentUrl = file.urls.get;
      console.log('PHOTO_UPLOAD: Saved to Replicate files (temporary URL — Supabase unavailable)');
    }

    res.json({ photoUrl: permanentUrl });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({
      error: `Failed to upload photo: ${err.message || "Unknown error"}`,
    });
  }
}
