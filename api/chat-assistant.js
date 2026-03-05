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

RESPONSE FORMAT — you MUST return valid JSON with these fields:
{
  "message": "Your response text to the user",
  "suggestions": ["Option 1", "Option 2", "Option 3"],
  "action": null,
  "dataUpdate": {}
}

"action" can be one of:
- null (default, just chatting)
- "request_photo" (when asking for a photo upload)
- "show_styles" (when presenting art style options)
- "show_tones" (when presenting tone options)
- "ready" (when all data is collected and user confirms)

"dataUpdate" should include any new data collected in this exchange. Valid keys:
- heroName (string)
- heroAge (string or number)
- heroType (string: "child", "adult", "grandparent", "pet", "baby")
- characters (array of {name, relationship, description})
- storyIdea (string — the user's own words)
- details (string — places, events, memories)
- personalIngredient (string)
- dedication (string)
- authorName (string)
- artStyle (string: "sb", "wc", "bb", "cs", "sc")
- tone (string: "cozy", "exciting", "funny", "heartfelt")

Only include keys in dataUpdate that were actually collected in THIS exchange.

Remember: Return ONLY valid JSON. No markdown wrapping, no explanation outside the JSON.`;

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

    // Try to parse JSON response
    try {
      const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return res.json(parsed);
    } catch {
      // If Claude didn't return valid JSON, wrap it
      return res.json({
        message: text,
        suggestions: [],
        action: null,
        dataUpdate: {},
      });
    }
  } catch (err) {
    console.error("Chat assistant error:", err);
    res.status(500).json({ error: `Chat assistant failed: ${err.message}` });
  }
}
