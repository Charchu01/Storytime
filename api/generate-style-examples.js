// One-time API endpoint to generate example images for each art style.
// Call POST /api/generate-style-examples to generate all examples.
// Results are returned as JSON with URLs — save them to your constants or public folder.

export const config = { maxDuration: 300 };

const STYLES_TO_GENERATE = [
  {
    id: "storybook",
    prompt: "Classic children's storybook illustration with bold saturated colours, clean outlines, warm painterly backgrounds. A young girl with brown pigtails and a red dress discovering a magical door hidden inside an ancient oak tree in an enchanted forest. Golden afternoon sunlight streaming through the leaves, fireflies beginning to glow. Wide shot showing the full tree with the small girl reaching toward a glowing doorknob. Warm, inviting, full of wonder."
  },
  {
    id: "watercolor",
    prompt: "Soft watercolour children's book illustration with visible brushstrokes, dreamy washes, and gentle colour bleeds. A little boy with curly blonde hair sitting on a dock, dangling his feet over a peaceful lake at sunset. Soft pink and orange washes in the sky, reflections rippling in the water. A small sailboat in the distance. Peaceful, dreamy, ethereal. White paper showing through the paint."
  },
  {
    id: "pixar",
    prompt: "Pixar-style 3D animated children's illustration with soft rounded characters, cinematic lighting, vibrant colours. A brave little girl astronaut with a big helmet floating in space, reaching toward a glowing planet. Stars and nebulae in the background, her suit has cute patches. Subsurface skin scattering, volumetric light rays. Movie-quality rendering, like a still from a Pixar film."
  },
  {
    id: "bold",
    prompt: "Modern vibrant children's book illustration with thick bold outlines, flat graphic colours, strong shapes. A superhero kid with a cape standing on top of a colourful building looking out over a stylised city. Electric blues, hot pinks, sunny yellows. Contemporary award-winning picture book aesthetic. Playful energy, dynamic composition."
  },
  {
    id: "cozy",
    prompt: "Gentle pastel children's bedtime book illustration with rounded shapes, soft muted tones. A sleepy toddler in pyjamas being carried by a parent through a cozy house, passing a window showing the moon. Plush toy aesthetic, rosy cheeks, warm lamplight. Everything soft and rounded. The feeling of being safe and loved."
  },
  {
    id: "sketch",
    prompt: "Whimsical hand-drawn children's book illustration with visible pencil lines, loose ink outlines, watercolour wash fills. A curious boy with messy hair climbing a huge stack of books in a library, almost reaching the ceiling. Charming imperfection in the lines, splashes of colour. Books tumbling playfully. Warm yellows and soft blues."
  },
  {
    id: "anime",
    prompt: "Anime-style children's book illustration with large expressive eyes, soft cel-shading, pastel colour palette. A young girl with long flowing hair standing in a field of cherry blossoms, a magical cat companion perched on her shoulder. Gentle magical atmosphere, sparkles in the air. Studio Ghibli inspired warmth and wonder."
  },
  {
    id: "retro",
    prompt: "Retro vintage children's book illustration in the style of 1950s-1960s picture books. A family of animals having a picnic in a meadow — rabbits, birds, a fox. Slightly muted colour palette, visible print texture, mid-century modern design sensibility. Charming simplified characters with minimal details. Nostalgic and timeless."
  },
  {
    id: "collage",
    prompt: "Paper collage children's book illustration with torn paper textures, fabric patterns, layered cut-out shapes. A hot air balloon made of patchwork fabric floating over rolling hills. Mixed media feel — you can see the paper grain, fabric weave, and glue edges. Handmade crafty aesthetic with warm colours. Tactile and three-dimensional."
  },
  {
    id: "minimal",
    prompt: "Minimalist Scandinavian children's book illustration with clean simple shapes, limited colour palette. A child and their dog walking through a snowy forest. Generous white space, elegant geometric characters, soft grey and pale blue with one warm accent colour. Nordic design aesthetic. Modern, calm, beautiful simplicity."
  },
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }

  const results = {};

  for (const style of STYLES_TO_GENERATE) {
    try {
      console.log(`Generating example for ${style.id}...`);

      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "black-forest-labs/flux-1.1-pro",
          input: {
            prompt: style.prompt,
            aspect_ratio: "3:4",
            output_format: "webp",
            output_quality: 80,
            safety_tolerance: 5,
            prompt_upsampling: true,
          },
        }),
      });

      const prediction = await response.json();

      // Poll for completion
      let result = prediction;
      while (result.status !== "succeeded" && result.status !== "failed") {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: { "Authorization": `Bearer ${replicateToken}` },
        });
        result = await poll.json();
      }

      if (result.status === "succeeded" && result.output) {
        const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
        results[style.id] = imageUrl;
        console.log(`✓ ${style.id}: ${imageUrl}`);
      } else {
        results[style.id] = null;
        console.warn(`✗ ${style.id}: failed`);
      }
    } catch (err) {
      results[style.id] = null;
      console.error(`✗ ${style.id}: ${err.message}`);
    }
  }

  // Return the URLs — user should download these and put them in public/examples/
  res.status(200).json({
    message: "Generation complete. Download these images and place them in public/examples/{id}.webp",
    results,
  });
}
