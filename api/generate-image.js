import Replicate from "replicate";

// Retry helper: waits and retries on 429 rate-limit errors
async function runWithRetry(replicate, model, input, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await replicate.run(model, { input });
    } catch (err) {
      const is429 =
        err.response?.status === 429 ||
        err.status === 429 ||
        (err.message && err.message.includes("429"));
      if (is429 && attempt < maxRetries) {
        const waitMs = 12000;
        console.log(
          `Rate limited (attempt ${attempt + 1}), waiting ${waitMs / 1000}s...`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

// Normalize Replicate output to a URL string.
// The SDK can return: a string, a FileOutput object, an array of those, or a ReadableStream.
function extractUrl(output) {
  // If it's an array, grab the first element
  if (Array.isArray(output)) {
    output = output[0];
  }
  // Already a plain URL string
  if (typeof output === "string") {
    return output;
  }
  // FileOutput or similar object — try common patterns
  if (output) {
    // FileOutput.toString() returns the URL in replicate SDK v1.x
    const str = String(output);
    if (str.startsWith("http")) return str;
    // Some objects have a .url property
    if (typeof output.url === "string" && output.url.startsWith("http")) {
      return output.url;
    }
    // .url() as a method
    if (typeof output.url === "function") {
      const result = output.url();
      if (typeof result === "string" && result.startsWith("http")) return result;
    }
  }
  return null;
}

export default async function handler(req, res) {
  // Top-level try/catch so we ALWAYS return JSON, never an HTML error page
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.REPLICATE_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "REPLICATE_KEY not configured" });
    }

    const { prompt, aspectRatio = "16:9", referencePhotoUrl, model } =
      req.body || {};
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
        output = await runWithRetry(
          replicate,
          "black-forest-labs/flux-kontext-pro",
          {
            prompt,
            input_image: referencePhotoUrl,
            aspect_ratio: aspectRatio,
            safety_tolerance: 5,
          }
        );
        usedModel = "kontext";
      } catch (err) {
        identityError = err.message || "Kontext failed";
        console.error("Kontext Pro failed, falling back:", identityError);
        output = null;
      }
    }

    // Step 2: Fallback to text-only Flux 1.1 Pro
    if (!output || !extractUrl(output)) {
      try {
        output = await runWithRetry(
          replicate,
          "black-forest-labs/flux-1.1-pro",
          {
            prompt,
            aspect_ratio: aspectRatio,
            output_format: "webp",
            output_quality: 90,
            safety_tolerance: 5,
            prompt_upsampling: true,
          }
        );
        usedModel = "flux-1.1-pro";
      } catch (err) {
        const fluxError = err.message || "Unknown error";
        console.error("Flux 1.1 Pro failed:", fluxError);
        const detail = identityError
          ? `Identity model: ${identityError}. Fallback: ${fluxError}`
          : fluxError;
        return res
          .status(500)
          .json({ error: `Image generation failed: ${detail}` });
      }
    }

    // Step 3: Normalize output to a URL string
    const imageUrl = extractUrl(output);

    if (!imageUrl) {
      console.error(
        "Bad output from model:",
        usedModel,
        typeof output,
        JSON.stringify(output).slice(0, 200)
      );
      return res.status(500).json({
        error: `Bad output from ${usedModel}: could not extract image URL`,
      });
    }

    res.json({ imageUrl, model: usedModel });
  } catch (err) {
    // Catch-all: never let Vercel return an HTML error page
    console.error("Unhandled error in generate-image:", err);
    res.status(500).json({
      error: `Unexpected server error: ${err.message || "Unknown"}`,
    });
  }
}
