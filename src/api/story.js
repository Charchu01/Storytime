import { claudeCall, generateImage, uploadPhoto, validateImage } from "./client";
import { ROLES, STYLES, WORLDS, OCCASIONS, THEMES } from "../constants/data";

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

// Legacy compat
const NANO_STYLES = {
  "Classic Storybook": "classic children's storybook illustration with bold saturated colours, clean outlines, and warm painterly backgrounds",
  "Soft Watercolor": "soft watercolour children's book illustration with visible brushstrokes, dreamy washes, and gentle colour bleeds",
  "Bold & Bright": "modern vibrant children's book illustration with thick bold outlines, flat graphic colours, and playful energy",
  "Cozy & Soft": "gentle pastel children's bedtime book illustration with rounded shapes, soft muted tones, and cozy warmth",
  "Sketch & Color": "whimsical hand-drawn children's book illustration with visible pencil lines, loose ink outlines, and watercolour wash fills",
  Storybook: "classic children's storybook illustration with bold saturated colours, clean outlines, and warm painterly backgrounds",
  Watercolor: "soft watercolour children's book illustration with visible brushstrokes, dreamy washes, and gentle colour bleeds",
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
  const isAdult = character.role === "adult" || (character.age && parseInt(character.age) >= 16);

  try {
    const description = await claudeCall(
      `You are a professional children's book illustrator creating a character reference sheet. Your description will be fed DIRECTLY into an AI image generator to draw this person as a storybook character.

CRITICAL: Look at the PHOTO FIRST. Describe EXACTLY what you see — the REAL person in the image. Do NOT invent or assume features. If the person is clearly an adult, describe them as an adult. If they have a shaved head, say "shaved head" or "buzz cut" — do NOT write "curly hair" if you see no curls.

Write an EXTREMELY specific and vivid visual description (4-6 sentences):
- EXACT hair: color, texture, length/style — or "shaved/buzz cut" if applicable
- EXACT skin tone (e.g. "warm golden brown", "fair with rosy cheeks", "olive-toned")
- Eye color and shape
- Face shape and key features (jawline, cheekbones, dimples, stubble/beard if present)
- Body build: ${isAdult ? "adult build (tall, average, stocky, slim, muscular, etc.)" : "child build for their age (chubby toddler, slim, sturdy)"}
- Any distinctive features (glasses, birthmark, facial hair, etc.)

Format as a single flowing paragraph. Do NOT mention clothing. Do NOT use vague terms. Write in third person.
${isAdult ? "\nIMPORTANT: This person is an ADULT. Do NOT describe them as a child. Use adult body proportions and features." : ""}`,
      `This is ${character.name}, a ${role}${ageNote}. Look at the photo carefully and describe EXACTLY what you see — their real physical appearance.`,
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
  companionNames = [],
}) {
  const sections = [];

  // ── REFERENCE IMAGES (always first) ──────────────────
  // Build companion reference lines
  const companionRefLines = companionNames.map((name, i) => {
    const imgNum = isCover ? i + 2 : isBackCover ? i + 3 : isFirstSpread ? i + 3 : i + 4;
    return `- Image ${imgNum}: Photo of ${name} — match their EXACT facial features, head shape, hair, and skin tone. Transform into the illustrated art style.`;
  }).join("\n");

  if (isCover) {
    sections.push(
`REFERENCE IMAGES:
- Image 1: Photograph of ${heroName}. Match their EXACT facial features, head shape, hair, and skin tone. Transform into the illustrated art style — NOT photorealistic.${companionRefLines ? "\n" + companionRefLines : ""}`
    );
  } else if (isBackCover) {
    sections.push(
`REFERENCE IMAGES:
- Image 1: Photo of ${heroName} — match face identity.
- Image 2: The COVER of this book — match this EXACT art style, colour palette, and brush technique.${companionRefLines ? "\n" + companionRefLines : ""}`
    );
  } else if (isFirstSpread) {
    sections.push(
`REFERENCE IMAGES:
- Image 1: Photo of ${heroName} — match EXACT facial features.
- Image 2: The COVER of this book — your STYLE BIBLE. Match this EXACT art style, colour palette, brush technique, and text box design on this page.${companionRefLines ? "\n" + companionRefLines : ""}`
    );
  } else {
    sections.push(
`REFERENCE IMAGES:
- Image 1: Photo of ${heroName} — match EXACT facial features.
- Image 2: The COVER of this book — your STYLE BIBLE. Match this exact art style.
- Image 3: The PREVIOUS SPREAD. Maintain visual continuity. ${heroName} must look IDENTICAL to this image. Same style, same colour temperature.${companionRefLines ? "\n" + companionRefLines : ""}`
    );
  }

  // ── CHARACTER ────────────────────────────────────────
  sections.push(
`CHARACTER:
${characterAppearances.hero}
${heroName}'s face MUST match Image 1. When in doubt, match the photo. NOT photorealistic — illustrated style.`
  );

  // Add supporting characters if present
  if (characterAppearances.supporting) {
    const supportingText = Object.entries(characterAppearances.supporting)
      .map(([name, desc]) => `- ${desc}`)
      .join("\n");
    if (supportingText) {
      sections.push(
`SUPPORTING CHARACTERS:
${supportingText}
Must look identical to previous pages.`
      );
    }
  }

  // ── SCENE (from Claude's creative writing) ───────────
  sections.push(`SCENE:\n${sceneDescription}`);

  // ── TEXT (if page has text boxes) ────────────────────
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
`TEXT BOX DESIGN (identical on every page):
${textBoxDesign || "Simple rectangular box, thin dark brown ornate border, small corner flourishes, warm cream fill, dark brown elegant serif text, centred. Same design every page."}`
      );
    }
  }

  // ── STYLE ───────────────────────────────────────────
  sections.push(
`STYLE:
${artStyle || "Classic children's storybook illustration, bold saturated colours, clean outlines, warm painterly backgrounds."}
Must be IDENTICAL on every page. Match Image 2 exactly.`
  );

  // ── RULES ───────────────────────────────────────────
  sections.push(
`RULES:
- Illustration fills ENTIRE image edge-to-edge
- NO borders, frames, or parchment edges
- NO page numbers
- NO speech bubbles or word balloons
- NO text outside the text boxes
- Character IDENTICAL to Image 1${!isCover && !isFirstSpread ? " and Image 3" : ""}
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
  const isAdultHero = heroRole === "adult" || (heroAge && parseInt(heroAge) >= 16);

  let castDesc = `MAIN CHARACTER: ${heroName}`;
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

${personalIngredient ? `EMOTIONAL CORE: "${personalIngredient}" — weave this into the story's heart.` : ""}
${occasionPrompt ? `OCCASION: ${occasionPrompt}` : ""}
${themeLabel ? `THEME/LESSON: The story should explore the theme of "${themeLabel}".` : ""}
${worldVocab ? `SETTING: Use this visual vocabulary for the world: ${worldVocab}` : ""}

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
  "textBoxDesign": "Simple rectangular box, thin dark brown ornate border, small corner flourishes, warm cream fill, dark brown elegant serif text, centred",
  "artStyle": "[full art style description matching the chosen style]",
  "cover": {
    "sceneDescription": "Detailed description of the cover scene — composition, characters, environment, lighting, mood. Include where the title text should appear. 80-150 words.",
    "titleText": "The Story Title",
    "aspectRatio": "3:4"
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
    "sceneDescription": "Back cover scene description...",
    "aspectRatio": "3:4"
  }
}

