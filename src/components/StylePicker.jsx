import { useState } from "react";
import { STYLES, TONES } from "../constants/data";

const STYLE_EXAMPLES = {
  storybook: "/styles/storybook.jpg",
  watercolor: "/styles/watercolor.jpg",
  pixar: "/styles/pixar.jpg",
  bold: "/styles/bold.jpg",
  cozy: "/styles/cozy.jpg",
  sketch: "/styles/sketch.jpg",
  anime: "/styles/anime.jpg",
  retro: "/styles/retro.jpg",
  collage: "/styles/collage.jpg",
};

const STYLE_EMOJIS = {
  storybook: "📚",
  watercolor: "🎨",
  pixar: "🎬",
  bold: "🌈",
  cozy: "🧸",
  sketch: "✏️",
  anime: "🌸",
  retro: "📻",
  collage: "✂️",
  minimal: "🔲",
};

const STYLE_DESCRIPTIONS = {
  storybook: "Think Beatrix Potter meets modern picture books — warm, painterly, timeless charm.",
  watercolor: "Soft washes of colour that bleed gently together, like a dreamy afternoon.",
  pixar: "Cinematic 3D characters with expressive faces, like a still from your favourite movie.",
  bold: "Punchy, modern illustrations with thick outlines and electric colours. Award-winning vibes.",
  cozy: "Pastel tones, rounded shapes, rosy cheeks. Perfect for bedtime stories.",
  sketch: "Charming hand-drawn lines with loose watercolour fills. Perfectly imperfect.",
  anime: "Large expressive eyes, soft cel-shading, and a touch of Studio Ghibli magic.",
  retro: "Mid-century nostalgia — muted palettes, print textures, and vintage charm.",
  collage: "Torn paper, fabric textures, and layered cutouts. Crafty and tactile.",
  minimal: "Clean Scandinavian simplicity — generous white space, geometric elegance.",
};

export default function StylePicker({ onSelect, onBack }) {
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedTone, setSelectedTone] = useState(null);
  const [imgErrors, setImgErrors] = useState({});

  function handleContinue() {
    if (!selectedStyle) return;
    onSelect({
      style: selectedStyle,
      tone: selectedTone,
    });
  }

  function handleImgError(styleId) {
    setImgErrors((prev) => ({ ...prev, [styleId]: true }));
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
          {STYLES.map((s) => {
            const isSelected = selectedStyle?.id === s.id;
            const exampleUrl = STYLE_EXAMPLES[s.id];
            const hasImage = exampleUrl && !imgErrors[s.id];
            return (
              <button
                key={s.id}
                className={`sp-style-card${isSelected ? " sp-style-selected" : ""}`}
                onClick={() => setSelectedStyle(s)}
              >
                {isSelected && <span className="sp-style-check">✓</span>}
                {hasImage ? (
                  <div className="style-card-preview">
                    <img
                      src={exampleUrl}
                      alt={`${s.name} example`}
                      loading="lazy"
                      onError={() => handleImgError(s.id)}
                    />
                  </div>
                ) : (
                  <div className="sp-style-preview" data-style={s.id}>
                    <span className="sp-style-emoji-icon">{STYLE_EMOJIS[s.id] || "🎨"}</span>
                  </div>
                )}
                <div className="sp-style-info">
                  <span className="sp-style-name">{s.name}</span>
                  <span className="sp-style-tagline">{s.tagline}</span>
                </div>
                <p className="sp-style-desc">{STYLE_DESCRIPTIONS[s.id]}</p>
              </button>
            );
          })}
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
