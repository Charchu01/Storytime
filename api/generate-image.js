import Replicate from "replicate";

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
    const replicate = new Replicate({ auth: apiKey });
    let output;

    if (referencePhoto && model === "kontext") {
      // Identity-preserving generation using Flux Kontext Pro
      // Takes the user's actual photo and transforms it into the art style + scene
      output = await replicate.run("black-forest-labs/flux-kontext-pro", {
        input: {
          prompt,
          input_image: referencePhoto,
          aspect_ratio: aspectRatio,
          safety_tolerance: 5,
        },
      });
    } else if (referencePhoto && model === "pulid") {
      // PuLID for stronger stylization (anime, 3D, plush)
      // Better at extreme style changes while preserving identity
      const dims = aspectRatio === "16:9" ? { width: 1344, height: 768 }
        : aspectRatio === "3:4" ? { width: 768, height: 1024 }
        : { width: 1024, height: 1024 };

      output = await replicate.run("bytedance/flux-pulid", {
        input: {
          prompt,
          main_face_image: referencePhoto,
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

    res.json({ imageUrl });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({
      error: `Failed to generate image: ${err.message || "Unknown error"}`,
    });
  }
}
