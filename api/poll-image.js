import Replicate from "replicate";

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.REPLICATE_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "REPLICATE_KEY not configured" });
    }

    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: "id query parameter is required" });
    }
    if (!/^[a-z0-9]{10,40}$/.test(id)) {
      return res.status(400).json({ error: "Invalid prediction ID format" });
    }

    const replicate = new Replicate({ auth: apiKey });
    const prediction = await replicate.predictions.get(id);

    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    // Extract image URL from output
    let imageUrl = null;
    if (prediction.status === "succeeded" && prediction.output) {
      const output = prediction.output;
      if (typeof output === "string") {
        imageUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        imageUrl = typeof output[0] === "string" ? output[0] : String(output[0]);
      } else if (output?.url) {
        imageUrl = typeof output.url === "function" ? output.url() : output.url;
      }
      if (!imageUrl) {
        console.warn("Could not extract imageUrl from output:", JSON.stringify(output).slice(0, 500));
      }
    } else if (prediction.status === "failed") {
      console.error("Prediction failed:", prediction.error);
    }

    // Validate the image URL is actually an image before returning
    if (prediction.status === "succeeded" && imageUrl) {
      try {
        const check = await fetch(imageUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        const contentType = check.headers.get("content-type") || "";
        if (!check.ok || !contentType.startsWith("image/")) {
          return res.json({
            status: "failed",
            imageUrl: null,
            error: "Generated image was invalid (not an image file)",
          });
        }
      } catch (err) {
        // HEAD check failed — still return the URL, client will validate
        console.warn("Image URL validation failed:", err.message);
      }
    }

    res.json({
      status: prediction.status, // "starting" | "processing" | "succeeded" | "failed" | "canceled"
      imageUrl,
      error: prediction.error || null,
    });
  } catch (err) {
    console.error("poll-image error:", err);
    res.status(500).json({
      error: 'Failed to check image status. Please try again.',
    });
  }
}
