import Replicate from "replicate";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.REPLICATE_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "REPLICATE_KEY not configured" });
  }

  const { photoDataUri } = req.body;
  if (!photoDataUri) {
    return res.status(400).json({ error: "photoDataUri is required" });
  }

  try {
    // Parse the data URI
    const base64Data = photoDataUri.split(",")[1];
    if (!base64Data) {
      return res.status(400).json({ error: "Invalid data URI format" });
    }

    const mimeMatch = photoDataUri.match(/^data:(image\/\w+);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // Convert to buffer and upload to Replicate's file hosting
    const buffer = Buffer.from(base64Data, "base64");
    const replicate = new Replicate({ auth: apiKey });
    const file = await replicate.files.create(
      new Blob([buffer], { type: mime }),
      { filename: "character-photo.jpg" }
    );

    res.json({ photoUrl: file.urls.get });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({
      error: `Failed to upload photo: ${err.message || "Unknown error"}`,
    });
  }
}
