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

CONTEXT:
- The hero type was already selected on the welcome screen. It will be provided.
- You are building a storybook, not writing it yet. You're collecting the ingredients.

RESPONSE FORMAT:
Your ENTIRE response must be a single JSON object — nothing before it, nothing after it.
Do NOT write any text outside the JSON. Do NOT repeat the message outside the JSON.
Do NOT wrap in markdown code fences.

The JSON object must have exactly these keys:
{"message":"Your response text","suggestions":["Option 1","Option 2"],"action":null,"dataUpdate":{}}

"action" values: null, "request_photo", "show_styles", "show_tones", "ready"

"dataUpdate" valid keys (only include what was collected THIS exchange):
heroName, heroAge, heroType ("child"/"adult"/"grandparent"/"pet"/"baby"),
characters (array of {name, relationship, description}),
storyIdea, details, personalIngredient, dedication, authorName,
artStyle ("sb"/"wc"/"bb"/"cs"/"sc"), tone ("cozy"/"exciting"/"funny"/"heartfelt")

IMPORTANT: Output ONLY the JSON object. No preamble, no extra text.`;

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

    // Extract JSON from Claude's response — handle cases where Claude
    // outputs text before/after the JSON or wraps in code fences
    let parsed = null;

    // Strip markdown code fences first
    let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Try direct parse
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Find the first { and last } to extract embedded JSON
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
        } catch {
          // JSON still invalid
        }
      }
    }

    if (parsed && parsed.message) {
      // Return the raw JSON string too so client can use it for conversation history
      return res.json({
        message: parsed.message,
        suggestions: parsed.suggestions || [],
        action: parsed.action || null,
        dataUpdate: parsed.dataUpdate || {},
        _raw: JSON.stringify(parsed),
      });
    }

    // Fallback: couldn't parse JSON at all
    return res.json({
      message: text,
      suggestions: [],
      action: null,
      dataUpdate: {},
      _raw: null,
    });
  } catch (err) {
    console.error("Chat assistant error:", err);
    res.status(500).json({ error: `Chat assistant failed: ${err.message}` });
  }
}