CRITICAL:
- sceneDescription is the ONLY creative writing you do for images. The app handles all technical prompt structure (reference images, frozen blocks, rules).
- Make each sceneDescription 80-150 words, richly detailed
- Include character appearance strings in each sceneDescription where that character appears
- Include camera angle, lighting, character positions, expressions
- Vary composition across spreads (wide shots, close-ups, etc.)

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

Hero: ${wizardData.heroName}${wizardData.heroAge ? ` (age ${wizardData.heroAge})` : ""}
Story idea: ${wizardData.storyIdea || wizardData.sparkText || wizardData.spark || "A magical adventure"}
${wizardData.personalIngredient ? `Personal detail: "${wizardData.personalIngredient}"` : ""}
${wizardData.tone ? `Mood: ${wizardData.tone}` : ""}
${wizardData.details ? `Extra details: ${wizardData.details}` : ""}

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
    sceneDescription: spread.sceneDescription || spread.imagePrompt || "",
    aspectRatio: spread.aspectRatio || "4:3",
  }));

  // Ensure cover and back cover
  parsed.cover = {
    sceneDescription: parsed.cover.sceneDescription || parsed.cover.imagePrompt || "",
    titleText: parsed.cover.titleText || parsed.title || "",
    aspectRatio: parsed.cover.aspectRatio || "3:4",
  };
  parsed.backCover = parsed.backCover || {
    sceneDescription: "",
    aspectRatio: "3:4",
  };
  if (!parsed.backCover.sceneDescription && parsed.backCover.imagePrompt) {
    parsed.backCover.sceneDescription = parsed.backCover.imagePrompt;
  }

  // Ensure top-level fields for prompt assembly
  parsed.characterAppearances = parsed.characterAppearances || { hero: `${storyData.heroName || "the character"}`, supporting: {} };
  parsed.textBoxDesign = parsed.textBoxDesign || "Simple rectangular box, thin dark brown ornate border, small corner flourishes, warm cream fill, dark brown elegant serif text, centred";
  parsed.artStyle = parsed.artStyle || getNanoStyle(styleName);

  return parsed;
}

