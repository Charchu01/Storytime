import { useState } from "react";
import { STYLES } from "../constants/data";

export default function StyleStep({ onNext, onBack }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="shell">
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="prog-wrap">
          <div className="prog">
            <div className="prog-fill" style={{ width: "50%" }} />
          </div>
          <div className="prog-lbl">Step 2 of 4 · Art style</div>
        </div>
      </div>

      <div className="content">
        <div className="eyebrow">Illustration Style</div>
        <h2 className="sec-h">How should it look?</h2>
        <p className="sec-p">
          Every page will be illustrated in this style with real AI-generated art.
          Take your time — this is the vibe of the whole book.
        </p>

        <div className="style-grid">
          {STYLES.map((style, index) => (
            <div
              key={style.id}
              className={`style-card${selected === style.id ? " on" : ""}`}
              style={{ animationDelay: `${index * 0.06}s`, animation: "msgIn .4s ease both" }}
              onClick={() => setSelected(style.id)}
            >
              <div className="sc-check">✓</div>
              <div className={`sc-prev ${style.className}`}>
                <span className="sc-em">{style.emoji}</span>
              </div>
              <div className="sc-info">
                <div className="sc-name">{style.name}</div>
                <div className="sc-tag">{style.tagline}</div>
                <div className="sc-mood">{style.mood}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          className="big-btn"
          disabled={!selected}
          onClick={() => onNext(STYLES.find((s) => s.id === selected)?.name || selected)}
        >
          {selected
            ? `Continue with ${STYLES.find((s) => s.id === selected)?.name} →`
            : "Choose a style to continue"}
        </button>
      </div>
    </div>
  );
}
