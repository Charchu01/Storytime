import Replicate from 'replicate';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) return res.status(500).json({ error: 'REPLICATE_KEY not configured' });

  const replicate = new Replicate({ auth: apiKey });
  const { zipUrl, childName, sessionId, artStyle } = req.body;

  if (!zipUrl || !childName || !sessionId) {
    return res.status(400).json({ error: 'zipUrl, childName, and sessionId required' });
  }

  const triggerWord = `STORYTIME_${childName.toUpperCase().replace(/[^A-Z]/g, '')}_${Date.now()}`;
  const modelName = `storytime-${childName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${sessionId}`.slice(0, 60);

  // Adjust learning rate based on art style
  let learningRate = 0.0004; // Default for realistic
  if (artStyle) {
    const style = artStyle.toLowerCase();
    if (style.includes("sketch") || style.includes("bold") || style.includes("storybook")) {
      learningRate = 0.001;
    } else if (style.includes("watercolour") || style.includes("watercolor") || style.includes("cozy")) {
      learningRate = 0.0006;
    }
  }

  try {
    const username = process.env.REPLICATE_USERNAME || "storytime";
    const training = await replicate.trainings.create(
      "replicate",
      "fast-flux-trainer",
      {
        destination: `${username}/${modelName}`,
        input: {
          input_images: zipUrl,
          trigger_word: triggerWord,
          steps: 1200,
          lora_rank: 32,
          learning_rate: learningRate,
          autocaption: true,
          lora_type: "subject",
        }
      }
    );

    res.json({ trainingId: training.id, triggerWord, modelName, destination: `${username}/${modelName}` });
  } catch (err) {
    console.error('LoRA training failed:', err);
    res.status(500).json({ error: err.message });
  }
}
