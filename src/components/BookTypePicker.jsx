import { useState, useRef } from "react";
import { BOOK_TYPES } from "../constants/data";

const MOOD_COLORS = {
  adventure: "rgba(255, 183, 77, VAR)",
  nursery_rhyme: "rgba(240, 128, 170, VAR)",
  bedtime: "rgba(147, 130, 220, VAR)",
  abc: "rgba(100, 181, 246, VAR)",
  counting: "rgba(129, 199, 132, VAR)",
  superhero: "rgba(239, 83, 80, VAR)",
  love_letter: "rgba(244, 143, 177, VAR)",
  day_in_life: "rgba(255, 213, 79, VAR)",
};

function getMoodColor(id, alpha) {
  const template = MOOD_COLORS[id];
  return template ? template.replace("VAR", alpha) : "transparent";
}

export default function BookTypePicker({ onSelect, onBack }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const advanceTimer = useRef(null);

  function handleCardClick(type) {
    if (advanceTimer.current) return;
    setSelectedId(type.id);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      onSelect(type);
    }, 300);
  }

  function handleCustomSubmit() {
    if (!customTitle.trim()) return;
    onSelect({
      id: "custom",
      emoji: "\u270F\uFE0F",
      title: customTitle.trim(),
      subtitle: customDesc.trim() || "A custom story",
      category: "story",
      claudeFormat: `Write a personalized children's story based on this concept: "${customTitle.trim()}". ${customDesc.trim()}`,
      example: "",
      pageCount: { standard: 6, premium: 10 },
    });
  }

  return (
    <div className="create-step">
      <div className="create-step-header">
        <button className="create-back" onClick={onBack}>&larr; Back</button>
      </div>
      <div className="create-step-content">
        <h1 className="create-step-title">What kind of book shall we make?</h1>
        <p className="create-step-subtitle">Every great story starts with a spark</p>

        <div className="btp-grid">
          {BOOK_TYPES.map((type, idx) => (
            <button
              key={type.id}
              className={
                "btp-card" +
                (idx < 3 ? " btp-card--featured" : "") +
                (selectedId === type.id ? " btp-card--selected" : "")
              }
              style={{
                "--mood-bg": getMoodColor(type.id, "0.08"),
                "--mood-bg-hover": getMoodColor(type.id, "0.15"),
                "--mood-circle": getMoodColor(type.id, "0.15"),
              }}
              onClick={() => handleCardClick(type)}
            >
              {selectedId === type.id && (
                <span className="btp-card-check">✓</span>
              )}
              <div className="btp-card-emoji-circle">
                <span className="btp-card-emoji">{type.emoji}</span>
              </div>
              <h3 className="btp-card-title">{type.title}</h3>
              <p className="btp-card-subtitle">{type.subtitle}</p>
              {type.example && (
                <p className="btp-card-example">{type.example}</p>
              )}
            </button>
          ))}

          {/* Something Else card */}
          <button
            className={`btp-card btp-card-custom${showCustom ? " btp-card-custom--active" : ""}`}
            onClick={() => setShowCustom(!showCustom)}
          >
            <span className="btp-custom-bg-emoji">✏️</span>
            <div className="btp-card-emoji-circle" style={{ "--mood-circle": "rgba(180, 160, 140, 0.12)" }}>
              <span className="btp-card-emoji">{"\u270F\uFE0F"}</span>
            </div>
            <h3 className="btp-card-title">Something Else</h3>
            <p className="btp-card-subtitle">Describe your own idea</p>
          </button>
        </div>

        {/* Custom idea form — below the grid */}
        {showCustom && (
          <div className="btp-custom-section">
            <h3 className="btp-custom-heading">Describe your idea</h3>
            <input
              className="btp-custom-input"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="What kind of book? e.g. 'A fairy tale about kindness'"
              autoFocus
              onKeyDown={(e) => e.stopPropagation()}
            />
            <textarea
              className="btp-custom-textarea"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="Any extra details... (optional)"
              rows={2}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <button
              className="create-continue-btn"
              disabled={!customTitle.trim()}
              onClick={handleCustomSubmit}
            >
              Use This Idea &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
