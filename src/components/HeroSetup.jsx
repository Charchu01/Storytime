import { useState, useRef, useEffect } from "react";
import { analyzePhotoQuality } from "../api/client";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const PHOTO_MAX_DIM = 1024;
const PHOTO_QUALITY = 0.85;
const MAX_CHARACTERS = 5;

const CHARACTER_TYPES = [
  { id: "child", emoji: "\uD83D\uDC76", label: "Child" },
  { id: "teen", emoji: "\uD83E\uDDD2", label: "Teen" },
  { id: "adult", emoji: "\uD83E\uDDD1", label: "Adult" },
  { id: "baby", emoji: "\uD83D\uDC76", label: "Baby" },
  { id: "pet", emoji: "\uD83D\uDC3E", label: "Pet" },
  { id: "stuffed_animal", emoji: "\uD83E\uDDF8", label: "Stuffed Animal" },
  { id: "imaginary_friend", emoji: "\uD83E\uDDDA", label: "Imaginary Friend" },
  { id: "magical_creature", emoji: "\uD83E\uDD84", label: "Magical Creature" },
];

const RELATIONSHIP_OPTIONS = [
  { id: "sibling", emoji: "\uD83D\uDC6B", label: "Sibling" },
  { id: "mom", emoji: "\uD83D\uDC69", label: "Mom" },
  { id: "dad", emoji: "\uD83D\uDC68", label: "Dad" },
  { id: "grandma", emoji: "\uD83D\uDC75", label: "Grandma" },
  { id: "grandpa", emoji: "\uD83D\uDC74", label: "Grandpa" },
  { id: "pet", emoji: "\uD83D\uDC3E", label: "Pet" },
  { id: "friend", emoji: "\uD83E\uDD1D", label: "Friend" },
  { id: "partner", emoji: "\uD83D\uDC91", label: "Partner" },
  { id: "other", emoji: "\u2728", label: "Other" },
];

const SHOW_AGE_TYPES = new Set(["child", "teen", "baby", "adult"]);

