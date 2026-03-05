import { useState } from "react";

const HERO_TYPES = [
  { id: "child", emoji: "👶", label: "A Child" },
  { id: "couple", emoji: "👨‍👩‍👧", label: "A Couple" },
  { id: "pet", emoji: "🐾", label: "A Pet" },
  { id: "special", emoji: "👵", label: "Someone Special" },
  { id: "family", emoji: "👨‍👩‍👧‍👦", label: "A Family" },
  { id: "surprise", emoji: "✨", label: "Surprise me" },
];

const TIER_OPTIONS = [
  { id: "standard", price: "$9.99", name: "Standard", desc: "6 illustrated pages", pages: 6 },
  { id: "premium", price: "$19.99", name: "Premium", desc: "10 pages · highest quality", pages: 10, badge: "Most popular" },
];

export default function WelcomeScreen({ onSelect, onBack }) {
  const [heroType, setHeroType] = useState(null);
  const [tier, setTier] = useState(null);
  const [isGift, setIsGift] = useState(false);

  function handleContinue() {
    if (!heroType || !tier) return;
    onSelect(heroType, tier, isGift);
  }

  return (
    <div className="ws-page">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className="ws-hero">
        <h1 className="ws-h1">Who is this story about?</h1>
        <p className="ws-sub">Pick the star of your storybook</p>
      </div>

      <div className="ws-type-grid">
        {HERO_TYPES.map((t) => (
          <button
            key={t.id}
            className={`ws-type-card${heroType === t.id ? " on" : ""}${heroType && heroType !== t.id ? " dim" : ""}`}
            onClick={() => { setHeroType(t.id); setTier(null); }}
          >
            <span className="ws-type-em">{t.emoji}</span>
            <span className="ws-type-lbl">{t.label}</span>
          </button>
        ))}
      </div>

      {heroType && (
        <>
          <div className="ws-tier-section">
            <h2 className="ws-tier-h">Choose your plan</h2>
            <div className="ws-tier-row">
              {TIER_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  className={`ws-tier${tier === t.id ? " on" : ""}`}
                  onClick={() => setTier(t.id)}
                >
                  {t.badge && <div className="ws-tier-badge">{t.badge}</div>}
                  <div className="ws-tier-price">{t.price}</div>
                  <div className="ws-tier-name">{t.name}</div>
                  <div className="ws-tier-desc">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="ws-gift-row">
            <label className="ws-gift-toggle">
              <input
                type="checkbox"
                checked={isGift}
                onChange={(e) => setIsGift(e.target.checked)}
              />
              <span className="ws-gift-label">🎁 This is a gift</span>
            </label>
          </div>
        </>
      )}

      <button
        className="big-btn"
        disabled={!heroType || !tier}
        onClick={handleContinue}
      >
        {heroType && tier ? "Start Building →" : "Choose above to continue"}
      </button>
    </div>
  );
}
