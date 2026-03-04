export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_KEY not configured" });
  }

  const { system, userMsg, maxTokens = 1400, imageDataUrl } = req.body;
  if (!system || !userMsg) {
    return res.status(400).json({ error: "system and userMsg are required" });
  }

  // Build message content - support text + optional image
  let content;
  if (imageDataUrl) {
    // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: "Invalid image data URL format" });
    }
    const mediaType = match[1];
    const base64Data = match[2];

    content = [
      { type: "text", text: userMsg },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      },
    ];
  } else {
    content = userMsg;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Anthropic API error",
      });
    }

    const text = data.content.map((block) => block.text || "").join("").trim();
    res.json({ text });
  } catch (err) {
    console.error("Claude API error:", err);
    res.status(500).json({ error: "Failed to call Claude API" });
  }
}
