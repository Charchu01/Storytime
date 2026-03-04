import Replicate from "replicate";

// Retry helper: waits and retries on 429 rate-limit errors
async function runWithRetry(replicate, model, input, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await replicate.run(model, { input });
    } catch (err) {
      const is429 = err.response?.status === 429 ||
        err.status === 429 ||
        (err.message && err.message.includes("429"));
      if (is429 && attempt < maxRetries) {
        // Wait 12s (rate limit resets in ~10s per Replicate docs)
        const waitMs = 12000;
        console.log(`Rate limited (attempt ${attempt + 1}), waiting ${waitMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

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

  // Step 1: Try Kontext identity-preserving model if requested
  if (referencePhotoUrl && model === "kontext") {
    try {
      output = await runWithRetry(replicate, "black-forest-labs/flux-kontext-pro", {
        prompt,
        input_image: referencePhotoUrl,
        aspect_ratio: aspectRatio,
        safety_tolerance: 5,
      });
      usedModel = "kontext";
    } catch (err) {
      identityError = err.message || "Kontext failed";
      console.error("Kontext Pro failed, falling back:", identityError);
      output = null;
    }
  }

  // Step 2: Fallback to text-only Flux 1.1 Pro
  if (!output) {
    try {
      output = await runWithRetry(replicate, "black-forest-labs/flux-1.1-pro", {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "webp",
        output_quality: 90,
        safety_tolerance: 5,
        prompt_upsampling: true,
      });
      usedModel = "flux-1.1-pro";
    } catch (err) {
      const fluxError = err.message || "Unknown error";
      console.error("Flux 1.1 Pro failed:", fluxError);
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
