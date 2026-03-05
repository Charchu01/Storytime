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

// ── Mood → lighting presets ───────────────────────────────────────────────────
const MOOD_LIGHTING = {
  wonder: "soft magical golden light, gentle god rays, sparkles",
  adventure: "dramatic dynamic lighting, strong shadows, energetic",
  cozy: "warm lamplight, soft glows, intimate and safe",
  tense: "cool dramatic shadows, high contrast, atmospheric",
  triumphant: "radiant warm sunlight, everything glowing, celebratory",
  tender: "soft diffused light, pastel tones, gentle and loving",
};

// ── Quality tags appended to every prompt ─────────────────────────────────────
const QUALITY_TAGS =
  "children's picture book quality, highly detailed illustration, award-winning picture book style, no text in image, no words, no letters, no watermarks";

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

      // Include the rich appearance description from photo analysis
      if (character.appearanceDescription) {
        parts.push(`— ${character.appearanceDescription}`);
      }

      if (character.isHero) parts.push("(main character)");
      return parts.join(" ");
    })
    .join("; ");
}

// ── Build the panoramic spread prompt for a scene ─────────────────────────────
function buildScenePrompt(sceneDescription, cast, styleName, mood) {
  const styleAnchor = STYLE_ANCHORS[styleName] || STYLE_ANCHORS["Storybook"];
  const lighting = MOOD_LIGHTING[mood] || MOOD_LIGHTING["wonder"];

  // Build detailed character appearance for the image prompt
  const hero = cast.find((c) => c.isHero) || cast[0];
  const heroAppearance = hero?.appearanceDescription || "";
  const heroAge = hero?.age ? `${hero.age}-year-old` : "young";
  const heroName = hero?.name || "the child";

  // Compact character reference for the image prompt
  const characterRef = heroAppearance
    ? `${heroAge} child: ${heroAppearance}`
    : `a ${heroAge} child named ${heroName}`;

  // Ultra-wide panoramic composition for double-page spread
  // Scene/environment FIRST, character secondary, explicit anti-portrait
  return [
    styleAnchor,
    `Ultra-wide cinematic panoramic illustration for a double-page picture book spread.`,
    `Rich detailed environment filling the entire frame:`,
    sceneDescription,
    `The main character is ${characterRef}.`,
    `Show the character full-body at medium distance in the left-center of the frame, roughly 25-35% of the frame height, naturally placed within the scene.`,
    `The right half of the image continues the same rich environment with beautiful atmospheric depth, environmental storytelling, lush detailed scenery.`,
    `NEVER a close-up, NEVER a portrait, NEVER a headshot. Show expansive landscape with detailed foreground, middleground, and deep background.`,
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
    console.error("Failed to analyze character photo:", err);
    return null;
  }
}

