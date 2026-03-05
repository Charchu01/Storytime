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
        imageUrl = output.url;
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
      error: `Failed to check prediction: ${err.message || "Unknown"}`,
    });
  }
}
