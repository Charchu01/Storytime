import Replicate from 'replicate';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) return res.status(500).json({ error: 'REPLICATE_KEY not configured' });

  const replicate = new Replicate({ auth: apiKey });
  const { trainingId } = req.query;

  if (!trainingId) return res.status(400).json({ error: 'trainingId required' });

  try {
    const training = await replicate.trainings.get(trainingId);

    const loraUrl = training.status === 'succeeded'
      ? (training.output?.weights || training.output?.lora_url || null)
      : null;

    res.json({
      status: training.status,
      loraUrl,
      error: training.error || null,
    });
  } catch (err) {
    console.error('check-training error:', err);
    res.status(500).json({ error: err.message });
  }
}
