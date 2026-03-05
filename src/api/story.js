import { claudeCall, generateImage, uploadPhoto } from "./client";
import { ROLES, STYLES } from "../constants/data";

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

// ── Nano Banana Pro style descriptions ───────────────────────────────────────
const NANO_STYLES = {
  "Storybook": "classic children's storybook illustration with bold saturated colours, clean outlines, and warm painterly backgrounds",
  "Watercolor": "soft watercolour children's book illustration with visible brushstrokes, dreamy washes, and gentle colour bleeds",
  "Bold & Bright": "modern vibrant children's book illustration with thick bold outlines, flat graphic colours, and playful energy",
  "Cozy & Soft": "gentle pastel children's bedtime book illustration with rounded shapes, soft muted tones, and cozy warmth",
  "Sketch & Color": "whimsical hand-drawn children's book illustration with visible pencil lines, loose ink outlines, and watercolour wash fills",
};

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
      cost: type === "nano_banana" ? 0.045 :
            type === "kontext" ? 0.04 :
            type === "flux" ? 0.04 : 0,
      error: error || null,
    });
    localStorage.setItem("st_costs", JSON.stringify(log.slice(-200)));
  } catch {}
}

// ── Image URL passthrough ────────────────────────────────────────────────────
export async function cacheImageAsBlob(url) {
  return url || null;
}

