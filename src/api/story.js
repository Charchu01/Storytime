import { claudeCall, generateImage, generateLoraImage, uploadPhoto } from "./client";
import { ROLES } from "../constants/data";

// ── Style anchors — prepended to EVERY prompt for that style ──────────────────
const STYLE_ANCHORS = {
  Storybook:
    "Classic children's picture book illustration, flat graphic style, bold clean outlines, warm saturated colors, expressive simplified cartoon face with large eyes, soft painterly background, professional picture book art quality, NOT photorealistic, NOT 3D rendered —",
  Watercolor:
    "Watercolor children's book illustration, loose painterly style, soft edges, visible brushstrokes, vibrant watercolor washes, expressive simplified character, white paper showing through, professional picture book watercolor art, NOT photorealistic, NOT digital-looking —",
  "Bold & Bright":
    "Modern children's book illustration, bold flat vector style, extremely vibrant colors, strong graphic shapes, thick outlines, highly expressive cartoon character, contemporary picture book aesthetic, inspired by modern award-winning picture books, NOT photorealistic, NOT muted —",
  "Cozy & Soft":
    "Soft cozy children's book illustration, rounded gentle shapes, pastel color palette, warm muted tones, plush toy aesthetic, soft lighting, gentle textures, expressive sweet character with rosy cheeks, professional bedtime storybook art, NOT harsh, NOT bright, NOT photorealistic —",
  "Sketch & Color":
    "Hand-drawn children's book illustration, pencil sketch style with color wash, visible linework, slightly rough edges, whimsical and charming character, loose ink outlines, watercolor color fills, professional picture book illustration quality, NOT digital-looking, NOT clean vectors —",
};

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

// ── World visual vocabularies ────────────────────────────────────────────────
const WORLD_VOCABULARY = {
  "Magical Forest": "ancient twisted trees, dappled golden sunlight, glowing mushrooms, fireflies, moss-covered stones, emerald greens and warm ambers",
  "Space Explorer": "cosmic purple and deep blue, stars and nebulae, metallic surfaces, curved futuristic architecture, lens flares",
  "Ocean Discovery": "turquoise and coral palette, underwater caustic light, bubbles, colourful fish, coral reef, bioluminescence",
  "Dragon Friends": "dramatic cliff faces, ember-glowing caves, vast skies with silhouetted wings, warm amber and deep crimson",
  "The Kingdom": "castle spires, banners, cobblestone paths, rolling green hills, golden crowns, royal purple and stone grey",
  "Enchanted Garden": "oversized flowers, hidden pathways, soft pastel petals, dew drops, butterfly wings, gentle morning light",
  "Dinosaur Island": "volcanic peaks, lush prehistoric jungle, massive fern fronds, ancient eggs, earth tones and vibrant greens",
  "Robot City": "gleaming chrome buildings, neon accent lights, friendly rounded robots, circuit patterns, cool blue and warm orange",
  "Magical Circus": "striped tent peaks, floating stars, trapeze silhouettes, confetti, bold red and gold and deep purple",
  "The Great Mountain": "snow-capped peaks, winding trails, alpine meadows, crystal-clear streams, sunrise golds and deep blues",
  "Dream World": "floating islands, impossible staircases, cotton-candy clouds, soft rainbow gradients, surreal gentle lighting",
  "Baking Kingdom": "candy-coloured buildings, frosting rivers, cookie paths, sugar crystal trees, warm pinks and creamy whites",
};

// ── Mood → lighting presets ───────────────────────────────────────────────────
const MOOD_LIGHTING = {
  wonder: "soft magical golden light, gentle god rays, sparkles",
  adventure: "dramatic dynamic lighting, strong shadows, energetic",
  cozy: "warm lamplight, soft glows, intimate and safe",
  tense: "cool dramatic shadows, high contrast, atmospheric",
  triumphant: "radiant warm sunlight, everything glowing, celebratory",
  tender: "soft diffused light, pastel tones, gentle and loving",
};

const TONE_LIGHTING = {
  "Cozy & Calming": "warm golden hour lighting, soft shadows, sunset palette",
  "Exciting & Dramatic": "dynamic lighting, high contrast, dramatic sky",
  "Warm & Heartfelt": "soft warm light, gentle tones, tender atmosphere",
  "Funny & Chaotic": "bright saturated colours, playful energy, exaggerated expressions",
};

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
      cost: type === "lora_train" ? 1.50 :
            type === "pulid" ? 0.04 :
            type === "lora_gen" ? 0.01 : 0,
      error: error || null,
    });
    localStorage.setItem("st_costs", JSON.stringify(log.slice(-200)));
  } catch {}
}

