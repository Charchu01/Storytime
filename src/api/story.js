import { claudeCall, generateImage, uploadPhoto } from "./client";
import { ROLES, STYLES } from "../constants/data";

// Style anchors now live in STYLES[] in constants/data.js (single source of truth)

// ── Face-ref-lost tracking ───────────────────────────────────────────────────
export const imageGenFlags = { faceRefLostCount: 0 };

// ── Left page gradients for each style ────────────────────────────────────────
export const STYLE_GRADIENTS = {
  Storybook: "linear-gradient(135deg, #FEF3C7, #FDE68A, #F59E0B)",
  Watercolor: "linear-gradient(135deg, #E0F2FE, #BAE6FD, #7DD3FC)",
  "Bold & Bright": "linear-gradient(135deg, #FDF4FF, #FAE8FF, #E879F9)",
  "Cozy & Soft": "linear-gradient(135deg, #FFF1F2, #FFE4E6, #FECDD3)",
  "Sketch & Color": "linear-gradient(135deg, #F5F5DC, #FFFACD, #FFEAA7)",
};

export const STYLE_COVER_GRADIENTS = {
  Storybook: "linear-gradient(160deg, #D97706, #B45309, #92400E)",
  Watercolor: "linear-gradient(160deg, #0284C7, #0369A1, #075985)",
  "Bold & Bright": "linear-gradient(160deg, #A855F7, #7C3AED, #6D28D9)",
  "Cozy & Soft": "linear-gradient(160deg, #F472B6, #EC4899, #DB2777)",
  "Sketch & Color": "linear-gradient(160deg, #A16207, #854D0E, #713F12)",
};

// World vocabularies now live in STORY_WORLDS[] in constants/data.js
// worldVocab is passed as a parameter to buildScenePrompt

// ── Mood → lighting presets ───────────────────────────────────────────────────
const MOOD_LIGHTING = {
  wonder: "soft magical golden light, gentle god rays, sparkles",
  adventure: "dramatic dynamic lighting, strong shadows, energetic",
  cozy: "warm lamplight, soft glows, intimate and safe",
  tense: "cool dramatic shadows, high contrast, atmospheric",
  triumphant: "radiant warm sunlight, everything glowing, celebratory",
  tender: "soft diffused light, pastel tones, gentle and loving",
};

// Tone lighting now lives in STORY_TONES[] in constants/data.js
// toneLighting is passed as a parameter to buildScenePrompt

// ── Quality tags appended to every prompt ─────────────────────────────────────
const QUALITY_TAGS =
  "children's picture book quality, highly detailed illustration, award-winning picture book style, no text in image, no words, no letters, no watermarks";

// ── Cost tracking ─────────────────────────────────────────────────────────────
export function logCost(type, model, success, durationMs, error) {
  try {
    const log = JSON.parse(localStorage.getItem("st_costs") || "[]");
    log.push({
      ts: Date.now(),
      type,
      model,
      success,
      durationMs,
      cost: type === "kontext_max" ? 0.05 :
            type === "kontext" ? 0.04 :
            type === "flux" ? 0.04 : 0,
      error: error || null,
    });
    localStorage.setItem("st_costs", JSON.stringify(log.slice(-200)));
  } catch {}
}

// ── Image URL passthrough ────────────────────────────────────────────────────
// Previously converted remote URLs to blob: URLs for offline caching, but
// blob: URLs don't survive page refresh or localStorage persistence.
// Replicate CDN URLs persist for 48 hours, so just pass them through.
export async function cacheImageAsBlob(url) {
  return url || null;
}

// ── Image validation ──────────────────────────────────────────────────────────
async function validateImageUrl(url) {
  if (!url) return false;
  // Blob URLs and data URIs are already local — always valid
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  try {
    const resp = await fetch(url, { method: "HEAD" });
    if (!resp.ok) return false;
    const ct = resp.headers.get("content-type");
    if (ct && !ct.startsWith("image/")) return false;
    // Skip size check — Replicate images vary widely and the URL existing means it succeeded
    return true;
  } catch {
    // Network error on HEAD — still try to use the URL (GET may work)
    return true;
  }
}

