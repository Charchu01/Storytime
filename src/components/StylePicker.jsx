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
  storybook: "\uD83D\uDCDA",
  watercolor: "\uD83C\uDFA8",
  pixar: "\uD83C\uDFAC",
  bold: "\uD83C\uDF08",
  cozy: "\uD83E\uDDF8",
  sketch: "\u270F\uFE0F",
  anime: "\uD83C\uDF38",
  retro: "\uD83D\uDCFB",
  collage: "\u2702\uFE0F",
  minimal: "\uD83D\uDD32",
};

const STYLE_DESCRIPTIONS = {
  storybook: "Warm and painterly, timeless charm",
  watercolor: "Soft dreamy washes of colour",
  pixar: "Cinematic 3D, like a Pixar movie",
  bold: "Thick outlines, electric colours",
  cozy: "Pastel tones, cozy bedtime warmth",
  sketch: "Hand-drawn lines, watercolour fills",
  anime: "Expressive eyes, Ghibli-inspired",
  retro: "Vintage 1960s nostalgia",
  collage: "Torn paper textures, handcrafted",
  minimal: "Scandinavian simplicity, clean lines",
};

export default function StylePicker({ onSelect, onBack }) {
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedTone, setSelectedTone] = useState(null);
  const [imgErrors, setImgErrors] = useState({});

  function handleContinue() {
    if (!selectedStyle) return;
    onSelect({ style: selectedStyle, tone: selectedTone });
  }

  function handleImgError(styleId) {
    setImgErrors((prev) => ({ ...prev, [styleId]: true }));
  }

  return (
    <div className="create-step">
      <div className="create-step-header">
        <button className="create-back" onClick={onBack}>&larr; Back</button>
      </div>
      <div className="create-step-content">
        <h1 className="create-step-title">Choose the look</h1>
        <p className="create-step-subtitle">Each style creates a completely different world</p>

        <div className="sp-grid">
          {STYLES.map((s) => {
            const isSelected = selectedStyle?.id === s.id;
            const exampleUrl = STYLE_EXAMPLES[s.id];
            const hasImage = exampleUrl && !imgErrors[s.id];
            return (
              <button key={s.id} className={`sp-card${isSelected ? " sp-card--selected" : ""}`} onClick={() => setSelectedStyle(s)}>
                {isSelected && <span className="sp-card-check">{"\u2713"}</span>}
                <div className="sp-card-preview">
                  {hasImage ? (
                    <img src={exampleUrl} alt={`${s.name} example`} loading="lazy" onError={() => handleImgError(s.id)} />
                  ) : (
                    <span className="sp-card-emoji-icon">{STYLE_EMOJIS[s.id] || "\uD83C\uDFA8"}</span>
                  )}
                </div>
                <div className="sp-card-info">
                  <span className="sp-card-name">{s.name}</span>
                  <span className="sp-card-desc">{STYLE_DESCRIPTIONS[s.id]}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tone section — only visible after selecting a style */}
        {selectedStyle && (
          <div className="sp-tone-section">
            <h2 className="sp-tone-title">Set the mood <span className="sp-tone-optional">(optional)</span></h2>
            <p className="sp-tone-subtitle">Adjusts the lighting and atmosphere</p>
            <div className="sp-tone-row">
              {TONES.map((t) => (
                <button key={t.id} className={`sp-tone-chip${selectedTone?.id === t.id ? " sp-tone-chip--active" : ""}`} onClick={() => setSelectedTone(selectedTone?.id === t.id ? null : t)}>
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer — only visible after selecting a style */}
      {selectedStyle && (
        <div className="sp-footer">
          <div className="sp-footer-inner">
            <p className="sp-selection-summary">
              {selectedStyle.name}{selectedTone ? ` \u00B7 ${selectedTone.label}` : ""}
            </p>
            <button className="create-continue-btn" onClick={handleContinue}>
              Continue &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
