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

// ── Page layout types ────────────────────────────────────────────────────────
export const PAGE_LAYOUTS = {
  "full-portrait": {
    aspect: "3:4",
    desc: "ONE full-page portrait illustration filling the entire page. The scene is rich and detailed with the character(s) naturally placed. Text box(es) at the bottom.",
  },
  "two-panel": {
    aspect: "4:3",
    desc: "TWO side-by-side illustrated panels on an open book spread, divided by a subtle page crease/spine down the centre. Each panel shows a different moment or scene. Each panel has its own text box at the bottom. The left panel is one scene, the right panel is the next moment in the story.",
  },
  "wide-cinematic": {
    aspect: "16:9",
    desc: "ONE wide cinematic landscape illustration stretching across both open pages of the book. The scene is epic and expansive. Text box(es) at the bottom, spanning the width.",
  },
};

// ── Layer 1: CHARACTER DNA (generated ONCE, used on EVERY page) ──────────────
function buildCharacterDNA(cast, heroName, heroAge, tone, personalIngredient) {
  const hero = cast.find(c => c.isHero) || cast[0];
  const supporting = cast.filter(c => !c.isHero);

  let dna = `CHARACTER BIBLE (apply to ALL pages):\nMAIN CHARACTER: ${heroName}`;

  if (heroAge) {
    dna += `, ${heroAge} years old`;
    if (heroAge <= 3) dna += `. Toddler proportions — large head, chubby cheeks, short limbs, round belly.`;
    else if (heroAge <= 6) dna += `. Young child proportions — round face, big expressive eyes, small stature.`;
    else if (heroAge <= 10) dna += `. Older child proportions — longer limbs, more defined features, confident posture.`;
    else dna += `. Adolescent proportions.`;
  }

  dna += `
- ${heroName} is the person from the uploaded photo (Image 1)
- Transform into an illustrated storybook character — NOT photorealistic
- Keep their EXACT facial features, head shape, and distinguishing features
- ${heroName} should be recognizable on every single page
- Characters can and should be seen from DIFFERENT angles and distances across pages — close-ups, medium shots, wide shots — but their identity, proportions, and clothing must remain consistent`;

  if (supporting.length > 0) {
    dna += `\n\nSUPPORTING CAST:`;
    supporting.forEach(c => {
      const roleLabel = c.role === 'mom' ? 'Mother figure' :
                        c.role === 'dad' ? 'Father figure' :
                        c.role === 'sibling' ? 'Sibling' :
                        c.role === 'pet' ? 'Family pet' :
                        c.role === 'grandparent' ? 'Grandparent' :
                        c.role === 'friend' ? 'Best friend' : c.role;
      dna += `\n- ${c.name}: ${roleLabel}. Must look the same on every page they appear — same hair, same build, same clothing style.`;
    });
  }

  if (personalIngredient) {
    dna += `\n\nEMOTIONAL CORE: This story is personally meaningful because: "${personalIngredient}". Illustrations should subtly reflect this emotional thread.`;
  }

  return dna;
}