// ── Blob URL caching ──────────────────────────────────────────────────────────
export async function cacheImageAsBlob(url) {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const contentType = resp.headers.get("content-type");
    if (!contentType?.startsWith("image/")) return url;
    const blob = await resp.blob();
    if (blob.size > 15000000) return url;
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
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
  const styleAnchor = STYLE_ANCHORS[styleName] || STYLE_ANCHORS["Storybook"];
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
    `Ultra-wide cinematic panoramic illustration for a double-page picture book spread.`,
    `Rich detailed environment filling the entire frame:`,
    sceneDescription,
    `The main character is ${characterRef}.`,
    `Show the character full-body at medium distance in the left-center of the frame, roughly 25-35% of the frame height, naturally placed within the scene.`,
    `The right half of the image continues the same rich environment with beautiful atmospheric depth, environmental storytelling, lush detailed scenery.`,
    `NEVER a close-up, NEVER a portrait, NEVER a headshot. Show expansive landscape with detailed foreground, middleground, and deep background.`,
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

{"title":"Story title (creative, evocative, 3-6 words)","coverScene":"A breathtaking wide establishing shot description of the story world — epic scale, no characters visible, pure world-building","coverEmoji":"Single emoji representing the story world","pages":[{"pageNumber":1,"text":"The story text for this page. 2-4 sentences.","scene_description":"A detailed WIDE or MEDIUM SHOT illustration description.","scene_emoji":"Single emoji for this scene","mood":"One of: wonder, adventure, cozy, tense, triumphant, tender","characters_present":["Name1","Name2"]}]}

Story writing rules:
* Exactly ${storyData.pageCount || 6} pages
* Each page ends at a moment that compels turning the page
* Use the character's name often
* Include sensory details: what things look, sound, smell, and feel like
* The story should have a clear arc: setup, adventure, challenge, resolution, warm ending
* The ending should feel earned and warm
${storyData.personalIngredient ? `* PRIORITY: Weave this personal detail into the emotional core of the story: "${storyData.personalIngredient}"` : ""}
${storyData.storyLesson ? `* Lesson "${storyData.storyLesson}" must emerge naturally — NEVER stated directly.` : ""}
${storyData.storyFormat === "rhyming" ? "* Write in strict AABB rhyme scheme. 8-10 syllables per line." : ""}
${storyData.storyFormat === "funny" ? "* Every page needs a genuine surprise. Setup on one page, punchline on the next." : ""}

Illustration rules:
* Wide establishing shots for big moments, medium shots for emotional moments
* Always show the character IN the world, not isolated
* Each page's characters_present must list which characters are visible in that scene
* The character should be 30-40% of frame height, never filling the whole image

Return ONLY valid JSON. No preamble. No markdown code blocks. Just the raw JSON object.`;

  const userPrompt = `Cast: ${characterDescriptions}
${appearanceNotes ? `\nCharacter Appearances:\n${appearanceNotes}\n` : ""}
Hero: ${storyData.hero}
Story theme: ${storyData.spark}
They love: ${storyData.loves}
Mood: ${storyData.mood}
${storyData.storyWorld ? `World: ${storyData.storyWorld}` : ""}
${storyData.storyTone ? `Tone: ${storyData.storyTone}` : ""}
Art style: ${styleName}`;

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

// ── Generate a single page image with fallback chain ────────────────────────
export async function generatePageImage(sceneDescription, cast, styleName, heroPhotoUrl, mood, worldVocab, toneLighting) {
  const prompt = buildScenePrompt(sceneDescription, cast, styleName, mood || "wonder", worldVocab, toneLighting);
  const startTime = Date.now();

  // ATTEMPT 1: Primary model
  try {
    const url = await generateImage(prompt, heroPhotoUrl, !!heroPhotoUrl);
    if (await validateImageUrl(url)) {
      const blobUrl = await cacheImageAsBlob(url);
      logCost("pulid", "primary", true, Date.now() - startTime, null);
      return blobUrl;
    }
  } catch (err) {
    // Primary attempt failed — trying fallback
  }

  // ATTEMPT 2: Retry with different approach (no face ref)
  try {
    const url = await generateImage(prompt, null, false);
    if (await validateImageUrl(url)) {
      const blobUrl = await cacheImageAsBlob(url);
      logCost("pulid", "retry_no_face", true, Date.now() - startTime, null);
      return blobUrl;
    }
  } catch (err) {
    // Fallback attempt also failed
  }

  // ATTEMPT 3: Return null (will show styled fallback in UI)
  logCost("pulid", "all_failed", false, Date.now() - startTime, "All attempts failed");
  return null;
}

// ── Generate a Premium page image using LoRA ──────────────────────────────────
export async function generatePremiumPageImage(sceneDescription, cast, styleName, loraUrl, triggerWord, mood, worldVocab, toneLighting) {
  const prompt = buildScenePrompt(sceneDescription, cast, styleName, mood || "wonder", worldVocab, toneLighting);
  const startTime = Date.now();

  try {
    const url = await generateLoraImage(prompt, loraUrl, triggerWord);
    if (await validateImageUrl(url)) {
      const blobUrl = await cacheImageAsBlob(url);
      logCost("lora_gen", loraUrl, true, Date.now() - startTime, null);
      return blobUrl;
    }
  } catch (err) {
    // Premium gen failed — falling back to standard
  }

  // Fallback to standard
  return generatePageImage(sceneDescription, cast, styleName, null, mood, worldVocab, toneLighting);
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
export async function generateCoverImage(coverScene, styleName) {
  if (!coverScene) return null;
  const styleAnchor = STYLE_ANCHORS[styleName] || STYLE_ANCHORS["Storybook"];
  const prompt = `${styleAnchor} A breathtaking wide establishing shot of ${coverScene}, cinematic composition, epic scale, no characters visible, pure world-building, evocative and magical, ${QUALITY_TAGS}`;

  try {
    const url = await generateImage(prompt, null);
    const blobUrl = await cacheImageAsBlob(url);
    return blobUrl;
  } catch (err) {
    // Cover generation is non-critical
    return null;
  }
}

// ── Generate ALL page images in parallel ──────────────────────────────────────
export async function generateAllImages(pages, cast, styleName, heroPhotoUrl, onPageImage, coverScene, worldVocab, toneLighting) {
  const coverPromise = generateCoverImage(coverScene, styleName);

  // Generate ALL pages in parallel
  const pagePromises = pages.map((page, i) => {
    const sceneDesc = page.scene_description || page.imagePrompt || page.text;
    const mood = page.mood || "wonder";
    return generatePageImage(sceneDesc, cast, styleName, heroPhotoUrl, mood, worldVocab, toneLighting)
      .then((url) => {
        if (onPageImage) onPageImage(i, url);
        return url;
      })
      .catch((err) => {
        // Page image failed — will show styled fallback
        if (onPageImage) onPageImage(i, null);
        return null;
      });
  });

  const pageImages = await Promise.all(pagePromises);
  const coverImageUrl = await coverPromise;

  if (pageImages.every((url) => url === null)) {
    throw new Error("All illustrations failed. Please try again.");
  }

  return { pageImages, coverImageUrl };
}

// ── Generate ALL Premium page images ─────────────────────────────────────────
export async function generateAllPremiumImages(pages, cast, styleName, loraUrl, triggerWord, onPageImage, coverScene, worldVocab, toneLighting) {
  const coverPromise = generateCoverImage(coverScene, styleName);

  const pagePromises = pages.map((page, i) => {
    const sceneDesc = page.scene_description || page.imagePrompt || page.text;
    const mood = page.mood || "wonder";
    return generatePremiumPageImage(sceneDesc, cast, styleName, loraUrl, triggerWord, mood, worldVocab, toneLighting)
      .then((url) => {
        if (onPageImage) onPageImage(i, url);
        return url;
      })
      .catch((err) => {
        // Premium page image failed — will show styled fallback
        if (onPageImage) onPageImage(i, null);
        return null;
      });
  });

  const pageImages = await Promise.all(pagePromises);
  const coverImageUrl = await coverPromise;

  if (pageImages.every((url) => url === null)) {
    throw new Error("All illustrations failed. Please try again.");
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
