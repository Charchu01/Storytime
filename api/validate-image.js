export const config = { maxDuration: 20 };

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

  // Retry up to 2 times on transient failures
  for (let attempt = 0; attempt < 2; attempt++) {
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
          max_tokens: 500,
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
        console.warn(`Validation API error (attempt ${attempt + 1}):`, data.error?.message);
        // Rate limited — retry after delay
        if (response.status === 429 && attempt === 0) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        // Other API errors — fail open but log clearly
        return res.json({
          pass: true,
          reason: "validation_api_error",
          apiStatus: response.status,
          issues: [`Validation unavailable (HTTP ${response.status})`],
        });
      }

      const text = data.content
        .map((block) => block.text || "")
        .join("")
        .trim();

      try {
        const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
        const result = JSON.parse(cleaned);

        // Ensure required fields exist with sensible defaults
        const normalized = {
          pass: Boolean(result.pass),
          textScore: Number(result.textScore) || 5,
          faceScore: Number(result.faceScore) || 5,
          formatOk: result.formatOk !== false,
          issues: Array.isArray(result.issues) ? result.issues : [],
          fixNotes: result.fixNotes || "",
          sceneAccuracy: Number(result.sceneAccuracy) || 7,
        };

        // Re-compute pass based on actual scores (don't trust Claude's pass field blindly)
        // Covers use hand-lettered artistic text — lower textScore threshold
        const textThreshold = pageType === "cover" ? 4 : 6;
        normalized.pass = normalized.textScore >= textThreshold
          && normalized.faceScore >= 6
          && normalized.formatOk
          && normalized.sceneAccuracy >= 5;

        console.log("IMG_VALIDATION:", JSON.stringify({
          pageType,
          attempt: attempt + 1,
          pass: normalized.pass,
          textScore: normalized.textScore,
          faceScore: normalized.faceScore,
          sceneAccuracy: normalized.sceneAccuracy,
          formatOk: normalized.formatOk,
          issues: normalized.issues,
        }));

        return res.json(normalized);
      } catch (parseErr) {
        console.warn(`Validation parse error (attempt ${attempt + 1}):`, text.substring(0, 200));
        if (attempt === 0) continue; // Retry on parse failure
        return res.json({
          pass: false,
          reason: "parse_error",
          issues: ["Validation response could not be parsed"],
          fixNotes: "Re-generate with clearer composition",
          textScore: 5,
          faceScore: 5,
          formatOk: true,
        });
      }
    } catch (err) {
      console.error(`Validation network error (attempt ${attempt + 1}):`, err.message);
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      // Final attempt failed — fail open but mark it
      return res.json({
        pass: true,
        reason: "network_error",
        issues: ["Validation could not reach API"],
      });
    }
  }
}

function buildValidationPrompt({
  expectedTexts,
  heroName,
  artStyle,
  pageType,
  sceneDescription,
}) {
  const isCover = pageType === "cover";
  const hasExpectedText = expectedTexts?.filter(t => t?.trim()).length > 0;

  let textSection;
  if (isCover && hasExpectedText) {
    textSection = `EXPECTED TITLE IN IMAGE:
${expectedTexts.filter(t => t?.trim()).map((t) => `Title: "${t}"`).join("\n")}

This is a COVER — the title is HAND-LETTERED artistic text that is PART OF the illustration, not in a text box.
Check that the title is:
- READABLE and RECOGNIZABLE as the correct title
- Not garbled or nonsensical
Do NOT penalize for artistic styling, glow effects, curved lettering, or slight stylization.
Hand-lettered text will naturally look different from typed text — that is expected and correct.`;
  } else if (hasExpectedText) {
    textSection = `EXPECTED TEXT IN IMAGE:
${expectedTexts.filter(t => t?.trim()).map((t, i) => `Text box ${i + 1}: "${t}"`).join("\n")}

Check EVERY word. Compare character by character. Report any:
- Misspelled words
- Missing words
- Extra words not in the original
- Garbled or unreadable text
- Text that is cut off or partially hidden`;
  } else {
    textSection = "No text boxes expected in this image.";
  }

  return `You are a strict quality checker for AI-generated children's book illustrations.

Analyze this image carefully and return a JSON object. Be STRICT — this is a premium product.

${textSection}

CHARACTER: The hero is "${heroName || "the main character"}".
ART STYLE: ${artStyle || "children's storybook illustration"}
PAGE TYPE: ${pageType}
SCENE REQUESTED: ${sceneDescription?.substring(0, 300) || "not provided"}

CHECK THESE CAREFULLY:

1. TEXT ACCURACY (textScore 1-10):
   - 10: All text perfectly rendered, every word correct
   - 7-9: Minor issues (one slightly unclear letter, small spacing issue)
   - 4-6: Some words misspelled or hard to read
   - 1-3: Text is garbled, wrong, or unreadable
   - If no text was expected, score 10

2. FACE/CHARACTER QUALITY (faceScore 1-10):
   - 10: Character looks natural, well-proportioned, appealing
   - 7-9: Minor oddities but overall good
   - 4-6: Noticeable issues (weird proportions, uncanny valley, extra fingers)
   - 1-3: Deformed, extra limbs, melted features, horrifying

3. SCENE ACCURACY (sceneAccuracy 1-10):
   - 10: Scene matches the description perfectly
   - 7-9: Scene mostly matches, minor differences
   - 4-6: Significant differences from description
   - 1-3: Completely wrong scene

4. FORMAT (formatOk true/false):
   - No unwanted borders or frames around the image
   - No watermarks or artifacts
   - Illustration fills the image properly
   - Looks like a professional picture book page

5. OVERALL PASS/FAIL:
   - PASS if: textScore >= 6 AND faceScore >= 6 AND sceneAccuracy >= 5 AND formatOk
   - FAIL if: any criteria not met

Return ONLY valid JSON:
{
  "pass": true/false,
  "textScore": 1-10,
  "faceScore": 1-10,
  "sceneAccuracy": 1-10,
  "formatOk": true/false,
  "issues": ["list of specific issues found"],
  "fixNotes": "if failed, specific detailed instructions to fix on retry — be very specific about what went wrong"
}

No explanation. No markdown. JSON only.`;
}
