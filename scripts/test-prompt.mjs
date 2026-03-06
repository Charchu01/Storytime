#!/usr/bin/env node

// ── Test Prompt Script ──────────────────────────────────────────────────────
// Generates ONE image via Replicate and validates it via Claude Vision.
// Usage:
//   REPLICATE_KEY=xxx ANTHROPIC_KEY=xxx node scripts/test-prompt.mjs "your prompt here"
//
// Options (via env vars):
//   ASPECT_RATIO   - "2:3" (default), "4:3", "3:2", etc.
//   PAGE_TYPE      - "cover" (default), "spread", "back_cover"
//   HERO_NAME      - Name for validation (default: "the hero")
//   ART_STYLE      - Style label for validation (default: "children's storybook")
//   REF_PHOTO      - URL to a reference photo
//   USE_ASSEMBLER   - "cover", "spread", "back_cover" to use assembleImagePrompt
//   SCENE          - Scene description (used with USE_ASSEMBLER)
//   TITLE_TEXT     - Title text for cover assembler
//   LEFT_TEXT      - Left page text for spread assembler
//   RIGHT_TEXT     - Right page text for spread assembler

import Replicate from "replicate";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "test-output");

// ── Config from env ─────────────────────────────────────────────────────────
const REPLICATE_KEY = process.env.REPLICATE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const ASPECT_RATIO = process.env.ASPECT_RATIO || "2:3";
const PAGE_TYPE = process.env.PAGE_TYPE || "cover";
const HERO_NAME = process.env.HERO_NAME || "the hero";
const ART_STYLE = process.env.ART_STYLE || "children's storybook illustration";
const REF_PHOTO = process.env.REF_PHOTO || null;
const USE_ASSEMBLER = process.env.USE_ASSEMBLER || null;
const SCENE = process.env.SCENE || "";
const TITLE_TEXT = process.env.TITLE_TEXT || "";
const LEFT_TEXT = process.env.LEFT_TEXT || "";
const RIGHT_TEXT = process.env.RIGHT_TEXT || "";

