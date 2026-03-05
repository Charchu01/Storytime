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
      tier,
      style,
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const replicate = new Replicate({ auth: apiKey });
    let prediction;
    let modelUsed;
    let faceRefUsed = false;

    // ── TIER-BASED MODEL SELECTION WITH FALLBACK CHAIN ──────────────────

    // Premium with face: Kontext Max (highest quality face fidelity)
    // The prompt is ALREADY optimized for Kontext by the client — pass through.
    if (tier === "premium" && referencePhotoUrl) {
      try {
        modelUsed = "black-forest-labs/flux-kontext-max";
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: prompt,
            input_image: referencePhotoUrl,
            aspect_ratio: "3:4",
            output_format: "jpg",
            safety_tolerance: 5,
          },
        });
        faceRefUsed = true;
      } catch (err) {
        console.warn("Kontext Max failed:", err.message);
        prediction = null;
      }
    }

    // Standard with face (or Premium fallback): Kontext Pro
    if (!prediction && referencePhotoUrl) {
      try {
        modelUsed = "black-forest-labs/flux-kontext-pro";
        prediction = await replicate.predictions.create({
          model: modelUsed,
          input: {
            prompt: prompt,
            input_image: referencePhotoUrl,
            aspect_ratio: "3:4",
            output_format: "jpg",
            safety_tolerance: 5,
          },
        });
        faceRefUsed = true;
      } catch (err) {
        console.warn("Kontext Pro failed:", err.message);
        prediction = null;
      }
    }

    // No face reference OR all face models failed: Flux Pro Ultra
    // This path gets the full descriptive prompt from the client — wrap minimally.
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
            prompt_upsampling: true,
          },
        });
      } catch (err) {
        console.error("All Flux models failed:", err.message);
        return res.status(500).json({
          error: "Image generation unavailable. Please try again.",
        });
      }
    }

    if (!prediction?.id) {
      return res.status(500).json({
        error: "Failed to start image generation",
      });
    }

    console.log("IMG_GEN:", JSON.stringify({
      ts: Date.now(),
      model: modelUsed,
      faceRefUsed,
      tier: tier || "standard",
      predictionId: prediction.id,
      durationMs: Date.now() - startTime,
    }));

    res.json({
      predictionId: prediction.id,
      status: prediction.status,
      model: modelUsed,
      faceRefUsed,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    res.status(500).json({
      error: `Image generation failed: ${err.message || "Unknown"}`,
    });
  }
}
