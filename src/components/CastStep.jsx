import { useState } from "react";
import { ROLES } from "../constants/data";
import CharModal from "./CharModal";

export default function CastStep({ onNext, onBack, initialCast }) {
  const [cast, setCast] = useState(initialCast || []);
  const [modal, setModal] = useState(null);

  function saveCharacter(character) {
    setCast((prev) => {
      const exists = prev.find((c) => c.id === character.id);
      return exists ? prev.map((c) => (c.id === character.id ? character : c)) : [...prev, character];
    });
    setModal(null);
  }

  function removeCharacter(id) {
    setCast((prev) => prev.filter((c) => c.id !== id));
  }

  function toggleHero(id) {
    setCast((prev) =>
      prev.map((c) => ({ ...c, isHero: c.id === id ? !c.isHero : false }))
    );
  }

  return (
    <div className="shell">
      {modal && (
        <CharModal
          preset={modal._new ? modal.role : undefined}
          existing={!modal._new ? modal : undefined}
          onSave={saveCharacter}
          onClose={() => setModal(null)}
        />
      )}

      <div className="topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="prog-wrap">
          <div className="prog">
            <div className="prog-fill" style={{ width: "25%" }} />
          </div>
          <div className="prog-lbl">Step 1 of 4 · Build your cast</div>
        </div>
      </div>

      <div className="content">
        <div className="eyebrow">Cast Builder</div>
        <h2 className="sec-h">Who's in this story?</h2>
        <p className="sec-p">
          Add everyone who should appear — then tap a character to make them the ⭐ hero.
        </p>

        <div className="stage">
          <div className="stage-lbl">Your story cast</div>
          {cast.length === 0 ? (
            <div className="stage-empty">
              <div style={{ fontSize: 40 }}>🎭</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 700, color: "var(--mid)" }}>
                Your cast will appear here
              </div>
            </div>
          ) : (
            <div className="stage-cast">
              {cast.map((character, index) => (
                <div
                  key={character.id}
                  className="cchar"
                  style={{ animationDelay: `${index * 0.07}s` }}
                  onClick={() => toggleHero(character.id)}
                >
                  <button
                    className="cchar-rm"
                    onClick={(e) => { e.stopPropagation(); removeCharacter(character.id); }}
                  >
                    ✕
                  </button>
                  <div className="cchar-av">
                    {character.isHero && <div className="hero-ring" />}
                    {character.photo ? <img src={character.photo} alt={character.name} /> : character.emoji}
                    {character.isHero && <div className="hero-star">⭐</div>}
                    {character.photos?.length > 1 && (
                      <div className="cchar-photo-count">{character.photos.length}</div>
                    )}
                  </div>
                  <div className="cchar-name">{character.name}</div>
                  <div className="cchar-role">
                    {ROLES.find((r) => r.id === character.role)?.label}
                    {character.age ? `, ${character.age}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cast.length > 0 && (
          <div className="hero-tip">
            💡 Tap any character to crown them the <strong>⭐ hero</strong>. Tap again to remove.
          </div>
        )}

        <div className="add-grid">
          {ROLES.map((role) => (
            <button
              key={role.id}
              className="add-btn"
              onClick={() => setModal({ _new: true, role: role.id })}
            >
              <span className="ab-em">{role.emoji}</span>
              <span className="ab-lbl">Add {role.label}</span>
            </button>
          ))}
        </div>

        <button
          className="big-btn"
          disabled={cast.length === 0}
          onClick={() => onNext(cast)}
        >
          {cast.length === 0
            ? "Add at least one character"
            : `Continue with ${cast.length} character${cast.length !== 1 ? "s" : ""} →`}
        </button>
      </div>
    </div>
  );
}