// ── assembleImagePrompt (same logic as src/api/story.js) ────────────────────
function assembleImagePrompt({
  sceneDescription,
  characterAppearances,
  textBoxDesign,
  artStyle,
  pageTexts,
  isFirstSpread,
  isCover,
  isBackCover,
  heroName,
  authorName,
  subtitleText,
  companionNames = [],
}) {
  const sections = [];

  // ── COVER ──
  if (isCover) {
    const companionRefLines = companionNames.map((name, i) =>
      `- Image ${i + 2}: Photo of ${name} — match their EXACT facial features, head shape, hair, and skin tone. Transform into the illustrated art style.`
    ).join("\n");

    sections.push(
`REFERENCE IMAGES:
- Image 1: Photograph of ${heroName}. Match their EXACT facial features, head shape, hair, and skin tone. Transform into illustrated art style — NOT photorealistic.${companionRefLines ? "\n" + companionRefLines : ""}`
    );

    sections.push(
`CHARACTER:
${characterAppearances?.hero || `${heroName} — a child character in a storybook`}
${heroName}'s face MUST match Image 1. Transform into illustrated style.`
    );

    sections.push(`SCENE:\n${sceneDescription}`);

    const titleText = pageTexts?.[0] || "Untitled";
    sections.push(
`TITLE TEXT:
The title "${titleText}" must be rendered as LARGE, beautiful hand-lettered text that is PART OF the illustration — not a separate text box.

Title requirements:
- Takes up 30-50% of the cover area (upper portion)
- Hand-lettered style that matches the art style
- Letters can interact with the scene: glow, cast shadows, have characters lean against them
- Warm, readable, bold — visible even as a tiny thumbnail
- Style-matched: if watercolor art, title looks hand-painted. If Pixar, title looks 3D rendered.
- Color: contrasts with background. Can have a subtle glow, shadow, or outline for readability
- Position: upper third of the image, arcing or flowing naturally

DO NOT put the title in a box, frame, banner, or rectangle. The title is PAINTED INTO the scene.`
    );

    if (authorName) {
      sections.push(
`AUTHOR NAME:
Render "By ${authorName}" in small, elegant text near the bottom of the cover.
- Much smaller than the title (about 1/6th the size)
- Same style family as the title but thinner/lighter weight
- Positioned at bottom centre or bottom right`
      );
    }

    sections.push(
`STYLE:
${artStyle || "Classic children's storybook illustration"}
This is the COVER — the most polished, beautiful image in the entire book. Gallery quality. Award-winning.`
    );

    sections.push(
`COVER RULES:
- Illustration fills ENTIRE image edge-to-edge, portrait 2:3
- NO text boxes, NO frames, NO banners, NO borders
- Title is HAND-LETTERED INTO the scene
- Character is the HERO — front and centre, full body or 3/4
- Lighting should be dramatic and cinematic
- Keep 5% safe zone at edges
- NOT photorealistic — illustrated children's book style`
    );

    return sections.join("\n\n");
  }

  // ── BACK COVER ──
  if (isBackCover) {
    sections.push(
`REFERENCE IMAGES:
- Image 1: Photo of ${heroName} — match face identity.`
    );

    sections.push(
`CHARACTER:
${characterAppearances?.hero || `${heroName} — a child character`}
${heroName}'s face MUST match Image 1. Transform into illustrated style.`
    );

    sections.push(`SCENE:\n${sceneDescription}`);

    sections.push(
`STYLE:
${artStyle || "Classic children's storybook illustration"}
This is the closing image — warm, gentle, reflective.`
    );

    sections.push(
`BACK COVER RULES:
- Illustration fills ENTIRE image edge-to-edge, portrait 2:3
- ABSOLUTELY NO TEXT, TITLES, LETTERS, OR WORDS anywhere in the image
- Quiet, peaceful, reflective scene
- Character shown from behind or at rest
- Leave the lower third slightly softer/darker for text overlay
- NOT photorealistic — illustrated children's book style`
    );

    return sections.join("\n\n");
  }

  // ── INTERIOR SPREAD ──
  if (isFirstSpread) {
    sections.push(
`REFERENCE IMAGES:
- Image 1: Photo of ${heroName} — match EXACT facial features.
- Image 2: The COVER of this book — your STYLE BIBLE. Match this EXACT art style.`
    );
  } else {
    sections.push(
`REFERENCE IMAGES:
- Image 1: Photo of ${heroName} — match EXACT facial features.
- Image 2: The COVER — your STYLE BIBLE.
- Image 3: The PREVIOUS SPREAD. Maintain visual continuity.`
    );
  }

  sections.push(
`CHARACTER:
${characterAppearances?.hero || `${heroName} — a child character`}
${heroName}'s face MUST match Image 1. NOT photorealistic — illustrated style.`
  );

  sections.push(`SCENE:\n${sceneDescription}`);

  if (pageTexts && pageTexts.length > 0) {
    const textLines = pageTexts
      .filter(t => t && t.trim())
      .map((t, i) => {
        const label = pageTexts.length === 1 ? "Text box" :
          i === 0 ? "Left page text box" : "Right page text box";
        return `${label}: "${t}"`;
      })
      .join("\n");

    if (textLines) {
      sections.push(
`TEXT:
Render the following EXACTLY as written. Every word must be correctly spelled.
${textLines}`
      );

      sections.push(
`TEXT BOX DESIGN — MUST BE IDENTICAL ON EVERY PAGE:
- Shape: Soft cloud/speech-bubble shape with smooth rounded edges
- Background: Semi-transparent white/cream (rgba(255,255,255,0.85))
- Border: Thin warm border (1-2px)
- Font: Hand-drawn/handwritten style, NOT cursive script, NOT serif
- Size: Text boxes should be 25-35% of the image area, never larger
- Position: One text box top-left area, one text box bottom-right area
${textBoxDesign ? `Additional style notes: ${textBoxDesign}` : ""}`
      );
    }
  }

  sections.push(
`STYLE:
${artStyle || "Classic children's storybook illustration, bold saturated colours, clean outlines, warm painterly backgrounds."}
Must be IDENTICAL on every page.`
  );

  sections.push(
`RULES:
- Illustration fills ENTIRE image edge-to-edge
- NO borders, frames, or parchment edges
- NO page numbers, NO speech bubbles
- Keep important content 5% from edges
- NOT photorealistic — illustrated children's book style`
  );

  return sections.join("\n\n");
}

