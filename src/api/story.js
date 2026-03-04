import { claudeCall, generateImage } from "./client";
import { ROLES } from "../constants/data";

// Style prompts for Kontext Pro (identity-preserving, with reference photo)
// These tell Kontext HOW to transform the person's photo into the art style
const KONTEXT_STYLE_PROMPTS = {
  Watercolor:
    "Transform this person into a beautiful watercolor children's book illustration. Soft pastel washes, dreamy brushstrokes, warm gentle lighting. Keep their exact facial features, hair color, skin tone, and distinctive features. Whimsical storybook aesthetic.",
  "Pixar 3D":
    "Transform this person into a Pixar-style 3D animated character for a children's book. Vibrant colors, soft lighting, big expressive eyes, smooth skin, cinematic composition. Keep their exact facial features, hair, and skin tone. Warm magical Pixar aesthetic.",
  "Storybook Sketch":
    "Transform this person into a hand-drawn pencil and ink children's book sketch. Cozy crosshatching, warm earth tones, gentle linework. Keep their exact facial features, hair, and skin tone. Nostalgic storybook illustration feel.",
  Anime:
    "Transform this person into a beautiful anime-style character for a children's book. Studio Ghibli inspired, vibrant colors, expressive eyes, soft cel shading, magical sparkles. Keep their facial features, hair color, and skin tone recognizable. Enchanting anime aesthetic.",
  Realistic:
    "Transform this person into a realistic digital painting for a children's book. Soft portrait lighting, warm golden tones, detailed and lifelike rendering. Keep their exact facial features, hair, and appearance. Gentle, warm illustrated atmosphere.",
  "Soft Plush":
    "Transform this person into an adorable soft plush toy character for a children's book. Felt and fabric textures, rounded shapes, pastel colors, cozy nursery aesthetic. Keep their hair color, skin tone, and recognizable features. Cuddly storybook style.",
};

// Style prompts for PuLID (stronger stylization with identity anchoring)
const PULID_STYLE_PROMPTS = {
  Watercolor:
    "beautiful watercolor children's book illustration, soft pastel colors, dreamy washes, gentle brushstrokes, warm lighting, whimsical storybook, portrait of this person",
  "Pixar 3D":
    "Pixar-style 3D animated character, children's book illustration, vibrant colors, soft lighting, big expressive eyes, cinematic composition, warm and magical, portrait of this person",
  "Storybook Sketch":
    "hand-drawn pencil and ink sketch, children's book illustration, cozy crosshatching, warm earth tones, gentle linework, nostalgic storybook feel, portrait of this person",
  Anime:
    "beautiful anime style character, children's book, vibrant colors, expressive eyes, soft cel shading, magical sparkles, Studio Ghibli inspired, portrait of this person",
  Realistic:
    "realistic digital painting, children's book illustration, soft portrait lighting, warm golden tones, detailed and lifelike, gentle atmosphere, portrait of this person",
  "Soft Plush":
    "soft plush toy character, children's book, felt and fabric textures, rounded shapes, pastel colors, cozy nursery aesthetic, adorable, portrait of this person",
};

// Text-only style prompts (no reference photo — fallback)
const TEXT_STYLE_PROMPTS = {
  Watercolor:
    "children's book illustration, beautiful watercolor painting, soft pastel colors, dreamy washes, gentle brushstrokes, warm lighting, whimsical, full scene composition",
  "Pixar 3D":
    "children's book illustration, Pixar-style 3D render, vibrant colors, soft lighting, expressive characters, cinematic composition, warm and magical, detailed character rendering",
  "Storybook Sketch":
    "children's book illustration, hand-drawn pencil and ink sketch, cozy crosshatching, warm earth tones, gentle linework, nostalgic storybook feel, detailed character illustration",
  Anime:
    "children's book illustration, beautiful anime style, vibrant colors, expressive eyes, soft cel shading, magical sparkles, Studio Ghibli inspired, detailed character art",
  Realistic:
    "children's book illustration, realistic digital painting, soft portrait lighting, warm golden tones, detailed and lifelike, gentle atmosphere, photorealistic character rendering",
  "Soft Plush":
    "children's book illustration, soft plush toy style, felt and fabric textures, rounded shapes, pastel colors, cozy nursery aesthetic, adorable character design",
};

// Styles that work better with PuLID (extreme stylization needs stronger identity anchoring)
const PULID_PREFERRED_STYLES = new Set(["Pixar 3D", "Anime", "Soft Plush"]);

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

// Build detailed character prompt for text-only generation (no photo available)
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

// Choose the right model and build the prompt based on whether we have a reference photo
function buildImageRequest(sceneDescription, cast, styleName) {
  const heroChar = cast.find((c) => c.isHero) || cast[0];
  const hasHeroPhoto = heroChar?.photo;

  if (hasHeroPhoto) {
    // We have a reference photo — use identity-preserving model
    const usePulid = PULID_PREFERRED_STYLES.has(styleName);
    const model = usePulid ? "pulid" : "kontext";

    let prompt;
    if (usePulid) {
      const styleBase = PULID_STYLE_PROMPTS[styleName] || PULID_STYLE_PROMPTS["Watercolor"];
      prompt = `${styleBase}. Scene: ${sceneDescription}. No text, words, or letters in the image.`;
    } else {
      const styleBase = KONTEXT_STYLE_PROMPTS[styleName] || KONTEXT_STYLE_PROMPTS["Watercolor"];
      prompt = `${styleBase} Scene: ${sceneDescription}. No text, words, or letters in the image.`;
    }

    return { prompt, referencePhoto: heroChar.photo, model };
  } else {
    // No photo — use text-only generation with detailed descriptions
    const styleBase = TEXT_STYLE_PROMPTS[styleName] || TEXT_STYLE_PROMPTS["Watercolor"];
    const characterDesc = buildDetailedCharacterPrompt(cast);
    const prompt = `${styleBase}. Characters: ${characterDesc}. Scene: ${sceneDescription}. Consistent character appearances, expressive faces. No text, words, or letters in the image.`;

    return { prompt, referencePhoto: null, model: null };
  }
}