// ── Layer 2: BOOK IDENTITY (generated ONCE, used on EVERY page) ──────────────
function buildBookIdentity(styleName, tone, format) {
  const styleDesc = NANO_STYLES[styleName] || NANO_STYLES["Storybook"];

  const toneMap = {
    "Cozy":       "Warm golden-hour lighting, soft glowing lamps, long gentle shadows, amber and honey tones. Feels like being wrapped in a blanket.",
    "Exciting":   "Dynamic dramatic lighting, bold contrasts, high energy, vivid saturated colours. Feels like the best part of a movie.",
    "Heartfelt":  "Soft diffused light, pastel warmth, gentle lens flare, intimate close framing. Feels like a warm hug.",
    "Funny":      "Bright playful lighting, exaggerated expressions, saturated candy colours, slightly cartoonish proportions. Feels like laughing until your belly hurts.",
  };
  const atmosphere = toneMap[tone] || toneMap["Cozy"];

  const formatMap = {
    "classic":  "Text in elegant decorative text boxes with ornate scroll borders, warm cream parchment background, classic serif font.",
    "rhyming":  "Text in whimsical decorative text boxes with playful curving borders, warm cream background, slightly italic serif font that flows like poetry.",
    "funny":    "Text in fun decorative text boxes with bouncy rounded borders, warm cream background, friendly serif font with personality.",
  };
  const textStyle = formatMap[format] || formatMap["classic"];

  return `BOOK IDENTITY (apply to EVERY page):

ART STYLE: ${styleDesc}
- This style must be IDENTICAL on every page — same brush strokes, same colour palette, same line weight, same level of detail
- Match the EXACT illustration style of the cover image (Image 2)
- This must look like a real professionally published children's picture book

ATMOSPHERE: ${atmosphere}

PAGE BORDERS:
- Every page has a painted border frame: a dark, rich colour (navy blue, deep burgundy, or forest green depending on the story's palette) with rough, hand-painted torn edges
- Underneath the painted border, aged parchment/cream paper texture is visible
- The border gives every page a classic, antique storybook feel
- The border style must be IDENTICAL on every page

TEXT BOXES:
- ${textStyle}
- Text boxes have decorative corner flourishes — small ornamental swirls at each corner of the box
- Text boxes occupy no more than 25% of the page area
- Text must be large enough to read comfortably — at least 14pt equivalent
- If the page text is long, split into two text boxes side by side
- Same text box design on EVERY page — identical borders, identical font, identical cream background

PAGE NUMBERS:
- Small elegant serif number at the bottom outer corner of each page
- Odd pages (1, 3, 5...): number at bottom-RIGHT
- Even pages (2, 4, 6...): number at bottom-LEFT
- Number should be subtle — same colour as the border, small size

DO NOT INCLUDE:
- No speech bubbles or comic-style word balloons
- No modern UI elements, watermarks, or logos
- No brand names or copyright text
- No photorealistic rendering — everything must be illustrated
- No text outside of the designated text boxes (no floating words in the illustration)

QUALITY: Award-winning picture book illustration quality. Every page should look like it belongs in a bookstore.`;
}

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

// ── Cover prompt builder (uses Layer 2 + cover-specific) ─────────────────────
function buildCoverPrompt(coverScene, styleName, title, heroName, authorName, tone, format, heroPhotoUrl) {
  const bookIdentity = buildBookIdentity(styleName, tone, format);

  return `${bookIdentity}

---

GENERATE A PROFESSIONAL CHILDREN'S PICTURE BOOK FRONT COVER.

This is the FIRST image generated for this book. It sets the art style for the ENTIRE book — every subsequent page MUST match this exact illustration style.

LAYOUT: Single portrait-oriented book cover
- Full illustrated background filling the entire cover
- Title "${title}" in large, warm, hand-lettered storybook style positioned in the top third
- "A story for ${heroName}" in elegant smaller text below
- "By ${authorName}" at the bottom in small text
- All text clearly legible against the illustration
- Painted border frame around the entire cover: dark rich colour (navy, burgundy, or forest green) with rough hand-painted torn edges, aged parchment visible underneath
- This border style will be used on EVERY page of the book${heroPhotoUrl ? `

REFERENCE IMAGES:
- Image 1: Photo of ${heroName} — this is for reference only. Do NOT include this person on the cover. No characters on the cover — pure world-building.` : ""}

ILLUSTRATION:
- Scene: ${coverScene}
- No characters visible — pure world-building establishing shot
- Epic cinematic scale, magical and inviting
- This scene should make a child WANT to open the book

This cover defines the visual DNA of the entire book. Every subsequent page MUST match this exact art style, colour palette, border design, text box style, and illustration quality.`;
}

