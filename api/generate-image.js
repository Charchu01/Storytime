import Replicate from "replicate";

export const config = { maxDuration: 30 };

// Resolve a model to its latest version hash, then create a prediction.
// The /models/{owner}/{name}/predictions shortcut only works for official models.
// Community models (like zsxkib/flux-pulid) require a version hash.
async function createPrediction(replicate, modelRef, input) {
  const [owner, name] = modelRef.split("/");
  const model = await replicate.models.get(owner, name);
  const version = model.latest_version?.id;

  if (!version) {
    throw new Error(`No version found for model ${modelRef}`);
  }

  return replicate.predictions.create({ version, input });
}

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
    let modelRef;
    let input;

    if (loraUrl && triggerWord) {
      // Premium LoRA path — trained model for perfect face consistency
      modelRef = "black-forest-labs/flux-dev-lora";
      input = {
        prompt: `${triggerWord} child, ${prompt}`,
        hf_loras: [loraUrl],
        lora_scales: [0.85],
        num_inference_steps: 28,
        guidance_scale: 3.5,
        aspect_ratio: "21:9",
        output_format: "webp",
        output_quality: 90,
      };
    } else if (referencePhotoUrl) {
      modelRef = "zsxkib/flux-pulid";
      input = {
        prompt,
        width: 1344,
        height: 576,
        num_steps: 20,
        start_step: 4,
        guidance_scale: 4,
        output_format: "webp",
        output_quality: 90,
        main_face_image: referencePhotoUrl,
      };
    } else {
      modelRef = "black-forest-labs/flux-1.1-pro-ultra";
      input = {
        prompt,
        aspect_ratio: "21:9",
        output_format: "webp",
        output_quality: 90,
        safety_tolerance: 5,
        prompt_upsampling: true,
      };
    }

    let prediction;
    try {
      prediction = await createPrediction(replicate, modelRef, input);
    } catch (err) {
      // If flux-pulid fails (404/removed), fall back to flux-1.1-pro-ultra without face ref
      if (referencePhotoUrl && !loraUrl) {
        console.warn(`${modelRef} failed (${err.message}), falling back to flux-1.1-pro-ultra`);
        modelRef = "black-forest-labs/flux-1.1-pro-ultra";
        prediction = await createPrediction(replicate, modelRef, {
          prompt,
          aspect_ratio: "21:9",
          output_format: "webp",
          output_quality: 90,
          safety_tolerance: 5,
          prompt_upsampling: true,
        });
      } else {
        throw err;
      }
    }

    if (!prediction?.id) {
      console.error("No prediction ID returned:", JSON.stringify(prediction).slice(0, 300));
      return res.status(500).json({ error: "Failed to start image generation" });
    }

    res.json({
      predictionId: prediction.id,
      status: prediction.status,
      model: modelRef,
    });
  } catch (err) {
    console.error("generate-image error:", err);
    res.status(500).json({
      error: `Failed to start image generation: ${err.message || "Unknown"}`,
    });
  }
}