// Use Claude to analyze a character photo and generate a detailed appearance description
async function analyzeCharacterPhoto(character) {
  if (!character.photo) return null;

  const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
  const ageNote = character.age ? `, approximately ${character.age} years old` : "";

  try {
    const description = await claudeCall(
      `You are helping create consistent character illustrations for a children's storybook. Analyze this person's photo and write a concise visual description (2-3 sentences) that an illustrator could use to draw them consistently across multiple pages. Focus on: hair color/style, skin tone, eye color, facial features, build/height, and any distinctive features. Do NOT include clothing (they'll wear different outfits in the story). Write in third person. Be specific about colors and features. Example: "A 5-year-old boy with curly dark brown hair, warm brown skin, big round dark eyes, a wide cheerful smile with dimples, and a small button nose. He has a sturdy build and his curls bounce when he moves."`,
      `This is ${character.name}, a ${role}${ageNote}. Please describe their physical appearance for an illustrator. Photo is attached as the image below.`,
      300,
      character.photo
    );
    return description;
  } catch (err) {
    console.error("Failed to analyze character photo:", err);
    return null;
  }
}

// Analyze all character photos and enrich the cast with appearance descriptions
export async function analyzeCharacterPhotos(cast) {
  const enrichedCast = await Promise.all(
    cast.map(async (character) => {
      if (character.photo) {
        const description = await analyzeCharacterPhoto(character);
        if (description) {
          return { ...character, appearanceDescription: description };
        }
      }
      return character;
    })
  );
  return enrichedCast;
}

export async function generateStory(cast, styleName, storyData) {
  const characterDescriptions = buildCharacterDescription(cast);

  const appearanceNotes = cast
    .filter((c) => c.appearanceDescription)
    .map((c) => `${c.name}: ${c.appearanceDescription}`)
    .join("\n");

  const heroHasPhoto = (cast.find((c) => c.isHero) || cast[0])?.photo;

  const systemPrompt = `You are a children's book author and illustrator director. Create a personalized picture book.
Return ONLY valid JSON with this exact structure:
{"title":"...","pages":[{"text":"...","imagePrompt":"..."}]}

Rules:
- Exactly 5 pages
- Each page: 2-3 warm, vivid sentences in picture-book voice using the characters' real names
- Each imagePrompt: a detailed visual scene description for an illustrator.${heroHasPhoto
    ? " The hero character's face will be preserved from their photo, so focus on describing the SCENE, SETTING, ACTIONS, EXPRESSIONS, and CLOTHING rather than facial features. Describe the environment, lighting, other characters, and what's happening."
    : " Include specific character appearances (hair color, skin tone, clothing, expressions), setting details, composition, and mood. Describe what characters look like in EVERY imagePrompt for consistency. Never use character names — describe their appearance instead."}
- Make it magical, age-appropriate, and emotionally resonant
- The story should have a clear arc: setup, adventure, challenge, resolution, warm ending
- Each imagePrompt should be 2-3 sentences of rich visual detail`;

  const userPrompt = `Cast: ${characterDescriptions}
${appearanceNotes ? `\nCharacter Appearances:\n${appearanceNotes}\n` : ""}
Hero: ${storyData.hero}
Story theme: ${storyData.spark}
They love: ${storyData.loves}
Mood: ${storyData.mood}
Art style: ${styleName}`;

  const raw = await claudeCall(systemPrompt, userPrompt, 1800);

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

export async function generatePageImage(pageText, cast, styleName) {
  const { prompt, referencePhoto, model } = buildImageRequest(pageText, cast, styleName);
  return generateImage(prompt, "16:9", referencePhoto, model);
}

export async function generateAllImages(pages, cast, styleName, onProgress) {
  const results = [];

  for (let i = 0; i < pages.length; i++) {
    if (onProgress) onProgress(i, pages.length);
    try {
      const imageUrl = await generatePageImage(
        pages[i].imagePrompt || pages[i].text,
        cast,
        styleName
      );
      results.push(imageUrl);
    } catch (err) {
      console.error(`Failed to generate image for page ${i + 1}:`, err);
      results.push(null);
    }
  }

  return results;
}

export async function editPageText(currentText, instruction, cast) {
  const characterNames = cast.map((c) => c.name).join(", ");
  return claudeCall(
    "Edit a single children's book page. Return ONLY the new text — exactly 2-3 sentences, warm picture-book voice. No quotes or extra formatting.",
    `Current text: "${currentText}"\nInstruction: "${instruction}"\nCharacters: ${characterNames}`,
    200
  );
}
