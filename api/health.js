export default function handler(_req, res) {
  res.json({
    status: "ok",
    hasAnthropic: !!process.env.ANTHROPIC_KEY,
    hasReplicate: !!process.env.REPLICATE_KEY,
  });
}
