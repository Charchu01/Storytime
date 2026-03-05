import Replicate from "replicate";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const startTime = Date.now();
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
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
      imageInputs.push(...referenceImageUrls);
    }

    // ── PRIMARY: Nano Banana Pro (with images) ────────────────
    if (imageInputs.length > 0) {
      try {
        modelUsed = "google/nano-banana-pro";
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: prompt,
            image_input: imageInputs,
            aspect_ratio: aspectRatio || "3:4",
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
          aspect_ratio: aspectRatio || "3:4",
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
            aspect_ratio: "3:4",
            output_format: "jpg",
            safety_tolerance: 5,
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
            aspect_ratio: "3:4",
            output_format: "webp",
            output_quality: 90,
            safety_tolerance: 5,
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

    console.log("IMG_GEN:", JSON.stringify({
      ts: Date.now(),
      model: modelUsed,
      imageCount: imageInputs.length,
      tier: tier || "standard",
      predictionId: prediction.id,
      durationMs: Date.now() - startTime,
    }));

    res.json({
      predictionId: prediction.id,
      status: prediction.status,
      model: modelUsed,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    res.status(500).json({ error: `Image generation failed: ${err.message}` });
  }
}
