export default async function handler(_req, res) {
  const result = {
    status: "ok",
    hasAnthropic: !!process.env.ANTHROPIC_KEY,
    hasReplicate: !!process.env.REPLICATE_KEY,
    replicate: "unknown",
    anthropic: "unknown",
    timestamp: new Date().toISOString(),
  };

  // Test Replicate API key
  if (process.env.REPLICATE_KEY) {
    try {
      const resp = await fetch("https://api.replicate.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      result.replicate = resp.ok ? "ok" : `error_${resp.status}`;
    } catch (err) {
      result.replicate = "unreachable";
    }
  } else {
    result.replicate = "not_configured";
  }

  // Test Anthropic API key
  if (process.env.ANTHROPIC_KEY) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      result.anthropic = resp.ok ? "ok" : `error_${resp.status}`;
    } catch (err) {
      result.anthropic = "unreachable";
    }
  } else {
    result.anthropic = "not_configured";
  }

  if (result.replicate !== "ok" || result.anthropic !== "ok") {
    result.status = "degraded";
  }

  res.json(result);
}
