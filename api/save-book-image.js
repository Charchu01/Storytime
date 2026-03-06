import { saveImageToStorage } from './lib/save-image.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, bookId, pageType, pageIndex } = req.body;
  if (!imageUrl || !bookId) return res.status(400).json({ error: 'imageUrl and bookId required' });

  const filename = `${pageType}_${pageIndex || 0}.jpg`;
  const permanentUrl = await saveImageToStorage(imageUrl, bookId, filename);

  res.json({ permanentUrl });
}
