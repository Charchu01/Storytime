import { claudeCall, generateImage } from "./client";
import { ROLES } from "../constants/data";

const ART_STYLE_PROMPTS = {
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

// Build a detailed character appearance description for image prompts
function buildDetailedCharacterPrompt(cast) {
  return cast
    .map((character) => {
      const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
      const parts = [];

      if (character.appearanceDescription) {
        // Use Claude-analyzed appearance description
        parts.push(character.appearanceDescription);
      } else {
        // Fallback to basic description
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

function buildImagePrompt(pageText, cast, styleName) {
  const styleBase = ART_STYLE_PROMPTS[styleName] || ART_STYLE_PROMPTS["Watercolor"];
  const characterDesc = buildDetailedCharacterPrompt(cast);

  return `${styleBase}. Characters: ${characterDesc}. Scene: ${pageText}. Consistent character appearances throughout, expressive faces, dynamic poses. No text, words, or letters in the image.`;
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

  // Include appearance descriptions in story generation for better integration
  const appearanceNotes = cast
    .filter((c) => c.appearanceDescription)
    .map((c) => `${c.name}: ${c.appearanceDescription}`)
    .join("\n");

  const systemPrompt = `You are a children's book author and illustrator director. Create a personalized picture book.
Return ONLY valid JSON with this exact structure:
{"title":"...","pages":[{"text":"...","imagePrompt":"..."}]}

Rules:
- Exactly 5 pages
- Each page: 2-3 warm, vivid sentences in picture-book voice using the characters' real names
- Each imagePrompt: a VERY detailed visual scene description for an illustrator. Include specific character appearances (hair color, skin tone, clothing for this scene, expressions), setting details (colors, lighting, objects), composition, and mood. Describe what characters look like in EVERY imagePrompt for consistency. Never use character names in imagePrompt — describe their appearance instead.
- Make it magical, age-appropriate, and emotionally resonant
- The story should have a clear arc: setup, adventure, challenge, resolution, warm ending
- Each imagePrompt should be at least 2-3 sentences of rich visual detail`;

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
  const prompt = buildImagePrompt(pageText, cast, styleName);
  return generateImage(prompt, "16:9");
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