// ── Layer 3: PAGE-SPECIFIC PROMPT (unique per page) ──────────────────────────
function buildPagePrompt(page, pageIndex, totalPages, cast, heroName, previousPageExists) {
  const layout = page.layout || "full-portrait";
  const pageNum = pageIndex + 1;

  const charactersPresent = page.characters_present || [];
  const characterNote = charactersPresent.length > 0
    ? `Characters visible in this scene: ${charactersPresent.join(", ")}`
    : `Main character visible in this scene.`;

  let layoutInstruction;
  if (layout === "two-panel") {
    const leftScene = page.scene_description_left || page.scene_description;
    const rightScene = page.scene_description_right || "The next moment in the story";
    layoutInstruction = `LAYOUT: TWO side-by-side illustrated panels on an open book spread.
- Divided by a subtle page crease/spine down the centre
- LEFT PANEL: ${leftScene}
- RIGHT PANEL: ${rightScene}
- Each panel has its own text box at the bottom
- Both panels share the same art style, lighting, and colour temperature`;
  } else {
    layoutInstruction = `LAYOUT: ONE full-page portrait illustration filling the entire page.
- Rich detailed scene with the character(s) naturally placed
- Text box(es) at the bottom integrated into the composition`;
  }

  const words = (page.scene_description || page.text || "").split(/\s+/);
  const scene = words.length > 50
    ? words.slice(0, 50).join(" ")
    : page.scene_description || page.text;

  const moodDirection = {
    "wonder":     "Sense of magical discovery. Wide eyes, soft gasps, sparkles in the air. The world feels bigger than the character.",
    "adventure":  "Thrilling energy and momentum. Dynamic poses, wind in hair, sense of speed and excitement.",
    "cozy":       "Intimate warmth and safety. Close proximity, soft textures, gentle embraces, warm light.",
    "tense":      "Suspenseful anticipation. Dramatic shadows, leaning forward, breath held, something about to happen.",
    "triumphant": "Victory and pride. Arms raised, biggest smile, golden light bursting, the world celebrating.",
    "tender":     "Quiet love and connection. Gentle touches, soft gazes, peaceful stillness, hearts full.",
  };
  const moodNote = moodDirection[page.mood] || moodDirection["wonder"];

  let positionNote;
  if (pageIndex === 0) {
    positionNote = "This is the OPENING page. Set the scene, introduce the world, create intrigue.";
  } else if (pageIndex === totalPages - 1) {
    positionNote = "This is the FINAL page. Bring the story to a warm, satisfying close. This should feel like the most emotionally resonant page in the book.";
  } else if (pageIndex === totalPages - 2) {
    positionNote = "This is the second-to-last page. The climax is resolving. Build toward the warm ending.";
  } else if (pageIndex < totalPages / 3) {
    positionNote = "This is early in the story. The adventure is beginning, curiosity is building.";
  } else if (pageIndex < (2 * totalPages) / 3) {
    positionNote = "This is the middle of the story. The adventure is at its peak, stakes are high.";
  } else {
    positionNote = "The story is winding down. Resolution is coming, warmth is returning.";
  }

  return `PAGE ${pageNum} OF ${totalPages}

REFERENCE IMAGES PROVIDED:
- Image 1: Photo of ${heroName || "the main character"} — use this for FACE and IDENTITY only. Transform into illustrated style, do NOT copy the photo literally.
- Image 2: The COVER of this book — this is your STYLE BIBLE. Match this EXACT art style, colour palette, brush technique, border design, and text box style on this page.${previousPageExists ? `
- Image 3: The PREVIOUS page of this book — maintain VISUAL CONTINUITY with this page. Characters should look identical. Colour temperature, lighting style, and border design should flow naturally from this page to the current one.` : ""}

${positionNote}

${layoutInstruction}

SCENE: ${scene}

${characterNote}

EMOTIONAL DIRECTION: ${moodNote}

PAGE TEXT (render in the decorative text boxes):
"${page.text}"

Page ${pageNum}`;
}

