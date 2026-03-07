import { logApiCall } from './lib/admin-logger.js';
import { rateLimit } from './lib/rate-limiter.js';

export const config = { maxDuration: 30 };

function buildSystemPrompt(context) {
  const {
    heroTypeContext,
    bookTypeContext,
    heroName,
    heroAge,
    artStyleName,
    toneName,
    companions,
    hasPhoto,
  } = context;

  const bookTypeLabels = {
    adventure: "Adventure Story (classic narrative prose)",
    nursery_rhyme: "Nursery Rhyme Book (AABB rhyme scheme)",
    bedtime: "Bedtime Story (gentle, ends with sleep)",
    abc: "ABC Book (personalised alphabet)",
    counting: "Counting Book (1-10)",
    superhero: "Superhero Origin Story",
    love_letter: "Love Letter (affirmation book)",
    day_in_life: "A Day in My Life (morning to bedtime)",
  };

  const bookLabel = bookTypeLabels[bookTypeContext] || bookTypeContext || "Adventure Story";

  const suggestionsByType = {
    adventure: `"🏰 Quest through a magical kingdom"
  "🚀 Blast off to outer space"
  "🌊 Dive into an underwater world"
  "🦕 Travel back to dinosaur times"
  "💭 I have my own idea!"`,
    nursery_rhyme: `"🌈 A silly day where everything goes wrong"
  "🐾 Adventures with their pet"
  "🎪 A magical circus comes to town"
  "🌙 A dreamy journey through the night sky"
  "💭 I have my own idea!"`,
    bedtime: `"🌟 A journey through the land of dreams"
  "🧸 Their favourite toy comes to life"
  "🌙 Following the moon to bedtime"
  "🦉 A wise owl guides them to sleep"
  "💭 I have my own idea!"`,
    abc: `"🌍 Around the world — each letter is a country"
  "🐾 Animals from A to Z"
  "🍕 Their favourite things from A to Z"
  "✨ Magical creatures from A to Z"
  "💭 I have my own idea!"`,
    counting: `"🎉 Birthday party — count the guests"
  "🌊 Ocean adventure — count the sea creatures"
  "🚀 Space mission — count the planets"
  "🐾 Farmyard fun — count the animals"
  "💭 I have my own idea!"`,
    superhero: `"💪 Super-strength from being kind"
  "🧠 Mind-reading (but only animals)"
  "🌊 Controls water and waves"
  "✨ Makes things grow with their touch"
  "💭 I have my own idea!"`,
    love_letter: `"👨‍👩‍👧 From Mum and Dad"
  "👵 From Grandma/Grandpa"
  "💑 For my partner"
  "🤝 For my best friend"
  "💭 Custom — tell me who it's from!"`,
    day_in_life: `"🏫 A school day (with magical surprises)"
  "🏖️ The best holiday ever"
  "🎂 Their birthday from morning to night"
  "🌧️ A rainy day that turned amazing"
  "💭 I have my own idea!"`,
  };

  return `You are a warm, enthusiastic story-building assistant for Storytime.

The user has already chosen:
- Book type: ${bookLabel}
- Hero: ${heroName || "not yet named"}${heroAge ? `, age ${heroAge}` : ""}${heroTypeContext ? ` (${heroTypeContext})` : ""}
- Art style: ${artStyleName || "not chosen yet"}
${toneName ? `- Tone: ${toneName}` : ""}
- Photo: ${hasPhoto ? "uploaded" : "not provided"}
${companions && companions.length > 0 ? `- Supporting characters: ${companions.map(c => c.name + " (" + c.relationship + ")").join(", ")}` : ""}

Your job: collect the STORY DETAILS through a short, fun conversation. Ask at most 4-5 questions.

COLLECT:
1. Story idea — what's the adventure/theme?
   Offer 4 vivid, specific suggestions based on the book type.
   ALWAYS allow custom input.
2. Personal details — any real places, events, or memories
   to weave in? (1 question, can be skipped)
3. Dedication + Author — "Who should we dedicate this to,
   and who's the author?" Combine into one question.
   Default author: "A loving family"

When everything is collected, give a quick summary and set action to "ready".

SUGGESTION CHIPS FOR THIS BOOK TYPE:
${suggestionsByType[bookTypeContext] || suggestionsByType.adventure}

RULES:
- MAX 4-5 messages from you before marking ready
- Be BRIEF — 1-2 sentences per message
- React with genuine warmth and excitement
- Suggestion chips MUST be vivid and specific
- NEVER re-ask information already collected (name, age, style, etc.)
- When done, confirm with a quick summary and mark ready

SUGGESTION CHIP STYLE:
Every chip MUST start with a relevant emoji and be vivid and specific.
BAD: "Magical journey", "Tell me your own idea"
GOOD: "🏰 Quest through a magical kingdom", "💭 I have my own idea!"

OUTPUT RULES:
Your response must be ONLY a JSON object. Nothing else.
No text before the JSON. No text after the JSON. No markdown fences.
Start your response with { and end it with }.

JSON schema:
{
  "message": "string — your friendly response to the user",
  "suggestions": ["string array — 2-4 quick reply options"],
  "action": "null or one of: ready",
  "dataUpdate": {"object — only keys collected THIS turn"}
}

dataUpdate valid keys: storyIdea, details, personalIngredient, dedication, authorName, occasion, theme, world`;
}

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
  const startTime = Date.now();
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rl = rateLimit(req, { key: 'chat-assistant', limit: 20, windowMs: 60000 });
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

    const { messages, heroTypeContext, bookTypeContext, heroName, heroAge, artStyleName, toneName, companions, hasPhoto } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Build the system prompt with all pre-collected context
    const system = buildSystemPrompt({
      heroTypeContext,
      bookTypeContext,
      heroName,
      heroAge,
      artStyleName,
      toneName,
      companions,
      hasPhoto,
    });

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      try {
        await logApiCall({
          service: 'anthropic',
          type: 'chat_assistant',
          status: response.status,
          durationMs,
          model: 'claude-sonnet-4-20250514',
          error: data.error?.message,
        });
      } catch (logErr) {
        console.warn('logApiCall failed:', logErr.message);
      }
      return res.status(response.status).json({
        error: data.error?.message || "Anthropic API error",
      });
    }

    // Calculate actual cost from token usage — await before response
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
    try {
      await logApiCall({
        service: 'anthropic',
        type: 'chat_assistant',
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

    // Fallback: couldn't parse JSON
    let cleanMessage = text;
    const braceIdx = text.indexOf("{");
    if (braceIdx > 0) {
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
    return res.status(500).json({ error: `Chat assistant failed: ${err.message}` });
  }
}
