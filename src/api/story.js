import { claudeCall, generateImage, uploadPhoto } from "./client";
import { ROLES } from "../constants/data";

// Kontext scene prompts — describe the SCENE in art style, character is part of the world
const KONTEXT_STYLE_PROMPTS = {
  Watercolor:
    "Award-winning children's picture book illustration. Luminous watercolor washes with visible wet-on-wet blending, layered transparent glazes, and delicate dry-brush texture. Rich color harmony with warm golden light streaming through the scene. Atmospheric depth with soft focus background elements. Professional editorial quality, reminiscent of Jerry Pinkney or Oliver Jeffers. Wide composition with this person as one element of an immersive, beautifully detailed world. Keep this person's facial features, hair color, skin tone recognizable.",
  "Pixar 3D":
    "Premium Pixar-quality 3D rendered children's book illustration. Sophisticated global illumination, volumetric light rays, subsurface scattering on skin. Rich cinematic color grading with teal-and-orange palette. Shallow depth of field with beautiful bokeh. Detailed textures on every surface — fabric weave, wood grain, leaf veins. Wide cinematic composition, 35mm lens feel. Keep this person's facial features, hair, skin tone recognizable but make them one element of a breathtaking, richly detailed world.",
  "Storybook Sketch":
    "Exquisite hand-drawn children's book illustration in the tradition of E.H. Shepard or Beatrix Potter. Fine pen and ink linework with delicate crosshatching, tinted with soft watercolor washes in warm earth tones and muted sage greens. Charming vignette composition with decorative botanical details. Nostalgic warmth with masterful draftsmanship. Keep this person's facial features, hair, skin tone recognizable but make them one element of a rich, detailed environment.",
  Anime:
    "Breathtaking Studio Ghibli-quality anime illustration for a premium children's book. Luminous hand-painted backgrounds with extraordinary environmental detail — dappled sunlight through leaves, rippling water reflections, clouds with painterly depth. Rich saturated colors with sophisticated color harmony. Hayao Miyazaki-level world-building with a sense of wonder and scale. Keep this person's facial features, hair, skin tone recognizable but make them one element of a vast, beautifully realized world.",
  Realistic:
    "Museum-quality realistic digital painting for a premium children's book. Masterful oil-painting technique with visible brushwork, rich impasto highlights, and luminous glazes. Rembrandt-quality lighting with warm golden tones and atmospheric perspective. Incredible detail in textures — fabric folds, wood grain, natural elements. Wide composition with cinematic depth. Keep this person's facial features, hair, appearance recognizable but make them one element of a richly detailed, immersive environment.",
  "Soft Plush":
    "Exquisite stop-motion quality felt and fabric children's book illustration. Incredibly detailed textile textures — hand-stitched felt characters, knitted backgrounds, embroidered flowers, corduroy hills. Warm studio lighting with soft shadows revealing every fiber and stitch. Miniature diorama feel with tilt-shift depth of field. Premium craft quality like Wes Anderson's Isle of Dogs. Keep this person's hair, skin tone recognizable but make them one element of a richly textured, cozy handcrafted world.",
};

