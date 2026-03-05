import { useState } from "react";
import { STYLES, TONES } from "../constants/data";

export default function StylePicker({ onSelect, onBack }) {
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedTone, setSelectedTone] = useState(null);

  function handleContinue() {
    if (!selectedStyle) return;
    onSelect({
      style: selectedStyle,
      tone: selectedTone,
    });
  }

  return (
    <div className="sp-container">
      <div className="sp-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="sp-header-text">
          <h1 className="sp-title">Choose the look</h1>
          <p className="sp-subtitle">Pick an art style and mood for your book</p>
        </div>
      </div>

      {/* Art Styles */}
      <div className="sp-section">
        <h2 className="sp-section-title">Art Style</h2>
        <div className="sp-style-grid">
          {STYLES.map((s) => (
            <button
              key={s.id}
              className={`sp-style-card${selectedStyle?.id === s.id ? " sp-style-selected" : ""}`}
              onClick={() => setSelectedStyle(s)}
            >
              <div className="sp-style-preview" data-style={s.id}>
                <span className="sp-style-initial">{s.name.charAt(0)}</span>
              </div>
              <div className="sp-style-info">
                <span className="sp-style-name">{s.name}</span>
                <span className="sp-style-tagline">{s.tagline}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tones */}
      <div className="sp-section">
        <h2 className="sp-section-title">Mood & Tone <span className="hs-optional">(optional)</span></h2>
        <div className="sp-tone-grid">
          {TONES.map((t) => (
            <button
              key={t.id}
              className={`sp-tone-chip${selectedTone?.id === t.id ? " sp-tone-selected" : ""}`}
              onClick={() => setSelectedTone(selectedTone?.id === t.id ? null : t)}
            >
              <span className="sp-tone-emoji">{t.emoji}</span>
              <span className="sp-tone-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected summary + continue */}
      {selectedStyle && (
        <div className="sp-footer">
          <div className="sp-selection-summary">
            <span className="sp-sel-style">{selectedStyle.name}</span>
            {selectedTone && <span className="sp-sel-tone"> · {selectedTone.label}</span>}
          </div>
          <button className="big-btn sp-continue" onClick={handleContinue}>
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
