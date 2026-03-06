import { useState } from "react";
import { BOOK_TYPES, BOOK_TYPE_CATEGORIES } from "../constants/data";

export default function BookTypePicker({ onSelect, onBack }) {
  const [filter, setFilter] = useState("all");
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");

  const filtered = filter === "all"
    ? BOOK_TYPES
    : BOOK_TYPES.filter((t) => t.category === filter);

  function handleCustomSubmit() {
    if (!customTitle.trim()) return;
    onSelect({
      id: "custom",
      emoji: "✏️",
      title: customTitle.trim(),
      subtitle: customDesc.trim() || "A custom story",
      category: "story",
      claudeFormat: `Write a personalized children's story based on this concept: "${customTitle.trim()}". ${customDesc.trim()}`,
      example: "",
      pageCount: { standard: 6, premium: 10 },
    });
  }

  return (
    <div className="btp-container">
      <div className="btp-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="btp-header-text">
          <h1 className="btp-title">What are we making?</h1>
          <p className="btp-subtitle">Pick a book type to get started</p>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="btp-filters">
        {BOOK_TYPE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`btp-filter-pill${filter === cat.id ? " btp-filter-active" : ""}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Book type grid */}
      <div className="btp-grid">
        {filtered.map((type) => (
          <button
            key={type.id}
            className="btp-card"
            onClick={() => onSelect(type)}
          >
            <span className="btp-card-emoji">{type.emoji}</span>
            <h3 className="btp-card-title">{type.title}</h3>
            <p className="btp-card-subtitle">{type.subtitle}</p>
            {type.example && (
              <p className="btp-card-preview">"{type.example}"</p>
            )}
          </button>
        ))}

        {/* Custom / Other card */}
        <button
          className={`btp-card btp-card-custom${showCustom ? " btp-card-expanded" : ""}`}
          onClick={() => setShowCustom(!showCustom)}
        >
          <span className="btp-card-emoji">✏️</span>
          <h3 className="btp-card-title">Something Else</h3>
          <p className="btp-card-subtitle">Describe your own idea</p>

          {showCustom && (
            <div className="btp-card-detail" onClick={(e) => e.stopPropagation()}>
              <input
                className="btp-custom-input"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="What kind of book? e.g. 'A fairy tale about kindness'"
                autoFocus
              />
              <textarea
                className="btp-custom-textarea"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Any extra details... (optional)"
                rows={2}
              />
              <button
                className="btp-choose-btn"
                disabled={!customTitle.trim()}
                onClick={handleCustomSubmit}
              >
                Use This Idea →
              </button>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
