import { logApiCall } from './lib/admin-logger.js';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const startTime = Date.now();
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rl = rateLimit(req, { key: 'claude', limit: 30, windowMs: 60000 });
    if (!rl.allowed) {
      res.setHeader('Retry-After', Math.ceil((rl.resetAt - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Too many requests. Please try again in a moment.',
        retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
      });
    }

    const apiKey = process.env.ANTHROPIC_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_KEY not configured" });
    }

    const { system, userMsg, maxTokens: rawMaxTokens = 1400, imageDataUrl } = req.body || {};
    if (!system || !userMsg) {
      return res.status(400).json({ error: "system and userMsg are required" });
    }
    // Cap maxTokens to prevent abuse — highest legitimate use is 6000 for premium stories
    const maxTokens = Math.min(Math.max(parseInt(rawMaxTokens) || 1400, 100), 8000);

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      try {
        await logApiCall({
          service: 'anthropic',
          type: imageDataUrl ? 'photo_analysis' : 'story',
          status: response.status,
          durationMs,
          model: 'claude-sonnet-4-20250514',
          error: data.error?.message,
        });
      } catch (logErr) {
        console.warn('logApiCall failed:', logErr.message);
      }

      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: "AI service temporarily unavailable. Please try again.",
      });
    }

    // Admin logging: success — await before sending response
    const callType = imageDataUrl ? 'photo_analysis' : 'story';
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
    try {
      await logApiCall({
        service: 'anthropic',
        type: callType,
        status: 200,
        durationMs,
        model: 'claude-sonnet-4-20250514',
        cost,
        details: { inputTokens, outputTokens },
      });
    } catch (logErr) {
      console.warn('logApiCall failed:', logErr.message);
    }

    const text = data.content.map((block) => block.text || "").join("").trim();
    res.json({ text });
  } catch (err) {
    console.error("Claude API error:", err);
    const durationMs = Date.now() - startTime;
    try {
      await logApiCall({
        service: 'anthropic',
        type: 'unknown',
        status: 500,
        durationMs,
        error: err.message,
      });
    } catch (logErr) {
      console.warn('logApiCall failed:', logErr.message);
    }
    res.status(500).json({ error: 'AI service unavailable. Please try again.' });
  }
}