// Text-only style prompts (no reference photo)
const TEXT_STYLE_PROMPTS = {
  Watercolor:
    "Award-winning children's picture book illustration. Luminous watercolor with wet-on-wet blending, layered transparent glazes, delicate dry-brush details. Rich color harmony, warm golden light, atmospheric depth with soft-focus backgrounds. Professional editorial quality reminiscent of Jerry Pinkney. Wide composition, immersive detailed world",
  "Pixar 3D":
    "Premium Pixar-quality 3D rendered children's book illustration. Global illumination, volumetric light rays, subsurface scattering. Cinematic teal-and-orange color grading. Shallow depth of field with bokeh. Detailed textures on every surface — fabric weave, wood grain, leaf veins. Wide 35mm cinematic composition, richly detailed world",
  "Storybook Sketch":
    "Exquisite hand-drawn children's book illustration in the tradition of E.H. Shepard or Beatrix Potter. Fine pen and ink with delicate crosshatching, tinted with soft watercolor washes in warm earth tones and muted sage. Charming vignette composition with botanical details. Nostalgic warmth, masterful draftsmanship",
  Anime:
    "Breathtaking Studio Ghibli-quality anime illustration. Luminous hand-painted backgrounds with extraordinary detail — dappled sunlight, rippling water, painterly clouds. Rich saturated colors with sophisticated harmony. Miyazaki-level world-building with wonder and scale. Wide composition, beautifully realized world",
  Realistic:
    "Museum-quality realistic digital painting. Masterful oil-painting technique with visible brushwork, impasto highlights, luminous glazes. Rembrandt lighting with warm golden tones and atmospheric perspective. Incredible texture detail — fabric, wood, nature. Wide composition with cinematic depth, richly immersive",
  "Soft Plush":
    "Exquisite stop-motion quality felt and fabric illustration. Detailed textile textures — hand-stitched felt, knitted backgrounds, embroidered flowers, corduroy hills. Warm studio lighting revealing every fiber and stitch. Miniature diorama feel with tilt-shift depth. Premium craft quality like Wes Anderson. Richly textured handcrafted world",
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
function buildImageRequest(sceneDescription, cast, styleName, heroPhotoUrl) {
  const styleAnchor = "Consistent visual style throughout. Same art technique, color palette, lighting mood, and character appearance on every page. ";
  const qualitySuffix = " Absolutely no text, words, letters, numbers, or writing of any kind anywhere in the image. Ultra high detail, professional quality.";

  if (heroPhotoUrl) {
    const styleBase = KONTEXT_STYLE_PROMPTS[styleName] || KONTEXT_STYLE_PROMPTS["Watercolor"];
    const prompt = `${styleAnchor}${styleBase} Scene: ${sceneDescription}.${qualitySuffix}`;
    return { prompt, referencePhotoUrl: heroPhotoUrl, model: "kontext" };
  } else {
    const styleBase = TEXT_STYLE_PROMPTS[styleName] || TEXT_STYLE_PROMPTS["Watercolor"];
    const characterDesc = buildDetailedCharacterPrompt(cast);
    const prompt = `${styleAnchor}${styleBase}. Characters: ${characterDesc}. Scene: ${sceneDescription}. Consistent character appearances throughout.${qualitySuffix}`;
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
{"title":"...","coverScene":"...","pages":[{"text":"...","imagePrompt":"..."}]}

Rules:
- Exactly ${storyData.pageCount || 5} pages
- Each page: 2-3 warm, vivid sentences in picture-book voice using the characters' real names
- "coverScene": a wide landscape scene description for the cover illustration — the magical world the story takes place in. Rich environment, atmospheric, cinematic. No characters needed, just the world/setting.
- For each imagePrompt: generate a FULL SCENE description showing the story action — wide or medium shot, character as part of the world, rich environment and atmosphere. Never a portrait or face close-up. The scene should tell the story visually even without reading the text.
  - Use rule of thirds composition. Character positioned slightly left of center with negative space flowing right.
  - Include: environment details, lighting, atmosphere, weather/time of day, foreground and background elements, character's body language and actions, clothing colors
  - The character should be roughly 30-40% of the frame height, never filling the whole image${heroHasPhoto
    ? "\n  - The hero character's face will be preserved from their photo, so focus on describing the SCENE, SETTING, ACTIONS, EXPRESSIONS, and CLOTHING rather than facial features. Describe the environment, lighting, other characters, and what's happening."
    : "\n  - Include specific character appearances (hair color, skin tone, clothing, expressions) in EVERY imagePrompt for consistency. Never use character names — describe their appearance instead."}
- Make it magical, age-appropriate, and emotionally resonant
- The story should have a clear arc: setup, adventure, challenge, resolution, warm ending
- Each imagePrompt should be 3-4 sentences of rich visual and environmental detail
- Maintain visual consistency: same color temperature, same rendering style, same character appearance throughout all pages`;

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

// Generate cover scene image
export async function generateCoverImage(coverScene, styleName, heroPhotoUrl) {
  if (!coverScene) return null;
  const styleAnchor = "Maintain visual consistency. ";
  const styleBase = heroPhotoUrl
    ? (KONTEXT_STYLE_PROMPTS[styleName] || KONTEXT_STYLE_PROMPTS["Watercolor"])
    : (TEXT_STYLE_PROMPTS[styleName] || TEXT_STYLE_PROMPTS["Watercolor"]);
  const prompt = `${styleAnchor}${styleBase}. Scene: ${coverScene}. Epic wide cinematic landscape with dramatic atmospheric perspective, volumetric lighting, and rich environmental storytelling. No characters needed. Absolutely no text, words, letters, numbers, or writing of any kind anywhere in the image. Ultra high detail, professional quality.`;

  try {
    return await generateImage(prompt, "16:9", null, null);
  } catch (err) {
    console.error("Cover image generation failed:", err);
    return null;
  }
}

// Generate all page images, reusing the pre-uploaded heroPhotoUrl for every page
export async function generateAllImages(pages, cast, styleName, heroPhotoUrl, onProgress, coverScene) {
  const results = [];
  let failCount = 0;
  let firstError = null;

  // Generate cover image first if we have a scene description
  let coverImageUrl = null;
  if (coverScene) {
    if (onProgress) onProgress(-1, pages.length, "cover");
    coverImageUrl = await generateCoverImage(coverScene, styleName, heroPhotoUrl);
    if (coverImageUrl) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

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

  return { pageImages: results, coverImageUrl };
}

export async function editPageText(currentText, instruction, cast) {
  const characterNames = cast.map((c) => c.name).join(", ");
  return claudeCall(
    "Edit a single children's book page. Return ONLY the new text — exactly 2-3 sentences, warm picture-book voice. No quotes or extra formatting.",
    `Current text: "${currentText}"\nInstruction: "${instruction}"\nCharacters: ${characterNames}`,
    200
  );
}
