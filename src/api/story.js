import { claudeCall, generateImage, uploadPhoto, validateImage, saveBookImage } from "./client";
import { ROLES, STYLES, WORLDS, OCCASIONS, THEMES } from "../constants/data";

// ── Prompt injection sanitization ─────────────────────────────────────────────
// Strip characters that could be used for prompt injection in user-supplied text
function sanitizeForPrompt(text) {
  if (!text) return text;
  return String(text)
    .replace(/["""]/g, "'")       // normalize quotes to single
    .replace(/[`]/g, "'")         // backticks to single quotes
    .replace(/[\r\n]+/g, " ")     // collapse newlines (prevent instruction injection)
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\p{Emoji}]/gu, "") // keep letters, numbers, punctuation, spaces, emoji
    .trim()
    .slice(0, 200);               // hard length limit
}

// ── Face-ref-lost tracking ───────────────────────────────────────────────────
export const imageGenFlags = { faceRefLostCount: 0 };

// ── Left page gradients for each style ────────────────────────────────────────
export const STYLE_GRADIENTS = {
  "Classic Storybook": "linear-gradient(135deg, #FEF3C7, #FDE68A, #F59E0B)",
  "Soft Watercolor": "linear-gradient(135deg, #E0F2FE, #BAE6FD, #7DD3FC)",
  "Pixar / 3D Animated": "linear-gradient(135deg, #DBEAFE, #BFDBFE, #93C5FD)",
  "Bold & Bright": "linear-gradient(135deg, #FDF4FF, #FAE8FF, #E879F9)",
  "Cozy & Soft": "linear-gradient(135deg, #FFF1F2, #FFE4E6, #FECDD3)",
  "Sketch & Color": "linear-gradient(135deg, #F5F5DC, #FFFACD, #FFEAA7)",
  "Anime / Manga": "linear-gradient(135deg, #FCE7F3, #FBCFE8, #F9A8D4)",
  "Vintage Storybook": "linear-gradient(135deg, #FEF3C7, #FDE68A, #FCD34D)",
  "Paper Collage": "linear-gradient(135deg, #FFEDD5, #FED7AA, #FDBA74)",
  "Clean & Minimal": "linear-gradient(135deg, #F8FAFC, #F1F5F9, #E2E8F0)",
  // Legacy fallbacks
  Storybook: "linear-gradient(135deg, #FEF3C7, #FDE68A, #F59E0B)",
  Watercolor: "linear-gradient(135deg, #E0F2FE, #BAE6FD, #7DD3FC)",
};

export const STYLE_COVER_GRADIENTS = {
  "Classic Storybook": "linear-gradient(160deg, #D97706, #B45309, #92400E)",
  "Soft Watercolor": "linear-gradient(160deg, #0284C7, #0369A1, #075985)",
  "Pixar / 3D Animated": "linear-gradient(160deg, #2563EB, #1D4ED8, #1E40AF)",
  "Bold & Bright": "linear-gradient(160deg, #A855F7, #7C3AED, #6D28D9)",
  "Cozy & Soft": "linear-gradient(160deg, #F472B6, #EC4899, #DB2777)",
  "Sketch & Color": "linear-gradient(160deg, #A16207, #854D0E, #713F12)",
  "Anime / Manga": "linear-gradient(160deg, #EC4899, #DB2777, #BE185D)",
  "Vintage Storybook": "linear-gradient(160deg, #D97706, #B45309, #92400E)",
  "Paper Collage": "linear-gradient(160deg, #EA580C, #C2410C, #9A3412)",
  "Clean & Minimal": "linear-gradient(160deg, #64748B, #475569, #334155)",
  // Legacy fallbacks
  Storybook: "linear-gradient(160deg, #D97706, #B45309, #92400E)",
  Watercolor: "linear-gradient(160deg, #0284C7, #0369A1, #075985)",
};

// ── Nano Banana Pro style descriptions ───────────────────────────────────────
// Look up by style name — supports both new and legacy names
function getNanoStyle(styleName) {
  const styleObj = STYLES.find(s => s.name === styleName || s.id === styleName);
  if (styleObj?.nanoPromptStyle) return styleObj.nanoPromptStyle;
  // Legacy fallback
  return "classic children's storybook illustration with bold saturated colours, clean outlines, and warm painterly backgrounds";
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
  } catch (err) { console.warn("Cost logging failed:", err.message); }
}

// ── Image URL passthrough ────────────────────────────────────────────────────
export async function cacheImageAsBlob(url) {
  return url || null;
}

// ── Image validation ──────────────────────────────────────────────────────────
async function validateImageUrl(url) {
  if (!url) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  // Use Image element instead of fetch HEAD to avoid CORS failures
  // (Replicate CDN doesn't set CORS headers for programmatic fetch)
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// ── Image selection & quality tier ────────────────────────────────────────────
function selectBestImage(attempts, hasReferencePhoto = false) {
  if (attempts.length === 0) return null;

  // Step 1: Filter out hard gate failures
  const viable = attempts.filter(a =>
    a.validation.textScore >= 4 &&
    a.validation.faceScore >= 4 &&
    a.validation.formatOk === true
  );

  // Step 2: If nothing passed hard gates, reject — don't use a bad image
  if (viable.length === 0) return null;

  if (viable.length === 1) return viable[0];

  // Step 3: Calculate weighted composite score
  // textBoxScore can be null for covers/back covers — use 7 (neutral) as fallback
  viable.forEach(a => {
    const v = a.validation;
    const tbScore = v.textBoxScore ?? 7;
    if (hasReferencePhoto && v.likenessScore != null) {
      a.composite = (v.textScore * 0.35) + (v.faceScore * 0.25) +
                     (tbScore * 0.15) + (v.sceneAccuracy * 0.15) +
                     (v.likenessScore * 0.10);
    } else {
      a.composite = (v.textScore * 0.40) + (v.faceScore * 0.30) +
                     (tbScore * 0.15) + (v.sceneAccuracy * 0.15);
    }
  });

  // Step 4: Return highest composite
  viable.sort((a, b) => b.composite - a.composite);
  return viable[0];
}

function getQualityTier(validation) {
  const v = validation;
  const tb = v.textBoxScore ?? 7; // neutral for covers/back covers
  if (v.textScore >= 9 && v.faceScore >= 8 && tb >= 7 && v.sceneAccuracy >= 7) {
    return 'excellent';
  }
  if (v.textScore >= 7 && v.faceScore >= 7 && tb >= 6 && v.sceneAccuracy >= 6) {
    return 'good';
  }
  if (v.textScore >= 5 && v.faceScore >= 5) {
    return 'acceptable';
  }
  return 'poor';
}

// ── Character description helpers ─────────────────────────────────────────────
function buildCharacterDescription(cast) {
  return cast
    .map((character) => {
      const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
      const age = character.age ? `, age ${character.age}` : "";
      const photoNote = character.photo ? " (photo provided)" : "";
      return `${sanitizeForPrompt(character.name)} (${role}${age})${photoNote}`;
    })
    .join(", ");
}

// ── Type-aware character analysis prompts ────────────────────────────────────
function buildCharacterAnalysisPrompt(heroName, heroType, heroAge) {
  const type = heroType || 'child';

  if (type === 'pet') {
    return {
      system: `You are a children's book art director. Analyze this photo of a pet and write a FROZEN CHARACTER DESCRIPTION that an illustrator will reference on every page.

Include ALL of these:
- Species and breed (or best guess)
- Coat/fur: color, pattern, length, texture (e.g., "long fluffy golden fur with a white chest patch")
- Size: small/medium/large
- Eyes: color and expression
- Ears: shape and position (floppy, pointed, etc.)
- Tail: length, bushiness, curl
- Distinguishing features: spots, markings, collar, bandana, scars
- Overall personality impression from appearance

Write as ONE dense paragraph. No headers, no bullets. Example: "Biscuit — a medium-sized golden retriever with long wavy caramel-gold fur, a fluffy white chest, warm brown eyes with a perpetually happy expression, floppy ears that bounce when running, a thick feathered tail always wagging. Wears a red collar with a bone-shaped tag. Same collar on every page."`,
      user: `Describe this pet named ${sanitizeForPrompt(heroName)} for an illustrator. Be specific about every visual detail.`,
    };
  }

  if (type === 'stuffed_animal') {
    return {
      system: `You are a children's book art director. Analyze this photo of a stuffed animal/plush toy and write a FROZEN CHARACTER DESCRIPTION.

Include: material/fabric type, color, size, eye type (button, plastic, embroidered), any clothing or accessories, wear/loved-look, distinguishing features.

Write as ONE dense paragraph. Example: "Mr. Bear — a well-loved medium brown teddy bear, soft plush fur slightly matted from hugs, round black button eyes, stitched smile with brown thread, faded red bow tie around the neck, slightly floppy left ear. Warm and worn — a treasured companion. Same bow tie on every page."`,
      user: `Describe this stuffed animal named ${sanitizeForPrompt(heroName)} for an illustrator. Include every detail that makes it unique.`,
    };
  }

  if (type === 'adult') {
    return {
      system: `You are a children's book art director. Analyze this photo and write a FROZEN CHARACTER DESCRIPTION of this adult for a children's storybook illustrator.

Include ALL of these:
- Hair: color, length, style, any grey/balding
- Skin: specific tone
- Eyes: color, shape, glasses if present
- Face: shape, notable features (beard, mustache, wrinkles, dimples, smile lines)
- Build: body type, height impression
- Age appearance: approximate decade (30s, 50s, 70s, etc.)
- Outfit: assign a signature storybook-appropriate outfit

Write as ONE dense paragraph. Example: "Grandpa Joe — a tall broad-shouldered man in his early 70s with a full head of silver-white hair combed to the side, warm deep brown skin with smile lines around his eyes, kind dark brown eyes behind round gold-rimmed glasses, a short salt-and-pepper beard. Wearing a cozy burgundy cardigan over a cream checkered shirt, brown corduroy trousers, leather shoes. Same outfit on every page."`,
      user: `Describe this person named ${sanitizeForPrompt(heroName)}${heroAge ? ` (age ${heroAge})` : ''} for an illustrator. Be specific about every visual detail.`,
    };
  }

  if (type === 'teen') {
    return {
      system: `You are a children's book art director. Analyze this photo of a teenager and write a FROZEN CHARACTER DESCRIPTION.

Include: hair (color, length, style), skin tone, eyes, face shape, build, approximate age (13-19), distinguishing features, and a signature outfit.

Write as ONE dense paragraph.`,
      user: `Describe this teenager named ${sanitizeForPrompt(heroName)}${heroAge ? ` (age ${heroAge})` : ''} for an illustrator. Be specific about every visual detail.`,
    };
  }

  if (type === 'baby') {
    return {
      system: `You are a children's book art director. Analyze this photo of a baby/toddler and write a FROZEN CHARACTER DESCRIPTION.

Include: hair (color, amount — babies may have very little), skin tone, eyes, face shape (round cheeks, etc.), approximate age appearance, and a signature onesie or outfit.

Baby proportions are critical for illustration: very large head relative to body, short chubby limbs, round belly, tiny hands and feet. Note these explicitly.

Write as ONE dense paragraph.`,
      user: `Describe this baby named ${sanitizeForPrompt(heroName)}${heroAge ? ` (age ${heroAge})` : ''} for an illustrator. Include age-appropriate proportions.`,
    };
  }

  if (type === 'imaginary_friend' || type === 'magical_creature') {
    return {
      system: `You are a children's book art director. Analyze this image and write a FROZEN CHARACTER DESCRIPTION. This is a fantasy/imaginary character — describe what you see faithfully, including any magical or unusual features.

Include: overall shape/form, colors, size, texture (fur, scales, sparkles, glow), eyes, distinguishing features.

Write as ONE dense paragraph.`,
      user: `Describe this character named ${sanitizeForPrompt(heroName)} for an illustrator. Capture every visual detail including any fantastical elements.`,
    };
  }

  // Default: child (the most common case)
  const isAdult = heroAge && parseInt(heroAge, 10) >= 16;
  return {
    system: `You are a children's book art director. Analyze this photo of a child and write a FROZEN CHARACTER DESCRIPTION that an illustrator will reference on every single page.

Include ALL of these:
- Hair: exact color, length, texture, style
- Skin: specific tone (e.g., "warm olive" or "fair with light freckles" — not just "light")
- Eyes: color, shape, size relative to face
- Face shape: round, oval, heart, etc.
- Distinguishing features: freckles, dimples, glasses, gap teeth, birthmarks
- Build: body type relative to age
- Age appearance: how old they look
- Outfit: describe what they're wearing OR assign a signature outfit

Write as ONE dense paragraph. No headers, no bullets. Example: "Luna — 5-year-old girl with long wavy auburn hair past her shoulders, fair skin with light freckles across her nose, large round hazel-green eyes, heart-shaped face with rosy cheeks and a small upturned nose. Petite build. Wearing a yellow raincoat over a blue striped dress, red rain boots. Same outfit on every page."
${isAdult ? "\nIMPORTANT: This person is an ADULT. Do NOT describe them as a child. Use adult body proportions and features." : ""}`,
    user: `Describe this ${isAdult ? 'person' : 'child'} named ${sanitizeForPrompt(heroName)}${heroAge ? ` (age ${heroAge})` : ''} for an illustrator. Be specific about every visual detail.`,
  };
}

function buildFallbackDescription(heroName, heroType, heroAge) {
  const type = heroType || 'child';
  const age = heroAge ? `${heroAge}-year-old ` : '';

  const typeLabels = {
    child: `${age}child`,
    teen: `${age}teenager`,
    adult: `${age}adult`,
    baby: `${age}baby`,
    pet: 'pet',
    stuffed_animal: 'stuffed animal',
    imaginary_friend: 'imaginary friend',
    magical_creature: 'magical creature',
  };

  return `${sanitizeForPrompt(heroName)} — a ${typeLabels[type] || type} character`;
}

// ── Analyze character photos ──────────────────────────────────────────────────
async function analyzeCharacterPhotos_single(character, photoDataUri) {
  const heroType = character.role || 'child';
  const heroAge = character.age || null;
  const heroName = character.name;

  try {
    const analysisPrompt = buildCharacterAnalysisPrompt(heroName, heroType, heroAge);
    const description = await claudeCall(
      analysisPrompt.system,
      analysisPrompt.user,
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
// PROMPT ASSEMBLY — Code builds structured prompts, Claude writes scenes only
// ══════════════════════════════════════════════════════════════════════════════

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
  frozenCharacterDescription,
  heroType,
  allFrozenDescriptions = {},
  ledgerBlock = null,
}) {
  const sections = [];

  // ═══════════════════════════════════════════════════════════════
  // COVER — completely different prompt structure
  // ═══════════════════════════════════════════════════════════════
  if (isCover) {
    // Build reference image labels: character photos first, then style refs
    let imgIdx = 1;
    const refLines = [];
    refLines.push(`- Image ${imgIdx}: Photograph of ${sanitizeForPrompt(heroName)}. Match their EXACT facial features, head shape, hair, and skin tone. Transform into illustrated art style — NOT photorealistic.`);
    imgIdx++;
    companionNames.forEach(name => {
      refLines.push(`- Image ${imgIdx}: Photo of ${sanitizeForPrompt(name)} — match their EXACT facial features, head shape, hair, and skin tone. Transform into the illustrated art style.`);
      imgIdx++;
    });

    sections.push(`REFERENCE IMAGES:\n${refLines.join("\n")}`);

    sections.push(
`CHARACTER:
${frozenCharacterDescription || characterAppearances.hero || buildFallbackDescription(heroName, heroType)}

CRITICAL CONSISTENCY RULES:
- ${sanitizeForPrompt(heroName)} MUST look identical on every page — same face, same coloring, same outfit/markings
- When ANY visual detail conflicts between this description and Image 1, Image 1 wins
- No appearance changes between pages unless the story specifically calls for it
- Zero variation — an illustrator would use this as their character model sheet`
    );

    if (characterAppearances.supporting) {
      const supportingText = Object.entries(characterAppearances.supporting)
        .map(([name, desc]) => {
          const frozen = allFrozenDescriptions[name];
          return frozen ? `- ${frozen}` : `- ${desc}`;
        })
        .join("\n");
      if (supportingText) {
        sections.push(`SUPPORTING CHARACTERS:\n${supportingText}`);
      }
    }

    if (ledgerBlock) {
      sections.push(ledgerBlock);
    }

    sections.push(`SCENE:\n${sceneDescription}`);

    // ── COVER TITLE (hand-lettered into the art) ──
    const titleText = pageTexts?.[0] || "Untitled";
    sections.push(
`TITLE TEXT:
The title "${sanitizeForPrompt(titleText)}" must be rendered as LARGE, beautiful hand-lettered text that is PART OF the illustration — not a separate text box.

Title requirements:
- Takes up 30-50% of the cover area (upper portion)
- Hand-lettered style that matches the art style
- Letters can interact with the scene: glow, cast shadows, have characters lean against them, sit on them, or peek around them
- Warm, readable, bold — visible even as a tiny thumbnail
- Style-matched: if watercolor art, title looks hand-painted. If Pixar, title looks 3D rendered. If sketch, title looks hand-drawn
- Color: contrasts with background. Light text on dark areas, dark text on light areas. Can have a subtle glow, shadow, or outline for readability
- Position: upper third of the image, arcing or flowing naturally

DO NOT put the title in a box, frame, banner, or rectangle. The title is PAINTED INTO the scene.`
    );

    if (authorName) {
      sections.push(
`AUTHOR NAME:
Render "By ${sanitizeForPrompt(authorName)}" in small, elegant text near the bottom of the cover.
- Much smaller than the title (about 1/6th the size)
- Same style family as the title but thinner/lighter weight
- Positioned at bottom centre or bottom right
- Subtle and classy — not in a box, just floating text
- Must be readable but not competing with the title`
      );
    }

    if (subtitleText) {
      sections.push(
`SUBTITLE:
Render "${sanitizeForPrompt(subtitleText)}" in small decorative text below the title or above the author name.
- Smaller than the title, similar size to author name
- Elegant, warm, integrated into the art
- Not in a box — just floating text with subtle shadow for readability`
      );
    }

    sections.push(
`STYLE:
${artStyle || "Classic children's storybook illustration"}
This is the COVER — the most polished, beautiful image in the entire book. Gallery quality. Award-winning. The image that makes someone stop scrolling and say "I need this."`
    );

    sections.push(
`COVER RULES:
- Illustration fills ENTIRE image edge-to-edge, portrait 2:3
- NO text boxes, NO frames, NO banners, NO borders
- NO parchment, NO scroll, NO ribbon, NO badge around text
- Title is HAND-LETTERED INTO the scene (not overlaid, not in a box)
- Character is the HERO — front and centre, full body or 3/4
- Character should be looking toward the viewer OR gazing toward the adventure
- The scene suggests the BEGINNING of the adventure (threshold moment)
- Lighting should be dramatic and cinematic — golden hour, volumetric rays, or magical glow
- Keep 5% safe zone at edges
- NOT photorealistic — illustrated children's book style
- This must look like an AWARD-WINNING picture book cover`
    );

    return sections.join("\n\n");
  }

  // ═══════════════════════════════════════════════════════════════
  // BACK COVER — peaceful closing scene
  // ═══════════════════════════════════════════════════════════════
  if (isBackCover) {
    // Build reference image labels: character photos first, then style refs
    let imgIdx = 1;
    const refLines = [];
    refLines.push(`- Image ${imgIdx}: Photograph of ${sanitizeForPrompt(heroName)}. Match their EXACT facial features, head shape, hair, skin tone, and ethnicity. Transform into illustrated art style — NOT photorealistic.`);
    imgIdx++;
    companionNames.forEach(name => {
      refLines.push(`- Image ${imgIdx}: Photo of ${sanitizeForPrompt(name)} — match their EXACT facial features, head shape, hair, and skin tone. Transform into the illustrated art style.`);
      imgIdx++;
    });
    const backCoverImgIdx = imgIdx;
    refLines.push(`- Image ${imgIdx}: The COVER of this book — your STYLE BIBLE. Match this EXACT art style, colour palette, brush technique, and character rendering.`);
    imgIdx++;
    const backPrevImgIdx = imgIdx;
    refLines.push(`- Image ${imgIdx}: The PREVIOUS SPREAD from this book. ${sanitizeForPrompt(heroName)} must look IDENTICAL to how they appear in this image. Same skin tone, same hair, same clothing style, same illustrated rendering.`);

    sections.push(`REFERENCE IMAGES:\n${refLines.join("\n")}`);

    sections.push(
`CHARACTER:
${frozenCharacterDescription || characterAppearances.hero || buildFallbackDescription(heroName, heroType)}
${sanitizeForPrompt(heroName)}'s face MUST match Image 1 (the photo). Their illustrated style MUST match Image ${backCoverImgIdx} and Image ${backPrevImgIdx} (previous pages).

CRITICAL CONSISTENCY RULES:
- ${sanitizeForPrompt(heroName)} MUST look identical on every page — same face, same coloring, same outfit/markings
- Match the EXACT skin tone, ethnicity, and hair from the photo. Do NOT change the character's race or appearance
- When ANY visual detail conflicts between this description and Image 1, Image 1 wins`
    );

    sections.push(`SCENE:\n${sceneDescription}`);

    sections.push(
`STYLE:
${artStyle || "Classic children's storybook illustration"}
Match the COVER art style exactly. This is the closing image — warm, gentle, reflective.
The character must be rendered in the SAME illustrated style as Image ${backCoverImgIdx} and Image ${backPrevImgIdx}.`
    );

    sections.push(
`BACK COVER RULES:
- Illustration fills ENTIRE image edge-to-edge, portrait 2:3
- ABSOLUTELY NO TEXT, TITLES, LETTERS, OR WORDS anywhere in the image
- The app overlays "The End", author, and dedication text separately
- NO text boxes, NO frames, NO banners, NO borders
- Quiet, peaceful, reflective scene
- Character shown from behind or at rest — the adventure is over
- Warm, soft lighting (sunset, lamplight, moonlight)
- Simpler composition than the front cover
- Leave the lower third slightly softer/darker for text overlay
- Keep 5% safe zone at edges
- NOT photorealistic — illustrated children's book style
- Character MUST have the same skin tone, hair, and features as in Image 1 and the rest of the book`
    );

    return sections.join("\n\n");
  }

  // ═══════════════════════════════════════════════════════════════
  // INTERIOR SPREADS — standard prompt structure
  // ═══════════════════════════════════════════════════════════════
  // Build reference image labels: character photos first, then style refs
  let imgIdx = 1;
  const refLines = [];
  refLines.push(`- Image ${imgIdx}: Photo of ${sanitizeForPrompt(heroName)} — match EXACT facial features.`);
  imgIdx++;
  companionNames.forEach(name => {
    refLines.push(`- Image ${imgIdx}: Photo of ${sanitizeForPrompt(name)} — match their EXACT facial features, head shape, hair, and skin tone. Transform into the illustrated art style.`);
    imgIdx++;
  });

  const coverImgIdx = imgIdx;
  let prevSpreadImgIdx = null;
  if (isFirstSpread) {
    refLines.push(`- Image ${imgIdx}: The COVER of this book — your STYLE BIBLE. Match this EXACT art style, colour palette, brush technique, and text box design on this page.`);
  } else {
    refLines.push(`- Image ${imgIdx}: The COVER of this book — your STYLE BIBLE. Match this exact art style.`);
    imgIdx++;
    prevSpreadImgIdx = imgIdx;
    refLines.push(`- Image ${imgIdx}: The PREVIOUS SPREAD. Maintain visual continuity. ${sanitizeForPrompt(heroName)} must look IDENTICAL to this image. Same style, same colour temperature.`);
  }
  sections.push(`REFERENCE IMAGES:\n${refLines.join("\n")}`);

  sections.push(
`CHARACTER:
${frozenCharacterDescription || characterAppearances.hero || buildFallbackDescription(heroName, heroType)}
${sanitizeForPrompt(heroName)}'s face MUST match Image 1 (the photo). Match their EXACT skin tone, ethnicity, hair colour, and facial features. Do NOT change the character's race or skin colour.
When in doubt, match the photo. NOT photorealistic — illustrated style.${prevSpreadImgIdx ? `\n${sanitizeForPrompt(heroName)} must look IDENTICAL to how they appear in Image ${prevSpreadImgIdx} (previous spread). Same skin tone, same features, same clothing.` : ""}

CRITICAL CONSISTENCY RULES:
- ${sanitizeForPrompt(heroName)} MUST look identical on every page — same face, same coloring, same outfit/markings
- When ANY visual detail conflicts between this description and Image 1, Image 1 wins
- No appearance changes between pages unless the story specifically calls for it`
  );

  if (characterAppearances.supporting) {
    const supportingText = Object.entries(characterAppearances.supporting)
      .map(([name, desc]) => {
        const frozen = allFrozenDescriptions[name];
        return frozen ? `- ${frozen}` : `- ${desc}`;
      })
      .join("\n");
    if (supportingText) {
      sections.push(
`SUPPORTING CHARACTERS:
${supportingText}
Must look identical to previous pages. Same skin tone, same features.`
      );
    }
  }

  if (ledgerBlock) {
    sections.push(ledgerBlock);
  }

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
Render the following EXACTLY as written. Every word must be correctly spelled. Do not change any words.
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
- CRITICAL: Every single spread MUST use the EXACT SAME text box style. If spread 1 has cloud boxes, ALL spreads must have identical cloud boxes.
${textBoxDesign ? `Additional style notes: ${textBoxDesign}` : ""}`
      );
    }
  }

  sections.push(
`STYLE:
${artStyle || "Classic children's storybook illustration, bold saturated colours, clean outlines, warm painterly backgrounds."}
Must be IDENTICAL on every page. Match Image 2 exactly.`
  );

  sections.push(
`RULES:
- Illustration fills ENTIRE image edge-to-edge
- NO borders, frames, or parchment edges
- NO page numbers
- NO speech bubbles or word balloons
- NO text outside the text boxes
- Character IDENTICAL to Image 1${prevSpreadImgIdx ? ` and Image ${prevSpreadImgIdx}` : ""} — same skin tone, ethnicity, hair, and features throughout the ENTIRE book
- Keep important content 5% from edges (safe zone)
- NOT photorealistic — illustrated children's book style`
  );

  return sections.join("\n\n");
}

// ══════════════════════════════════════════════════════════════════════════════
// CLAUDE AS ART DIRECTOR — Story + Visual Plan in ONE call
// ══════════════════════════════════════════════════════════════════════════════

// ── Book Type prompt overrides ────────────────────────────────────────────────
const BOOK_TYPE_PROMPTS = {
  adventure: `Write a classic narrative picture book with a beginning, middle, and satisfying end. Include a challenge the hero must overcome and a moment of triumph.`,
  nursery_rhyme: `Write in strict AABB rhyme scheme. Every line must rhyme with the next. 8-10 syllables per line. Musical, bouncy rhythm designed to be read aloud. Each spread is a new verse.`,
  bedtime: `Write a gentle, calming bedtime story. Start with a quiet adventure, gradually wind down, and end with the hero falling asleep. Soft, soothing language. The last spread must show the hero peacefully sleeping.`,
  abc: `Write a personalised alphabet book. Each spread covers 2-3 letters. Connect each letter to something from the hero's life, world, or personality. Use a rhyming couplet for each letter. Layout: letter large on the left page, illustration + text on the right.`,
  counting: `Write a personalised counting book from 1 to 10. Each spread covers 1-2 numbers. The items being counted should connect to the story theme. Accumulating pattern — each new number adds to the adventure. Layout: number large on the left, scene on the right.`,
  day_in_life: `Write a "day in the life" story following the hero from morning to bedtime. Each spread is a different time of day. Ground it in REAL activities the child does, but sprinkle in magical/special moments. Chronological flow: wake up -> morning -> midday -> afternoon -> evening -> bedtime.`,
  love_letter: `Write a book of affirmations and love. Each spread is a different reason why the hero is special. Direct address: "Did you know..." / "I love the way you..." / "You make the world better because..." Tender, heartfelt, makes the reader cry (in a good way). The final spread is the biggest declaration of love.`,
  superhero: `Write a superhero origin story. The hero discovers they have a unique power connected to something real about them (kindness, curiosity, laughter). Include an exciting challenge they must face and overcome using their power. End with them embracing their identity. Action-packed but with a heartfelt message.`,
};

function buildMasterSystemPrompt(cast, heroName, heroAge, styleName, tone, format, personalIngredient, pageCount, storyData) {
  const styleDesc = getNanoStyle(styleName);
  const supporting = cast.filter(c => !c.isHero);
  const bookType = storyData?.bookType || "adventure";
  const bookTypePrompt = BOOK_TYPE_PROMPTS[bookType] || BOOK_TYPE_PROMPTS.adventure;

  // Build character descriptions
  const heroChar = cast.find(c => c.isHero) || cast[0];
  const heroRole = heroChar?.role || "child";
  const isAdultHero = heroRole === "adult" || (heroAge && parseInt(heroAge, 10) >= 16);

  let castDesc = `MAIN CHARACTER: ${sanitizeForPrompt(heroName)}`;
  if (isAdultHero) {
    castDesc += heroAge ? `, ${heroAge} years old (ADULT — adult proportions, adult face, adult body)` : ` (ADULT — adult proportions, adult face, adult body)`;
  } else if (heroAge) {
    if (heroAge <= 3) castDesc += `, ${heroAge} years old (toddler — large head, chubby cheeks, short limbs)`;
    else if (heroAge <= 6) castDesc += `, ${heroAge} years old (young child — round face, big eyes, small stature)`;
    else if (heroAge <= 10) castDesc += `, ${heroAge} years old (older child — longer limbs, confident posture)`;
    else castDesc += `, ${heroAge} years old`;
  }

  // Add appearance descriptions from photo analysis
  if (heroChar?.appearanceDescription) {
    castDesc += `\nAppearance: ${heroChar.appearanceDescription}`;
  }

  supporting.forEach(c => {
    const roleMap = {
      mom: 'Mother', dad: 'Father', sibling: 'Sibling', pet: 'Family pet',
      grandma: 'Grandmother', grandpa: 'Grandfather', friend: 'Best friend',
      child: 'Child', baby: 'Baby', partner: 'Partner', other: 'Companion',
    };
    const role = roleMap[c.role] || c.role;
    castDesc += `\n${sanitizeForPrompt(c.name)}: ${role}`;
    if (c.appearanceDescription) {
      castDesc += ` — ${c.appearanceDescription}`;
    }
  });

  const toneMap = {
    "Cozy": "warm golden-hour lighting, soft glowing lamps, amber and honey tones, feels like a warm blanket",
    "Cozy & Warm": "warm golden-hour lighting, soft glowing lamps, amber and honey tones, feels like a warm blanket",
    "Exciting": "dynamic dramatic lighting, bold contrasts, vivid saturated colours, cinematic energy",
    "Exciting & Epic": "dynamic dramatic lighting, bold contrasts, vivid saturated colours, cinematic energy, wide sweeping shots",
    "Heartfelt": "soft diffused light, gentle warmth, intimate framing, tender atmosphere",
    "Heartfelt & Tender": "soft diffused light, gentle warmth, intimate close framing, tender atmosphere",
    "Funny": "bright playful lighting, exaggerated expressions, candy colours, maximum fun energy",
    "Funny & Silly": "bright playful lighting, exaggerated expressions, candy colours, physical comedy, maximum fun energy",
    "Dreamy & Magical": "ethereal glowing light, soft focus, magical particles, aurora colours, floating elements, surreal gentle beauty",
    "Spooky (but fun!)": "purple and orange Halloween palette, friendly ghosts, playful shadows, moonlit scenes, spooky-cute not scary",
  };
  const atmosphere = toneMap[tone] || toneMap["Cozy"];

  // Build world/setting vocabulary
  const worldObj = storyData?.world ? WORLDS?.find(w => w.id === storyData.world) : null;
  const worldVocab = worldObj?.vocab || "";

  // Build occasion context
  const occasionObj = storyData?.occasion ? OCCASIONS?.find(o => o.id === storyData.occasion) : null;
  const occasionPrompt = occasionObj?.prompt || "";

  // Build theme context
  const themeObj = storyData?.theme ? THEMES?.find(t => t.id === storyData.theme) : null;
  const themeLabel = themeObj?.label || "";

  // Calculate spread count
  const spreadCount = Math.ceil(pageCount / 2);

  return `You are a master children's book author AND art director. You will write an amazing story AND design every visual spread of the book.

═══ BOOK TYPE ═══
${bookTypePrompt}

═══ YOUR CHARACTERS ═══
${castDesc}

${personalIngredient ? `EMOTIONAL CORE: "${sanitizeForPrompt(personalIngredient)}" — weave this into the story's heart.` : ""}
${occasionPrompt ? `OCCASION: ${occasionPrompt}` : ""}
${themeLabel ? `THEME/LESSON: The story should explore the theme of "${themeLabel}".` : ""}
${worldVocab ? `SETTING: Use this visual vocabulary for the world: ${worldVocab}` : ""}

═══ THE BOOK FORMAT ═══
This is a ${pageCount}-page picture book with ${spreadCount} illustrated spreads.

Physical structure:
- PAGE 1: Front cover (single page, portrait 2:3)
- PAGES 2-3: First spread (two facing pages, landscape 4:3)
- PAGES 4-5: Second spread (landscape 4:3)
- PAGES 6-7: Third spread (landscape 4:3)
${pageCount > 6 ? `- PAGES 8-9: Fourth spread (landscape 4:3)
- PAGES 10-11: Fifth spread (landscape 4:3)` : ""}
- LAST PAGE: Back cover (single page, portrait 2:3)

When a reader opens the book, they see TWO pages at once (a spread). Each spread image shows the LEFT page and RIGHT page together, with a subtle crease/spine visible down the centre.

═══ ART STYLE ═══
Style: ${styleDesc}
Atmosphere: ${atmosphere}
${format === "rhyming" ? "Text boxes should feel whimsical and poetic." : ""}
${format === "funny" ? "Text boxes should feel playful and bouncy." : ""}

═══ COVER DESIGN (CRITICAL) ═══
The cover is the MOST IMPORTANT image. It must be stunning.

COMPOSITION RULES:
- Hero is the focal point: front-and-centre, 3/4 body or full body
- Hero is FACING the viewer or looking toward the adventure with wonder/excitement/determination
- Hero is at the THRESHOLD — the moment before the adventure begins. Standing at the edge of the forest. Looking up at the mountain. Reaching for the magic door.
- Leave the UPPER 30-40% relatively open or with sky/soft background for the title text to flow naturally
- Dramatic lighting: golden hour, sunset, sunrise, magical glow, volumetric light rays streaming through trees/clouds
- Rich environment that HINTS at the adventure without spoiling it
- Depth: foreground elements (grass, flowers, rocks) frame the character, background shows the world they're about to enter

WHAT NOT TO DO ON THE COVER:
- Character tiny in the distance
- Character with back to the viewer
- Flat, even lighting with no drama
- Scene that shows the CLIMAX instead of the beginning
- Cluttered scene with too many characters
- Dark or muddy colours
- Character floating in empty space with no environment

The cover should make someone scrolling on their phone STOP and think: "I need to make this for my kid."

═══ ART DIRECTION NOTES ═══
The app handles all technical prompt assembly (reference images, frozen blocks, rules). You focus ONLY on creative scene descriptions.

CHARACTER IDENTITY (IMPORTANT):
- Create a vivid, specific appearance string for each character
- Include this appearance in EVERY sceneDescription where that character appears
- NEVER describe a character differently from one spread to another
- Include: hair colour/style, skin tone, build, specific clothing with colours

═══ YOUR TASK ═══
1. First, create a CHARACTER APPEARANCE STRING for each character — a short, specific visual description (hair, skin, build, clothing) that will be COPIED into every scene description.
2. Write an incredible ${pageCount}-page children's story
3. Design the visual layout for every single spread
4. Write a detailed SCENE DESCRIPTION for each image (the app handles technical prompt assembly)

For each spread, YOU decide:
- How to split the story text between the left and right page
- Whether the illustration is one continuous scene across both pages, or two distinct panels
- The camera angle and composition (wide establishing shot, intimate close-up, dramatic low angle, etc.)
- The lighting and colour mood for this specific moment
- Which characters are visible and how they're positioned
- What details in the environment tell the story

Think like a REAL picture book designer. NEVER use the same layout twice in a row.

LAYOUT OPTIONS (use ALL of these across a book):

1. PANORAMIC — One continuous scene spanning both pages.
   Text boxes at the bottom, one per page. Epic, sweeping.
   Use for: adventure moments, big reveals, beautiful vistas.

2. SPLIT SCENE — Two distinct but connected scenes, one per page.
   Each with its own text box at the bottom.
   Use for: before/after, cause/effect, two perspectives.

3. HERO CLOSE-UP — One page is a close-up of the character's face
   showing emotion. Other page is the wider scene. Text on the
   wider-scene page only.
   Use for: emotional moments, reactions, tender scenes.

4. FULL BLEED — Illustration fills EVERYTHING. Text boxes overlay
   the art in the lower corners or centre-bottom. Minimal text.
   Let the art tell the story.
   Use for: the most dramatic/beautiful moment.

5. VIGNETTE — Character in centre of both pages, surrounded by
   white/soft space. Small decorative text below.
   Use for: quiet moments, endings, dedications.

6. ACTION SEQUENCE — Left page shows the start of an action,
   right page shows the result. Dynamic, energetic.
   Use for: something happening, movement, surprise.

RULES:
- NEVER use the same layout on consecutive spreads
- Use at least 3 different layouts in a 6-page book
- Use at least 4 different layouts in a 10-page book
- The FINAL spread should be the most emotionally impactful
  (usually HERO CLOSE-UP or FULL BLEED)
- The FIRST spread should be visually striking (PANORAMIC or
  FULL BLEED) to hook the reader
- Text boxes can go ANYWHERE — top, bottom, corner, centre,
  one side only. Vary their position.
- Some spreads should have text on only ONE page

In your sceneDescription, STATE the layout type:
"LAYOUT: PANORAMIC — one continuous sunset beach scene..."
"LAYOUT: HERO CLOSE-UP — left page shows Dom's amazed face..."

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
  "textBoxDesign": "Soft cloud/speech-bubble shape, smooth rounded edges, semi-transparent white/cream fill, thin warm border, hand-drawn/handwritten font (not cursive, not serif), 25-35% of image area, top-left and bottom-right positioning, IDENTICAL on every page",
  "artStyle": "[full art style description matching the chosen style]",
  "cover": {
    "sceneDescription": "COVER SCENE: [80-150 words describing the cover composition]. The hero should be the focal point, positioned front and centre or in a dynamic pose. The scene shows the THRESHOLD of the adventure — the moment before it begins. Include: character position/pose/expression, environment that hints at the adventure, dramatic lighting (golden hour, magical glow, volumetric light rays), where the title text should flow in the upper portion, and overall mood. Make this the MOST BEAUTIFUL image in the entire book.",
    "titleText": "The Story Title",
    "authorName": "By [Author Name]",
    "aspectRatio": "2:3"
  },
  "spreads": [
    {
      "spreadNumber": 1,
      "leftPageText": "Story text for the left page...",
      "rightPageText": "Story text for the right page...",
      "sceneDescription": "DETAILED description of the spread — this is a two-page illustration. Describe what appears on the left side and right side. Include: characters present and their poses/expressions, environment details, lighting, camera angle (wide/medium/close-up), emotional mood. 80-150 words.",
      "aspectRatio": "4:3"
    }
  ],
  "backCover": {
    "sceneDescription": "A peaceful, emotional closing scene. The hero seen from behind or in silhouette in a beautiful setting that echoes the story's world. Warm, golden-hour or twilight lighting. Leave the lower third of the image slightly darker/softer to allow text overlay. Do NOT render any text in the image — the app overlays the author and dedication text separately. 80-150 words.",
    "aspectRatio": "2:3"
  }
}

CRITICAL:
- sceneDescription is the ONLY creative writing you do for images. The app handles all technical prompt structure (reference images, frozen blocks, rules).
- Make each sceneDescription 80-150 words, richly detailed
- Include character appearance strings in each sceneDescription where that character appears
- Include camera angle, lighting, character positions, expressions
- Vary composition across spreads (wide shots, close-ups, etc.)
- COVER: The app will hand-letter the title INTO the image as part of the art. Your cover sceneDescription should describe WHERE the title text should flow (e.g. "the upper third has open sky for the title to arc across"). Do NOT write the title text in the sceneDescription — just describe the visual scene and composition. Make the cover BREATHTAKING.
- BACK COVER: Do NOT describe any text in the back cover sceneDescription. The app overlays "The End", author, and dedication text separately. Leave the bottom third softer for text overlay. Scene should be peaceful and reflective — the adventure is over.

${format === "rhyming" ? "Write in strict AABB rhyme scheme. 8-10 syllables per line." : ""}
${format === "funny" ? "Make it genuinely funny with surprises and silly moments." : ""}

Return ONLY the JSON. No preamble. No markdown.`;
}

function buildMasterUserPrompt(wizardData) {
  const bookTypeLabel = {
    adventure: "adventure story",
    nursery_rhyme: "nursery rhyme book",
    bedtime: "bedtime story",
    abc: "ABC alphabet book",
    counting: "counting book",
    superhero: "superhero origin story",
    love_letter: "love letter / affirmation book",
    day_in_life: "day in the life story",
  }[wizardData.bookType] || "adventure story";

  return `Create a personalized children's ${bookTypeLabel}.

Hero: ${sanitizeForPrompt(wizardData.heroName)}${wizardData.heroAge ? ` (age ${wizardData.heroAge})` : ""}
Story idea: ${sanitizeForPrompt(wizardData.storyIdea || wizardData.sparkText || wizardData.spark || "A magical adventure")}
${wizardData.personalIngredient ? `Personal detail: "${sanitizeForPrompt(wizardData.personalIngredient)}"` : ""}
${wizardData.tone ? `Mood: ${wizardData.tone}` : ""}
${wizardData.details ? `Extra details: ${sanitizeForPrompt(wizardData.details)}` : ""}

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
    storyData.pageCount || 6,
    storyData
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
        try {
          parsed = JSON.parse(retryCleaned);
        } catch (retryErr) {
          throw new Error(`Story JSON parse failed after retry: ${retryErr.message}`);
        }
      }
    } else {
      // Retry once
      const retryRaw = await claudeCall(systemPrompt, userPrompt, maxTokens);
      const retryCleaned = retryRaw.replace(/```json\s*|```\s*/g, "").trim();
      try {
        parsed = JSON.parse(retryCleaned);
      } catch (retryErr) {
        throw new Error(`Story JSON parse failed after retry: ${retryErr.message}`);
      }
    }
  }

  // Validate structure
  if (!parsed.title || !parsed.cover || !Array.isArray(parsed.spreads) || parsed.spreads.length === 0) {
    throw new Error("Invalid story structure. Please try again.");
  }

  // Ensure each spread has required fields
  parsed.spreads = parsed.spreads.filter(Boolean).map((spread, i) => ({
    spreadNumber: spread?.spreadNumber || i + 1,
    leftPageText: spread?.leftPageText || "",
    rightPageText: spread?.rightPageText || "",
    sceneDescription: spread?.sceneDescription || spread?.imagePrompt || "",
    aspectRatio: spread?.aspectRatio || "4:3",
  }));

  // Ensure cover and back cover
  parsed.cover = {
    sceneDescription: parsed.cover.sceneDescription || parsed.cover.imagePrompt || "",
    titleText: parsed.cover.titleText || parsed.title || "",
    authorName: parsed.cover.authorName || storyData.authorName || "A loving family",
    aspectRatio: parsed.cover.aspectRatio || "2:3",
  };
  parsed.backCover = parsed.backCover || {
    sceneDescription: "",
    aspectRatio: "2:3",
  };
  if (!parsed.backCover.sceneDescription && parsed.backCover.imagePrompt) {
    parsed.backCover.sceneDescription = parsed.backCover.imagePrompt;
  }

  // Ensure top-level fields for prompt assembly
  parsed.characterAppearances = parsed.characterAppearances || { hero: `${sanitizeForPrompt(storyData.heroName) || "the character"}`, supporting: {} };
  parsed.textBoxDesign = parsed.textBoxDesign || "Soft cloud/speech-bubble shape, smooth rounded edges, semi-transparent white/cream fill, thin warm border, hand-drawn/handwritten font (not cursive, not serif), 25-35% of image area, IDENTICAL on every page";
  parsed.artStyle = parsed.artStyle || getNanoStyle(styleName);

  return parsed;
}

// ── Character Ledger — self-improving corrections across pages ───────────────
function updateCharacterLedger(ledger, valResult) {
  if (!valResult || valResult.skipped) return;

  // Extract character-specific corrections from validation fixNotes and issues
  const fixNotes = valResult.fixNotes || '';
  const issues = valResult.issues || [];
  const allFeedback = [fixNotes, ...issues].filter(Boolean).join(' ');

  if (!allFeedback) return;

  // Look for face/skin/hair/appearance-related corrections
  const facePatterns = [
    /skin\s*(?:tone|color|colour)\s*(?:is|should|must|needs?\s*to\s*be)\s*([^.]+)/gi,
    /hair\s*(?:is|should|must|needs?\s*to\s*be)\s*([^.]+)/gi,
    /(?:face|facial)\s*(?:features?|structure)?\s*(?:is|should|must|needs?\s*to\s*be|looks?)\s*([^.]+)/gi,
    /(?:character|hero|child)\s*(?:looks?|appears?|should)\s*(?:more|less|too)\s*([^.]+)/gi,
    /(?:wrong|incorrect|different)\s*(?:skin|hair|face|ethnicity|race)\s*([^.]*)/gi,
  ];

  const corrections = [];
  for (const pattern of facePatterns) {
    let match;
    while ((match = pattern.exec(allFeedback)) !== null) {
      corrections.push(match[0].trim());
    }
  }

  // Also capture general consistency notes
  if (/(?:doesn't match|does not match|inconsistent|different from)/i.test(allFeedback)) {
    corrections.push(allFeedback.substring(0, 200));
  }

  if (corrections.length > 0) {
    if (!ledger.corrections) ledger.corrections = [];
    ledger.corrections.push(...corrections);
    // Keep only the most recent 10 corrections to avoid prompt bloat
    ledger.corrections = ledger.corrections.slice(-10);
  }
}

function buildLedgerBlock(ledger) {
  if (!ledger || !ledger.corrections || ledger.corrections.length === 0) return null;

  // Deduplicate and build the correction block
  const unique = [...new Set(ledger.corrections)];
  return `CHARACTER CORRECTIONS FROM PREVIOUS PAGES (apply these fixes):
${unique.map(c => `- ${c}`).join('\n')}`;
}

// ── Generate ALL images using code-assembled prompts ──────────────────────────
// Sequential chained flow: cover → spread1 → spread2 → ... → back cover
// Each image references the hero photo + cover (style anchor) + previous image
export async function generateAllImages(
  storyPlan, heroPhotoUrl, onImageReady, tier, companionPhotoUrls = {},
  { frozenCharacterDescription = null, heroType = 'child', allFrozenDescriptions = {} } = {}
) {
  const bookStartTime = Date.now();
  const images = {};
  const permanentImages = {};
  const savePromises = [];
  const tempBookId = `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let previousImageUrl = null;
  let totalImageGenerations = 0; // tracks all attempts including retries
  let textBoxStyleReference = null; // captured from first spread validation
  const characterLedger = {}; // accumulates character corrections across pages

  const { characterAppearances, textBoxDesign, artStyle } = storyPlan;
  const heroName = characterAppearances?.hero?.split("—")[0]?.trim() || "the character";
  const companionNames = Object.keys(companionPhotoUrls);
  const companionUrls = Object.values(companionPhotoUrls);

  // Build complete character photo array: hero first, then companions
  // This order must match the REFERENCE IMAGES section in assembleImagePrompt
  const allCharacterPhotoUrls = [heroPhotoUrl, ...companionUrls].filter(Boolean);

  console.log("CAST_PHOTOS:", JSON.stringify({
    heroPhotoUrl: heroPhotoUrl?.substring(0, 60) || null,
    companionCount: companionUrls.length,
    totalCharacterPhotos: allCharacterPhotoUrls.length,
    companionNames,
  }));

  // Build characterDescriptions for validation
  const characterDescriptions = [
    { name: heroName, relationship: 'hero', hasPhoto: !!heroPhotoUrl },
    ...companionNames.map(name => ({
      name,
      relationship: 'supporting',
      hasPhoto: !!companionPhotoUrls[name],
    })),
  ];

  // ── Helper: run multi-attempt generation + validation loop ──
  async function generateWithRetries({
    pageType, originalPrompt, expectedTexts, sceneDescription,
    maxAttempts, stopAtTier, generateArgs, onProgress,
  }) {
    const allAttempts = [];
    const pageStartTime = Date.now();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const attemptStartTime = Date.now();
        // Build prompt — first attempt uses original, retries append fixNotes
        const bestSoFar = allAttempts.length > 0
          ? selectBestImage(allAttempts, !!heroPhotoUrl)
          : null;
        const prompt = attempt === 0
          ? originalPrompt
          : `${originalPrompt}\n\nPREVIOUS ATTEMPT FAILED. FIX THESE ISSUES:\n${bestSoFar?.validation?.fixNotes || 'Improve overall quality.'}`;

        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));

        totalImageGenerations++;
        const imageUrl = await generateImage(prompt, ...generateArgs, tempBookId, attempt + 1);
        console.log(`TIMING_GEN: ${pageType} attempt ${attempt + 1} — ${Date.now() - attemptStartTime}ms`);

        if (!imageUrl || !(await validateImageUrl(imageUrl))) {
          allAttempts.push({
            imageUrl: null,
            validation: { textScore: 0, faceScore: 0, textBoxScore: 0, sceneAccuracy: 0, formatOk: false, issues: ['Invalid image URL'] },
            attempt,
          });
          continue;
        }

        // Show progress: update bubble with current best image during retries
        if (onProgress) onProgress(imageUrl);

        // Validate
        let valResult;
        try {
          valResult = await validateImage(
            imageUrl, expectedTexts, heroName, artStyle, pageType,
            sceneDescription, tempBookId, heroPhotoUrl,
            characterDescriptions, textBoxStyleReference,
            prompt, attempt + 1
          );
        } catch (valErr) {
          console.warn(`Validation call failed for ${pageType}:`, valErr.message);
          valResult = null;
        }

        // If validation infrastructure failed (API error, network error, parse error),
        // don't block the image — accept it immediately and stop retrying.
        // Validation is a quality check, not a hard gate for book generation.
        const isInfraFailure = !valResult
          || valResult.skipped === true
          || valResult.reason === 'validation_api_error'
          || valResult.reason === 'network_error'
          || valResult.reason === 'parse_error'
          || valResult.reason?.startsWith('validation_skipped');

        if (isInfraFailure) {
          const reason = valResult?.reason || 'no_response';
          console.log(`TIMING_VAL: ${pageType} attempt ${attempt + 1} — ${Date.now() - attemptStartTime}ms total (validation skipped)`);
          console.log(`VALIDATION_SKIPPED: ${pageType} attempt ${attempt + 1} — reason: ${reason}, using image without scores`);
          // Build a pass-through result: scores high enough to pass hard gates,
          // tagged so admin dashboard can distinguish infra failures from real passes
          allAttempts.push({
            imageUrl,
            validation: {
              pass: true,
              formatOk: true,
              textScore: 7,
              faceScore: 7,
              textBoxScore: null,
              sceneAccuracy: 7,
              fingersOk: true,
              characterCount: 1,
              issues: [`validation_skipped: ${reason}`],
              fixNotes: '',
              qualityTier: 'good',
              compositeScore: 7,
            },
            attempt,
          });
          break; // Don't burn more retries — validation is broken, not the image
        }

        // Capture text box style from first successful spread validation
        if (!textBoxStyleReference && valResult.textBoxDescription && pageType !== 'cover' && pageType !== 'back_cover') {
          textBoxStyleReference = valResult.textBoxDescription;
        }

        // Update character ledger with corrections from this validation
        updateCharacterLedger(characterLedger, valResult);

        allAttempts.push({ imageUrl, validation: valResult, attempt });
        console.log(`TIMING_VAL: ${pageType} attempt ${attempt + 1} — ${Date.now() - attemptStartTime}ms total`);

        // Check if we can stop early
        const qualityTier = getQualityTier(valResult);
        console.log(`VALIDATION: ${pageType} attempt ${attempt + 1}/${maxAttempts} — tier=${qualityTier}, text=${valResult.textScore}, face=${valResult.faceScore}, textBox=${valResult.textBoxScore || '?'}, scene=${valResult.sceneAccuracy}`);

        if (qualityTier === 'excellent') break; // Always stop at excellent
        if (qualityTier === stopAtTier) break;   // Stop at target tier for this page type
      } catch (err) {
        console.warn(`${pageType} attempt ${attempt + 1} failed:`, err.message);
        allAttempts.push({
          imageUrl: null,
          validation: { textScore: 0, faceScore: 0, textBoxScore: 0, sceneAccuracy: 0, formatOk: false, issues: [err.message] },
          attempt,
        });
      }
    }

    // Select the best image from all attempts
    const validAttempts = allAttempts.filter(a => a.imageUrl);
    if (validAttempts.length === 0) {
      console.log(`TIMING_PAGE: ${pageType} — ${Date.now() - pageStartTime}ms, 0 valid attempt(s) of ${allAttempts.length}`);
      return null;
    }

    console.log(`TIMING_PAGE: ${pageType} — ${Date.now() - pageStartTime}ms, ${allAttempts.length} attempt(s)`);
    const best = selectBestImage(validAttempts, !!heroPhotoUrl);
    // Safety fallback: if hard gates rejected everything but we have images, use the first one
    // This prevents "All illustrations failed" when validation infrastructure is down
    if (!best && validAttempts.length > 0) {
      console.warn(`HARD_GATE_FALLBACK: ${pageType} — selectBestImage returned null, using first valid image`);
      return validAttempts[0];
    }
    return best;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. COVER — max 2 attempts, stop at excellent
  // ═══════════════════════════════════════════════════════════════
  const coverPrompt = assembleImagePrompt({
    sceneDescription: storyPlan.cover.sceneDescription,
    characterAppearances,
    artStyle,
    pageTexts: storyPlan.cover.titleText ? [storyPlan.cover.titleText] : [storyPlan.title || "Untitled"],
    isCover: true,
    heroName,
    authorName: storyPlan.cover.authorName || storyPlan.authorName || "A loving family",
    subtitleText: storyPlan.subtitleText || null,
    companionNames,
    frozenCharacterDescription,
    heroType,
    allFrozenDescriptions,
  });

  const coverResult = await generateWithRetries({
    pageType: 'cover',
    originalPrompt: coverPrompt,
    expectedTexts: storyPlan.cover.titleText ? [storyPlan.cover.titleText] : [],
    sceneDescription: storyPlan.cover.sceneDescription,
    maxAttempts: 2,
    stopAtTier: 'excellent',
    generateArgs: [allCharacterPhotoUrls, tier, null, [], storyPlan.cover.aspectRatio || "2:3", true],
    onProgress: (url) => { if (onImageReady) onImageReady("cover", url); },
  });

  if (coverResult) {
    images.cover = coverResult.imageUrl;
    previousImageUrl = coverResult.imageUrl;
    logCost("nano_banana", "nano-banana-pro", true, 0, null);
    savePromises.push(
      saveBookImage(coverResult.imageUrl, tempBookId, 'cover', 0)
        .then(permanentUrl => { if (permanentUrl && permanentUrl !== coverResult.imageUrl) permanentImages.cover = permanentUrl; })
        .catch(err => console.warn('SAVE_IMAGE_FAILED:', err.message))
    );
  }
  if (onImageReady) onImageReady("cover", images.cover || null);

  // ═══════════════════════════════════════════════════════════════
  // 2. SPREADS — max 2 attempts, stop at good
  // ═══════════════════════════════════════════════════════════════
  for (let i = 0; i < storyPlan.spreads.length; i++) {
    const spread = storyPlan.spreads[i];
    const isFirst = (i === 0);

    const spreadPrompt = assembleImagePrompt({
      sceneDescription: spread.sceneDescription,
      characterAppearances,
      textBoxDesign,
      artStyle,
      pageTexts: [spread.leftPageText, spread.rightPageText],
      isFirstSpread: isFirst,
      heroName,
      companionNames,
      frozenCharacterDescription,
      heroType,
      allFrozenDescriptions,
      ledgerBlock: buildLedgerBlock(characterLedger),
    });

    // Style references: cover (style anchor) + previous spread (continuity)
    const styleRefs = [];
    if (images.cover) styleRefs.push(images.cover);
    if (!isFirst && previousImageUrl && previousImageUrl !== images.cover) {
      styleRefs.push(previousImageUrl);
    }

    const maxAttempts = 2; // Same for all pages
    const spreadIdx = i;
    const spreadResult = await generateWithRetries({
      pageType: 'spread',
      originalPrompt: spreadPrompt,
      expectedTexts: [spread.leftPageText, spread.rightPageText],
      sceneDescription: spread.sceneDescription,
      maxAttempts,
      stopAtTier: 'good',
      generateArgs: [allCharacterPhotoUrls, tier, null, styleRefs, spread.aspectRatio || "4:3", false],
      onProgress: (url) => { if (onImageReady) onImageReady(`spread_${spreadIdx}`, url); },
    });

    if (spreadResult) {
      images[`spread_${i}`] = spreadResult.imageUrl;
      previousImageUrl = spreadResult.imageUrl;
      logCost("nano_banana", "nano-banana-pro", true, 0, null);
      savePromises.push(
        saveBookImage(spreadResult.imageUrl, tempBookId, 'spread', i)
          .then(permanentUrl => { if (permanentUrl && permanentUrl !== spreadResult.imageUrl) permanentImages[`spread_${i}`] = permanentUrl; })
          .catch(err => console.warn('SAVE_IMAGE_FAILED:', err.message))
      );
    } else {
      images[`spread_${i}`] = null;
    }

    if (onImageReady) onImageReady(`spread_${i}`, images[`spread_${i}`] || null);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. BACK COVER — 2 attempts, stop at good
  // ═══════════════════════════════════════════════════════════════
  const backPrompt = assembleImagePrompt({
    sceneDescription: storyPlan.backCover?.sceneDescription || "A peaceful closing scene. The hero seen from behind, looking out at a beautiful vista that echoes the story's world. Warm golden-hour lighting, soft atmosphere. The adventure is over. Calm, reflective, warm.",
    characterAppearances,
    artStyle,
    isBackCover: true,
    heroName,
    companionNames,
    frozenCharacterDescription,
    heroType,
    allFrozenDescriptions,
    ledgerBlock: buildLedgerBlock(characterLedger),
  });

  const backStyleRefs = [];
  if (images.cover) backStyleRefs.push(images.cover);
  // Add the last successful spread for visual continuity (prefer the most recent one)
  const lastSpreadUrl = previousImageUrl
    || [...storyPlan.spreads].reverse().map((_, i) => images[`spread_${storyPlan.spreads.length - 1 - i}`]).find(Boolean);
  if (lastSpreadUrl && lastSpreadUrl !== images.cover) {
    backStyleRefs.push(lastSpreadUrl);
  }

  const backResult = await generateWithRetries({
    pageType: 'back_cover',
    originalPrompt: backPrompt,
    expectedTexts: [],
    sceneDescription: storyPlan.backCover?.sceneDescription || "",
    maxAttempts: 2,
    stopAtTier: 'good',
    generateArgs: [allCharacterPhotoUrls, tier, null, backStyleRefs, storyPlan.backCover?.aspectRatio || "2:3", false],
    onProgress: (url) => { if (onImageReady) onImageReady("backCover", url); },
  });

  if (backResult) {
    images.backCover = backResult.imageUrl;
    logCost("nano_banana", "nano-banana-pro", true, 0, null);
    savePromises.push(
      saveBookImage(backResult.imageUrl, tempBookId, 'back_cover', 0)
        .then(permanentUrl => { if (permanentUrl && permanentUrl !== backResult.imageUrl) permanentImages.backCover = permanentUrl; })
        .catch(err => console.warn('SAVE_IMAGE_FAILED:', err.message))
    );
  } else {
    images.backCover = null;
  }
  if (onImageReady) onImageReady("backCover", images.backCover || null);

  // Check if we got at least some images
  const spreadImages = storyPlan.spreads.map((_, i) => images[`spread_${i}`]);
  if (!images.cover && spreadImages.every(url => !url)) {
    throw new Error("All illustrations failed. Please try again.");
  }

  console.log(`TIMING_BOOK: ${Date.now() - bookStartTime}ms total, ${totalImageGenerations} image generation(s)`);

  // Wait for permanent saves to complete — these store images in Supabase storage
  // so they don't expire when Replicate CDN URLs rotate (~1 hour).
  // Give generous timeout since image download + sharp processing + upload can take time.
  await Promise.race([
    Promise.allSettled(savePromises),
    new Promise(r => setTimeout(r, 30000)),
  ]);

  return { images, tempBookId, permanentImages, totalImageGenerations, savePromises };
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

// ── Upload companion photos ──────────────────────────────────────────────────
export async function uploadCompanionPhotos(cast) {
  const urls = {};
  const companions = cast.filter((c) => !c.isHero && (c.photo || c.photos?.some((p) => p.dataUri)));
  await Promise.all(
    companions.map(async (c) => {
      let photoUri = null;
      const photos = c.photos?.filter((p) => p.dataUri) || [];
      if (photos.length > 0) {
        photoUri = photos[0].dataUri;
      } else if (c.photo) {
        photoUri = c.photo;
      }
      if (!photoUri) return;
      try {
        const url = await uploadPhoto(photoUri);
        if (url) urls[c.name] = url;
      } catch {
        // Non-critical — companion photo upload failure doesn't block generation
      }
    })
  );
  return urls;
}

// ── Generate a single page image (fallback for edits) ────────────────────────
export async function generatePageImage(sceneDescription, cast, styleName, heroPhotoUrl, mood) {
  const styleDesc = getNanoStyle(styleName);
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
    `Current text: "${sanitizeForPrompt(currentText)}"\nInstruction: "${sanitizeForPrompt(instruction)}"\nCharacters: ${sanitizeForPrompt(characterNames)}`,
    200
  );
}
