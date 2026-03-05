import Replicate from "replicate";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "REPLICATE_KEY not configured" });
  }

  const { photoDataUri } = req.body || {};
  if (!photoDataUri) {
    return res.status(400).json({ error: "photoDataUri is required" });
  }

  try {
    // Parse the data URI
    const commaIdx = photoDataUri.indexOf(",");
    if (commaIdx === -1) {
      return res.status(400).json({ error: "Invalid data URI format" });
    }
    const base64Data = photoDataUri.slice(commaIdx + 1);
    const mimeMatch = photoDataUri.match(/^data:(image\/[a-zA-Z+]+);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Convert to buffer then to Blob (Replicate SDK accepts Blob for file upload)
    const buffer = Buffer.from(base64Data, "base64");
    const blob = new Blob([buffer], { type: mime });

    const replicate = new Replicate({ auth: apiKey });
    const file = await replicate.files.create(blob);

    if (!file?.urls?.get) {
      console.error("Unexpected file response:", JSON.stringify(file));
      return res.status(500).json({ error: "Upload succeeded but no URL returned" });
    }

    res.json({ photoUrl: file.urls.get });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({
      error: `Failed to upload photo: ${err.message || "Unknown error"}`,
    });
  }
}
