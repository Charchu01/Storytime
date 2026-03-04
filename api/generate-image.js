import Replicate from "replicate";

// Convert a base64 data URI to a Buffer the Replicate SDK will auto-upload
function dataUriToBuffer(dataUri) {
  const base64Data = dataUri.split(",")[1];
  if (!base64Data) return null;
  return Buffer.from(base64Data, "base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "REPLICATE_KEY not configured" });
  }

  const { prompt, aspectRatio = "16:9", referencePhoto, model } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    // Force upload strategy so Buffers get uploaded to Replicate hosting first
    const replicate = new Replicate({
      auth: apiKey,
      fileEncodingStrategy: "upload",
    });

    // Convert data URI to Buffer so the SDK uploads it and gets a proper HTTP URL
    const photoBuffer = referencePhoto ? dataUriToBuffer(referencePhoto) : null;

    let output;
    let usedModel = "none";

    // If we have a reference photo, try identity-preserving models first
    if (photoBuffer && model === "kontext") {
      usedModel = "kontext";
      try {
        output = await replicate.run("black-forest-labs/flux-kontext-pro", {
          input: {
            prompt,
            input_image: photoBuffer,
            aspect_ratio: aspectRatio,
            safety_tolerance: 5,
          },
        });
      } catch (err) {
        console.error("Kontext Pro failed, falling back to text-only:", err.message);
        output = null;
      }
    } else if (photoBuffer && model === "pulid") {
      usedModel = "pulid";
      const dims = aspectRatio === "16:9" ? { width: 1344, height: 768 }
        : aspectRatio === "3:4" ? { width: 768, height: 1024 }
        : { width: 1024, height: 1024 };

      try {
        output = await replicate.run("bytedance/flux-pulid", {
          input: {
            prompt,
            main_face_image: photoBuffer,
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
      } catch (err) {
        console.error("PuLID failed, falling back to text-only:", err.message);
        output = null;
      }
    }

    // Fallback to text-only Flux 1.1 Pro if no photo or identity model failed
    if (!output) {
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
    let imageUrl;
    if (typeof output === "string") {
      imageUrl = output;
    } else if (output && typeof output === "object") {
      if (typeof output.url === "function") {
        imageUrl = output.url();
      } else if (output.url) {
        imageUrl = output.url;
      } else if (output.output) {
        imageUrl = Array.isArray(output.output) ? output.output[0] : output.output;
      } else {
        imageUrl = String(output);
      }
    } else {
      imageUrl = String(output);
    }

    res.json({ imageUrl, model: usedModel });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({
      error: `Failed to generate image: ${err.message || "Unknown error"}`,
    });
  }
}
