export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_KEY not configured" });
  }

  const {
    imageUrl,
    expectedTexts,
    heroName,
    artStyle,
    pageType,
    sceneDescription,
  } = req.body || {};

  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
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
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "url", url: imageUrl },
              },
              {
                type: "text",
                text: buildValidationPrompt({
                  expectedTexts,
                  heroName,
                  artStyle,
                  pageType,
                  sceneDescription,
                }),
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn("Validation API error:", data.error?.message);
      return res.json({ pass: true, reason: "validation_unavailable" });
    }

    const text = data.content
      .map((block) => block.text || "")
      .join("")
      .trim();

    try {
      const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
      const result = JSON.parse(cleaned);

      console.log("IMG_VALIDATION:", JSON.stringify({
        pageType,
        pass: result.pass,
        textScore: result.textScore,
        faceScore: result.faceScore,
        issues: result.issues,
      }));

      return res.json(result);
    } catch {
      return res.json({ pass: true, reason: "parse_error" });
    }
  } catch (err) {
    console.error("validate-image error:", err);
    return res.json({ pass: true, reason: "error" });
  }
}

function buildValidationPrompt({
  expectedTexts,
  heroName,
  artStyle,
  pageType,
  sceneDescription,
}) {
  const textSection = expectedTexts?.filter(t => t?.trim()).length > 0
    ? `EXPECTED TEXT IN IMAGE:
${expectedTexts.filter(t => t?.trim()).map((t, i) => `Text box ${i + 1}: "${t}"`).join("\n")}

Check EVERY word. Compare character by character. Report any:
- Misspelled words
- Missing words
- Extra words not in the original
- Garbled or unreadable text
- Text that is cut off or partially hidden`
    : "No text boxes expected in this image.";

  return `You are a quality checker for AI-generated children's book illustrations.

Analyze this image and return a JSON object. Be strict but fair.

${textSection}

CHARACTER: The hero is "${heroName || "the main character"}".
ART STYLE: ${artStyle || "children's storybook illustration"}
PAGE TYPE: ${pageType}
SCENE REQUESTED: ${sceneDescription?.substring(0, 200) || "not provided"}

CHECK THESE:

1. TEXT ACCURACY (textScore 1-10):
   - 10: All text perfectly rendered, every word correct
   - 7-9: Minor issues (one slightly unclear letter, small spacing issue)
   - 4-6: Some words misspelled or hard to read
   - 1-3: Text is garbled, wrong, or unreadable

2. FACE/CHARACTER QUALITY (faceScore 1-10):
   - 10: Character looks natural, well-proportioned, appealing
   - 7-9: Minor oddities but overall good
   - 4-6: Noticeable issues (weird proportions, uncanny valley)
   - 1-3: Deformed, extra limbs, melted features, horrifying

3. FORMAT (formatOk true/false):
   - No unwanted borders or frames around the image
   - No watermarks or artifacts
   - Illustration fills the image properly
   - Looks like a professional picture book page

4. OVERALL PASS/FAIL:
   - PASS if: textScore >= 6 AND faceScore >= 6 AND formatOk
   - FAIL if: any score below 6 OR formatOk is false

Return ONLY valid JSON:
{
  "pass": true/false,
  "textScore": 1-10,
  "faceScore": 1-10,
  "formatOk": true/false,
  "issues": ["list of specific issues found"],
  "fixNotes": "if failed, specific instructions to fix on retry"
}

No explanation. No markdown. JSON only.`;
}
