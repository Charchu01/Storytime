#!/usr/bin/env node
/**
 * Quality Gauntlet — Automated book generation + scoring.
 * Generates real storybooks and validates every page.
 * Keeps going until 5 consecutive books pass ALL quality checks.
 *
 * Usage:
 *   REPLICATE_KEY=xxx ANTHROPIC_KEY=xxx node scripts/quality-gauntlet.mjs
 *
 * Optional env vars:
 *   BASE_URL=http://localhost:3000  (default: uses API files directly)
 *   MAX_BOOKS=20                    (safety cap, default 20)
 *   TARGET_STREAK=5                 (consecutive passes needed, default 5)
 *   PHOTO_URL=https://...           (reference photo URL for face testing)
 *   SAVE_IMAGES=true                (save all images locally for manual review)
 */

import { writeFileSync, mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "test-output", "gauntlet");
const REPORT_FILE = join(OUTPUT_DIR, "gauntlet-report.json");
const LOG_FILE = join(OUTPUT_DIR, "gauntlet-log.txt");

// ── Config ──────────────────────────────────────────────────────────────────
const REPLICATE_KEY = process.env.REPLICATE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const MAX_BOOKS = parseInt(process.env.MAX_BOOKS) || 20;
const TARGET_STREAK = parseInt(process.env.TARGET_STREAK) || 5;
const PHOTO_URL = process.env.PHOTO_URL || null;
const SAVE_IMAGES = process.env.SAVE_IMAGES === "true";
const BASE_URL = process.env.BASE_URL || null;