// ── Character description helpers ─────────────────────────────────────────────
function buildCharacterDescription(cast) {
  return cast
    .map((character) => {
      const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
      const age = character.age ? `, age ${character.age}` : "";
      const photoNote = character.photo ? " (photo provided)" : "";
      return `${character.name} (${role}${age})${photoNote}`;
    })
    .join(", ");
}

function buildDetailedCharacterPrompt(cast) {
  return cast
    .map((character) => {
      const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
      const parts = [];
      const ageDesc = character.age ? `${character.age}-year-old` : "";

      if (character.role === "pet") {
        parts.push(`a pet named ${character.name}`);
      } else if (character.role === "baby") {
        parts.push(`a baby named ${character.name}`);
      } else {
        parts.push(`${ageDesc} ${role.toLowerCase()} named ${character.name}`.trim());
      }

      if (character.appearanceDescription) {
        parts.push(`— ${character.appearanceDescription}`);
      }

      if (character.isHero) parts.push("(main character)");
      return parts.join(" ");
    })
    .join("; ");
}

// ── Build the panoramic spread prompt for a scene ─────────────────────────────
function buildScenePrompt(sceneDescription, cast, styleName, mood, worldVocab, toneLighting) {
  const styleData = STYLES.find(s => s.name === styleName);
  const styleAnchor = styleData?.anchor || STYLES[0].anchor;
  const lighting = MOOD_LIGHTING[mood] || MOOD_LIGHTING["wonder"];
  const worldDesc = worldVocab ? `${worldVocab} — ` : "";
  const toneDesc = toneLighting ? `${toneLighting}, ` : "";

  const hero = cast.find((c) => c.isHero) || cast[0];
  const heroAppearance = hero?.appearanceDescription || "";
  const heroAge = hero?.age ? `${hero.age}-year-old` : "young";
  const heroName = hero?.name || "the child";

  const characterRef = heroAppearance
    ? `${heroAge} child: ${heroAppearance}`
    : `a ${heroAge} child named ${heroName}`;

  return [
    styleAnchor,
    worldDesc,
    `Single-page children's picture book illustration in portrait orientation.`,
    `This fills ONE page of an open storybook.`,
    `Rich detailed environment fills the entire frame.`,
    sceneDescription,
    `The main character is ${characterRef}.`,
    `The main character is naturally placed within the scene, roughly 30-40% of the frame height, surrounded by the world.`,
    `Beautiful atmospheric depth — detailed foreground elements, character in middleground, environment extending into background.`,
    `NEVER a headshot or close-up portrait. ALWAYS show the character within their world, full-body or at least waist-up, with the environment telling the story around them.`,
    toneDesc,
    lighting,
    QUALITY_TAGS,
  ].join(" ");
}

// ── Analyze character photos ──────────────────────────────────────────────────
async function analyzeCharacterPhotos_single(character, photoDataUri) {
  const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
  const ageNote = character.age ? `, approximately ${character.age} years old` : "";

  try {
    const description = await claudeCall(
      `You are a professional children's book illustrator creating a character reference sheet. Your description will be fed DIRECTLY into an AI image generator to draw this person as a storybook character across multiple pages.

Write an EXTREMELY specific and vivid visual description (4-6 sentences) that an AI image generator can use. Be precise about:
- EXACT hair color (e.g. "warm chestnut brown", "jet black", "strawberry blonde"), texture (straight, wavy, curly, coily), and length/style
- EXACT skin tone (e.g. "warm golden brown", "fair with rosy cheeks", "deep rich brown", "olive-toned")
- Eye color and shape (e.g. "large round dark brown eyes", "bright blue almond-shaped eyes")
- Face shape (round, oval, heart-shaped) and key features (chubby cheeks, dimples, freckles, button nose)
- Body build for their age (chubby toddler, slim, sturdy)
- Any distinctive features (gap teeth, birthmark, curls that bounce, glasses)

Format as a single flowing paragraph. Do NOT mention clothing. Do NOT use vague terms like "light skin" or "dark hair" — be SPECIFIC with descriptive color words. Write in third person.`,
      `This is ${character.name}, a ${role}${ageNote}. Please write an extremely detailed physical appearance description for an illustrator.`,
      400,
      photoDataUri
    );
    return description;
  } catch (err) {
    // Photo analysis failed — continue without appearance description
    return null;
  }
}

