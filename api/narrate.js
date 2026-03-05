export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ELEVENLABS_KEY not configured" });
  }

  const { text, voiceId } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  // Premium narration voices (warm, expressive storytelling voices)
  const VOICES = {
    mom: "XrExE9yKIg1WjnnlVkGX",      // Matilda — warm, friendly, narration
    dad: "N2lVS1w4EtoT3dr4eOWO",      // Callum — dramatic, character, storytelling
    grandma: "pFZP5JQG7iQjIQuC4Bku",  // Lily — warm British narration
    default: "XrExE9yKIg1WjnnlVkGX",  // Matilda
  };

  const voice = VOICES[voiceId] || VOICES.default;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.80,
            style: 0.6,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Narration failed: ${response.status}`,
      });
    }

    const contentType = response.headers.get("content-type");
    res.setHeader("Content-Type", contentType || "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Narrate error:", err);
    res.status(500).json({ error: "Narration unavailable" });
  }
}
