import { useState } from "react";
import { BOOK_TYPES } from "../constants/data";

export default function BookTypePicker({ onSelect, onBack }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");

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
        <p className="create-step-subtitle">Choose the perfect format for your story</p>

        <div className="btp-grid">
          {BOOK_TYPES.map((type) => (
            <button
              key={type.id}
              className="btp-card"
              onClick={() => onSelect(type)}
            >
              <div className="btp-card-emoji-circle">
                <span className="btp-card-emoji">{type.emoji}</span>
              </div>
              <h3 className="btp-card-title">{type.title}</h3>
              <p className="btp-card-subtitle">{type.subtitle}</p>
              {type.example && (
                <p className="btp-card-example">&ldquo;{type.example}&rdquo;</p>
              )}
            </button>
          ))}

          {/* Something Else card */}
          <button
            className={`btp-card btp-card-custom${showCustom ? " btp-card-custom--active" : ""}`}
            onClick={() => setShowCustom(!showCustom)}
          >
            <div className="btp-card-emoji-circle">
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