// ── Full prompt assembler (all 3 layers) ─────────────────────────────────────
function buildFullPrompt(page, pageIndex, totalPages, cast, heroName, heroAge,
  styleName, tone, format, personalIngredient, previousPageExists) {
  const characterDNA = buildCharacterDNA(cast, heroName, heroAge, tone, personalIngredient);
  const bookIdentity = buildBookIdentity(styleName, tone, format);
  const pagePrompt = buildPagePrompt(page, pageIndex, totalPages, cast, heroName, previousPageExists);

  return `${characterDNA}\n\n---\n\n${bookIdentity}\n\n---\n\n${pagePrompt}`;
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

{"title":"Story title (creative, evocative, 3-6 words)","coverScene":"A breathtaking wide establishing shot description of the story world — epic scale, no characters visible, pure world-building","coverEmoji":"Single emoji representing the story world","pages":[{"pageNumber":1,"text":"The story text for this page. 2-4 sentences.","scene_description":"A detailed illustration description with rich environmental details including colors, lighting, textures, and atmosphere.","scene_description_left":"(Only for two-panel layout) Left panel scene description","scene_description_right":"(Only for two-panel layout) Right panel scene description","scene_emoji":"Single emoji for this scene","mood":"One of: wonder, adventure, cozy, tense, triumphant, tender","layout":"One of: full-portrait, two-panel, wide-cinematic","characters_present":["Name1","Name2"]}]}

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

Layout rules — for each page, assign a "layout" field:
* "full-portrait": One big scene filling the whole page. Use for: emotional close-ups, tender moments, bedtime scenes, single dramatic moments.
* "two-panel": Two side-by-side panels showing two connected moments. Use for: action sequences, before/after, journey progressions, conversations. For two-panel, also provide "scene_description_left" and "scene_description_right" describing each panel separately.
* "wide-cinematic": One wide panoramic scene. Use for: epic reveals, establishing new worlds, dramatic vistas, climactic moments.
* Vary layouts for visual rhythm — never the same layout 3 times in a row
* Use "two-panel" for at least 40% of pages
* A typical 6-page book: two-panel, full-portrait, two-panel, wide-cinematic, two-panel, full-portrait
* A typical 10-page book: two-panel, full-portrait, two-panel, wide-cinematic, two-panel, full-portrait, two-panel, wide-cinematic, full-portrait, full-portrait

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
    scene_description_left: page.scene_description_left || null,
    scene_description_right: page.scene_description_right || null,
    scene_emoji: page.scene_emoji || "🌟",
    mood: page.mood || "wonder",
    layout: page.layout || "full-portrait",
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
  coverScene, styleName, tier, title, heroName, authorName, heroPhotoUrl,
  tone, format
) {
  if (!coverScene) return null;

  const prompt = buildCoverPrompt(
    coverScene, styleName,
    title || "My Story",
    heroName || "a special child",
    authorName || "A loving family",
    tone || "Cozy",
    format || "classic",
    heroPhotoUrl
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
  onPageImage, coverImageUrl, tier,
  heroName, heroAge, tone, format, personalIngredient
) {
  if (!heroPhotoUrl) {
    return generateAllImagesFallback(pages, cast, styleName, tier, onPageImage, tone, format);
  }

  heroName = heroName || cast.find(c => c.isHero)?.name || cast[0]?.name || "the hero";
  const totalPages = pages.length;
  const pageImages = [];
  let previousPageUrl = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // Build full three-layer prompt
    const previousPageExists = (previousPageUrl !== null);
    const prompt = buildFullPrompt(
      page, i, totalPages, cast, heroName, heroAge,
      styleName, tone, format, personalIngredient, previousPageExists
    );

    // Aspect ratio depends on layout type
    const layout = PAGE_LAYOUTS[page.layout] || PAGE_LAYOUTS["full-portrait"];
    const aspectRatio = layout.aspect;

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
        aspectRatio,
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
          referenceImageUrls, aspectRatio, false
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
async function generateAllImagesFallback(pages, cast, styleName, tier, onPageImage, tone, format) {
  const bookIdentity = buildBookIdentity(styleName, tone, format);
  const pageImages = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const layout = PAGE_LAYOUTS[page.layout] || PAGE_LAYOUTS["full-portrait"];
    const sceneDesc = page.scene_description || page.text;
    const prompt = `${bookIdentity}\n\n---\n\nSCENE: ${sceneDesc}\n\nPAGE TEXT (render in decorative text boxes):\n"${page.text}"`;


    try {
      const url = await generateImage(prompt, null, tier, styleName, [], layout.aspect, false);
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
