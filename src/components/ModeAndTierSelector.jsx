import { useState } from "react";
import { STORY_MODES } from "../constants/data";

const MODE_BGS = {
  child: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
  pet: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
  family: "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
  special: "linear-gradient(135deg, #FDE2E4, #FECDD3)",
  imagination: "linear-gradient(135deg, #EDE9FE, #DDD6FE)",
};

export default function ModeAndTierSelector({ onSelect, onBack }) {
  const [mode, setMode] = useState(null);
  const [tier, setTier] = useState(null);
  const [isGift, setIsGift] = useState(false);

  return (
    <div className="mts-page">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h1 className="mts-h1">Who is this story for?</h1>
      <p className="mts-sub">Pick the star, then choose your plan.</p>

      <div className="mts-mode-grid">
        {STORY_MODES.map((m) => (
          <button
            key={m.id}
            className={`mts-mode${mode === m.id ? " on" : ""}${mode && mode !== m.id ? " dim" : ""}`}
            style={{ background: MODE_BGS[m.id] }}
            onClick={() => { setMode(m.id); setTier(null); }}
          >
            <span className="mts-mode-em">{m.emoji}</span>
            <span className="mts-mode-lbl">{m.label}</span>
            <span className="mts-mode-desc">{m.desc}</span>
          </button>
        ))}
      </div>

      <div className="mts-gift-row">
        <label className="mts-gift-toggle">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
          />
          <span className="mts-gift-label">🎁 This is a gift</span>
        </label>
      </div>

      {mode && (
        <div className="mts-tier-section">
          <h2 className="mts-tier-h">Choose your plan</h2>
          <div className="mts-tier-row">
            <button
              className={`mts-tier${tier === "standard" ? " on" : ""}`}
              onClick={() => setTier("standard")}
            >
              <div className="mts-tier-price">$9.99</div>
              <div className="mts-tier-name">Standard</div>
              <div className="mts-tier-desc">6 illustrated pages · face-matching illustrations</div>
            </button>
            <button
              className={`mts-tier${tier === "premium" ? " on" : ""}`}
              onClick={() => setTier("premium")}
            >
              <div className="mts-tier-badge">Most popular</div>
              <div className="mts-tier-price">$19.99</div>
              <div className="mts-tier-name">Premium</div>
              <div className="mts-tier-desc">10 pages · highest quality AI illustrations</div>
            </button>
          </div>
        </div>
      )}

      <button
        className="big-btn"
        disabled={!mode || !tier}
        onClick={() => onSelect(mode, tier, isGift)}
      >
        {mode && tier ? "Let's go →" : "Choose above to continue"}
      </button>
    </div>
  );
}