export async function analyzeCharacterPhotos(cast) {
  const enrichedCast = await Promise.all(
    cast.map(async (character) => {
      const photos = character.photos?.filter((p) => p.dataUri) || [];
      // Fall back to single photo field for backward compat
      if (photos.length === 0 && character.photo) {
        const description = await analyzeCharacterPhotos_single(character, character.photo);
        return description ? { ...character, appearanceDescription: description } : character;
      }
      if (photos.length === 0) return character;

      // Analyze ALL photos for a richer description
      if (photos.length === 1) {
        const description = await analyzeCharacterPhotos_single(character, photos[0].dataUri);
        return description ? { ...character, appearanceDescription: description } : character;
      }

      // Multiple photos: analyze the best one in detail, note features from others
      const primaryIdx = character.primaryPhotoIndex || 0;
      const primaryPhoto = photos[primaryIdx] || photos[0];
      const otherPhotos = photos.filter((_, i) => i !== primaryIdx);

      // Analyze primary photo
      const primaryDesc = await analyzeCharacterPhotos_single(character, primaryPhoto.dataUri);

      // Analyze one additional photo for supplementary details (different angle)
      let supplementDesc = null;
      if (otherPhotos.length > 0) {
        // Pick the best quality supplementary photo
        const bestOther = otherPhotos.find((p) => p.quality === "good") || otherPhotos[0];
        supplementDesc = await analyzeCharacterPhotos_single(character, bestOther.dataUri);
      }

      // Merge descriptions
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

  const systemPrompt = `You are Stori, a magical children's book author and illustrator. You create personalized picture books for families.

You will receive information about the main character(s) — their name, age, personality, and physical description. You will also receive the story theme, mood, and length.

Generate a complete picture book with this exact JSON structure:

{"title":"Story title (creative, evocative, 3-6 words)","coverScene":"A breathtaking wide establishing shot description of the story world — epic scale, no characters visible, pure world-building, the kind of image that makes a child gasp","coverEmoji":"Single emoji representing the story world","pages":[{"text":"The story text for this page. 2-4 sentences. Warm, vivid, age-appropriate. Written in third person. Include the character name naturally. End each page at a moment of anticipation or discovery.","scene_description":"A detailed description of a WIDE or MEDIUM SHOT illustration for this page. Describe the full scene as if directing an illustrator: the character doing something specific in a rich environment, their emotional expression, the atmosphere, the lighting. The character should occupy 20-40% of the frame surrounded by the world they inhabit. NEVER describe a close-up or portrait. NEVER describe the character just standing still. Make the scene tell the story visually even without words.","scene_emoji":"Single emoji representing this page scene","mood":"One of: wonder, adventure, cozy, tense, triumphant, tender"}]}

Story writing rules:
* Exactly ${storyData.pageCount || 5} pages
* Each page ends at a moment that makes you want to turn to the next page
* Use the character's name often — it feels magical to hear your own name in a story
* Include sensory details: what things look, sound, smell, and feel like
* The world should feel vast and real
* The character should show growth and courage
* The ending should feel earned and warm
* Make it magical, age-appropriate, and emotionally resonant
* The story should have a clear arc: setup, adventure, challenge, resolution, warm ending

Illustration description rules:
* Think like a professional picture book illustrator describing their next painting
* Wide establishing shots for big moments
* Medium shots for emotional character moments
* Always show the character IN the world, not isolated against a plain background
* Include other story elements: creatures, objects, weather, architecture, nature
* Color and light should match the mood
* The composition should naturally draw the eye from the illustration into the text
* Include: environment details, lighting, atmosphere, weather/time of day, foreground and background elements, character's body language and actions, clothing colors
* The character should be roughly 30-40% of the frame height, never filling the whole image

Return ONLY valid JSON. No preamble. No markdown code blocks. Just the raw JSON object.`;

  const userPrompt = `Cast: ${characterDescriptions}
${appearanceNotes ? `\nCharacter Appearances:\n${appearanceNotes}\n` : ""}
Hero: ${storyData.hero}
Story theme: ${storyData.spark}
They love: ${storyData.loves}
Mood: ${storyData.mood}
Art style: ${styleName}`;

  const maxTokens = (storyData.pageCount || 5) > 6 ? 3000 : 1800;
  const raw = await claudeCall(systemPrompt, userPrompt, maxTokens);

  let parsed;
  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse story response. Please try again.");
  }

  if (!parsed.title || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error("Invalid story structure returned. Please try again.");
  }

  return parsed;
}

// ── Generate a single page image ──────────────────────────────────────────────
// Uses flux-1.1-pro-ultra with detailed text descriptions (most reliable).
// The character appearance from photo analysis is baked into the prompt.
export async function generatePageImage(sceneDescription, cast, styleName, heroPhotoUrl, mood) {
  const prompt = buildScenePrompt(sceneDescription, cast, styleName, mood || "wonder");
  // Use text-only generation — character appearance is in the prompt from photo analysis.
  // This produces better illustration-style results than face-reference models.
  return generateImage(prompt, null, false);
}

// ── Generate a Premium page image using LoRA ──────────────────────────────────
export async function generatePremiumPageImage(sceneDescription, cast, styleName, loraUrl, triggerWord, mood) {
  const prompt = buildScenePrompt(sceneDescription, cast, styleName, mood || "wonder");
  return generateLoraImage(prompt, loraUrl, triggerWord);
}

// ── Upload hero photo once ────────────────────────────────────────────────────
export async function uploadHeroPhoto(cast) {
  const heroChar = cast.find((c) => c.isHero) || cast[0];
  if (!heroChar) return null;

  // Pick the best photo: prefer primary from photos array, fall back to single photo field
  let bestPhotoUri = null;
  const photos = heroChar.photos?.filter((p) => p.dataUri) || [];
  if (photos.length > 0) {
    const primaryIdx = heroChar.primaryPhotoIndex || 0;
    // Prefer good quality, then fair, avoid poor
    const goodPhotos = photos.filter((p) => p.quality === "good");
    const fairPhotos = photos.filter((p) => p.quality === "fair");
    if (goodPhotos.length > 0) {
      // Use the primary if it's good, otherwise first good
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
    console.error("Failed to upload hero photo, falling back to text-only:", err);
    return null;
  }
}

// ── Generate cover image ──────────────────────────────────────────────────────
export async function generateCoverImage(coverScene, styleName) {
  if (!coverScene) return null;
  const styleAnchor = STYLE_ANCHORS[styleName] || STYLE_ANCHORS["Storybook"];
  const prompt = `${styleAnchor} A breathtaking wide establishing shot of ${coverScene}, cinematic composition, epic scale, no characters visible, pure world-building, evocative and magical, ${QUALITY_TAGS}`;

  try {
    // Cover has no character face, so no referencePhotoUrl
    return await generateImage(prompt, null);
  } catch (err) {
    console.error("Cover image generation failed:", err);
    return null;
  }
}

// ── Generate ALL page images in batches ──────────────────────────────────────
const BATCH_SIZE = 3; // Max concurrent image requests to avoid rate limiting

export async function generateAllImages(pages, cast, styleName, heroPhotoUrl, onPageImage, coverScene) {
  // Start cover generation (runs alongside batches)
  const coverPromise = generateCoverImage(coverScene, styleName);

  // Generate page images in batches of BATCH_SIZE to avoid Replicate rate limits
  const pageImages = new Array(pages.length).fill(null);

  for (let batchStart = 0; batchStart < pages.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, pages.length);
    const batchPromises = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const page = pages[i];
      const sceneDesc = page.scene_description || page.imagePrompt || page.text;
      const mood = page.mood || "wonder";
      batchPromises.push(
        generatePageImage(sceneDesc, cast, styleName, heroPhotoUrl, mood)
          .then((url) => {
            pageImages[i] = url;
            if (onPageImage) onPageImage(i, url);
          })
          .catch((err) => {
            console.error(`Failed to generate image for page ${i + 1}:`, err);
            pageImages[i] = null;
            if (onPageImage) onPageImage(i, null);
          })
      );
    }

    await Promise.all(batchPromises);
  }

  const coverImageUrl = await coverPromise;

  // If ALL page images failed, throw
  if (pageImages.every((url) => url === null)) {
    throw new Error("All illustrations failed. Please try again.");
  }

  return { pageImages, coverImageUrl };
}

// ── Generate ALL Premium page images in batches ─────────────────────────────
export async function generateAllPremiumImages(pages, cast, styleName, loraUrl, triggerWord, onPageImage, coverScene) {
  const coverPromise = generateCoverImage(coverScene, styleName);

  const pageImages = new Array(pages.length).fill(null);

  for (let batchStart = 0; batchStart < pages.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, pages.length);
    const batchPromises = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const page = pages[i];
      const sceneDesc = page.scene_description || page.imagePrompt || page.text;
      const mood = page.mood || "wonder";
      batchPromises.push(
        generatePremiumPageImage(sceneDesc, cast, styleName, loraUrl, triggerWord, mood)
          .then((url) => {
            pageImages[i] = url;
            if (onPageImage) onPageImage(i, url);
          })
          .catch((err) => {
            console.error(`Failed to generate premium image for page ${i + 1}:`, err);
            pageImages[i] = null;
            if (onPageImage) onPageImage(i, null);
          })
      );
    }

    await Promise.all(batchPromises);
  }

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
