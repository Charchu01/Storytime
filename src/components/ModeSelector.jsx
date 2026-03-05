import { useState } from "react";
import { STORY_MODES } from "../constants/data";

const MODE_BGS = {
  child: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
  pet: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
  family: "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
  special: "linear-gradient(135deg, #FDE2E4, #FECDD3)",
  imagination: "linear-gradient(135deg, #EDE9FE, #DDD6FE)",
};

export default function ModeSelector({ onSelect, onBack }) {
  const [selected, setSelected] = useState(null);
  const [isGift, setIsGift] = useState(false);

  return (
    <div className="mode-page wizard-step-enter">
      <button className="back-btn mode-back" onClick={onBack}>← Back</button>

      <div className="mode-header">
        <h1 className="mode-h1">Who is this story about?</h1>
        <p className="mode-sub">Each mode tailors the story, prompts, and illustrations perfectly.</p>
      </div>

      <div className="mode-grid">
        {STORY_MODES.map((mode) => (
          <button
            key={mode.id}
            className={`mode-card${selected === mode.id ? " selected" : ""}${selected && selected !== mode.id ? " dimmed" : ""}`}
            style={{ background: MODE_BGS[mode.id] }}
            onClick={() => setSelected(mode.id)}
          >
            <span className="mode-card-emoji">{mode.emoji}</span>
            <span className="mode-card-label">{mode.label}</span>
            <span className="mode-card-desc">{mode.desc}</span>
          </button>
        ))}
      </div>

      <div className="mode-gift-row">
        <label className="mode-gift-toggle">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
          />
          <span className="mode-gift-label">🎁 This is a gift</span>
        </label>
      </div>

      <button
        className="big-btn"
        disabled={!selected}
        onClick={() => onSelect(selected, isGift)}
      >
        {selected ? `Continue with "${STORY_MODES.find((m) => m.id === selected)?.label}" →` : "Choose a mode to continue"}
      </button>
    </div>
  );
}