// ── buildValidationPrompt (same logic as api/validate-image.js) ─────────────
function buildValidationPrompt({
  expectedTexts,
  heroName,
  artStyle,
  pageType,
  sceneDescription,
  hasReferencePhoto,
}) {
  const isCover = pageType === "cover";
  const hasExpectedText = expectedTexts?.filter(t => t?.trim()).length > 0;

  let textSection;
  if (isCover && hasExpectedText) {
    textSection = `EXPECTED TITLE IN IMAGE:
${expectedTexts.filter(t => t?.trim()).map((t) => `Title: "${t}"`).join("\n")}

This is a COVER — the title is HAND-LETTERED artistic text that is PART OF the illustration, not in a text box.
Check that the title is:
- READABLE and RECOGNIZABLE as the correct title
- Not garbled or nonsensical
Do NOT penalize for artistic styling, glow effects, curved lettering, or slight stylization.`;
  } else if (hasExpectedText) {
    textSection = `EXPECTED TEXT IN IMAGE:
${expectedTexts.filter(t => t?.trim()).map((t, i) => `Text box ${i + 1}: "${t}"`).join("\n")}

Check EVERY word. Compare character by character.`;
  } else {
    textSection = "No text boxes expected in this image.";
  }

  return `You are a STRICT quality inspector for a premium children's storybook.

PAGE TYPE: ${pageType}
ART STYLE REQUESTED: ${artStyle || "children's storybook illustration"}
SCENE REQUESTED: ${sceneDescription?.substring(0, 400) || "not provided"}

=== CHECK 1: TEXT ACCURACY (textScore 1-10) ===
${textSection}

Score STRICTLY:
- 10: Every single word perfectly readable and correct
- 8-9: One slightly unclear letter but all words recognizable
- 6-7: One word misspelled or one section hard to read
- 4-5: Multiple words wrong or garbled
- 1-3: Text is mostly unreadable nonsense
- If no text expected, score 10

=== CHECK 2: CHARACTER QUALITY (faceScore 1-10) ===
CHARACTER: The hero is "${heroName || 'the main character'}". Check that they look natural, appealing, and age-appropriate.

Score STRICTLY:
- 10: All characters look natural, appealing, age-appropriate
- 8-9: Very minor oddities
- 6-7: Noticeable issues (weird fingers, uncanny valley)
- 4-5: Clearly wrong (extra fingers, distorted face)
- 1-3: Horrifying (melted features, extra limbs)

=== CHECK 3: TEXT BOX CONSISTENCY (textBoxScore 1-10) ===
Check the visual design of text boxes in this image.

=== CHECK 4: SCENE ACCURACY (sceneAccuracy 1-10) ===
Does the illustration match what was requested?

=== CHECK 5: FORMAT (formatOk true/false) ===
- Illustration fills edge to edge (no white/black borders)
- No watermarks, artifacts, or UI elements
- Appropriate for a children's book

${hasReferencePhoto ? `=== CHECK 6: PHOTO LIKENESS (likenessScore 1-10) ===
Compare the illustrated character to the reference photo.
` : ''}
Return ONLY valid JSON. No explanation. No markdown fences.
{
  "pass": true/false,
  "textScore": 1-10,
  "faceScore": 1-10,
  "textBoxScore": 1-10,
  "sceneAccuracy": 1-10,
  "formatOk": true/false,
  ${hasReferencePhoto ? '"likenessScore": 1-10,' : ''}
  "issues": ["list of specific issues found"],
  "fixNotes": "if any score is below 7, provide SPECIFIC regeneration instructions",
  "textBoxDescription": "describe the text box style you see",
  "characterCount": number_of_characters_visible,
  "fingersOk": true/false
}

No explanation. No markdown. JSON only.`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const rawPrompt = process.argv[2];
  if (!rawPrompt && !USE_ASSEMBLER) {
    console.error("Usage: REPLICATE_KEY=xxx ANTHROPIC_KEY=xxx node scripts/test-prompt.mjs \"your prompt here\"");
    console.error("");
    console.error("Or use the assembler:");
    console.error("  USE_ASSEMBLER=cover SCENE=\"A child in a garden\" TITLE_TEXT=\"My Story\" ...");
    console.error("");
    console.error("Env vars: ASPECT_RATIO, PAGE_TYPE, HERO_NAME, ART_STYLE, REF_PHOTO,");
    console.error("          USE_ASSEMBLER, SCENE, TITLE_TEXT, LEFT_TEXT, RIGHT_TEXT");
    process.exit(1);
  }

  if (!REPLICATE_KEY) {
    console.error("Error: REPLICATE_KEY env var is required");
    process.exit(1);
  }

  // ── Build prompt ──────────────────────────────────────────────
  let prompt;
  if (USE_ASSEMBLER) {
    const scene = SCENE || rawPrompt || "A child on an adventure";
    console.log(`\n--- Using assembleImagePrompt (${USE_ASSEMBLER}) ---`);

    const pageTexts = USE_ASSEMBLER === "cover"
      ? [TITLE_TEXT || "Untitled"]
      : USE_ASSEMBLER === "spread"
        ? [LEFT_TEXT, RIGHT_TEXT].filter(Boolean)
        : [];

    prompt = assembleImagePrompt({
      sceneDescription: scene,
      characterAppearances: { hero: `${HERO_NAME} — the main character in a children's storybook` },
      textBoxDesign: null,
      artStyle: ART_STYLE,
      pageTexts,
      isFirstSpread: USE_ASSEMBLER === "spread",
      isCover: USE_ASSEMBLER === "cover",
      isBackCover: USE_ASSEMBLER === "back_cover",
      heroName: HERO_NAME,
      authorName: USE_ASSEMBLER === "cover" ? "A loving family" : null,
      subtitleText: null,
      companionNames: [],
    });
  } else {
    prompt = rawPrompt;
  }

  console.log("\n=== PROMPT ===");
  console.log(prompt.length > 500 ? prompt.substring(0, 500) + `\n... (${prompt.length} chars total)` : prompt);
  console.log(`\nAspect ratio: ${ASPECT_RATIO}`);
  console.log(`Page type: ${PAGE_TYPE}`);
  if (REF_PHOTO) console.log(`Reference photo: ${REF_PHOTO}`);

  // ── Step 1: Generate image ────────────────────────────────────
  console.log("\n=== GENERATING IMAGE ===");
  const replicate = new Replicate({ auth: REPLICATE_KEY });

  const input = {
    prompt,
    aspect_ratio: ASPECT_RATIO,
    output_format: "jpg",
    allow_fallback_model: true,
  };
  if (REF_PHOTO) {
    input.image_input = [REF_PHOTO];
  }

  let prediction;
  try {
    prediction = await replicate.predictions.create({
      model: "google/nano-banana-pro",
      input,
    });
    console.log(`Prediction ID: ${prediction.id}`);
    console.log(`Status: ${prediction.status}`);
  } catch (err) {
    console.error(`Failed to create prediction: ${err.message}`);
    process.exit(1);
  }

  // ── Poll for completion ───────────────────────────────────────
  const POLL_INTERVAL = 2500;
  const MAX_POLLS = 48;
  let imageUrl = null;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    process.stdout.write(".");

    try {
      const status = await replicate.predictions.get(prediction.id);

      if (status.status === "succeeded") {
        const output = status.output;
        if (typeof output === "string") imageUrl = output;
        else if (Array.isArray(output) && output.length > 0) imageUrl = String(output[0]);
        else if (output?.url) imageUrl = typeof output.url === "function" ? output.url() : output.url;

        console.log(`\nImage generated: ${imageUrl}`);
        break;
      }

      if (status.status === "failed" || status.status === "canceled") {
        console.error(`\nGeneration ${status.status}: ${status.error || "unknown error"}`);
        process.exit(1);
      }
    } catch (err) {
      // Network hiccup, keep polling
    }
  }

  if (!imageUrl) {
    console.error("\nTimed out waiting for image generation");
    process.exit(1);
  }

  // ── Step 2: Save image locally ────────────────────────────────
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  const filename = `test-${PAGE_TYPE}-${timestamp}.jpg`;
  const filepath = join(OUTPUT_DIR, filename);

  try {
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) throw new Error(`HTTP ${imgResponse.status}`);
    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    writeFileSync(filepath, buffer);
    console.log(`Saved: ${filepath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.warn(`Failed to save image locally: ${err.message}`);
    console.log(`Image URL: ${imageUrl}`);
  }

  // ── Step 3: Validate with Claude Vision ───────────────────────
  if (!ANTHROPIC_KEY) {
    console.log("\n=== SKIPPING VALIDATION (no ANTHROPIC_KEY) ===");
    console.log("Set ANTHROPIC_KEY to run Claude Vision validation.");
    return;
  }

  console.log("\n=== VALIDATING IMAGE ===");

  const expectedTexts = USE_ASSEMBLER === "cover"
    ? [TITLE_TEXT || "Untitled"]
    : USE_ASSEMBLER === "spread"
      ? [LEFT_TEXT, RIGHT_TEXT].filter(Boolean)
      : [];

  const validationPrompt = buildValidationPrompt({
    expectedTexts,
    heroName: HERO_NAME,
    artStyle: ART_STYLE,
    pageType: PAGE_TYPE,
    sceneDescription: SCENE || rawPrompt,
    hasReferencePhoto: !!REF_PHOTO,
  });

  const messageContent = [
    { type: "image", source: { type: "url", url: imageUrl } },
    { type: "text", text: validationPrompt },
  ];

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
        max_tokens: 600,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Validation API error (${response.status}):`, data.error?.message || JSON.stringify(data));
      return;
    }

    const text = data.content.map(b => b.text || "").join("").trim();
    const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse validation response:");
      console.log(text.substring(0, 500));
      return;
    }

    // ── Print results ──────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════╗");
    console.log(`║  ${result.pass ? "✅ PASS" : "❌ FAIL"}                                   ║`);
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  Text Score:      ${padScore(result.textScore)}                   ║`);
    console.log(`║  Face Score:      ${padScore(result.faceScore)}                   ║`);
    console.log(`║  TextBox Score:   ${padScore(result.textBoxScore)}                   ║`);
    console.log(`║  Scene Accuracy:  ${padScore(result.sceneAccuracy)}                   ║`);
    console.log(`║  Format OK:       ${result.formatOk ? "Yes" : "NO "}                   ║`);
    console.log(`║  Fingers OK:      ${result.fingersOk ? "Yes" : "NO "}                   ║`);
    console.log(`║  Characters:      ${String(result.characterCount || 0).padEnd(3)}                   ║`);
    if (result.likenessScore != null) {
      console.log(`║  Likeness:        ${padScore(result.likenessScore)}                   ║`);
    }
    console.log("╚══════════════════════════════════════════╝");

    if (result.issues?.length > 0) {
      console.log("\nIssues:");
      result.issues.forEach(issue => console.log(`  • ${issue}`));
    }

    if (result.fixNotes) {
      console.log(`\nFix notes: ${result.fixNotes}`);
    }

    if (result.textBoxDescription) {
      console.log(`\nText box style: ${result.textBoxDescription}`);
    }

    console.log(`\nImage: ${filepath}`);
    console.log(`URL: ${imageUrl}`);

  } catch (err) {
    console.error(`Validation failed: ${err.message}`);
  }
}

function padScore(score) {
  const s = score != null ? `${score}/10` : "N/A  ";
  return s.padEnd(4);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
