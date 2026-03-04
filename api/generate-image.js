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

  try {
    const replicate = new Replicate({ auth: apiKey });
    let output;
    let usedModel = "none";

    // referencePhotoUrl is a proper HTTP URL (uploaded via /api/upload-photo)
    if (referencePhotoUrl && model === "kontext") {
      usedModel = "kontext";
      output = await replicate.run("black-forest-labs/flux-kontext-pro", {
        input: {
          prompt,
          input_image: referencePhotoUrl,
          aspect_ratio: aspectRatio,
          safety_tolerance: 5,
        },
      });
    } else if (referencePhotoUrl && model === "pulid") {
      usedModel = "pulid";
      const dims = aspectRatio === "16:9" ? { width: 1344, height: 768 }
        : aspectRatio === "3:4" ? { width: 768, height: 1024 }
        : { width: 1024, height: 1024 };

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

      // PuLID returns an array
      if (Array.isArray(output)) {
        output = output[0];
      }
    } else {
      // Text-only generation using Flux 1.1 Pro (no reference photo)
      usedModel = "flux-1.1-pro";
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
    }

    // Normalize output to a URL string
    // Replicate SDK v1.4.0 returns FileOutput (extends ReadableStream) with toString() returning URL
    let imageUrl;
    if (typeof output === "string") {
      imageUrl = output;
    } else if (output != null) {
      // FileOutput.toString() returns the URL, String() calls toString()
      imageUrl = String(output);
      // Sanity check: if it doesn't look like a URL, something went wrong
      if (!imageUrl.startsWith("http")) {
        console.error("Unexpected output format:", imageUrl.slice(0, 100));
        return res.status(500).json({
          error: `Unexpected image output format from ${usedModel}`,
        });
      }
    } else {
      return res.status(500).json({ error: "Model returned empty output" });
    }

    res.json({ imageUrl, model: usedModel });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({
      error: `Failed to generate image (${err.message || "Unknown error"})`,
    });
  }
}
