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

  // Test Anthropic API key — use a minimal request with max_tokens=1 to minimize cost,
  // or just validate the key format if cost is a concern
  if (process.env.ANTHROPIC_KEY) {
    try {
      // Use GET on models endpoint to verify key without billable usage
      const resp = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": process.env.ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
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