const TYPE_EMOJI_MAP = {
  child: "\uD83D\uDC76",
  teen: "\uD83E\uDDD2",
  adult: "\uD83E\uDDD1",
  baby: "\uD83D\uDC76",
  pet: "\uD83D\uDC3E",
  stuffed_animal: "\uD83E\uDDF8",
  imaginary_friend: "\uD83E\uDDDA",
  magical_creature: "\uD83E\uDD84",
};

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > PHOTO_MAX_DIM || height > PHOTO_MAX_DIM) {
        const scale = PHOTO_MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

export default function HeroSetup({ onComplete, onBack }) {
  const [characters, setCharacters] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null); // number index or 'new'
  const [newCharacterDraft, setNewCharacterDraft] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const fileRef = useRef();
  const editorRef = useRef();
  const lineupRef = useRef();

  // Scroll editor into view when it opens
  useEffect(() => {
    if (editingIndex !== null && editorRef.current) {
      setTimeout(() => {
        editorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [editingIndex]);

  function makeEmptyCharacter() {
    return {
      name: "",
      characterType: "child",
      age: "",
      photo: null,
      photoQuality: null,
      photoFeedback: "",
      relationship: null,
    };
  }

  function updateCharacter(index, updates) {
    if (index === "new") {
      setNewCharacterDraft(prev => prev ? { ...prev, ...updates } : null);
    } else {
      setCharacters(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
    }
  }

  function getEditingCharacter() {
    if (editingIndex === "new") return newCharacterDraft;
    if (typeof editingIndex === "number") return characters[editingIndex];
    return null;
  }

  function handleAddSlotClick() {
    setEditingIndex("new");
    setNewCharacterDraft(makeEmptyCharacter());
    setPhotoError(null);
  }

  function handleCardClick(index) {
    if (editingIndex === index) {
      setEditingIndex(null);
    } else {
      setEditingIndex(index);
      setPhotoError(null);
    }
  }

  function handleAddToCast() {
    if (!newCharacterDraft?.name.trim()) return;
    setCharacters(prev => [...prev, { ...newCharacterDraft, name: newCharacterDraft.name.trim() }]);
    setEditingIndex(null);
    setNewCharacterDraft(null);
  }

  function handleSaveChanges() {
    if (typeof editingIndex !== "number") return;
    const char = characters[editingIndex];
    if (!char?.name.trim()) return;
    setEditingIndex(null);
  }

  function handleRemoveFromCast() {
    if (typeof editingIndex !== "number") return;
    setCharacters(prev => prev.filter((_, i) => i !== editingIndex));
    setEditingIndex(null);
  }

  function handleCloseEditor() {
    if (editingIndex === "new") {
      setNewCharacterDraft(null);
    }
    setEditingIndex(null);
    setPhotoError(null);
  }

  async function handlePhotoUpload(characterIndex, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError("Photo too large! Please use a photo under 10MB.");
      return;
    }
    setPhotoError(null);
    try {
      const compressed = await compressPhoto(file);
      updateCharacter(characterIndex, { photo: compressed, photoQuality: "analyzing", photoFeedback: "" });

      try {
        const result = await analyzePhotoQuality(compressed);
        updateCharacter(characterIndex, {
          photoQuality: result.quality,
          photoFeedback: result.feedback,
        });
      } catch {
        updateCharacter(characterIndex, {
          photoQuality: "unknown",
          photoFeedback: "",
        });
      }
    } catch {
      setPhotoError("Failed to process photo. Please try another.");
    }
  }

  function handleContinue() {
    if (characters.length === 0) return;

    const mainChar = characters[0];
    const companions = characters.slice(1).map(c => ({
      name: c.name,
      relationship: c.relationship || "friend",
      photo: c.photo,
      characterType: c.characterType,
      age: c.age,
    }));

    onComplete({
      heroName: mainChar.name,
      heroType: mainChar.characterType === "stuffed_animal" ? "pet"
        : mainChar.characterType === "imaginary_friend" ? "child"
        : mainChar.characterType === "magical_creature" ? "child"
        : mainChar.characterType === "teen" ? "child"
        : mainChar.characterType === "baby" ? "child"
        : mainChar.characterType,
      heroAge: mainChar.age ? parseInt(mainChar.age) || mainChar.age : "",
      heroPhoto: mainChar.photo,
      companions,
    });
  }

  const currentChar = getEditingCharacter();
  const isEditorOpen = editingIndex !== null && currentChar;
  const isNewCharacter = editingIndex === "new";
  const canContinue = characters.length > 0 && characters[0].name.trim();
  const showAddSlot = characters.length < MAX_CHARACTERS;
  const isEmpty = characters.length === 0 && editingIndex === null;

  return (
    <div className="create-step">
      <div className="create-step-header">
        <button className="create-back" onClick={onBack}>&larr; Back</button>
      </div>
      <div className="create-step-content create-step-content--narrow">

        {/* Section 1: Title */}
        <h1 className="cast-title">Build your cast</h1>
        <p className="cast-subtitle">Who&rsquo;s starring in this story? Add everyone who appears.</p>

        {/* Section 2: Cast Lineup */}
        <div className={`cast-lineup${isEmpty ? " cast-lineup--empty" : ""}`} ref={lineupRef}>
          {characters.map((char, i) => (
            <div
              key={i}
              className={`cast-card${editingIndex === i ? " cast-card--selected" : ""}${i === characters.length - 1 && editingIndex !== i ? " cast-card--new-entry" : ""}`}
              onClick={() => handleCardClick(i)}
            >
              <div className={`cast-photo ${char.photo ? `cast-photo--quality-${char.photoQuality || "unknown"}` : ""}`}>
                {char.photo ? (
                  <img src={char.photo} alt={char.name} className="cast-photo-img" />
                ) : (
                  <span className="cast-photo-emoji">{TYPE_EMOJI_MAP[char.characterType] || "\uD83D\uDC76"}</span>
                )}
                {i === 0 && <span className="cast-star-badge">{"\u2B50"}</span>}
              </div>
              <span className="cast-card-name">{char.name || "Unnamed"}</span>
              <span className="cast-card-role">
                {i === 0 ? "Main character" : char.relationship || CHARACTER_TYPES.find(t => t.id === char.characterType)?.label || ""}
              </span>
            </div>
          ))}

          {showAddSlot && (
            <div
              className={`cast-add-slot${isEmpty ? " cast-add-slot--large" : ""}${editingIndex === "new" ? " cast-add-slot--active" : ""}`}
              onClick={handleAddSlotClick}
            >
              <div className={`cast-add-circle${isEmpty ? " cast-add-circle--large" : ""}`}>
                <span className="cast-add-icon">+</span>
              </div>
              <span className="cast-add-label">
                {isEmpty ? "Add your first character" : "Add character"}
              </span>
            </div>
          )}

          {characters.length >= MAX_CHARACTERS && (
            <p className="cast-max-note">Maximum {MAX_CHARACTERS} characters</p>
          )}
        </div>

        {/* Section 3: Character Editor */}
        {isEditorOpen && (
          <div className="cast-editor" ref={editorRef}>
            <button className="cast-editor-close" onClick={handleCloseEditor}>&times;</button>

            {/* Main character label */}
            {((isNewCharacter && characters.length === 0) || editingIndex === 0) && (
              <div className="cast-editor-main-label">{"\u2B50"} Main Character</div>
            )}

            {/* Photo upload */}
            <div className="cast-editor-photo-section">
              <button
                className={`cast-editor-photo${currentChar.photo ? ` cast-editor-photo--quality-${currentChar.photoQuality || "unknown"}` : ""}`}
                onClick={() => fileRef.current?.click()}
              >
                {currentChar.photo ? (
                  <img src={currentChar.photo} alt="" className="cast-editor-photo-img" />
                ) : (
                  <div className="cast-editor-photo-empty">
                    <span className="cast-editor-photo-cam">{"\uD83D\uDCF7"}</span>
                    <span className="cast-editor-photo-text">Upload a photo</span>
                    <span className="cast-editor-photo-opt">(optional)</span>
                  </div>
                )}
              </button>
              {currentChar.photo && (
                <button className="cast-editor-change-photo" onClick={() => fileRef.current?.click()}>Change photo</button>
              )}
              {photoError && <p className="cast-editor-photo-error">{photoError}</p>}

              {/* Quality feedback */}
              {currentChar.photoQuality === "analyzing" && (
                <p className="cast-quality cast-quality--analyzing">Checking photo...</p>
              )}
              {currentChar.photoQuality === "good" && (
                <p className="cast-quality cast-quality--good">{"\u2713"} Great photo! Clear face detected.</p>
              )}
              {currentChar.photoQuality === "fair" && (
                <p className="cast-quality cast-quality--fair">{"\u26A0"} Face is partially hidden — a front-facing photo works best.</p>
              )}
              {currentChar.photoQuality === "poor" && (
                <p className="cast-quality cast-quality--poor">{"\u2717"} We can&rsquo;t detect a face. Try a clearer, front-facing photo.</p>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: "none" }}
                onChange={(e) => handlePhotoUpload(editingIndex, e)}
              />
            </div>

            {/* Name */}
            <div className="cast-field">
              <label className="cast-label">NAME</label>
              <input
                className="cast-input"
                value={currentChar.name}
                onChange={(e) => updateCharacter(editingIndex, { name: e.target.value })}
                placeholder="What's their name?"
                autoFocus
              />
            </div>

            {/* Character type */}
            <div className="cast-field">
              <label className="cast-label">WHO ARE THEY?</label>
              <div className="cast-pills">
                {CHARACTER_TYPES.map(t => (
                  <button
                    key={t.id}
                    className={`cast-pill${currentChar.characterType === t.id ? " cast-pill--active" : ""}`}
                    onClick={() => updateCharacter(editingIndex, { characterType: t.id })}
                    type="button"
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Relationship (only for non-first characters) */}
            {((isNewCharacter && characters.length > 0) || (typeof editingIndex === "number" && editingIndex > 0)) && (
              <div className="cast-field">
                <label className="cast-label">RELATIONSHIP TO {characters[0]?.name || "main character"}</label>
                <div className="cast-pills">
                  {RELATIONSHIP_OPTIONS.map(r => (
                    <button
                      key={r.id}
                      className={`cast-pill${currentChar.relationship === r.id ? " cast-pill--active" : ""}`}
                      onClick={() => updateCharacter(editingIndex, { relationship: r.id })}
                      type="button"
                    >
                      {r.emoji} {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Age (only for applicable types) */}
            {SHOW_AGE_TYPES.has(currentChar.characterType) && (
              <div className="cast-field">
                <label className="cast-label">AGE <span className="cast-optional">(optional)</span></label>
                <input
                  className="cast-input cast-input--small"
                  type="number"
                  min="0"
                  max="120"
                  value={currentChar.age}
                  onChange={(e) => updateCharacter(editingIndex, { age: e.target.value })}
                  placeholder="e.g. 5"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="cast-editor-actions">
              {isNewCharacter ? (
                <>
                  <button
                    className="cast-btn-primary"
                    onClick={handleAddToCast}
                    disabled={!currentChar.name.trim()}
                  >
                    Add to Cast &rarr;
                  </button>
                  <button className="cast-btn-cancel" onClick={handleCloseEditor}>Cancel</button>
                </>
              ) : (
                <>
                  <button
                    className="cast-btn-primary"
                    onClick={handleSaveChanges}
                    disabled={!currentChar.name.trim()}
                  >
                    Save Changes
                  </button>
                  <button className="cast-btn-remove" onClick={handleRemoveFromCast}>Remove from Cast</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Section 4: Continue */}
        <button className="cast-continue" disabled={!canContinue} onClick={handleContinue}>
          Continue &rarr;
        </button>
      </div>
    </div>
  );
}
