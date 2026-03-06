import { logApiCall, updateDailyApiStats } from './lib/admin-logger.js';

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
  const startTime = Date.now();

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

  // Accept ElevenLabs voice ID directly, with a sensible default
  const DEFAULT_VOICE = "o5yhdpwO4YUK0MmUtJv5";
  const voice = voiceId && voiceId.length > 10 ? voiceId : DEFAULT_VOICE;
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

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("ElevenLabs error:", response.status, errText.substring(0, 200));

      logApiCall({
        service: 'elevenlabs',
        type: 'narration',
        status: response.status,
        durationMs,
        error: `HTTP ${response.status}`,
      }).catch(() => {});
      updateDailyApiStats('elevenlabs', durationMs, 0, true).catch(() => {});

      return res.status(response.status).json({
        error: `Narration failed: ${response.status}`,
      });
    }

    // Admin logging: success
    logApiCall({
      service: 'elevenlabs',
      type: 'narration',
      status: 200,
      durationMs,
      cost: 0.005,
      details: `${text.length} chars`,
    }).catch(() => {});
    updateDailyApiStats('elevenlabs', durationMs, 0.005, false).catch(() => {});

    const contentType = response.headers.get("content-type");
    res.setHeader("Content-Type", contentType || "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Narrate error:", err);
    const durationMs = Date.now() - startTime;
    logApiCall({
      service: 'elevenlabs',
      type: 'narration',
      status: 500,
      durationMs,
      error: err.message,
    }).catch(() => {});
    updateDailyApiStats('elevenlabs', durationMs, 0, true).catch(() => {});
    res.status(500).json({ error: "Narration unavailable" });
  }
}
