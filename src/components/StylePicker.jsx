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
        <p className="create-step-subtitle">Pick an art style for your illustrations</p>

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
                  <span className="sp-card-tagline">{STYLE_DESCRIPTIONS[s.id]}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tones */}
        <div className="sp-tone-section">
          <h2 className="sp-tone-title">Set the mood <span className="hs-optional">(optional)</span></h2>
          <div className="sp-tone-row">
            {TONES.map((t) => (
              <button key={t.id} className={`sp-tone-chip${selectedTone?.id === t.id ? " sp-tone-chip--active" : ""}`} onClick={() => setSelectedTone(selectedTone?.id === t.id ? null : t)}>
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selection summary + continue */}
        {selectedStyle && (
          <div className="sp-footer">
            <p className="sp-selection-summary">
              {selectedStyle.name}{selectedTone ? ` \u00B7 ${selectedTone.label}` : ""}
            </p>
            <button className="create-continue-btn" onClick={handleContinue}>
              Continue &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
