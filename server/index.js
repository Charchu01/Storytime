import express from "express";
import cors from "cors";
import Replicate from "replicate";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const REPLICATE_KEY = process.env.REPLICATE_KEY;

if (!ANTHROPIC_KEY) console.warn("⚠️  ANTHROPIC_KEY not set");
if (!REPLICATE_KEY) console.warn("⚠️  REPLICATE_KEY not set");

const replicate = new Replicate({ auth: REPLICATE_KEY });

// ── Anthropic proxy ──────────────────────────────────────────────────────────

app.post("/api/claude", async (req, res) => {
  const { system, userMsg, maxTokens = 1400 } = req.body;

  if (!system || !userMsg) {
    return res.status(400).json({ error: "system and userMsg are required" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Anthropic API error",
      });
    }

    const text = data.content.map((block) => block.text || "").join("").trim();
    res.json({ text });
  } catch (err) {
    console.error("Claude API error:", err);
    res.status(500).json({ error: "Failed to call Claude API" });
  }
});

// ── Image generation via Replicate (Flux) ────────────────────────────────────

app.post("/api/generate-image", async (req, res) => {
  const { prompt, aspectRatio = "3:4" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
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

    // Flux returns a URL string or a FileOutput object
    const imageUrl = typeof output === "string" ? output : output?.url?.() || String(output);
    res.json({ imageUrl });
  } catch (err) {
    console.error("Replicate error:", err);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", hasAnthropic: !!ANTHROPIC_KEY, hasReplicate: !!REPLICATE_KEY });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✨ StoriKids server running on port ${PORT}`));
