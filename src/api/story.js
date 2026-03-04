import { claudeCall, generateImage, uploadPhoto } from "./client";
import { ROLES } from "../constants/data";

// Style prompts for Kontext Pro (identity-preserving, with reference photo)
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

// Build the prompt and model selection for a single page image.
// heroPhotoUrl is a pre-uploaded HTTP URL (or null if no photo).
function buildImageRequest(sceneDescription, cast, styleName, heroPhotoUrl) {
  if (heroPhotoUrl) {
    // We have a reference photo URL — use Kontext Pro for identity preservation
    const styleBase = KONTEXT_STYLE_PROMPTS[styleName] || KONTEXT_STYLE_PROMPTS["Watercolor"];
    const prompt = `${styleBase} Scene: ${sceneDescription}. No text, words, or letters in the image.`;
    return { prompt, referencePhotoUrl: heroPhotoUrl, model: "kontext" };
  } else {
    // No photo — use text-only generation
    const styleBase = TEXT_STYLE_PROMPTS[styleName] || TEXT_STYLE_PROMPTS["Watercolor"];
    const characterDesc = buildDetailedCharacterPrompt(cast);
    const prompt = `${styleBase}. Characters: ${characterDesc}. Scene: ${sceneDescription}. Consistent character appearances, expressive faces. No text, words, or letters in the image.`;
    return { prompt, referencePhotoUrl: null, model: null };
  }
}

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

export async function generatePageImage(pageText, cast, styleName, heroPhotoUrl) {
  const { prompt, referencePhotoUrl, model } = buildImageRequest(pageText, cast, styleName, heroPhotoUrl);
  return generateImage(prompt, "16:9", referencePhotoUrl, model);
}

// Upload the hero's photo ONCE to Replicate file hosting, returning a reusable HTTP URL
export async function uploadHeroPhoto(cast) {
  const heroChar = cast.find((c) => c.isHero) || cast[0];
  if (!heroChar?.photo) return null;

  try {
    return await uploadPhoto(heroChar.photo);
  } catch (err) {
    console.error("Failed to upload hero photo, falling back to text-only:", err);
    return null;
  }
}

// Generate all page images, reusing the pre-uploaded heroPhotoUrl for every page
export async function generateAllImages(pages, cast, styleName, heroPhotoUrl, onProgress) {
  const results = [];
  let failCount = 0;
  let firstError = null;

  for (let i = 0; i < pages.length; i++) {
    if (onProgress) onProgress(i, pages.length);
    try {
      const imageUrl = await generatePageImage(
        pages[i].imagePrompt || pages[i].text,
        cast,
        styleName,
        heroPhotoUrl
      );
      results.push(imageUrl);
    } catch (err) {
      console.error(`Failed to generate image for page ${i + 1}:`, err);
      if (!firstError) firstError = err.message;
      failCount++;
      results.push(null);
    }
    // Small delay between requests to avoid rate-limit bursts
    if (i < pages.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // If ALL images failed, throw with the actual error so the user knows what went wrong
  if (failCount === pages.length) {
    throw new Error(firstError || "All illustrations failed. Please try again.");
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
