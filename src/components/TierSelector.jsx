import { useState } from "react";

const TIERS = [
  {
    id: "standard",
    name: "Standard",
    price: "$9.99",
    badge: "Great for trying it out",
    features: [
      "6 illustrated pages",
      "Ready in ~60 seconds",
      "Great character likeness",
      "Beautiful art styles",
    ],
    gradient: "linear-gradient(135deg, #FEF3C7, #FDE68A, #F59E0B)",
    emoji: "📖",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$19.99",
    badge: "Best for families",
    popular: true,
    features: [
      "10 illustrated pages",
      "Perfect face consistency on every page",
      "Character saved to Family Vault",
      "Reuse character instantly in future stories",
    ],
    gradient: "linear-gradient(135deg, #EDE9FE, #DDD6FE, #8B5CF6)",
    emoji: "✨",
  },
];

export default function TierSelector({ onSelect, onBack }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="tier-page">
      <button className="chat-back tier-back" onClick={onBack}>
        ← Back
      </button>

      <div className="tier-header">
        <div className="tier-emoji">✨</div>
        <h1 className="tier-h1">Choose your storybook</h1>
        <p className="tier-sub">
          Every story is unique, magical, and made just for your child
        </p>
      </div>

      <div className="tier-cards">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            className={`tier-card${hovered === tier.id ? " tier-card-hover" : ""}${tier.popular ? " tier-card-popular" : ""}`}
            onMouseEnter={() => setHovered(tier.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(tier.id)}
          >
            {tier.popular && <div className="tier-pop-badge">Most Popular</div>}
            <div className="tier-card-top" style={{ background: tier.gradient }}>
              <span className="tier-card-emoji">{tier.emoji}</span>
            </div>
            <div className="tier-card-body">
              <h2 className="tier-card-name">{tier.name}</h2>
              <div className="tier-card-price">{tier.price}</div>
              <div className="tier-card-badge-txt">{tier.badge}</div>
              <ul className="tier-features">
                {tier.features.map((f, i) => (
                  <li key={i}>
                    <span className="tier-check">✓</span> {f}
                  </li>
                ))}
              </ul>
              <div className="tier-select-btn">
                Select {tier.name} →
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="tier-fine">
        One-time payment · No subscription · Instant access
      </p>
    </div>
  );
}
