import { useState } from "react";

const STORY_SUGGESTIONS = [
  "Make it funnier 😄",
  "More adventurous 🚀",
  "Make it shorter",
  "Add a twist ✨",
  "Cozier 🌙",
];

const ART_SUGGESTIONS = [
  "Change setting 🌿",
  "Add magic ✨",
  "Make it nighttime 🌙",
  "Warmer colors 🌅",
  "Add the pet 🐾",
];

export default function EditDrawer({ type, onSave }) {
  const [inputText, setInputText] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestions = type === "story" ? STORY_SUGGESTIONS : ART_SUGGESTIONS;

  async function handleSubmit(text) {
    if (!text.trim() || saving) return;
    setSaving(true);
    await onSave(text);
    setSaving(false);
    setInputText("");
  }

  return (
    <div className="ed-drawer">
      <div className="ed-ttl">
        {type === "story" ? "✏️ What should change?" : "🎨 How should the art look different?"}
      </div>

      <div className="ed-sugs">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            className="ed-sug"
            onClick={() => handleSubmit(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="ed-row">
        <textarea
          className="ed-inp"
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(inputText);
            }
          }}
          placeholder="Or describe your change…"
        />
        <button
          className="ed-send"
          onClick={() => handleSubmit(inputText)}
          disabled={!inputText.trim() || saving}
        >
          {saving ? "…" : "→"}
        </button>
      </div>
    </div>
  );
}
