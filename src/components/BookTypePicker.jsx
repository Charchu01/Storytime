import { useState } from "react";
import { BOOK_TYPES, BOOK_TYPE_CATEGORIES } from "../constants/data";

export default function BookTypePicker({ onSelect, onBack }) {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const filtered = filter === "all"
    ? BOOK_TYPES
    : BOOK_TYPES.filter((t) => t.category === filter);

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
        {filtered.map((type) => {
          const isExpanded = expanded === type.id;
          return (
            <button
              key={type.id}
              className={`btp-card${isExpanded ? " btp-card-expanded" : ""}`}
              onClick={() => setExpanded(isExpanded ? null : type.id)}
            >
              <span className="btp-card-emoji">{type.emoji}</span>
              <h3 className="btp-card-title">{type.title}</h3>
              <p className="btp-card-subtitle">{type.subtitle}</p>

              {isExpanded && (
                <div className="btp-card-detail">
                  <div className="btp-card-example">
                    <span className="btp-example-label">Example:</span>
                    <em>"{type.example}"</em>
                  </div>
                  <button
                    className="btp-choose-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(type);
                    }}
                  >
                    Choose This →
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
