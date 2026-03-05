// Generate images using zsxkib/flux-pulid on Replicate (async polling)

async function pollForResult(apiKey, predictionId, maxAttempts = 60) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Token ${apiKey}` } }
    );
    const result = await pollRes.json();
    if (result.status === "succeeded") {
      // output can be a URL string or array of URLs
      const out = Array.isArray(result.output) ? result.output[0] : result.output;
      if (typeof out === "string" && out.startsWith("http")) return out;
      throw new Error("Unexpected output format from model");
    }
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error("Image generation failed: " + (result.error || "unknown"));
    }
    attempts++;
  }
  throw new Error("Image generation timed out");
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

    const {
      prompt,
      aspectRatio = "16:9",
      referencePhotoUrl,
      width = 768,
      height = 576,
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    // Build input for flux-pulid
    const input = {
      prompt,
      id_weight: 0.8,
      num_steps: 20,
      guidance_scale: 4,
      width,
      height,
      output_format: "webp",
      output_quality: 90,
    };

    // Only pass id_image if we have a reference photo
    if (referencePhotoUrl) {
      input.id_image = referencePhotoUrl;
    }

    // Submit prediction with Prefer: wait (Replicate may return immediately for fast models)
    const submitRes = await fetch(
      "https://api.replicate.com/v1/models/zsxkib/flux-pulid/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({ input }),
      }
    );

    const prediction = await submitRes.json();

    // If Prefer: wait returned a completed result
    if (prediction.status === "succeeded" && prediction.output) {
      const out = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;
      if (typeof out === "string" && out.startsWith("http")) {
        return res.json({ imageUrl: out, model: "flux-pulid" });
      }
    }

    // If failed immediately
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return res.status(500).json({
        error: `Image generation failed: ${prediction.error || "unknown"}`,
      });
    }

    // Otherwise poll for result
    if (!prediction.id) {
      return res.status(500).json({
        error: "No prediction ID returned from Replicate",
      });
    }

    const imageUrl = await pollForResult(apiKey, prediction.id);
    res.json({ imageUrl, model: "flux-pulid" });
  } catch (err) {
    console.error("Unhandled error in generate-image:", err);
    res.status(500).json({
      error: `Unexpected server error: ${err.message || "Unknown"}`,
    });
  }
}
