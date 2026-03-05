import Replicate from "replicate";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.REPLICATE_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "REPLICATE_KEY not configured" });
    }

    const { prompt, referencePhotoUrl, loraUrl, triggerWord } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const replicate = new Replicate({ auth: apiKey });
    let model;
    let input;

    if (loraUrl && triggerWord) {
      // Premium LoRA path — trained model for perfect face consistency
      model = "black-forest-labs/flux-dev-lora";
      input = {
        prompt: `${triggerWord} child, ${prompt}`,
        hf_loras: [loraUrl],
        lora_scales: [0.85],
        num_inference_steps: 28,
        guidance_scale: 3.5,
        aspect_ratio: "4:3",
        output_format: "webp",
        output_quality: 90,
      };
    } else if (referencePhotoUrl) {
      model = "zsxkib/flux-pulid";
      input = {
        prompt,
        width: 768,
        height: 576,
        num_steps: 20,
        start_step: 4,
        guidance_scale: 4,
        output_format: "webp",
        output_quality: 90,
        main_face_image: referencePhotoUrl,
      };
    } else {
      model = "black-forest-labs/flux-1.1-pro-ultra";
      input = {
        prompt,
        aspect_ratio: "4:3",
        output_format: "webp",
        output_quality: 90,
        safety_tolerance: 5,
        prompt_upsampling: true,
      };
    }

    // Create prediction WITHOUT waiting — returns immediately
    const prediction = await replicate.predictions.create({
      model,
      input,
    });

    if (!prediction?.id) {
      console.error("No prediction ID returned:", JSON.stringify(prediction).slice(0, 300));
      return res.status(500).json({ error: "Failed to start image generation" });
    }

    res.json({
      predictionId: prediction.id,
      status: prediction.status,
      model,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    res.status(500).json({
      error: `Failed to start image generation: ${err.message || "Unknown"}`,
    });
  }
}
