import Replicate from 'replicate';
import archiver from 'archiver';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) return res.status(500).json({ error: 'REPLICATE_KEY not configured' });

  const { photoUrls } = req.body;
  if (!photoUrls || !Array.isArray(photoUrls) || photoUrls.length === 0) {
    return res.status(400).json({ error: 'photoUrls array required' });
  }

  try {
    // Fetch all photos as buffers
    const photoBuffers = await Promise.all(
      photoUrls.map(async (url, i) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to fetch photo ${i + 1}: ${resp.status}`);
        const buffer = Buffer.from(await resp.arrayBuffer());
        const ext = url.includes('.png') ? 'png' : 'jpg';
        return { buffer, name: `photo_${i + 1}.${ext}` };
      })
    );

    // Create zip in memory
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 5 } });

    archive.on('data', (chunk) => chunks.push(chunk));

    const archiveFinished = new Promise((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
    });

    for (const photo of photoBuffers) {
      archive.append(photo.buffer, { name: photo.name });
    }

    await archive.finalize();
    await archiveFinished;

    const zipBuffer = Buffer.concat(chunks);

    // Upload zip to Replicate
    const replicate = new Replicate({ auth: apiKey });
    const blob = new Blob([zipBuffer], { type: 'application/zip' });
    const file = await replicate.files.create(blob, { filename: 'training-photos.zip' });

    res.json({ zipUrl: file.urls.get });
  } catch (err) {
    console.error('zip-photos error:', err);
    res.status(500).json({ error: err.message });
  }
}
