import Replicate from "replicate";
import { logApiCall, updateDailyApiStats } from './lib/admin-logger.js';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const startTime = Date.now();
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rl = rateLimit(req, { key: 'generate-image', limit: 10, windowMs: 60000 });
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
        console.warn("Nano Banana Pro failed:", err.message);
        prediction = null;
      }
    }

    // ── FALLBACK 1: Nano Banana Pro without images ──────────
    if (!prediction) {
      try {
        modelUsed = "google/nano-banana-pro";
        const input = {
          prompt: prompt,
          aspect_ratio: aspectRatio || "2:3",
          output_format: "jpg",
          allow_fallback_model: true,
        };
        if (imageInputs.length > 0) {
          input.image_input = imageInputs;
        }
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input,
        });
      } catch (err) {
        console.warn("Nano Banana Pro (no images) failed:", err.message);
        prediction = null;
      }
    }

    // ── FALLBACK 2: Kontext Pro (face-preserving) ───────────
    if (!prediction && referencePhotoUrl) {
      try {
        modelUsed = "black-forest-labs/flux-kontext-pro";
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: `Turn this person into a children's storybook illustration. ${prompt}. Keep their exact face from the photo. No text or words.`,
            input_image: referencePhotoUrl,
            aspect_ratio: aspectRatio || "2:3",
            output_format: "jpg",
          },
        });
      } catch (err) {
        console.warn("Kontext Pro fallback failed:", err.message);
        prediction = null;
      }
    }

    // ── FALLBACK 3: Flux Pro Ultra (no face) ────────────────
    if (!prediction) {
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
      } catch (err) {
        console.error("All models failed:", err.message);
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

    // Admin logging
    logApiCall({
      service: 'replicate',
      type: isCover ? 'cover' : 'spread',
      status: 200,
      durationMs,
      model: modelUsed,
      cost: 0.045,
      details: `${modelUsed} | ${imageInputs.length} refs`,
    }).catch(() => {});
    updateDailyApiStats('replicate', durationMs, 0.045, false).catch(() => {});

    res.json({
      predictionId: prediction.id,
      status: prediction.status,
      model: modelUsed,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    logApiCall({
      service: 'replicate',
      type: 'image_gen',
      status: 500,
      durationMs: Date.now() - startTime,
      error: err.message,
    }).catch(() => {});
    updateDailyApiStats('replicate', Date.now() - startTime, 0, true).catch(() => {});
    res.status(500).json({ error: `Image generation failed: ${err.message}` });
  }
}
