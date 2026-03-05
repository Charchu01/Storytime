export const config = { maxDuration: 30 };

// Preprocess story text for more natural narration
function prepareNarrationText(text) {
  let prepared = text;
  // Add gentle pauses after sentences for a bedtime-story cadence
  prepared = prepared.replace(/\. /g, "... ");
  // Add slight pause after commas for more natural breath
  prepared = prepared.replace(/, /g, ", ");
  // Add emphasis on exclamations
  prepared = prepared.replace(/!/g, "!");
  return prepared.trim();
}

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

  // Premium narration voices — warm, expressive storytelling
  const VOICES = {
    mom: "XrExE9yKIg1WjnnlVkGX",      // Matilda — warm, friendly, narration
    dad: "N2lVS1w4EtoT3dr4eOWO",      // Callum — dramatic, character, storytelling
    grandma: "pFZP5JQG7iQjIQuC4Bku",  // Lily — warm British narration
    default: "XrExE9yKIg1WjnnlVkGX",  // Matilda
  };

  const voice = VOICES[voiceId] || VOICES.default;
  const narrationText = prepareNarrationText(text);

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
          text: narrationText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.40,
            similarity_boost: 0.65,
            style: 0.10,
            use_speaker_boost: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("ElevenLabs error:", response.status, errText.substring(0, 200));
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
