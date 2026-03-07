import Replicate from "replicate";
import { logApiCall } from './lib/admin-logger.js';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const startTime = Date.now();
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rl = rateLimit(req, { key: 'generate-image', limit: 60, windowMs: 60000 });
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

    const {
      prompt,
      referencePhotoUrl,
      referenceImageUrls,
      tier,
      style,
      aspectRatio,
      isCover,
      bookId,
      clientAttempt,
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const replicate = new Replicate({ auth: apiKey });
    let prediction;
    let modelUsed;

    // ── BUILD IMAGE INPUTS ARRAY ────────────────────────────
    const imageInputs = [];
    if (referencePhotoUrl) imageInputs.push(referencePhotoUrl);
    if (referenceImageUrls && Array.isArray(referenceImageUrls)) {
      imageInputs.push(...referenceImageUrls.filter(Boolean));
    }

    console.log("NANO_BANANA_INPUT:", JSON.stringify({
      promptLength: prompt.length,
      promptStart: prompt.substring(0, 120),
      imageCount: imageInputs.length,
      hasRefPhoto: !!referencePhotoUrl,
      refImageCount: referenceImageUrls?.length || 0,
      imageInputUrls: imageInputs.map(u => u?.substring(0, 60)),
      aspectRatio: aspectRatio || "2:3",
    }));

    // ── PRIMARY: Nano Banana Pro (with images) ────────────────
    let primaryFailed = false;
    let fallbackReason = null;
    let faceRefLost = false;

    if (imageInputs.length > 0) {
      try {
        modelUsed = "google/nano-banana-pro";
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: prompt,
            image_input: imageInputs,
            aspect_ratio: aspectRatio || "2:3",
            output_format: "jpg",
            allow_fallback_model: true,
          },
        });
      } catch (err) {
        primaryFailed = true;
        faceRefLost = !!referencePhotoUrl;
        fallbackReason = `primary_with_images_failed: ${err.message}`;
        console.error("FACE_REF_LOST: Primary model with images FAILED — falling back to no-reference generation.", err.message);
        prediction = null;
      }
    }

    // ── FALLBACK 1: Nano Banana Pro without images ──────────
    if (!prediction) {
      if (primaryFailed && referencePhotoUrl) {
        console.error("FACE_REF_LOST: Generating WITHOUT hero photo reference. Character will NOT match uploaded photo.");
      }
      try {
        modelUsed = "google/nano-banana-pro";
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: prompt,
            aspect_ratio: aspectRatio || "2:3",
            output_format: "jpg",
            allow_fallback_model: true,
          },
        });
        if (!fallbackReason) fallbackReason = imageInputs.length > 0 ? null : 'no_reference_images';
      } catch (err) {
        console.warn("Nano Banana Pro (no images) failed:", err.message);
        fallbackReason = fallbackReason || `nano_banana_no_images_failed: ${err.message}`;
        prediction = null;
      }
    }

    // ── FALLBACK 2: Kontext Pro (face-preserving) ───────────
    if (!prediction && referencePhotoUrl) {
      try {
        modelUsed = "black-forest-labs/flux-kontext-pro";
        faceRefLost = false; // Kontext preserves face
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: `Turn this person into a children's storybook illustration. ${prompt}. Keep their exact face from the photo. No text or words.`,
            input_image: referencePhotoUrl,
            aspect_ratio: aspectRatio || "2:3",
            output_format: "jpg",
          },
        });
        fallbackReason = `kontext_fallback: primary models failed`;
      } catch (err) {
        console.warn("Kontext Pro fallback failed:", err.message);
        faceRefLost = true; // Back to lost
        fallbackReason = `kontext_also_failed: ${err.message}`;
        prediction = null;
      }
    }

    // ── FALLBACK 3: Flux Pro Ultra (no face) ────────────────
    if (!prediction) {
      faceRefLost = !!referencePhotoUrl; // Always lost at this point if there was a photo
      try {
        modelUsed = "black-forest-labs/flux-1.1-pro-ultra";
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: `Children's picture book illustration: ${prompt}. Rich detailed environment, warm lighting, magical atmosphere.`,
            aspect_ratio: aspectRatio || "2:3",
            output_format: "webp",
            output_quality: 90,
          },
        });
        fallbackReason = `flux_ultra_fallback: all primary models failed`;
      } catch (err) {
        console.error("All models failed:", err.message);
        const durationMs = Date.now() - startTime;
        try {
          await logApiCall({
            service: 'replicate',
            type: isCover ? 'cover' : 'spread',
            bookId: bookId || null,
            status: 500,
            durationMs,
            model: 'all_failed',
            error: err.message,
            details: { fallbackReason: 'all_4_models_failed', attempt: clientAttempt || 1 },
          });
        } catch (logErr) {
          console.error('GEN_LOG_FAILED:', bookId, logErr.message);
        }
        return res.status(500).json({
          error: "Image generation unavailable. Please try again.",
        });
      }
    }

    if (!prediction?.id) {
      return res.status(500).json({ error: "Failed to start image generation" });
    }

    const durationMs = Date.now() - startTime;
    console.log("IMG_GEN:", JSON.stringify({
      ts: Date.now(),
      model: modelUsed,
      imageCount: imageInputs.length,
      tier: tier || "standard",
      predictionId: prediction.id,
      durationMs,
    }));

    // Admin logging — MUST await before res.json() or Vercel kills pending writes
    try {
      await logApiCall({
        service: 'replicate',
        type: isCover ? 'cover' : 'spread',
        bookId: bookId || null,
        status: 200,
        durationMs,
        model: modelUsed,
        cost: 0.045,
        details: {
          summary: `${modelUsed} | ${imageInputs.length} refs`,
          attempt: clientAttempt || 1,
          fallbackReason: fallbackReason || null,
          faceRefLost,
        },
      });
    } catch (logErr) {
      console.error('GEN_LOG_FAILED:', bookId, logErr.message);
    }

    res.json({
      predictionId: prediction.id,
      status: prediction.status,
      model: modelUsed,
      faceRefLost,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    try {
      await logApiCall({
        service: 'replicate',
        type: 'image_gen',
        bookId: bookId || null,
        status: 500,
        durationMs: Date.now() - startTime,
        error: err.message,
      });
    } catch (logErr) {
      console.warn('logApiCall failed:', logErr.message);
    }
    res.status(500).json({ error: `Image generation failed: ${err.message}` });
  }
}
