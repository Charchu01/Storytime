import { logApiCall, logValidation, updateDailyApiStats } from './lib/admin-logger.js';

export const config = { maxDuration: 25 };

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
    bookId,
    referencePhotoUrl,
    characterDescriptions,
    previousPageStyle,
  } = req.body || {};

  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  req._adminStartTime = Date.now();

  // Retry up to 2 times on transient failures
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Build message content — generated image + optional reference photo + prompt
      const messageContent = [];

      // Generated image first
      messageContent.push({
        type: "image",
        source: { type: "url", url: imageUrl },
      });

      // Reference photo for likeness comparison (when available)
      if (referencePhotoUrl) {
        messageContent.push({
          type: "text",
          text: "Above is the AI-generated illustration. Below is the REFERENCE PHOTO of the real person who should appear in the illustration:",
        });
        messageContent.push({
          type: "image",
          source: { type: "url", url: referencePhotoUrl },
        });
      }

      // Validation prompt
      messageContent.push({
        type: "text",
        text: buildValidationPrompt({
          expectedTexts,
          heroName,
          artStyle,
          pageType,
          sceneDescription,
          characterDescriptions,
          previousPageStyle,
          hasReferencePhoto: !!referencePhotoUrl,
        }),
      });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: messageContent,
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
          textBoxScore: Number(result.textBoxScore) || 7,
          sceneAccuracy: Number(result.sceneAccuracy) || 7,
          formatOk: result.formatOk !== false,
          likenessScore: result.likenessScore ? Number(result.likenessScore) : null,
          issues: Array.isArray(result.issues) ? result.issues : [],
          fixNotes: result.fixNotes || "",
          textBoxDescription: result.textBoxDescription || "",
          characterCount: Number(result.characterCount) || 1,
          fingersOk: result.fingersOk !== false,
        };

        // Re-compute pass based on actual scores (don't trust Claude's pass field blindly)
        // Covers use hand-lettered artistic text — lower textScore threshold
        const textThreshold = pageType === "cover" ? 4 : 6;
        normalized.pass = normalized.textScore >= textThreshold
          && normalized.faceScore >= 6
          && (normalized.textBoxScore || 10) >= 6
          && normalized.formatOk
          && normalized.sceneAccuracy >= 5;

        console.log("IMG_VALIDATION:", JSON.stringify({
          pageType,
          attempt: attempt + 1,
          pass: normalized.pass,
          textScore: normalized.textScore,
          faceScore: normalized.faceScore,
          textBoxScore: normalized.textBoxScore,
          sceneAccuracy: normalized.sceneAccuracy,
          likenessScore: normalized.likenessScore,
          formatOk: normalized.formatOk,
          fingersOk: normalized.fingersOk,
          issues: normalized.issues,
        }));

        // Admin logging
        const valDuration = Date.now() - (req._adminStartTime || Date.now());
        logApiCall({
          service: 'anthropic',
          type: 'validation',
          bookId: bookId || null,
          status: 200,
          durationMs: valDuration,
          model: 'claude-sonnet-4-20250514',
          cost: 0.004,
          details: `${pageType}: text=${normalized.textScore} face=${normalized.faceScore} textBox=${normalized.textBoxScore} scene=${normalized.sceneAccuracy} ${normalized.pass ? 'PASS' : 'FAIL'}`,
        }).catch(() => {});
        updateDailyApiStats('anthropic', valDuration, 0.004, false).catch(() => {});
        logValidation({
          bookId: bookId || null,
          page: pageType,
          attempt: attempt + 1,
          textScore: normalized.textScore,
          faceScore: normalized.faceScore,
          textBoxScore: normalized.textBoxScore,
          sceneAccuracy: normalized.sceneAccuracy,
          formatOk: normalized.formatOk,
          pass: normalized.pass,
          issues: normalized.issues,
          fixNotes: normalized.fixNotes,
          likenessScore: normalized.likenessScore,
          fingersOk: normalized.fingersOk,
        }).catch(() => {});

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
          textBoxScore: 7,
          sceneAccuracy: 5,
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
  characterDescriptions,
  previousPageStyle,
  hasReferencePhoto,
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

  const characterSection = characterDescriptions && characterDescriptions.length > 1
    ? `EXPECTED CHARACTERS IN THIS SCENE:\n${characterDescriptions.map((c, i) =>
        `${i + 1}. ${c.name} (${c.relationship})${c.hasPhoto ? ' — has reference photo uploaded' : ''}`
      ).join('\n')}\nCheck that ALL listed characters appear in the image, are distinguishable from each other, and each looks natural and appropriate.`
    : `CHARACTER: The hero is "${heroName || 'the main character'}". Check that they look natural, appealing, and age-appropriate.`;

  return `You are a STRICT quality inspector for a premium children's storybook. This book costs $10-20. Parents will judge every page. Be HARSH. A score of 7 means "noticeable issues that a parent would spot." Do NOT be generous. The default score for "looks okay I guess" is 6, not 8.

PAGE TYPE: ${pageType}
ART STYLE REQUESTED: ${artStyle || "children's storybook illustration"}
SCENE REQUESTED: ${sceneDescription?.substring(0, 400) || "not provided"}

=== CHECK 1: TEXT ACCURACY (textScore 1-10) ===
${textSection}

Compare EVERY word character by character. AI image generators frequently:
- Swap similar letters (d↔b, p↔q, m↔n, u↔v)
- Insert random characters mid-word
- Drop letters from long words
- Make text progressively worse toward the end of a sentence
- Render gibberish that LOOKS like text from a distance but is nonsense

Score STRICTLY:
- 10: Every single word perfectly readable and correct
- 8-9: One slightly unclear letter but all words recognizable
- 6-7: One word misspelled or one section hard to read
- 4-5: Multiple words wrong or garbled
- 1-3: Text is mostly unreadable nonsense
- If no text expected, score 10

=== CHECK 2: CHARACTER QUALITY (faceScore 1-10) ===
${characterSection}

Check EVERY character in the scene for:
- Natural proportions (no elongated limbs, oversized heads)
- Correct number of fingers (EXACTLY 5 per hand — count them)
- No extra limbs or merged body parts
- Eyes that look natural (not crossed, not wildly different sizes)
- Age-appropriate appearance
- If multiple characters: each must be DISTINCT and distinguishable

Score STRICTLY:
- 10: All characters look natural, appealing, age-appropriate
- 8-9: Very minor oddities (slightly off hand positioning)
- 6-7: Noticeable issues a parent would spot (weird fingers, uncanny valley)
- 4-5: Clearly wrong (extra fingers, distorted face, wrong age)
- 1-3: Horrifying (melted features, extra limbs, body horror)

=== CHECK 3: TEXT BOX CONSISTENCY (textBoxScore 1-10) ===
Check the visual design of text boxes/bubbles in this image:
- Shape: cloud/bubble shaped with smooth rounded edges?
- Background: semi-transparent white/cream fill?
- Font style: hand-drawn/handwritten style, consistent across boxes?
- Font size: readable, proportional to the image?
- Font color: consistent warm dark color?
- Position: appropriately placed, not covering key character faces?
- Border: thin warm border present?

${previousPageStyle ? `EXPECTED STYLE (MUST match the first page): ${previousPageStyle}\nCompare what you see to this description. Any deviation is a consistency failure.` : 'This is the FIRST interior page. Describe the text box style you see in detail so we can enforce it on all future pages.'}

Score:
- 10: Text boxes are beautiful, consistent, professional
- 7-9: Minor differences but overall cohesive look
- 4-6: Noticeably different style from what was expected
- 1-3: Completely different text box design

=== CHECK 4: SCENE ACCURACY (sceneAccuracy 1-10) ===
Does the illustration match what was requested?
- Setting/environment correct?
- Characters doing what was described?
- Mood matches (cozy, adventurous, triumphant, etc.)?
- Time of day/lighting correct?
- Layout type roughly matches (panoramic vs close-up vs split scene)?

Score:
- 10: Perfect match to the description
- 7-9: Mostly matches, minor differences
- 4-6: Significant differences from what was requested
- 1-3: Completely wrong scene

=== CHECK 5: FORMAT (formatOk true/false) ===
- Illustration fills edge to edge (no white/black borders or frames)
- No watermarks, artifacts, or UI elements
- No text outside of text boxes bleeding randomly into the art
- Appropriate for a children's book (no scary/inappropriate content)
- Image is not cropped awkwardly

${hasReferencePhoto ? `=== CHECK 6: PHOTO LIKENESS (likenessScore 1-10) ===
Compare the illustrated character to the reference photo provided.
- Does the hair color and style match?
- Do the facial features resemble the real person?
- Is the skin tone approximately correct?
- Would the parent recognize their child in this illustration?

Score:
- 10: Unmistakably the same person, strong resemblance
- 7-9: Clear resemblance, parent would recognize them immediately
- 4-6: Vague similarity, could be a different child
- 1-3: Looks nothing like the reference photo
` : ''}
Return ONLY valid JSON. No explanation. No markdown fences.
{
  "pass": true/false,
  "textScore": 1-10,
  "faceScore": 1-10,
  "textBoxScore": 1-10,
  "sceneAccuracy": 1-10,
  "formatOk": true/false,
  ${hasReferencePhoto ? '"likenessScore": 1-10,' : ''}
  "issues": ["list of specific issues found — be detailed"],
  "fixNotes": "if any score is below 7, provide SPECIFIC regeneration instructions",
  "textBoxDescription": "describe the text box style: shape, background color, font style, font color, border style, position pattern",
  "characterCount": number_of_characters_visible,
  "fingersOk": true/false
}

No explanation. No markdown. JSON only.`;
}