// ── Generate ALL images using code-assembled prompts ──────────────────────────
// Sequential chained flow: cover → spread1 → spread2 → ... → back cover
// Each image references the hero photo + cover (style anchor) + previous image
export async function generateAllImages(
  storyPlan, heroPhotoUrl, onImageReady, tier, companionPhotoUrls = {}
) {
  const images = {};
  let previousImageUrl = null;

  const { characterAppearances, textBoxDesign, artStyle } = storyPlan;
  const heroName = characterAppearances?.hero?.split("—")[0]?.trim() || "the character";
  const companionNames = Object.keys(companionPhotoUrls);
  const companionUrls = Object.values(companionPhotoUrls);

  // 1. Generate cover (assembled prompt)
  const coverPrompt = assembleImagePrompt({
    sceneDescription: storyPlan.cover.sceneDescription,
    characterAppearances,
    textBoxDesign,
    artStyle,
    pageTexts: storyPlan.cover.titleText
      ? [`Title: ${storyPlan.cover.titleText}`]
      : null,
    isCover: true,
    heroName,
    companionNames,
  });

  try {
    let coverUrl = await generateImage(
      coverPrompt,
      heroPhotoUrl,
      tier,
      null,
      [...companionUrls],
      storyPlan.cover.aspectRatio || "3:4",
      true
    );
    if (coverUrl && await validateImageUrl(coverUrl)) {
      // Validate cover with Claude Vision
      const coverValidation = await validateImage(
        coverUrl,
        storyPlan.cover.titleText ? [storyPlan.cover.titleText] : [],
        heroName,
        artStyle,
        "cover",
        storyPlan.cover.sceneDescription
      );
      if (!coverValidation.pass) {
        console.warn("Cover failed validation:", coverValidation.issues?.join(", "));
        try {
          const fixPrompt = coverPrompt +
            `\n\nCRITICAL FIXES FOR THIS RETRY:\n${coverValidation.fixNotes || coverValidation.issues?.join(". ") || "Improve text accuracy and character quality."}`;
          await new Promise(r => setTimeout(r, 2000));
          const retryCover = await generateImage(
            fixPrompt, heroPhotoUrl, tier, null, [...companionUrls],
            storyPlan.cover.aspectRatio || "3:4", true
          );
          if (retryCover && await validateImageUrl(retryCover)) {
            coverUrl = retryCover;
          }
        } catch { /* use original */ }
      }
      images.cover = coverUrl;
      previousImageUrl = coverUrl;
      logCost("nano_banana", tier, true, 0, null);
    }
  } catch (err) {
    console.warn("Cover generation failed:", err.message);
  }
  if (onImageReady) onImageReady("cover", images.cover || null);

  // 2. Generate spreads sequentially (chained, assembled prompts)
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
    });

    // Reference images: cover (style anchor) + previous spread (continuity) + companion photos
    const refImages = [];
    if (images.cover) refImages.push(images.cover);
    if (!isFirst && previousImageUrl && previousImageUrl !== images.cover) {
      refImages.push(previousImageUrl);
    }
    refImages.push(...companionUrls);

    try {
      let url = await generateImage(
        spreadPrompt,
        heroPhotoUrl,
        tier,
        null,
        refImages,
        spread.aspectRatio || "4:3",
        false
      );

      if (url && await validateImageUrl(url)) {
        // Validate every spread
        const validation = await validateImage(
          url,
          [spread.leftPageText, spread.rightPageText],
          heroName,
          artStyle,
          "spread",
          spread.sceneDescription
        );
        if (!validation.pass) {
          console.warn(`Spread ${i + 1} failed validation:`, validation.issues?.join(", "));
          // Retry with specific fix instructions
          try {
            const fixPrompt = spreadPrompt +
              `\n\nCRITICAL FIXES FOR THIS RETRY:\n${validation.fixNotes || validation.issues?.join(". ") || "Improve text accuracy and character quality."}`;
            await new Promise(r => setTimeout(r, 2000));
            const retryUrl = await generateImage(
              fixPrompt, heroPhotoUrl, tier, null,
              refImages, spread.aspectRatio || "4:3", false
            );
            if (retryUrl && await validateImageUrl(retryUrl)) {
              // Validate the retry too
              const retryValidation = await validateImage(
                retryUrl,
                [spread.leftPageText, spread.rightPageText],
                heroName, artStyle, "spread", spread.sceneDescription
              );
              if (retryValidation.pass || (retryValidation.faceScore || 0) >= (validation.faceScore || 0)) {
                url = retryUrl;
                logCost("nano_banana", tier, true, 0, "retry_after_validation");
              }
            }
          } catch { /* use original */ }
        }
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
        const retryRefs = [];
        if (images.cover) retryRefs.push(images.cover);
        if (!isFirst && previousImageUrl && previousImageUrl !== images.cover) {
          retryRefs.push(previousImageUrl);
        }
        const retryUrl = await generateImage(
          spreadPrompt, heroPhotoUrl, tier, null,
          retryRefs, spread.aspectRatio || "4:3", false
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

  // 3. Generate back cover (assembled prompt)
  const backPrompt = assembleImagePrompt({
    sceneDescription: storyPlan.backCover?.sceneDescription || "A peaceful closing scene with soft warm lighting. 'The End' in elegant hand-lettered text.",
    characterAppearances,
    artStyle,
    isCover: false,
    isBackCover: true,
    heroName,
    companionNames,
  });

  const backRefs = [];
  if (images.cover) backRefs.push(images.cover);
  if (previousImageUrl && previousImageUrl !== images.cover) {
    backRefs.push(previousImageUrl);
  }
  backRefs.push(...companionUrls);

  try {
    const backUrl = await generateImage(
      backPrompt,
      heroPhotoUrl,
      tier,
      null,
      backRefs,
      storyPlan.backCover?.aspectRatio || "3:4",
      false
    );
    if (backUrl && await validateImageUrl(backUrl)) {
      // Validate back cover
      const backValidation = await validateImage(
        backUrl, [], heroName, artStyle, "back_cover",
        storyPlan.backCover?.sceneDescription || ""
      );
      if (!backValidation.pass) {
        console.warn("Back cover failed validation:", backValidation.issues?.join(", "));
        try {
          const fixPrompt = backPrompt +
            `\n\nCRITICAL FIXES:\n${backValidation.fixNotes || backValidation.issues?.join(". ")}`;
          await new Promise(r => setTimeout(r, 2000));
          const retryBack = await generateImage(
            fixPrompt, heroPhotoUrl, tier, null,
            backRefs, storyPlan.backCover?.aspectRatio || "3:4", false
          );
          if (retryBack && await validateImageUrl(retryBack)) {
            images.backCover = retryBack;
          } else {
            images.backCover = backUrl;
          }
        } catch {
          images.backCover = backUrl;
        }
      } else {
        images.backCover = backUrl;
      }
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
    `Current text: "${currentText}"\nInstruction: "${instruction}"\nCharacters: ${characterNames}`,
    200
  );
}
