import Replicate from "replicate";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "REPLICATE_KEY not configured" });
  }

  const { prompt, aspectRatio = "3:4" } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const replicate = new Replicate({ auth: apiKey });
    const output = await replicate.run("black-forest-labs/flux-1.1-pro", {
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "webp",
        output_quality: 90,
        safety_tolerance: 5,
        prompt_upsampling: true,
      },
    });

    const imageUrl = typeof output === "string" ? output : output?.url?.() || String(output);
    res.json({ imageUrl });
  } catch (err) {
    console.error("Replicate error:", err);
    res.status(500).json({ error: "Failed to generate image" });
  }
}
