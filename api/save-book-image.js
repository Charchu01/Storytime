import { saveImageToStorage } from './lib/save-image.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageUrl, bookId, pageType, pageIndex } = req.body;
  if (!imageUrl || !bookId) return res.status(400).json({ error: 'imageUrl and bookId required' });

  try {
    const filename = `${pageType}_${pageIndex || 0}.jpg`;
    const permanentUrl = await saveImageToStorage(imageUrl, bookId, filename);

    if (!permanentUrl) {
      return res.status(500).json({ error: 'Failed to save image to storage' });
    }

    return res.json({ permanentUrl });
  } catch (err) {
    console.error('save-book-image error:', err.message);
    return res.status(500).json({ error: 'Image save failed' });
  }
}
