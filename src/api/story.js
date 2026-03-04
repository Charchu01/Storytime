import { claudeCall, generateImage } from "./client";
import { ROLES } from "../constants/data";

const ART_STYLE_PROMPTS = {
  Watercolor:
    "children's book illustration, beautiful watercolor painting, soft pastel colors, dreamy washes, gentle brushstrokes, warm lighting, whimsical",
  "Pixar 3D":
    "children's book illustration, Pixar-style 3D render, vibrant colors, soft lighting, expressive characters, cinematic composition, warm and magical",
  "Storybook Sketch":
    "children's book illustration, hand-drawn pencil and ink sketch, cozy crosshatching, warm earth tones, gentle linework, nostalgic storybook feel",
  Anime:
    "children's book illustration, beautiful anime style, vibrant colors, expressive eyes, soft cel shading, magical sparkles, Studio Ghibli inspired",
  Realistic:
    "children's book illustration, realistic digital painting, soft portrait lighting, warm golden tones, detailed and lifelike, gentle atmosphere",
  "Soft Plush":
    "children's book illustration, soft plush toy style, felt and fabric textures, rounded shapes, pastel colors, cozy nursery aesthetic, adorable",
};

function buildCharacterDescription(cast) {
  return cast
    .map((character) => {
      const role = ROLES.find((r) => r.id === character.role)?.label || character.role;
      const age = character.age ? `, age ${character.age}` : "";
      return `${character.name} (${role}${age})`;
    })
    .join(", ");
}

function buildImagePrompt(pageText, cast, styleName) {
  const styleBase = ART_STYLE_PROMPTS[styleName] || ART_STYLE_PROMPTS["Watercolor"];
  const heroChar = cast.find((c) => c.isHero) || cast[0];
  const heroDesc = heroChar
    ? `featuring a ${heroChar.age ? `${heroChar.age}-year-old ` : ""}child named ${heroChar.name}`
    : "";

  return `${styleBase}, ${heroDesc}, scene: ${pageText}. No text or words in the image.`;
}

export async function generateStory(cast, styleName, storyData) {
  const characterDescriptions = buildCharacterDescription(cast);

  const systemPrompt = `You are a children's book author. Create a personalized picture book.
Return ONLY valid JSON with this exact structure:
{"title":"...","pages":[{"text":"...","imagePrompt":"..."}]}

Rules:
- Exactly 5 pages
- Each page: 2-3 warm, vivid sentences in picture-book voice using the characters' real names
- Each imagePrompt: a detailed visual scene description for an illustrator (no character names, describe appearances instead)
- Make it magical, age-appropriate, and emotionally resonant
- The story should have a clear arc: setup, adventure, challenge, resolution, warm ending`;

  const userPrompt = `Cast: ${characterDescriptions}
Hero: ${storyData.hero}
Story theme: ${storyData.spark}
They love: ${storyData.loves}
Mood: ${storyData.mood}
Art style: ${styleName}`;

  const raw = await claudeCall(systemPrompt, userPrompt);

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
  return generateImage(prompt);
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