export async function analyzeCharacterPhotos(cast) {
  const enrichedCast = await Promise.all(
    cast.map(async (character) => {
      const photos = character.photos?.filter((p) => p.dataUri) || [];
      if (photos.length === 0 && character.photo) {
        const description = await analyzeCharacterPhotos_single(character, character.photo);
        return description ? { ...character, appearanceDescription: description } : character;
      }
      if (photos.length === 0) return character;

      if (photos.length === 1) {
        const description = await analyzeCharacterPhotos_single(character, photos[0].dataUri);
        return description ? { ...character, appearanceDescription: description } : character;
      }

      const primaryIdx = character.primaryPhotoIndex || 0;
      const primaryPhoto = photos[primaryIdx] || photos[0];
      const otherPhotos = photos.filter((_, i) => i !== primaryIdx);

      const primaryDesc = await analyzeCharacterPhotos_single(character, primaryPhoto.dataUri);

      let supplementDesc = null;
      if (otherPhotos.length > 0) {
        const bestOther = otherPhotos.find((p) => p.quality === "good") || otherPhotos[0];
        supplementDesc = await analyzeCharacterPhotos_single(character, bestOther.dataUri);
      }

      let finalDesc = primaryDesc || "";
      if (supplementDesc && primaryDesc) {
        finalDesc = await claudeCall(
          "Merge these two appearance descriptions of the same person into one concise description (3-4 sentences). Combine unique details from both, resolve any contradictions by favoring the first. Write in third person. Return ONLY the merged description.",
          `Description 1: ${primaryDesc}\n\nDescription 2: ${supplementDesc}`,
          300
        ).catch(() => primaryDesc);
      }

      return finalDesc ? { ...character, appearanceDescription: finalDesc } : character;
    })
  );
  return enrichedCast;
}