if (!REPLICATE_KEY || !ANTHROPIC_KEY) {
  console.error("Required: REPLICATE_KEY and ANTHROPIC_KEY env vars");
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Test Book Configurations ────────────────────────────────────────────────
// Rotate through different configs to test variety
const BOOK_CONFIGS = [
  {
    bookType: "adventure",
    style: "storybook",
    nanoPromptStyle: "Classic children's storybook illustration with bold saturated colours, clean outlines, warm painterly backgrounds, visible brushwork, rich oil-paint textures, golden ambient lighting, like a Caldecott Medal winner",
    tone: "exciting",
    heroName: "Luna",
    heroAge: 5,
    heroType: "child",
  },
  {
    bookType: "bedtime",
    style: "watercolor",
    nanoPromptStyle: "Soft watercolour children's book illustration with visible brushstrokes, dreamy wet-on-wet washes, gentle colour bleeds at edges, white paper showing through in highlights, delicate and airy",
    tone: "cozy",
    heroName: "James",
    heroAge: 3,
    heroType: "child",
  },
  {
    bookType: "superhero",
    style: "pixar",
    nanoPromptStyle: "Pixar-quality 3D animated children's illustration with soft rounded characters, subsurface skin scattering, cinematic depth of field, vibrant saturated colours, warm rim lighting, like a still from a major animated film",
    tone: "exciting",
    heroName: "Mia",
    heroAge: 7,
    heroType: "child",
  },
  {
    bookType: "abc",
    style: "bold",
    nanoPromptStyle: "Modern vibrant children's book illustration with thick bold outlines, flat graphic colour fills, limited but punchy palette, strong geometric shapes, playful energy, contemporary award-winning picture book design",
    tone: "funny",
    heroName: "Oliver",
    heroAge: 4,
    heroType: "child",
  },
  {
    bookType: "love_letter",
    style: "cozy",
    nanoPromptStyle: "Gentle pastel children's bedtime book illustration with rounded soft shapes, muted warm tones, rosy cheeks, plush toy aesthetic, amber lamplight glow, everything looks soft and huggable",
    tone: "heartfelt",
    heroName: "Sophie",
    heroAge: 6,
    heroType: "child",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + "\n");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callClaude(system, userMsg, maxTokens = 2000) {
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
  if (!response.ok) throw new Error(`Claude error ${response.status}: ${data.error?.message}`);
  return {
    text: data.content.map(b => b.text || "").join("").trim(),
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

async function generateImage(prompt, imageInputs = [], aspectRatio = "2:3") {
  const { default: Replicate } = await import("replicate");
  const replicate = new Replicate({ auth: REPLICATE_KEY });

  const input = {
    prompt,
    aspect_ratio: aspectRatio,
    output_format: "jpg",
    allow_fallback_model: true,
  };
  if (imageInputs.length > 0) {
    input.image_input = imageInputs;
  }

  const prediction = await replicate.predictions.create({
    model: "google/nano-banana-pro",
    input,
  });

  // Poll for completion
  for (let i = 0; i < 48; i++) {
    await sleep(2500);
    const status = await replicate.predictions.get(prediction.id);
    if (status.status === "succeeded") {
      const output = status.output;
      if (typeof output === "string") return output;
      if (Array.isArray(output) && output[0]) return String(output[0]);
      if (output?.url) return typeof output.url === "function" ? output.url() : output.url;
      throw new Error("No output URL from succeeded prediction");
    }
    if (status.status === "failed" || status.status === "canceled") {
      throw new Error(`Prediction ${status.status}: ${status.error || "unknown"}`);
    }
  }
  throw new Error("Image generation timed out");
}

async function validateImage(imageUrl, expectedTexts, config, pageType, sceneDescription) {
  // Fetch image and convert to base64
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
  const imgBuffer = await imgResp.arrayBuffer();
  const imgBase64 = Buffer.from(imgBuffer).toString("base64");
  const imgContentType = imgResp.headers.get("content-type") || "image/jpeg";

  const content = [
    {
      type: "image",
      source: { type: "base64", media_type: imgContentType.split(";")[0], data: imgBase64 },
    },
  ];

  // Add reference photo if available
  if (PHOTO_URL) {
    try {
      const refResp = await fetch(PHOTO_URL);
      if (refResp.ok) {
        const refBuffer = await refResp.arrayBuffer();
        const refBase64 = Buffer.from(refBuffer).toString("base64");
        const refType = refResp.headers.get("content-type") || "image/jpeg";
        content.push({
          type: "text",
          text: "Above is the generated illustration. Below is the REFERENCE PHOTO:",
        });
        content.push({
          type: "image",
          source: { type: "base64", media_type: refType.split(";")[0], data: refBase64 },
        });
      }
    } catch (e) {
      log(`  Warning: couldn't fetch reference photo: ${e.message}`);
    }
  }

  const isCover = pageType === "cover";
  const isBackCover = pageType === "back_cover";
  const hasText = expectedTexts?.filter(t => t?.trim()).length > 0;

  let textSection;
  if (isCover && hasText) {
    textSection = `EXPECTED TITLE: ${expectedTexts.filter(t => t?.trim()).map(t => `"${t}"`).join(", ")}
This is a cover — title is hand-lettered. Check readability, not perfection.`;
  } else if (hasText) {
    textSection = `EXPECTED TEXT:\n${expectedTexts.filter(t => t?.trim()).map((t, i) => `Text box ${i + 1}: "${t}"`).join("\n")}
Check every word character by character.`;
  } else {
    textSection = "No text expected in this image.";
  }

  content.push({
    type: "text",
    text: `You are a STRICT quality inspector for a children's storybook.
PAGE TYPE: ${pageType}
ART STYLE: ${config.nanoPromptStyle}
SCENE: ${sceneDescription?.substring(0, 300) || "not provided"}

CHECK 1 — TEXT (textScore 1-10):
${textSection}
CHECK 2 — CHARACTER (faceScore 1-10):
Natural proportions, correct fingers (5 per hand), age-appropriate.
CHECK 3 — TEXT BOX (textBoxScore 1-10):
Consistent style, readable, well-positioned.
CHECK 4 — SCENE (sceneAccuracy 1-10):
Matches requested scene?
CHECK 5 — FORMAT (formatOk true/false):
Edge-to-edge, no borders/watermarks.
${PHOTO_URL ? "CHECK 6 — LIKENESS (likenessScore 1-10): Does character match reference photo?" : ""}

Return ONLY JSON:
{
  "textScore": N, "faceScore": N, "textBoxScore": N,
  "sceneAccuracy": N, "formatOk": true/false,
  ${PHOTO_URL ? '"likenessScore": N,' : ""}
  "issues": ["..."], "fingersOk": true/false
}`,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content }],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Validation API error: ${data.error?.message}`);

  const rawText = data.content.map(b => b.text || "").join("").trim();
  let cleaned = rawText.replace(/```json\s*|```\s*/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  const scores = JSON.parse(cleaned);

  // Compute pass/fail
  const textThreshold = isCover ? 4 : 6;
  scores.pass = (
    (scores.textScore || 0) >= textThreshold &&
    (scores.faceScore || 0) >= 6 &&
    (scores.textBoxScore || (isBackCover || isCover ? 10 : 0)) >= 6 &&
    (scores.sceneAccuracy || 0) >= 5 &&
    scores.formatOk !== false
  );

  // Quality tier
  const ts = scores.textScore || 0;
  const fs = scores.faceScore || 0;
  const tb = scores.textBoxScore || 7;
  const sa = scores.sceneAccuracy || 0;
  if (ts >= 9 && fs >= 8 && tb >= 7 && sa >= 7) scores.qualityTier = "excellent";
  else if (ts >= 7 && fs >= 7 && tb >= 6 && sa >= 6) scores.qualityTier = "good";
  else if (ts >= 5 && fs >= 5) scores.qualityTier = "acceptable";
  else scores.qualityTier = "poor";

  return scores;
}

async function saveImage(url, filename) {
  if (!SAVE_IMAGES) return;
  try {
    const resp = await fetch(url);
    const buffer = Buffer.from(await resp.arrayBuffer());
    writeFileSync(join(OUTPUT_DIR, filename), buffer);
  } catch (e) {
    log(`  Warning: couldn't save image: ${e.message}`);
  }
}

// ── Generate One Book ───────────────────────────────────────────────────────

async function generateOneBook(bookNum, config) {
  const bookResult = {
    bookNum,
    config: { bookType: config.bookType, style: config.style, heroName: config.heroName },
    startTime: Date.now(),
    storyPlan: null,
    pages: [],
    allPassed: false,
    totalCost: 0,
    errors: [],
  };

  try {
    // ── Step 1: Generate story plan ──────────────────────────
    log(`  Step 1: Generating story plan...`);

    const storySystem = `You are a children's storybook writer. Write a short story plan for a ${config.bookType} book. The hero is ${config.heroName}, age ${config.heroAge}. Art style: ${config.style}. Tone: ${config.tone}. Return JSON with: title, dedication, coverScene (visual description), spreads (array of 3 objects each with leftPageText, rightPageText, sceneDescription), backCoverScene. Each sceneDescription must be 2-3 sentences of VISUAL detail an illustrator could paint from. Each page text should be 1-2 sentences appropriate for a young child. Return ONLY valid JSON.`;

    const storyResult = await callClaude(storySystem, `Write a ${config.bookType} story for ${config.heroName}.`);
    bookResult.totalCost += (storyResult.inputTokens * 3 + storyResult.outputTokens * 15) / 1_000_000;

    let storyPlan;
    try {
      let cleaned = storyResult.text.replace(/```json\s*|```\s*/g, "").trim();
      const fb = cleaned.indexOf("{");
      const lb = cleaned.lastIndexOf("}");
      if (fb >= 0 && lb > fb) cleaned = cleaned.substring(fb, lb + 1);
      storyPlan = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Story plan parse failed: ${e.message}\nRaw: ${storyResult.text.substring(0, 200)}`);
    }

    bookResult.storyPlan = {
      title: storyPlan.title,
      spreadCount: storyPlan.spreads?.length || 0,
    };
    log(`  Story: "${storyPlan.title}" (${storyPlan.spreads?.length || 0} spreads)`);

    // ── Step 2: Generate cover ───────────────────────────────
    log(`  Step 2: Generating cover...`);

    const coverPrompt = `REFERENCE IMAGES:
- Image 1: ${PHOTO_URL ? `Photograph of ${config.heroName}. Match their EXACT facial features.` : `${config.heroName} is the main character.`}

CHARACTER: ${config.heroName} — a ${config.heroAge}-year-old ${config.heroType}. Must look illustrated, NOT photorealistic.

SCENE: ${storyPlan.coverScene || `${config.heroName} in an exciting scene from a ${config.bookType} story`}

TITLE TEXT: The title "${storyPlan.title}" rendered as LARGE hand-lettered text in the upper third.

STYLE: ${config.nanoPromptStyle}

RULES: Edge-to-edge illustration, portrait 2:3. NO borders. Character is focal point (40%+ of frame). Award-winning quality.`;

    const coverImageInputs = PHOTO_URL ? [PHOTO_URL] : [];
    const coverUrl = await generateImage(coverPrompt, coverImageInputs, "2:3");
    bookResult.totalCost += 0.045;
    await saveImage(coverUrl, `book${bookNum}_cover.jpg`);

    log(`  Step 2b: Validating cover...`);
    const coverScores = await validateImage(
      coverUrl,
      [storyPlan.title],
      config,
      "cover",
      storyPlan.coverScene
    );
    bookResult.totalCost += 0.01; // validation cost estimate

    bookResult.pages.push({
      type: "cover",
      imageUrl: coverUrl,
      scores: coverScores,
      passed: coverScores.pass,
    });

    log(`  Cover: text=${coverScores.textScore} face=${coverScores.faceScore} scene=${coverScores.sceneAccuracy} ${coverScores.pass ? "PASS" : "FAIL"} [${coverScores.qualityTier}]`);
    if (coverScores.issues?.length > 0) {
      log(`    Issues: ${coverScores.issues.slice(0, 2).join("; ")}`);
    }

    // ── Step 3: Generate spreads ─────────────────────────────
    const spreads = storyPlan.spreads || [];
    let prevImageUrl = coverUrl;

    for (let i = 0; i < Math.min(spreads.length, 3); i++) {
      const spread = spreads[i];
      log(`  Step 3.${i + 1}: Generating spread ${i + 1}/${spreads.length}...`);

      const spreadPrompt = `REFERENCE IMAGES:
- Image 1: ${PHOTO_URL ? `Photo of ${config.heroName} — match EXACT face.` : `${config.heroName} is the main character.`}
- Image 2: The COVER — match this EXACT art style.
${i > 0 ? "- Image 3: Previous spread — maintain visual continuity." : ""}

CHARACTER: ${config.heroName} — illustrated style, NOT photorealistic.

SCENE: ${spread.sceneDescription || "A scene from the story"}

TEXT:
Left page text box: "${spread.leftPageText || ""}"
Right page text box: "${spread.rightPageText || ""}"

TEXT BOX DESIGN: Soft cloud shape, semi-transparent white, hand-drawn font, warm dark text.

STYLE: ${config.nanoPromptStyle}

RULES: Edge-to-edge, landscape 4:3. NO borders. Text must be READABLE and correctly spelled.

AVOID: Extra fingers, distorted hands, text outside boxes, watermarks, borders, photorealistic faces.`;

      const spreadInputs = [];
      if (PHOTO_URL) spreadInputs.push(PHOTO_URL);
      spreadInputs.push(coverUrl);
      if (i > 0 && prevImageUrl) spreadInputs.push(prevImageUrl);

      const spreadUrl = await generateImage(spreadPrompt, spreadInputs, "4:3");
      bookResult.totalCost += 0.045;
      await saveImage(spreadUrl, `book${bookNum}_spread${i}.jpg`);

      log(`  Step 3.${i + 1}b: Validating spread ${i + 1}...`);
      const spreadTexts = [spread.leftPageText, spread.rightPageText].filter(Boolean);
      const spreadScores = await validateImage(
        spreadUrl,
        spreadTexts,
        config,
        "spread",
        spread.sceneDescription
      );
      bookResult.totalCost += 0.01;

      bookResult.pages.push({
        type: `spread_${i}`,
        imageUrl: spreadUrl,
        scores: spreadScores,
        passed: spreadScores.pass,
      });

      log(`  Spread ${i + 1}: text=${spreadScores.textScore} face=${spreadScores.faceScore} textBox=${spreadScores.textBoxScore || "?"} scene=${spreadScores.sceneAccuracy} ${spreadScores.pass ? "PASS" : "FAIL"} [${spreadScores.qualityTier}]`);
      if (spreadScores.issues?.length > 0) {
        log(`    Issues: ${spreadScores.issues.slice(0, 2).join("; ")}`);
      }

      prevImageUrl = spreadUrl;
    }

    // ── Step 4: Generate back cover ──────────────────────────
    log(`  Step 4: Generating back cover...`);

    const backPrompt = `REFERENCE IMAGES:
- Image 1: ${PHOTO_URL ? `Photo of ${config.heroName}.` : `${config.heroName}.`}

CHARACTER: ${config.heroName} — illustrated style.

SCENE: ${storyPlan.backCoverScene || `${config.heroName} peacefully resting after the adventure, warm sunset light.`}

STYLE: ${config.nanoPromptStyle}

BACK COVER RULES:
- ABSOLUTELY NO TEXT. Zero words, zero letters, zero numbers.
- Pure illustration only. No textual elements whatsoever.
- Quiet, peaceful scene — the story has ended.
- Edge-to-edge, portrait 2:3. NO borders.`;

    const backInputs = PHOTO_URL ? [PHOTO_URL] : [];
    backInputs.push(coverUrl);
    const backUrl = await generateImage(backPrompt, backInputs, "2:3");
    bookResult.totalCost += 0.045;
    await saveImage(backUrl, `book${bookNum}_back.jpg`);

    log(`  Step 4b: Validating back cover...`);
    const backScores = await validateImage(backUrl, [], config, "back_cover", storyPlan.backCoverScene);
    bookResult.totalCost += 0.01;

    bookResult.pages.push({
      type: "back_cover",
      imageUrl: backUrl,
      scores: backScores,
      passed: backScores.pass,
    });

    log(`  Back cover: text=${backScores.textScore} face=${backScores.faceScore} scene=${backScores.sceneAccuracy} ${backScores.pass ? "PASS" : "FAIL"}`);

    // ── Determine overall pass ───────────────────────────────
    bookResult.allPassed = bookResult.pages.every(p => p.passed);
    bookResult.durationMs = Date.now() - bookResult.startTime;

  } catch (err) {
    bookResult.errors.push(err.message);
    bookResult.allPassed = false;
    bookResult.durationMs = Date.now() - bookResult.startTime;
    log(`  ERROR: ${err.message}`);
  }

  return bookResult;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log("===========================================================");
  log("  STORYTIME QUALITY GAUNTLET                               ");
  log(`  Target: ${TARGET_STREAK} consecutive fully-passing books              `);
  log(`  Max books: ${MAX_BOOKS}                                        `);
  log(`  Reference photo: ${PHOTO_URL ? "YES" : "NO"}                                  `);
  log("===========================================================");
  log("");

  const allResults = [];
  let consecutivePasses = 0;
  let totalBooks = 0;
  let totalCost = 0;

  while (consecutivePasses < TARGET_STREAK && totalBooks < MAX_BOOKS) {
    totalBooks++;
    const configIndex = (totalBooks - 1) % BOOK_CONFIGS.length;
    const config = BOOK_CONFIGS[configIndex];

    log(`\n${"=".repeat(60)}`);
    log(`BOOK ${totalBooks}/${MAX_BOOKS} — ${config.heroName}'s ${config.bookType} story (${config.style})`);
    log(`Streak: ${consecutivePasses}/${TARGET_STREAK}`);
    log(`${"=".repeat(60)}`);

    const result = await generateOneBook(totalBooks, config);
    allResults.push(result);
    totalCost += result.totalCost;

    if (result.allPassed) {
      consecutivePasses++;
      log(`\nBOOK ${totalBooks} PASSED — Streak: ${consecutivePasses}/${TARGET_STREAK}`);
    } else {
      const failedPages = result.pages.filter(p => !p.passed);
      log(`\nBOOK ${totalBooks} FAILED — ${failedPages.length} page(s) failed. Streak reset to 0.`);
      failedPages.forEach(p => {
        log(`   Failed: ${p.type} — text=${p.scores.textScore} face=${p.scores.faceScore} scene=${p.scores.sceneAccuracy}`);
      });
      consecutivePasses = 0;
    }

    log(`  Duration: ${(result.durationMs / 1000).toFixed(0)}s | Cost: ~$${result.totalCost.toFixed(3)}`);
    log(`  Running total: ${totalBooks} books, ~$${totalCost.toFixed(2)}`);

    // Save running report
    writeFileSync(REPORT_FILE, JSON.stringify({
      status: consecutivePasses >= TARGET_STREAK ? "PASSED" : "IN_PROGRESS",
      targetStreak: TARGET_STREAK,
      currentStreak: consecutivePasses,
      totalBooks,
      totalCost: Math.round(totalCost * 100) / 100,
      books: allResults.map(r => ({
        bookNum: r.bookNum,
        config: r.config,
        allPassed: r.allPassed,
        durationMs: r.durationMs,
        cost: Math.round(r.totalCost * 1000) / 1000,
        pages: r.pages.map(p => ({
          type: p.type,
          passed: p.passed,
          scores: {
            text: p.scores.textScore,
            face: p.scores.faceScore,
            textBox: p.scores.textBoxScore,
            scene: p.scores.sceneAccuracy,
            likeness: p.scores.likenessScore,
            format: p.scores.formatOk,
            fingers: p.scores.fingersOk,
            tier: p.scores.qualityTier,
          },
          issues: p.scores.issues,
        })),
        errors: r.errors,
      })),
    }, null, 2));
  }

  // ── Final Report ──────────────────────────────────────────
  log(`\n${"=".repeat(60)}`);
  if (consecutivePasses >= TARGET_STREAK) {
    log(`GAUNTLET PASSED — ${TARGET_STREAK} consecutive books passed!`);
  } else {
    log(`GAUNTLET FAILED — Hit max ${MAX_BOOKS} books without ${TARGET_STREAK} consecutive passes.`);
  }
  log(`${"=".repeat(60)}`);
  log(`Total books generated: ${totalBooks}`);
  log(`Total cost: ~$${totalCost.toFixed(2)}`);
  log(`Final streak: ${consecutivePasses}/${TARGET_STREAK}`);

  // Score breakdown
  const allPages = allResults.flatMap(r => r.pages);
  const avgText = allPages.reduce((s, p) => s + (p.scores.textScore || 0), 0) / allPages.length;
  const avgFace = allPages.reduce((s, p) => s + (p.scores.faceScore || 0), 0) / allPages.length;
  const avgScene = allPages.reduce((s, p) => s + (p.scores.sceneAccuracy || 0), 0) / allPages.length;
  const passRate = allPages.filter(p => p.passed).length / allPages.length;

  log(`\nAVERAGE SCORES:`);
  log(`  Text: ${avgText.toFixed(1)}/10`);
  log(`  Face: ${avgFace.toFixed(1)}/10`);
  log(`  Scene: ${avgScene.toFixed(1)}/10`);
  log(`  Page pass rate: ${(passRate * 100).toFixed(0)}%`);

  // Most common issues
  const issueCounts = {};
  allPages.forEach(p => {
    (p.scores.issues || []).forEach(issue => {
      const key = issue.substring(0, 60);
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    });
  });
  const topIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topIssues.length > 0) {
    log(`\nMOST COMMON ISSUES:`);
    topIssues.forEach(([issue, count]) => log(`  ${count}x: ${issue}`));
  }

  // Per-style breakdown
  const byStyle = {};
  allResults.forEach(r => {
    const style = r.config.style;
    if (!byStyle[style]) byStyle[style] = { books: 0, passed: 0, pages: [] };
    byStyle[style].books++;
    if (r.allPassed) byStyle[style].passed++;
    byStyle[style].pages.push(...r.pages);
  });
  log(`\nBY STYLE:`);
  Object.entries(byStyle).forEach(([style, data]) => {
    const stylePassRate = data.passed / data.books;
    const styleAvgText = data.pages.reduce((s, p) => s + (p.scores.textScore || 0), 0) / data.pages.length;
    log(`  ${style}: ${data.passed}/${data.books} books passed (${(stylePassRate * 100).toFixed(0)}%), avg text=${styleAvgText.toFixed(1)}`);
  });

  log(`\nReport saved: ${REPORT_FILE}`);
  log(`Log saved: ${LOG_FILE}`);
  if (SAVE_IMAGES) log(`Images saved: ${OUTPUT_DIR}/`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