// ── Image validation ──────────────────────────────────────────────────────────
async function validateImageUrl(url) {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  try {
    const resp = await fetch(url, { method: "HEAD" });
    if (!resp.ok) return false;
    const ct = resp.headers.get("content-type");
    if (ct && !ct.startsWith("image/")) return false;
    return true;
  } catch {
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

// ── Cover prompt builder ─────────────────────────────────────────────────────
function buildCoverPrompt(coverScene, styleName, title, heroName, authorName) {
  const styleDesc = NANO_STYLES[styleName] || NANO_STYLES["Storybook"];

  return `Generate a professional children's picture book FRONT COVER.

This is a single portrait-oriented book cover, NOT an interior page.

LAYOUT:
- Full illustrated background filling the entire cover
- Title "${title}" in large, warm, hand-lettered storybook style at the top third
- "A story for ${heroName}" in elegant smaller text below the title
- "By ${authorName}" at the bottom in small text
- All text must be clearly legible against the illustration

ILLUSTRATION:
- Scene: ${coverScene}
- No characters visible — pure world-building establishing shot
- Epic cinematic scale, magical and inviting

STYLE:
- ${styleDesc}
- The kind of cover that makes a child reach for the book
- Award-winning picture book cover quality
- NOT photorealistic — fully illustrated

This sets the art style for the ENTIRE book. Every subsequent page will match this exact illustration style.`;
}

// ── Page prompt builder ──────────────────────────────────────────────────────
function buildPagePrompt(sceneDescription, styleName, mood, pageIndex, pageNum, emoji, pageText) {
  const styleDesc = NANO_STYLES[styleName] || NANO_STYLES["Storybook"];

  const words = sceneDescription.split(/\s+/);
  const scene = words.length > 40
    ? words.slice(0, 40).join(" ")
    : sceneDescription;

  return `Create the next page of a children's storybook illustration that perfectly matches the exact art style, colours, lighting, brush style, character design, and page layout of the previously uploaded reference images.

Use the reference images so the main character looks exactly the same as in previous pages. Maintain consistent character proportions, facial features, clothing, and illustration style so the entire book feels like it was illustrated by the same artist.

SCENE: ${scene}

The main character is the person from Image 1 (the uploaded photo). Transform them into an illustrated storybook character — NOT photorealistic. Show them naturally in the scene. Keep their exact facial features and identity from the photo.

STYLE:
- ${styleDesc}
- Match the EXACT illustration style of Image 2 (the cover) — same colours, line work, brush style
- Award-winning children's picture book quality
- Soft painterly textures, warm lighting, gentle magical atmosphere
- Same colour palette and illustration style as the previous pages

PAGE TEXT: Leave clear space for story text at the bottom of the page. Render the following text in decorative storybook text boxes with ornate borders, elegant serif font, warm cream/parchment background behind the text. Use the same text box style consistently. Split the text across one or two text boxes as needed for readability:

"${pageText}"

Page ${pageNum}

CONSTRAINTS:
- The text must be rendered clearly and legibly — no spelling errors
- Text boxes should feel like a natural part of the page design
- The illustration fills the full page with the text integrated at the bottom
- This must look like a page from a real printed children's storybook`;
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
    const jsonMatch = raw.match(/```json?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
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

// ── Generate a single page image (fallback for edits) ────────────────────────
export async function generatePageImage(sceneDescription, cast, styleName, heroPhotoUrl, mood) {
  const styleDesc = NANO_STYLES[styleName] || NANO_STYLES["Storybook"];
  const prompt = `Children's storybook illustration in ${styleDesc} style. ${sceneDescription}. Award-winning picture book quality, no text in image.`;

  const startTime = Date.now();

  if (heroPhotoUrl) {
    try {
      const url = await generateImage(prompt, heroPhotoUrl, "standard", styleName);
      if (await validateImageUrl(url)) {
        logCost("nano_banana", "standard", true, Date.now() - startTime, null);
        return url;
      }
    } catch (err) {
      console.warn("Face-ref generation failed:", err.message);
    }
  }

  try {
    const url = await generateImage(prompt, null, "standard", styleName);
    if (await validateImageUrl(url)) {
      logCost("flux", "no_face", true, Date.now() - startTime, null);
      return url;
    }
  } catch (err) {
    console.error("All image attempts failed:", err.message);
  }

  logCost("all", "failed", false, Date.now() - startTime, "all attempts failed");
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
    return null;
  }
}

// ── Generate cover image ──────────────────────────────────────────────────────
export async function generateCoverImage(
  coverScene, styleName, tier, title, heroName, authorName, heroPhotoUrl
) {
  if (!coverScene) return null;

  const prompt = buildCoverPrompt(
    coverScene, styleName,
    title || "My Story",
    heroName || "a special child",
    authorName || "A loving family"
  );

  try {
    const url = await generateImage(
      prompt,
      heroPhotoUrl || null,
      tier,
      styleName,
      [],
      "3:4",
      true
    );
    return url;
  } catch (err) {
    console.warn("Cover generation failed:", err.message);
    return null;
  }
}

// ── Generate ALL page images — sequential chained flow ───────────────────────
// Each page includes the PREVIOUS page's output as a reference image,
// creating a chain that maintains consistent style across the entire book.
// The cover acts as a permanent "style anchor."
export async function generateAllImagesChained(
  pages, cast, styleName, heroPhotoUrl,
  onPageImage, coverImageUrl, tier
) {
  if (!heroPhotoUrl) {
    return generateAllImagesFallback(pages, cast, styleName, tier, onPageImage);
  }

  const pageImages = [];
  let previousPageUrl = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const sceneDesc = page.scene_description || page.imagePrompt || page.text;
    const mood = page.mood || "wonder";
    const emoji = page.scene_emoji || "✨";
    const pageNum = i + 1;

    const prompt = buildPagePrompt(
      sceneDesc, styleName, mood, i, pageNum, emoji,
      page.text || ""
    );

    // Build reference images: cover (style anchor) + previous page (local consistency)
    const referenceImageUrls = [];
    if (coverImageUrl) referenceImageUrls.push(coverImageUrl);
    if (previousPageUrl) referenceImageUrls.push(previousPageUrl);

    try {
      const url = await generateImage(
        prompt,
        heroPhotoUrl,
        tier,
        styleName,
        referenceImageUrls,
        "3:4",
        false
      );

      if (url && await validateImageUrl(url)) {
        pageImages.push(url);
        previousPageUrl = url;
        if (onPageImage) onPageImage(i, url);
        logCost("nano_banana", tier, true, 0, null);
      } else {
        throw new Error("Invalid image URL");
      }
    } catch (err) {
      console.warn(`Page ${i + 1} failed:`, err.message);

      // Retry once with 3s delay
      try {
        await new Promise(r => setTimeout(r, 3000));
        const retryUrl = await generateImage(
          prompt, heroPhotoUrl, tier, styleName,
          referenceImageUrls, "3:4", false
        );
        if (retryUrl && await validateImageUrl(retryUrl)) {
          pageImages.push(retryUrl);
          previousPageUrl = retryUrl;
          if (onPageImage) onPageImage(i, retryUrl);
        } else {
          pageImages.push(null);
          if (onPageImage) onPageImage(i, null);
        }
      } catch (retryErr) {
        console.warn(`Page ${i + 1} retry failed:`, retryErr.message);
        pageImages.push(null);
        if (onPageImage) onPageImage(i, null);
      }
    }
  }

  const failCount = pageImages.filter(url => url === null).length;
  if (failCount > 0) {
    console.warn(`${failCount} of ${pages.length} illustrations failed`);
  }
  if (pageImages.every(url => url === null)) {
    throw new Error("All illustrations failed. Please try again.");
  }

  return { pageImages, coverImageUrl };
}

// ── Fallback: generate without chaining (no hero photo) ──────────────────────
async function generateAllImagesFallback(pages, cast, styleName, tier, onPageImage) {
  const styleDesc = NANO_STYLES[styleName] || NANO_STYLES["Storybook"];
  const pageImages = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const sceneDesc = page.scene_description || page.text;
    const prompt = `Children's storybook illustration in ${styleDesc} style. ${sceneDesc}. Full page illustration with story text "${page.text}" rendered in decorative text boxes at the bottom. Award-winning picture book quality.`;

    try {
      const url = await generateImage(prompt, null, tier, styleName, [], "3:4", false);
      if (url && await validateImageUrl(url)) {
        pageImages.push(url);
        if (onPageImage) onPageImage(i, url);
      } else {
        pageImages.push(null);
        if (onPageImage) onPageImage(i, null);
      }
    } catch (err) {
      console.warn(`Page ${i + 1} fallback failed:`, err.message);
      pageImages.push(null);
      if (onPageImage) onPageImage(i, null);
    }
  }

  if (pageImages.every(url => url === null)) {
    throw new Error("All illustrations failed. Please try again.");
  }

  return { pageImages, coverImageUrl: null };
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
