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

// ══════════════════════════════════════════════════════════════════════════════
// CLAUDE AS ART DIRECTOR — Story + Visual Plan in ONE call
// ══════════════════════════════════════════════════════════════════════════════

function buildMasterSystemPrompt(cast, heroName, heroAge, styleName, tone, format, personalIngredient, pageCount) {
  const styleDesc = NANO_STYLES[styleName] || NANO_STYLES["Storybook"];
  const supporting = cast.filter(c => !c.isHero);

  // Build character descriptions
  let castDesc = `MAIN CHARACTER: ${heroName}`;
  if (heroAge) {
    if (heroAge <= 3) castDesc += `, ${heroAge} years old (toddler — large head, chubby cheeks, short limbs)`;
    else if (heroAge <= 6) castDesc += `, ${heroAge} years old (young child — round face, big eyes, small stature)`;
    else if (heroAge <= 10) castDesc += `, ${heroAge} years old (older child — longer limbs, confident posture)`;
    else castDesc += `, ${heroAge} years old`;
  }

  // Add appearance descriptions from photo analysis
  const heroChar = cast.find(c => c.isHero) || cast[0];
  if (heroChar?.appearanceDescription) {
    castDesc += `\nAppearance: ${heroChar.appearanceDescription}`;
  }

  supporting.forEach(c => {
    const role = c.role === 'mom' ? 'Mother' : c.role === 'dad' ? 'Father' :
      c.role === 'sibling' ? 'Sibling' : c.role === 'pet' ? 'Family pet' :
      c.role === 'grandparent' ? 'Grandparent' : c.role === 'friend' ? 'Best friend' : c.role;
    castDesc += `\n${c.name}: ${role}`;
    if (c.appearanceDescription) {
      castDesc += ` — ${c.appearanceDescription}`;
    }
  });

  const toneMap = {
    "Cozy": "warm golden-hour lighting, soft glowing lamps, amber and honey tones, feels like a warm blanket",
    "Exciting": "dynamic dramatic lighting, bold contrasts, vivid saturated colours, cinematic energy",
    "Heartfelt": "soft diffused light, gentle warmth, intimate framing, tender atmosphere",
    "Funny": "bright playful lighting, exaggerated expressions, candy colours, maximum fun energy",
  };
  const atmosphere = toneMap[tone] || toneMap["Cozy"];

  // Calculate spread count
  const spreadCount = Math.ceil(pageCount / 2);

  return `You are a master children's book author AND art director. You will write an amazing story AND design every visual spread of the book.

═══ YOUR CHARACTERS ═══
${castDesc}

${personalIngredient ? `EMOTIONAL CORE: "${personalIngredient}" — weave this into the story's heart.` : ""}

═══ THE BOOK FORMAT ═══
This is a ${pageCount}-page picture book with ${spreadCount} illustrated spreads.

Physical structure:
- PAGE 1: Front cover (single page, portrait 3:4)
- PAGES 2-3: First spread (two facing pages, landscape 4:3)
- PAGES 4-5: Second spread (landscape 4:3)
- PAGES 6-7: Third spread (landscape 4:3)
${pageCount > 6 ? `- PAGES 8-9: Fourth spread (landscape 4:3)
- PAGES 10-11: Fifth spread (landscape 4:3)` : ""}
- LAST PAGE: Back cover (single page, portrait 3:4)

When a reader opens the book, they see TWO pages at once (a spread). Each spread image shows the LEFT page and RIGHT page together, with a subtle crease/spine visible down the centre.

═══ ART STYLE ═══
Style: ${styleDesc}
Atmosphere: ${atmosphere}
${format === "rhyming" ? "Text boxes should feel whimsical and poetic." : ""}
${format === "funny" ? "Text boxes should feel playful and bouncy." : ""}

═══ ILLUSTRATION RULES FOR NANO BANANA PRO ═══

The following rules MUST be included in EVERY imagePrompt you write. Copy them into every prompt — do NOT summarize or paraphrase. The image model needs to see these exact instructions every single time.

REFERENCE IMAGES (include in EVERY spread prompt):
- Image 1: Photo of ${heroName} — use ONLY for face identity. Transform into the illustrated art style. Keep their EXACT facial features, head shape, hair (or lack of hair), skin tone, and distinguishing features.
- Image 2: The COVER of this book — your STYLE BIBLE. Match this EXACT art style, colour palette, brush technique, and text box style.
- Image 3 (when available): The PREVIOUS spread — maintain visual continuity. Characters must look IDENTICAL to how they appear in this image.

CHARACTER IDENTITY LOCK (THE #1 MOST IMPORTANT RULE):
This product FAILS if characters look different across pages. In every imagePrompt you write, you MUST:
1. Describe ${heroName}'s appearance explicitly: "[name] — [hair description], [skin tone], [build], wearing [specific clothing with colours]." Copy this description WORD FOR WORD into every prompt.
2. State: "The main character must look IDENTICAL to Image 1 (face) and Image 2 (art style). Same head shape, same hair, same skin tone, same outfit, same proportions."
3. For supporting characters, describe them explicitly too and repeat their description on every prompt they appear in.
4. NEVER describe a character differently from one spread to another.

ART STYLE LOCK:
- Art style must be IDENTICAL across all spreads — same brush strokes, same colour palette, same line weight, same level of detail
- Match the EXACT illustration style of the cover (Image 2)
- NOT photorealistic — this is an illustrated children's storybook

TEXT ACCURACY (CRITICAL):
- Every word in the text boxes MUST be spelled correctly — NO garbled text, NO made-up words, NO letter substitutions
- Copy the page text EXACTLY as written — do not change, abbreviate, or improvise any words
- Read back every word before finalising — if any word is not a real, correctly spelled English word, fix it
- This is a children's book — text errors are unacceptable

TEXT BOX DESIGN (MUST BE IDENTICAL ON EVERY PAGE):
- ALL text boxes use the EXACT SAME design on every spread: simple rectangular box, thin ornate border with small corner flourishes, warm cream fill, dark serif text, centred
- Do NOT vary the style — no scrolls on one page, frames on another, ribbons on another. Same box. Every page.
- Text boxes sit at the BOTTOM of the page, inside the safe zone
- Text boxes should not cover more than 25-30% of the image
- No text anywhere EXCEPT inside the text boxes

COMPOSITION:
- The illustration fills the ENTIRE image edge-to-edge — NO borders, NO frames
- Do NOT add any decorative border or frame (the app adds these)
- Do NOT add page numbers (the app adds these)
- Keep all important content at least 5% inward from all edges (safe zone for cropping)

DO NOT INCLUDE:
- No page borders, frames, or parchment edges
- No page numbers
- No speech bubbles or comic-style word balloons
- No watermarks or logos

═══ YOUR TASK ═══
1. First, create a CHARACTER APPEARANCE STRING for each character — a short, specific visual description (hair, skin, build, clothing) that will be COPIED VERBATIM into every single image prompt. This is how you lock character identity across pages.
2. Write an incredible ${pageCount}-page children's story
3. Design the visual layout for every single spread
4. Write the COMPLETE Nano Banana Pro prompt for each image, including the character appearance string in every one

For each spread, YOU decide:
- How to split the story text between the left and right page
- Whether the illustration is one continuous scene across both pages, or two distinct panels
- Where the text boxes go (bottom of spread, bottom of each page, one page only, etc.)
- The camera angle and composition (wide establishing shot, intimate close-up, dramatic low angle, etc.)
- The lighting and colour mood for this specific moment
- Which characters are visible and how they're positioned
- What details in the environment tell the story

Think like a REAL picture book designer. Vary your layouts:
- Some spreads: one epic scene spanning both pages, text at bottom
- Some spreads: distinct left and right panels with their own text boxes
- Some spreads: illustration dominant with small text box in one corner
- Some spreads: close-up emotional moment with large text overlay area
- The FINAL spread should be the most emotionally resonant

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON with this structure:

{
  "title": "Story Title",
  "dedication": "A heartfelt dedication...",
  "characterAppearances": {
    "hero": "${heroName} — [hair], [skin tone], [build], wearing [specific clothing with colours]",
    "supporting": {
      "CharName": "CharName — [hair], [skin tone], wearing [clothing]"
    }
  },
  "cover": {
    "imagePrompt": "COMPLETE prompt including character appearance string...",
    "aspectRatio": "3:4"
  },
  "spreads": [
    {
      "spreadNumber": 1,
      "leftPageText": "Story text for the left page...",
      "rightPageText": "Story text for the right page...",
      "imagePrompt": "COMPLETE prompt including character appearance string, text content, layout, reference image instructions, text box rules, and all consistency rules...",
      "aspectRatio": "4:3",
      "designNotes": "Brief note on why this layout works"
    }
  ],
  "backCover": {
    "imagePrompt": "COMPLETE prompt for the back cover...",
    "aspectRatio": "3:4"
  }
}

CRITICAL RULES FOR imagePrompt FIELDS:
1. Each imagePrompt MUST be a COMPLETE standalone prompt — 200-300 words
2. Each imagePrompt MUST include the full character appearance string from characterAppearances, copied VERBATIM. Every prompt featuring a character must contain their exact appearance string.
3. Each imagePrompt MUST include the text box design rule: "Text in rectangular boxes with thin ornate border, small corner flourishes, warm cream fill, dark serif text, centred. Same box design on every page."
4. Each imagePrompt MUST include: "The illustration fills the ENTIRE image edge-to-edge. NO borders, NO frames, NO page numbers. Match the EXACT style of Image 2 (the cover). Character must look IDENTICAL to Image 1 and Image 2."
5. Each imagePrompt MUST include the exact page text to be rendered, with the instruction: "Render this text EXACTLY as written with no spelling errors."
6. NEVER describe a character differently from one prompt to another. Use the SAME character appearance string on every prompt.

${format === "rhyming" ? "Write in strict AABB rhyme scheme. 8-10 syllables per line." : ""}
${format === "funny" ? "Make it genuinely funny with surprises and silly moments." : ""}

Return ONLY the JSON. No preamble. No markdown.`;
}

function buildMasterUserPrompt(wizardData) {
  return `Create a personalized children's storybook.

Hero: ${wizardData.heroName}${wizardData.heroAge ? ` (age ${wizardData.heroAge})` : ""}
Story idea: ${wizardData.storyIdea || wizardData.sparkText || wizardData.spark || "A magical adventure"}
${wizardData.personalIngredient ? `Personal detail: "${wizardData.personalIngredient}"` : ""}
${wizardData.tone ? `Mood: ${wizardData.tone}` : ""}

Write the story, then design every spread with complete image prompts. Make it magical, personal, and visually stunning.`;
}

// ── Generate story + visual plan (ONE Claude call) ───────────────────────────
export async function generateStoryAndVisualPlan(cast, styleName, storyData) {
  const systemPrompt = buildMasterSystemPrompt(
    cast,
    storyData.heroName,
    storyData.heroAge,
    styleName,
    storyData.tone,
    storyData.storyFormat || "classic",
    storyData.personalIngredient,
    storyData.pageCount || 6
  );

  const userPrompt = buildMasterUserPrompt(storyData);

  const maxTokens = (storyData.pageCount || 6) > 6 ? 6000 : 4000;
  const raw = await claudeCall(systemPrompt, userPrompt, maxTokens);

  // Parse the JSON response
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
        // Retry once
        const retryRaw = await claudeCall(systemPrompt, userPrompt, maxTokens);
        const retryCleaned = retryRaw.replace(/```json\s*|```\s*/g, "").trim();
        parsed = JSON.parse(retryCleaned);
      }
    } else {
      // Retry once
      const retryRaw = await claudeCall(systemPrompt, userPrompt, maxTokens);
      const retryCleaned = retryRaw.replace(/```json\s*|```\s*/g, "").trim();
      parsed = JSON.parse(retryCleaned);
    }
  }

  // Validate structure
  if (!parsed.title || !parsed.cover || !Array.isArray(parsed.spreads) || parsed.spreads.length === 0) {
    throw new Error("Invalid story structure. Please try again.");
  }

  // Ensure each spread has required fields
  parsed.spreads = parsed.spreads.map((spread, i) => ({
    spreadNumber: spread.spreadNumber || i + 1,
    leftPageText: spread.leftPageText || "",
    rightPageText: spread.rightPageText || "",
    imagePrompt: spread.imagePrompt || "",
    aspectRatio: spread.aspectRatio || "4:3",
    designNotes: spread.designNotes || "",
  }));

  // Ensure cover and back cover
  parsed.cover = {
    imagePrompt: parsed.cover.imagePrompt || "",
    aspectRatio: parsed.cover.aspectRatio || "3:4",
  };
  parsed.backCover = parsed.backCover || {
    imagePrompt: "",
    aspectRatio: "3:4",
  };

  return parsed;
}

// ── Generate ALL images from Claude's prompts ────────────────────────────────
// Sequential chained flow: cover → spread1 → spread2 → ... → back cover
// Each image references the hero photo + cover (style anchor) + previous image
export async function generateAllImages(
  storyPlan, heroPhotoUrl, onImageReady, tier
) {
  const images = {};
  let previousImageUrl = null;

  // 1. Generate cover
  try {
    const coverUrl = await generateImage(
      storyPlan.cover.imagePrompt,
      heroPhotoUrl,
      tier,
      null,
      [],
      storyPlan.cover.aspectRatio || "3:4",
      true
    );
    if (coverUrl && await validateImageUrl(coverUrl)) {
      images.cover = coverUrl;
      previousImageUrl = coverUrl;
      logCost("nano_banana", tier, true, 0, null);
    }
  } catch (err) {
    console.warn("Cover generation failed:", err.message);
  }
  if (onImageReady) onImageReady("cover", images.cover || null);

  // 2. Generate spreads sequentially (chained)
  for (let i = 0; i < storyPlan.spreads.length; i++) {
    const spread = storyPlan.spreads[i];

    // Reference images: cover (style anchor) + previous spread (local consistency)
    const referenceImageUrls = [];
    if (images.cover) referenceImageUrls.push(images.cover);
    if (previousImageUrl && previousImageUrl !== images.cover) {
      referenceImageUrls.push(previousImageUrl);
    }

    try {
      const url = await generateImage(
        spread.imagePrompt,
        heroPhotoUrl,
        tier,
        null,
        referenceImageUrls,
        spread.aspectRatio || "4:3",
        false
      );

      if (url && await validateImageUrl(url)) {
        images[`spread_${i}`] = url;
        previousImageUrl = url;
        logCost("nano_banana", tier, true, 0, null);
      } else {
        throw new Error("Invalid image URL");
      }
    } catch (err) {
      console.warn(`Spread ${i + 1} failed:`, err.message);

      // Retry once with 3s delay
      try {
        await new Promise(r => setTimeout(r, 3000));
        const referenceImageUrls2 = [];
        if (images.cover) referenceImageUrls2.push(images.cover);
        if (previousImageUrl && previousImageUrl !== images.cover) {
          referenceImageUrls2.push(previousImageUrl);
        }
        const retryUrl = await generateImage(
          spread.imagePrompt, heroPhotoUrl, tier, null,
          referenceImageUrls2, spread.aspectRatio || "4:3", false
        );
        if (retryUrl && await validateImageUrl(retryUrl)) {
          images[`spread_${i}`] = retryUrl;
          previousImageUrl = retryUrl;
        } else {
          images[`spread_${i}`] = null;
        }
      } catch (retryErr) {
        console.warn(`Spread ${i + 1} retry failed:`, retryErr.message);
        images[`spread_${i}`] = null;
      }
    }

    if (onImageReady) onImageReady(`spread_${i}`, images[`spread_${i}`] || null);
  }

  // 3. Generate back cover
  const backRefImages = [];
  if (images.cover) backRefImages.push(images.cover);
  if (previousImageUrl) backRefImages.push(previousImageUrl);

  try {
    const backUrl = await generateImage(
      storyPlan.backCover.imagePrompt,
      heroPhotoUrl,
      tier,
      null,
      backRefImages,
      storyPlan.backCover.aspectRatio || "3:4",
      false
    );
    if (backUrl && await validateImageUrl(backUrl)) {
      images.backCover = backUrl;
      logCost("nano_banana", tier, true, 0, null);
    }
  } catch (err) {
    console.warn("Back cover generation failed:", err.message);
    images.backCover = null;
  }
  if (onImageReady) onImageReady("backCover", images.backCover || null);

  // Check if we got at least some images
  const spreadImages = storyPlan.spreads.map((_, i) => images[`spread_${i}`]);
  if (!images.cover && spreadImages.every(url => !url)) {
    throw new Error("All illustrations failed. Please try again.");
  }

  return images;
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

// ── Generate a single page image (fallback for edits) ────────────────────────
export async function generatePageImage(sceneDescription, cast, styleName, heroPhotoUrl, mood) {
  const styleDesc = NANO_STYLES[styleName] || NANO_STYLES["Storybook"];
  const prompt = `Children's storybook illustration in ${styleDesc} style. ${sceneDescription}. The illustration fills the ENTIRE image edge-to-edge — NO borders, NO frames. Award-winning picture book quality, no text in image.`;

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

// ── Edit page text ────────────────────────────────────────────────────────────
export async function editPageText(currentText, instruction, cast) {
  const characterNames = cast.map((c) => c.name).join(", ");
  return claudeCall(
    "Edit a single children's book page. Return ONLY the new text — exactly 2-3 sentences, warm picture-book voice. No quotes or extra formatting.",
    `Current text: "${currentText}"\nInstruction: "${instruction}"\nCharacters: ${characterNames}`,
    200
  );
}
