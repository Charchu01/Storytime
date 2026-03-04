import Replicate from "replicate";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "REPLICATE_KEY not configured" });
  }

  const { prompt, aspectRatio = "16:9", referencePhotoUrl, model } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const replicate = new Replicate({ auth: apiKey });
  let output;
  let usedModel = "flux-1.1-pro";
  let identityError = null;

  // Step 1: Try identity-preserving model if requested
  if (referencePhotoUrl && model === "kontext") {
    try {
      output = await replicate.run("black-forest-labs/flux-kontext-pro", {
        input: {
          prompt,
          input_image: referencePhotoUrl,
          aspect_ratio: aspectRatio,
          safety_tolerance: 5,
        },
      });
      usedModel = "kontext";
    } catch (err) {
      identityError = err.message || "Kontext failed";
      console.error("Kontext Pro failed:", identityError);
      output = null;
    }
  } else if (referencePhotoUrl && model === "pulid") {
    const dims = aspectRatio === "16:9" ? { width: 1344, height: 768 }
      : aspectRatio === "3:4" ? { width: 768, height: 1024 }
      : { width: 1024, height: 1024 };
    try {
      output = await replicate.run("bytedance/flux-pulid", {
        input: {
          prompt,
          main_face_image: referencePhotoUrl,
          width: dims.width,
          height: dims.height,
          num_outputs: 1,
          start_step: 1,
          guidance_scale: 4,
          num_inference_steps: 20,
          true_cfg: true,
        },
      });
      if (Array.isArray(output)) output = output[0];
      usedModel = "pulid";
    } catch (err) {
      identityError = err.message || "PuLID failed";
      console.error("PuLID failed:", identityError);
      output = null;
    }
  }

  // Step 2: Fallback to text-only Flux 1.1 Pro if identity model failed or wasn't requested
  if (!output) {
    try {
      output = await replicate.run("black-forest-labs/flux-1.1-pro", {
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: "webp",
          output_quality: 90,
          safety_tolerance: 5,
          prompt_upsampling: true,
        },
      });
      usedModel = "flux-1.1-pro";
    } catch (err) {
      const fluxError = err.message || "Unknown error";
      console.error("Flux 1.1 Pro also failed:", fluxError);
      const detail = identityError
        ? `Identity model: ${identityError}. Fallback: ${fluxError}`
        : fluxError;
      return res.status(500).json({ error: `Image generation failed: ${detail}` });
    }
  }

  // Step 3: Normalize output to a URL string
  const imageUrl = typeof output === "string"
    ? output
    : (output?.url?.() || String(output));

  if (!imageUrl || !imageUrl.startsWith("http")) {
    return res.status(500).json({
      error: `Bad output from ${usedModel}: ${String(imageUrl).slice(0, 80)}`,
    });
  }

  res.json({ imageUrl, model: usedModel });
}
