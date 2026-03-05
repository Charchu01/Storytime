import Replicate from 'replicate';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) return res.status(500).json({ error: 'REPLICATE_KEY not configured' });

  const replicate = new Replicate({ auth: apiKey });
  const { zipUrl, childName, sessionId } = req.body;

  if (!zipUrl || !childName || !sessionId) {
    return res.status(400).json({ error: 'zipUrl, childName, and sessionId required' });
  }

  const triggerWord = `${childName.toUpperCase().replace(/[^A-Z]/g, '')}CHILD`;
  const modelName = `storykids-${childName.toLowerCase().replace(/[^a-z]/g, '')}-${sessionId}`.slice(0, 60);

  try {
    const training = await replicate.trainings.create(
      'ostris',
      'flux-dev-lora-trainer',
      'e440909d01824b3fbfc4e29da7db5955e4e3cfc429647fd2c07a168cbb053ba1',
      {
        destination: `storikids/${modelName}`,
        input: {
          input_images: zipUrl,
          trigger_word: triggerWord,
          steps: 1000,
        }
      }
    );

    res.json({ trainingId: training.id, triggerWord, modelName });
  } catch (err) {
    console.error('LoRA training failed:', err);
    res.status(500).json({ error: err.message });
  }
}
