#!/usr/bin/env node
/**
 * One-time script: Generate style preview images via Replicate API.
 * Usage: REPLICATE_KEY=r8_... node generate-style-previews.mjs
 * Delete this file after images are saved.
 */

import fs from "fs";
import path from "path";
import https from "https";

const API_KEY = process.env.REPLICATE_KEY || process.env.REPLICATE_API_TOKEN;
if (!API_KEY) {
  console.error("Set REPLICATE_KEY (or REPLICATE_API_TOKEN) environment variable");
  console.error("Usage: REPLICATE_KEY=r8_xxx node generate-style-previews.mjs");
  process.exit(1);
}

const BASE_PROMPT =
  "Children's picture book cover illustration of a young girl with curly red hair and a bright yellow raincoat, standing at the edge of an enchanted forest at golden hour. She looks up in wonder at enormous glowing mushrooms and floating fireflies. Warm magical lighting streams through ancient twisted trees. Beautiful, award-winning picture book quality. Full illustration edge to edge, no borders, no text.";

const STYLES = [
  { id: "storybook", suffix: "Style: classic children's storybook illustration with bold saturated colours, clean outlines, and warm painterly backgrounds" },
  { id: "watercolor", suffix: "Style: soft watercolour children's book illustration with visible brushstrokes, dreamy washes, and gentle colour bleeds" },
  { id: "pixar", suffix: "Style: Pixar-style 3D animated children's illustration with soft rounded characters, cinematic lighting, vibrant colours, subsurface skin scattering, and movie-quality rendering" },
  { id: "bold", suffix: "Style: modern vibrant children's book illustration with thick bold outlines, flat graphic colours, and playful energy" },
  { id: "cozy", suffix: "Style: gentle pastel children's bedtime book illustration with rounded shapes, soft muted tones, plush toy aesthetic, and cozy warmth" },
  { id: "sketch", suffix: "Style: whimsical hand-drawn children's book illustration with visible pencil lines, loose ink outlines, and watercolour wash fills" },
  { id: "anime", suffix: "Style: Studio Ghibli inspired anime children's book illustration with large expressive eyes, soft hand-painted backgrounds, lush natural environments, gentle magical atmosphere" },
  { id: "retro", suffix: "Style: retro vintage children's book illustration in the style of 1950s-1960s picture books, slightly muted colour palette, visible print texture, mid-century modern design" },
  { id: "collage", suffix: "Style: paper collage children's book illustration with torn paper textures, fabric patterns, layered cut-out shapes, mixed media feel, like Eric Carle" },
];

const OUT_DIR = path.join(process.cwd(), "public", "styles");
fs.mkdirSync(OUT_DIR, { recursive: true });

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "api.replicate.com",
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error(`Non-JSON response: ${text.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const handler = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, handler).on("error", reject);
        return;
      }
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on("finish", () => { ws.close(); resolve(); });
    };
    https.get(url, handler).on("error", reject);
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createPrediction(prompt) {
  return apiRequest("POST", "/v1/predictions", {
    model: "google/nano-banana-pro",
    input: {
      prompt,
      aspect_ratio: "4:3",
      output_format: "jpg",
    },
  });
}

async function pollPrediction(id) {
  while (true) {
    const pred = await apiRequest("GET", `/v1/predictions/${id}`);
    if (pred.status === "succeeded") return pred;
    if (pred.status === "failed" || pred.status === "canceled") {
      throw new Error(`Prediction ${id} ${pred.status}: ${pred.error || "unknown"}`);
    }
    await sleep(2000);
  }
}

async function generateOne(style) {
  const dest = path.join(OUT_DIR, `${style.id}.jpg`);
  if (fs.existsSync(dest)) {
    console.log(`  ✓ ${style.id}.jpg already exists, skipping`);
    return;
  }

  const prompt = `${BASE_PROMPT}\n\n${style.suffix}`;
  console.log(`  ⏳ Creating prediction for ${style.id}...`);
  const pred = await createPrediction(prompt);
  if (pred.error) throw new Error(`Create failed for ${style.id}: ${JSON.stringify(pred.error)}`);

  console.log(`  ⏳ Polling ${style.id} (${pred.id})...`);
  const result = await pollPrediction(pred.id);

  const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!imageUrl) throw new Error(`No output URL for ${style.id}`);

  console.log(`  ⬇ Downloading ${style.id}...`);
  await downloadFile(imageUrl, dest);
  console.log(`  ✅ Saved ${style.id}.jpg`);
}

// Run up to 3 at a time to avoid rate limits
async function main() {
  console.log("Generating style preview images...\n");

  const CONCURRENCY = 3;
  for (let i = 0; i < STYLES.length; i += CONCURRENCY) {
    const batch = STYLES.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((s) => generateOne(s)));
  }

  console.log("\n✅ All done! Images saved to public/styles/");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
