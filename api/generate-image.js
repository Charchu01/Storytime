import Replicate from "replicate";

export const config = { maxDuration: 60 };

async function createPrediction(replicate, modelRef, input) {
  const [owner, name] = modelRef.split("/");

  if (owner === "black-forest-labs") {
    return replicate.predictions.create({ model: modelRef, input });
  }

  const model = await replicate.models.get(owner, name);
  const version = model.latest_version?.id;
  if (!version) {
    throw new Error(`No version found for model ${modelRef}`);
  }
  return replicate.predictions.create({ version, input });
}

function logCost(type, model, success, durationMs, error) {
  // Cost tracking is client-side via localStorage; server logs to console
  const entry = {
    ts: Date.now(), type, model, success, durationMs,
    cost: type === "lora_train" ? 1.50 : type === "pulid" ? 0.04 : type === "lora_gen" ? 0.01 : 0,
    error: error || null,
  };
  console.log("COST_LOG:", JSON.stringify(entry));
}

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

    const { prompt, referencePhotoUrl, loraUrl, triggerWord, useFaceRef, isMaleCharacter } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const replicate = new Replicate({ auth: apiKey });
    let modelRef;
    let input;
    let costType = "pulid";

    if (loraUrl && triggerWord) {
      // Premium LoRA path
      modelRef = "black-forest-labs/flux-dev-lora";
      costType = "lora_gen";
      input = {
        prompt: `${triggerWord} person, ${prompt}`,
        hf_loras: [loraUrl],
        lora_scales: [0.85],
        num_inference_steps: 28,
        guidance_scale: 3.5,
        aspect_ratio: "3:4",
        output_format: "webp",
        output_quality: 90,
      };
    } else if (useFaceRef && referencePhotoUrl) {
      // Face-reference path using PuLID
      // CRITICAL: id_start=0 for illustrated/stylized images (not default 4 which is for photorealistic)
      modelRef = "zsxkib/flux-pulid";
      costType = "pulid";
      input = {
        prompt,
        main_face_image: referencePhotoUrl,
        num_steps: 20,
        guidance_scale: 4,
        id_weight: 0.8,
        id_start: 0,        // CRITICAL: 0 for illustrated styles
        num_outputs: isMaleCharacter ? 2 : 1, // Generate 2 for males due to known PuLID fidelity issues
        output_format: "png",
        width: 768,
        height: 1024,
      };
    } else {
      // Primary path — flux-1.1-pro-ultra for highest quality illustrations
      modelRef = "black-forest-labs/flux-1.1-pro-ultra";
      costType = "pulid";
      input = {
        prompt,
        aspect_ratio: "3:4",
        output_format: "webp",
        output_quality: 90,
        safety_tolerance: 5,
        prompt_upsampling: true,
      };
    }

    let prediction;
    try {
      console.log(`Creating prediction with model: ${modelRef}`);
      prediction = await createPrediction(replicate, modelRef, input);
    } catch (err) {
      console.error(`Model ${modelRef} failed:`, err.message);
      if (modelRef === "zsxkib/flux-pulid") {
        console.warn(`flux-pulid failed (${err.message}), falling back to flux-1.1-pro-ultra`);
        modelRef = "black-forest-labs/flux-1.1-pro-ultra";
        prediction = await createPrediction(replicate, modelRef, {
          prompt,
          aspect_ratio: "3:4",
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
      logCost(costType, modelRef, false, Date.now() - startTime, "No prediction ID");
      return res.status(500).json({ error: "Failed to start image generation" });
    }

    logCost(costType, modelRef, true, Date.now() - startTime, null);

    res.json({
      predictionId: prediction.id,
      status: prediction.status,
      model: modelRef,
    });
  } catch (err) {
    logCost("pulid", "unknown", false, Date.now() - startTime, err.message);
    console.error("generate-image error:", err);
    res.status(500).json({
      error: `Failed to start image generation: ${err.message || "Unknown"}`,
    });
  }
}
