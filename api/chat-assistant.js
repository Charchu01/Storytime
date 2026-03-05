export const config = { maxDuration: 30 };

const ASSISTANT_SYSTEM_PROMPT = `You are a warm, enthusiastic story-building assistant for Storytime — an app that creates personalized illustrated storybooks.

You are guiding a user through building their story. You'll collect information through natural, friendly conversation.

INFORMATION TO COLLECT (roughly this order):
1. Hero's name
2. Hero's age or type (child, adult, grandparent, pet) — NEVER assume. Ask explicitly.
3. Hero's photo (prompt upload)
4. Supporting characters — for each: name, relationship to hero, optional photo
5. Story idea — what's the adventure? Let them describe freely. Offer themed suggestions but always allow custom input.
6. Specific details — places, memories, events to include
7. Personal ingredient — something special to weave in (e.g. "just lost first tooth", "loves dinosaurs")
8. Dedication message — "For [someone], [message]"
9. Author name — "By [name]"
10. Art style — offer: Storybook, Watercolor, Bold & Bright, Cozy & Soft, Sketch & Color
11. Tone — cozy, exciting, funny, heartfelt

CRITICAL RULES:
- Ask ONE question at a time
- React with genuine warmth: "Oh I love that!", "This is going to be amazing!"
- Keep responses to 1-2 sentences + suggestion chips
- NEVER assume someone is a child. If they mention or upload a photo of an adult, ask: "Is [name] a grown-up in this story, or would you like them as a child character?"
- Offer 2-4 quick-select suggestions as chips + free text is always available
- When all info is collected, summarize and ask to confirm
- If user wants to skip something, that's fine — move on
- Be encouraging and excited about their creative choices

SUGGESTION CHIP STYLE:
Every suggestion chip MUST start with a relevant emoji and be vivid and specific.
BAD: "Magical journey", "Everyday hero moment", "Tell me your own idea"
GOOD: "🏰 Quest through a magical kingdom", "🚀 Blast off to outer space", "🧜‍♂️ Underwater adventure", "💭 I have my own idea!"
BAD: "Partner", "Child", "Pet", "Solo adventure"
GOOD: "👩 My partner", "👧 Our kid(s)", "🐾 A pet!", "🦸 Solo hero — just me!"
Make them fun, descriptive, and feel like exciting options — not form labels.

CONTEXT:
- The hero type was already selected on the welcome screen. It will be provided.
- You are building a storybook, not writing it yet. You're collecting the ingredients.

OUTPUT RULES:
Your response must be ONLY a JSON object. Nothing else.
No text before the JSON. No text after the JSON. No markdown fences.
Start your response with { and end it with }.

JSON schema:
{
  "message": "string — your friendly response to the user",
  "suggestions": ["string array — 2-4 quick reply options"],
  "action": "null or one of: request_photo, show_styles, show_tones, ready",
  "dataUpdate": {"object — only keys collected THIS turn"}
}

dataUpdate valid keys: heroName, heroAge, heroType (child/adult/grandparent/pet/baby), characters (array of {name, relationship, description}), storyIdea, details, personalIngredient, dedication, authorName, artStyle (sb/wc/bb/cs/sc), tone (cozy/exciting/funny/heartfelt)`;

// Extract a JSON object from text that may contain preamble/postamble
function extractJSON(text) {
  // Strip markdown fences
  let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Find the outermost balanced { } pair
  let depth = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        end = i;
        break;
      }
    }
  }

  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {}
  }

  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.ANTHROPIC_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_KEY not configured" });
    }

    const { messages, heroTypeContext } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Build the system prompt with hero type context
    let system = ASSISTANT_SYSTEM_PROMPT;
    if (heroTypeContext) {
      system += `\n\nThe user selected "${heroTypeContext}" as who this story is about on the welcome screen. Start your conversation accordingly.`;
    }

    // Convert our message format to Claude API format
    const apiMessages = messages.map((m) => {
      if (m.imageDataUrl) {
        const match = m.imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "Here's a photo" },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: match[1],
                  data: match[2],
                },
              },
            ],
          };
        }
      }
      return { role: m.role, content: m.content };
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
        max_tokens: 500,
        system,
        messages: apiMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Anthropic API error",
      });
    }

    const text = data.content.map((block) => block.text || "").join("").trim();

    // Extract JSON from Claude's response
    const parsed = extractJSON(text);

    if (parsed && typeof parsed.message === "string") {
      return res.json({
        message: parsed.message,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        action: parsed.action || null,
        dataUpdate: parsed.dataUpdate || {},
      });
    }

    // Fallback: couldn't parse JSON — strip any JSON-looking content from the text
    // to get a clean message for display
    let cleanMessage = text;
    const braceIdx = text.indexOf("{");
    if (braceIdx > 0) {
      // Take only the text before the first {
      cleanMessage = text.slice(0, braceIdx).trim();
    }
    if (!cleanMessage) {
      cleanMessage = "I'm here to help build your story! What should we work on next?";
    }

    return res.json({
      message: cleanMessage,
      suggestions: [],
      action: null,
      dataUpdate: {},
    });
  } catch (err) {
    console.error("Chat assistant error:", err);
    res.status(500).json({ error: `Chat assistant failed: ${err.message}` });
  }
}