// ── Generate story text + scene descriptions ──────────────────────────────────
export async function generateStory(cast, styleName, storyData) {
  const characterDescriptions = buildCharacterDescription(cast);

  const appearanceNotes = cast
    .filter((c) => c.appearanceDescription)
    .map((c) => `${c.name}: ${c.appearanceDescription}`)
    .join("\n");

  const systemPrompt = `You are a master storyteller. You write with the emotional depth of Oliver Jeffers, the playful language of Julia Donaldson, and the worldbuilding of Maurice Sendak.

Generate a complete picture book with this exact JSON structure:

{"title":"Story title (creative, evocative, 3-6 words)","coverScene":"A breathtaking wide establishing shot description of the story world — epic scale, no characters visible, pure world-building","coverEmoji":"Single emoji representing the story world","pages":[{"pageNumber":1,"text":"The story text for this page. 2-4 sentences.","scene_description":"A detailed WIDE or MEDIUM SHOT illustration description with rich environmental details including colors, lighting, textures, and atmosphere that an image generator can use.","scene_emoji":"Single emoji for this scene","mood":"One of: wonder, adventure, cozy, tense, triumphant, tender","characters_present":["Name1","Name2"]}]}

Story writing rules:
* Exactly ${storyData.pageCount || 6} pages
* Each page ends at a moment that compels turning the page
* Use the character's name often
* Include sensory details: what things look, sound, smell, and feel like
* The story should have a clear arc: setup, adventure, challenge, resolution, warm ending
* The ending should feel earned and warm
${storyData.personalIngredient ? `* PRIORITY: Weave this personal detail into the emotional core of the story: "${storyData.personalIngredient}"` : ""}
${storyData.storyFormat === "rhyming" ? "* Write in strict AABB rhyme scheme. 8-10 syllables per line." : ""}
${storyData.storyFormat === "funny" ? "* Every page needs a genuine surprise. Setup on one page, punchline on the next." : ""}

Illustration rules:
* Wide establishing shots for big moments, medium shots for emotional moments
* Always show the character IN the world, not isolated
* Each scene_description MUST include vivid world vocabulary — describe the environment with specific colors, textures, lighting, and atmosphere so the image generator has rich visual context
* Each page's characters_present must list which characters are visible in that scene
* The character should be 30-40% of frame height, never filling the whole image

Based on the story idea provided, choose the perfect world setting, character personality traits, emotional tone, and story arc. The user has given you creative freedom — make it magical.

Return ONLY valid JSON. No preamble. No markdown code blocks. Just the raw JSON object.`;

  const userPrompt = `Hero: ${storyData.hero || storyData.heroName || "the child"}${storyData.heroAge ? ` (age ${storyData.heroAge})` : ""}
${appearanceNotes ? `\nCharacter Appearances:\n${appearanceNotes}\n` : ""}
${characterDescriptions ? `Cast: ${characterDescriptions}` : ""}

Story idea: ${storyData.storyIdea || storyData.sparkText || storyData.spark || "A magical adventure"}

Art style: ${styleName}
Pages: ${storyData.pageCount || 6}
${storyData.tone ? `Preferred tone: ${storyData.tone}` : ""}
${storyData.storyFormat === "rhyming" ? "Write in AABB rhyming couplets." : ""}
${storyData.storyFormat === "funny" ? "Make it genuinely funny with surprises." : ""}
${storyData.personalIngredient ? `Personal detail to weave in: "${storyData.personalIngredient}"` : ""}

Based on the story idea, choose the perfect world setting, character personality, emotional arc, and visual environments. Make it magical and personal.`;

  const maxTokens = (storyData.pageCount || 6) > 6 ? 3000 : 1800;
  const raw = await claudeCall(systemPrompt, userPrompt, maxTokens);

  let parsed;
  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = raw.match(/```json?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
        // Last resort: retry once
        try {
          const retryRaw = await claudeCall(systemPrompt, userPrompt, maxTokens);
          const retryCleaned = retryRaw.replace(/```json\s*|```\s*/g, "").trim();
          parsed = JSON.parse(retryCleaned);
        } catch {
          throw new Error("Failed to parse story response after retry. Please try again.");
        }
      }
    } else {
      throw new Error("Failed to parse story response. Please try again.");
    }
  }

  if (!parsed.title || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error("Invalid story structure returned. Please try again.");
  }

  // Validate each page has required fields
  parsed.pages = parsed.pages.map((page, i) => ({
    pageNumber: page.pageNumber || i + 1,
    text: page.text || "",
    scene_description: page.scene_description || page.text || "",
    scene_emoji: page.scene_emoji || "🌟",
    mood: page.mood || "wonder",
    characters_present: page.characters_present || [],
  }));

  return parsed;
}

// ── Build a Kontext-optimized prompt (research-backed) ──────────────────────
// Research-backed Kontext prompting rules (BFL, Replicate, community):
// 1. Don't describe what Kontext can already see in the photo
// 2. Style transformation as FIRST instruction (dominant signal)
// 3. Use "Turn into" not "transform" (BFL: "transform" = complete change)
// 4. Scene truncated to ~25 words (512 token limit)
// 5. Face preservation at END (BFL recommended position)
// 6. Total prompt under 60 words
function buildKontextPrompt(sceneDescription, styleName, mood) {
  const styleMap = {
    "Storybook":     "a classic children's storybook illustration with bold colors and clean outlines",
    "Watercolor":    "a soft watercolor children's picture book illustration with dreamy washes",
    "Bold & Bright": "a bright colorful cartoon children's book illustration with thick outlines",
    "Cozy & Soft":   "a gentle pastel children's bedtime book illustration, cozy and warm",
    "Sketch & Color":"a hand-drawn children's book illustration with pencil lines and color wash",
  };

  const moodMap = {
    "wonder":     "magical and sparkly",
    "adventure":  "exciting and dynamic",
    "cozy":       "warm and cozy",
    "tense":      "mysterious",
    "triumphant": "bright and triumphant",
    "tender":     "soft and heartfelt",
  };

  const style = styleMap[styleName] || styleMap["Storybook"];
  const moodStr = moodMap[mood] || "magical";

  // Truncate scene description to max ~25 words
  const words = sceneDescription.split(/\s+/);
  const scene = words.length > 25
    ? words.slice(0, 25).join(" ")
    : sceneDescription;

  return `Turn this person into ${style}. Scene: ${scene}. ${moodStr} atmosphere. Show full-body, naturally in the scene. Keep their exact face and features from the photo. No text or words.`;
}

// ── Generate a single page image with fallback chain ────────────────────────
export async function generatePageImage(sceneDescription, cast, styleName, heroPhotoUrl, mood, worldVocab, toneLighting, tier = "standard") {
  const startTime = Date.now();
  const errors = [];

  // ATTEMPT 1: With face reference → use Kontext prompt (short, instructional)
  if (heroPhotoUrl) {
    const kontextPrompt = buildKontextPrompt(sceneDescription, styleName, mood || "wonder");
    try {
      const url = await generateImage(kontextPrompt, heroPhotoUrl, tier, styleName);
      if (await validateImageUrl(url)) {
        logCost(tier === "premium" ? "kontext_max" : "kontext", tier, true, Date.now() - startTime, null);
        return url;
      }
      errors.push("Kontext: image URL invalid");
    } catch (err) {
      errors.push(`Kontext: ${err.message}`);
      console.error("Kontext generation failed:", err.message);
    }
  }

  // ATTEMPT 2: No face ref → use full descriptive prompt for Flux Pro Ultra
  const fullPrompt = buildScenePrompt(sceneDescription, cast, styleName, mood || "wonder", worldVocab, toneLighting);
  try {
    const url = await generateImage(fullPrompt, null, tier, styleName);
    if (await validateImageUrl(url)) {
      logCost("flux", "no_face", true, Date.now() - startTime, null);
      if (heroPhotoUrl) imageGenFlags.faceRefLostCount++;
      return url;
    }
    errors.push("Flux: image URL invalid");
  } catch (err) {
    errors.push(`Flux: ${err.message}`);
    console.error("Scene-only generation failed:", err.message);
  }

  const errorSummary = errors.join(" | ");
  console.error("All image attempts failed:", errorSummary);
  logCost("all", "failed", false, Date.now() - startTime, errorSummary);
  return null;
}

// ── Upload hero photo once ────────────────────────────────────────────────────
export async function uploadHeroPhoto(cast) {
  const heroChar = cast.find((c) => c.isHero) || cast[0];
  if (!heroChar) return null;

  let bestPhotoUri = null;
  const photos = heroChar.photos?.filter((p) => p.dataUri) || [];
  if (photos.length > 0) {
    const primaryIdx = heroChar.primaryPhotoIndex || 0;
    const goodPhotos = photos.filter((p) => p.quality === "good");
    const fairPhotos = photos.filter((p) => p.quality === "fair");
    if (goodPhotos.length > 0) {
      bestPhotoUri = (photos[primaryIdx]?.quality === "good" ? photos[primaryIdx] : goodPhotos[0]).dataUri;
    } else if (fairPhotos.length > 0) {
      bestPhotoUri = fairPhotos[0].dataUri;
    } else {
      bestPhotoUri = photos[primaryIdx]?.dataUri || photos[0].dataUri;
    }
  } else if (heroChar.photo) {
    bestPhotoUri = heroChar.photo;
  }

  if (!bestPhotoUri) return null;

  try {
    return await uploadPhoto(bestPhotoUri);
  } catch (err) {
    // Photo upload failed — falling back to text-only generation
    return null;
  }
}

// ── Generate cover image ──────────────────────────────────────────────────────
export async function generateCoverImage(coverScene, styleName, tier = "standard") {
  if (!coverScene) return null;
  const styleData = STYLES.find(s => s.name === styleName);
  const styleAnchor = styleData?.anchor || STYLES[0].anchor;
  const prompt = `${styleAnchor} A breathtaking wide establishing shot of ${coverScene}, cinematic composition, epic scale, no characters visible, pure world-building, evocative and magical, ${QUALITY_TAGS}`;

  try {
    const url = await generateImage(prompt, null, tier, styleName);
    const blobUrl = await cacheImageAsBlob(url);
    return blobUrl;
  } catch (err) {
    console.error("Cover image generation failed:", err.message);
    return null;
  }
}

// ── Concurrency-limited helper ──────────────────────────────────────────────
async function runWithConcurrency(tasks, limit = 2) {
  const results = new Array(tasks.length).fill(null);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      try {
        results[i] = await tasks[i]();
      } catch {
        results[i] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

// ── Generate ALL page images with concurrency limit ─────────────────────────
export async function generateAllImages(pages, cast, styleName, heroPhotoUrl, onPageImage, coverScene, worldVocab, toneLighting, tier = "standard") {
  // Cover runs independently — skip if coverScene is null (already generated externally)
  const coverPromise = coverScene
    ? generateCoverImage(coverScene, styleName, tier)
    : Promise.resolve(null);

  // Collect errors for diagnostics
  const pageErrors = [];

  // Build task array — each task is a function that returns a promise
  const tasks = pages.map((page, i) => {
    return async () => {
      const sceneDesc = page.scene_description || page.imagePrompt || page.text;
      const mood = page.mood || "wonder";

      try {
        const url = await generatePageImage(
          sceneDesc, cast, styleName, heroPhotoUrl,
          mood, worldVocab, toneLighting, tier
        );
        if (onPageImage) onPageImage(i, url);
        return url;
      } catch (err) {
        console.error(`Page ${i + 1} generation failed:`, err.message);
        pageErrors.push(`P${i + 1}: ${err.message}`);

        // Retry once after a short delay (catches transient 429s)
        try {
          await new Promise((r) => setTimeout(r, 3000));
          const retryUrl = await generatePageImage(
            sceneDesc, cast, styleName, heroPhotoUrl,
            mood, worldVocab, toneLighting, tier
          );
          if (onPageImage) onPageImage(i, retryUrl);
          return retryUrl;
        } catch (retryErr) {
          console.error(`Page ${i + 1} retry failed:`, retryErr.message);
          pageErrors.push(`P${i + 1} retry: ${retryErr.message}`);
          if (onPageImage) onPageImage(i, null);
          return null;
        }
      }
    };
  });

  // Run with concurrency limit of 2:
  // At most 2 Replicate predictions + 2 polling loops at a time = ~5 Vercel functions (safe)
  const pageImages = await runWithConcurrency(tasks, 2);
  const coverImageUrl = await coverPromise;

  const failCount = pageImages.filter((url) => url === null).length;
  if (failCount > 0) {
    console.error(`${failCount} of ${pages.length} illustrations failed. Errors:`, pageErrors.join(" | "));
  }

  if (pageImages.every((url) => url === null)) {
    const firstError = pageErrors[0] || "Unknown error";
    throw new Error(`All illustrations failed (${firstError}). Check browser console for details.`);
  }

  return { pageImages, coverImageUrl };
}

// ── Edit page text ────────────────────────────────────────────────────────────
export async function editPageText(currentText, instruction, cast) {
  const characterNames = cast.map((c) => c.name).join(", ");
  return claudeCall(
    "Edit a single children's book page. Return ONLY the new text — exactly 2-3 sentences, warm picture-book voice. No quotes or extra formatting.",
    `Current text: "${currentText}"\nInstruction: "${instruction}"\nCharacters: ${characterNames}`,
    200
  );
}
