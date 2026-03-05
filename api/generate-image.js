import Replicate from "replicate";

// Vercel function config
export const config = { maxDuration: 60 };

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
        const waitMs = 8000 + attempt * 4000; // 8s, 12s
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
function extractUrl(output) {
  if (Array.isArray(output)) {
    output = output[0];
  }
  if (typeof output === "string") {
    return output;
  }
  if (output) {
    const str = String(output);
    if (str.startsWith("http")) return str;
    if (typeof output.url === "string" && output.url.startsWith("http")) {
      return output.url;
    }
    if (typeof output.url === "function") {
      const result = output.url();
      if (typeof result === "string" && result.startsWith("http")) return result;
    }
  }
  return null;
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

    const { prompt, referencePhotoUrl } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const replicate = new Replicate({ auth: apiKey });
    let output;
    let usedModel;

    if (referencePhotoUrl) {
      // Use flux-pulid for face-preserving generation
      usedModel = "flux-pulid";
      const input = {
        prompt,
        width: 768,
        height: 576,
        num_steps: 20,
        start_step: 4,
        guidance_scale: 4,
        output_format: "webp",
        output_quality: 90,
        main_face_image: referencePhotoUrl,
      };

      try {
        output = await runWithRetry(replicate, "zsxkib/flux-pulid", input);
      } catch (err) {
        const pulIdError = err.message || "flux-pulid failed";
        console.error("flux-pulid failed:", pulIdError);

        // Fallback to flux-1.1-pro-ultra (no face preservation)
        try {
          console.log("Falling back to flux-1.1-pro-ultra...");
          output = await runWithRetry(
            replicate,
            "black-forest-labs/flux-1.1-pro-ultra",
            {
              prompt,
              aspect_ratio: "4:3",
              output_format: "webp",
              output_quality: 90,
              safety_tolerance: 5,
              prompt_upsampling: true,
            }
          );
          usedModel = "flux-1.1-pro-ultra";
        } catch (fallbackErr) {
          const fallbackError = fallbackErr.message || "Fallback also failed";
          console.error("Fallback flux-1.1-pro-ultra failed:", fallbackError);
          return res.status(500).json({
            error: `Image generation failed: ${pulIdError}. Fallback: ${fallbackError}`,
          });
        }
      }
    } else {
      // No face reference — go straight to flux-1.1-pro-ultra (faster, no pulid overhead)
      usedModel = "flux-1.1-pro-ultra";
      try {
        output = await runWithRetry(
          replicate,
          "black-forest-labs/flux-1.1-pro-ultra",
          {
            prompt,
            aspect_ratio: "4:3",
            output_format: "webp",
            output_quality: 90,
            safety_tolerance: 5,
            prompt_upsampling: true,
          }
        );
      } catch (err) {
        console.error("flux-1.1-pro-ultra failed:", err.message);
        return res.status(500).json({
          error: `Image generation failed: ${err.message || "Unknown error"}`,
        });
      }
    }

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
    console.error("Unhandled error in generate-image:", err);
    res.status(500).json({
      error: `Unexpected server error: ${err.message || "Unknown"}`,
    });
  }
}
