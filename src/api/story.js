import { claudeCall, generateImage, uploadPhoto } from "./client";
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

      if (character.appearanceDescription) {
        parts.push(character.appearanceDescription);
      } else {
        const ageDesc = character.age ? `${character.age}-year-old` : "";
        if (character.role === "pet") {
          parts.push(`a pet named ${character.name}`);
        } else if (character.role === "baby") {
          parts.push(`a baby named ${character.name}`);
        } else {
          parts.push(`${ageDesc} ${role.toLowerCase()} named ${character.name}`.trim());
        }
      }

      if (character.isHero) parts.push("(main character)");
      return parts.join(" ");
    })
    .join("; ");
}

// ── Build the 6-part prompt for a scene ───────────────────────────────────────
function buildScenePrompt(sceneDescription, cast, styleName, mood) {
  const styleAnchor = STYLE_ANCHORS[styleName] || STYLE_ANCHORS["Storybook"];
  const characterDesc = buildDetailedCharacterPrompt(cast);
  const lighting = MOOD_LIGHTING[mood] || MOOD_LIGHTING["wonder"];

  // PART 1: Style anchor
  // PART 2: Character description
  // PART 3: Scene action (from scene_description)
  // PART 4+5: Environment + mood lighting
  // PART 6: Quality tags
  return `${styleAnchor} The main character is ${characterDesc}, ${sceneDescription}, ${lighting}, ${QUALITY_TAGS}`;
}

// ── Analyze character photos ──────────────────────────────────────────────────
async function analyzeCharacterPhotos_single(character, photoDataUri) {
  const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
  const ageNote = character.age ? `, approximately ${character.age} years old` : "";

  try {
    const description = await claudeCall(
      `You are helping create consistent character illustrations for a children's storybook. Analyze this person's photo and write a concise visual description (2-3 sentences) that an illustrator could use to draw them consistently across multiple pages. Focus on: hair color/style, skin tone, eye color, facial features, build/height, and any distinctive features. Do NOT include clothing (they'll wear different outfits in the story). Write in third person. Be specific about colors and features.`,
      `This is ${character.name}, a ${role}${ageNote}. Please describe their physical appearance for an illustrator.`,
      300,
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
export async function generatePageImage(sceneDescription, cast, styleName, heroPhotoUrl, mood) {
  const prompt = buildScenePrompt(sceneDescription, cast, styleName, mood || "wonder");
  return generateImage(prompt, heroPhotoUrl || null);
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

// ── Generate ALL page images in PARALLEL ──────────────────────────────────────
export async function generateAllImages(pages, cast, styleName, heroPhotoUrl, onPageImage, coverScene) {
  // Start cover generation
  const coverPromise = generateCoverImage(coverScene, styleName);

  // Fire ALL page image requests in parallel
  const pagePromises = pages.map((page, i) => {
    const sceneDesc = page.scene_description || page.imagePrompt || page.text;
    const mood = page.mood || "wonder";
    return generatePageImage(sceneDesc, cast, styleName, heroPhotoUrl, mood)
      .then((url) => {
        // Notify as each image arrives
        if (onPageImage) onPageImage(i, url);
        return url;
      })
      .catch((err) => {
        console.error(`Failed to generate image for page ${i + 1}:`, err);
        if (onPageImage) onPageImage(i, null);
        return null;
      });
  });

  // Wait for all in parallel
  const [coverImageUrl, ...pageImages] = await Promise.all([
    coverPromise,
    ...pagePromises,
  ]);

  // If ALL page images failed, throw
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
