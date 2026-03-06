import { useState, useRef } from "react";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const PHOTO_MAX_DIM = 1024;
const PHOTO_QUALITY = 0.85;

const HERO_TYPES = [
  { id: "child", emoji: "\uD83D\uDC76", label: "Child" },
  { id: "adult", emoji: "\uD83E\uDDD1", label: "Adult" },
  { id: "pet", emoji: "\uD83D\uDC3E", label: "Pet" },
];

const RELATIONSHIP_OPTIONS = [
  { id: "partner", label: "Partner" },
  { id: "child", label: "Child" },
  { id: "sibling", label: "Sibling" },
  { id: "pet", label: "Pet" },
  { id: "friend", label: "Friend" },
  { id: "grandparent", label: "Grandparent" },
  { id: "parent", label: "Parent" },
];

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
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

export default function HeroSetup({ bookType, onComplete, onBack }) {
  const [name, setName] = useState("");
  const [heroType, setHeroType] = useState("child");
  const [age, setAge] = useState("");
  const [photo, setPhoto] = useState(null);
  const [companions, setCompanions] = useState([]);
  const [showAddChar, setShowAddChar] = useState(false);
  const [newCharName, setNewCharName] = useState("");
  const [newCharRelation, setNewCharRelation] = useState("friend");
  const [newCharPhoto, setNewCharPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const fileRef = useRef();
  const companionFileRef = useRef();

  async function handlePhotoUpload(e) {
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
      setPhoto(compressed);
    } catch {}
  }

  async function handleCompanionPhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > MAX_PHOTO_SIZE) return;
    try {
      const compressed = await compressPhoto(file);
      setNewCharPhoto(compressed);
    } catch {}
  }

  function addCompanion() {
    if (!newCharName.trim()) return;
    setCompanions([...companions, {
      name: newCharName.trim(),
      relationship: newCharRelation,
      photo: newCharPhoto,
    }]);
    setNewCharName("");
    setNewCharRelation("friend");
    setNewCharPhoto(null);
    setShowAddChar(false);
  }

  function removeCompanion(idx) {
    setCompanions(companions.filter((_, i) => i !== idx));
  }

  function handleContinue() {
    if (!name.trim()) return;
    onComplete({
      heroName: name.trim(),
      heroType,
      heroAge: age ? parseInt(age) || age : "",
      heroPhoto: photo,
      companions,
    });
  }

  return (
    <div className="create-step">
      <div className="create-step-header">
        <button className="create-back" onClick={onBack}>&larr; Back</button>
      </div>
      <div className="create-step-content create-step-content--narrow">
        <h1 className="create-step-title">Who's the star of this story?</h1>
        <p className="create-step-subtitle">Tell us about the hero</p>

        {/* Photo upload */}
        <div className="hs-photo-section">
          <button className={`hs-photo-circle${photo ? " hs-photo-circle--filled" : ""}`} onClick={() => fileRef.current?.click()}>
            {photo ? (
              <img src={photo} alt="Hero" className="hs-photo-img" />
            ) : (
              <div className="hs-photo-placeholder">
                <span className="hs-photo-icon">{"\uD83D\uDCF7"}</span>
                <span className="hs-photo-label">Add a photo</span>
              </div>
            )}
          </button>
          {photoError && <p className="hs-photo-error">{photoError}</p>}
          {!photo && <p className="hs-photo-hint">Photo helps us match their face in illustrations</p>}
          {photo && (
            <button className="hs-photo-change" onClick={() => fileRef.current?.click()}>Change photo</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handlePhotoUpload} />
        </div>

        {/* Name */}
        <div className="hs-field">
          <label className="hs-label">Their name</label>
          <input className="hs-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="What's their name?" autoFocus />
        </div>

        {/* Hero type */}
        <div className="hs-field">
          <label className="hs-label">They are a...</label>
          <div className="hs-type-row">
            {HERO_TYPES.map((t) => (
              <button key={t.id} className={`hs-type-btn${heroType === t.id ? " hs-type-btn--active" : ""}`} onClick={() => setHeroType(t.id)}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Age */}
        <div className="hs-field">
          <label className="hs-label">Age <span className="hs-optional">(optional)</span></label>
          <input className="hs-input hs-input--small" type="number" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 5" />
        </div>

        {/* Supporting characters */}
        <div className="hs-field">
          <label className="hs-label">Anyone else in the story? <span className="hs-optional">(optional)</span></label>
          {companions.length > 0 && (
            <div className="hs-companions">
              {companions.map((c, i) => (
                <div key={i} className="hs-companion-chip">
                  {c.photo && <img src={c.photo} alt={c.name} className="hs-companion-thumb" />}
                  <span>{c.name} ({c.relationship})</span>
                  <button className="hs-companion-remove" onClick={() => removeCompanion(i)}>&times;</button>
                </div>
              ))}
            </div>
          )}
          {showAddChar ? (
            <div className="hs-add-form">
              <div className="hs-add-photo-row">
                <button className="hs-add-photo-btn" type="button" onClick={() => companionFileRef.current?.click()}>
                  {newCharPhoto ? (
                    <img src={newCharPhoto} alt="" className="hs-add-photo-preview" />
                  ) : (
                    <span className="hs-add-photo-icon">{"\uD83D\uDCF7"}</span>
                  )}
                </button>
                <span className="hs-add-photo-label">{newCharPhoto ? "Change photo" : "Photo (optional)"}</span>
                <input ref={companionFileRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handleCompanionPhotoUpload} />
              </div>
              <input className="hs-input" value={newCharName} onChange={(e) => setNewCharName(e.target.value)} placeholder="Character name..." autoFocus />
              <select className="hs-select" value={newCharRelation} onChange={(e) => setNewCharRelation(e.target.value)}>
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              <div className="hs-add-actions">
                <button className="hs-add-confirm" onClick={addCompanion} disabled={!newCharName.trim()}>Add</button>
                <button className="hs-add-cancel" onClick={() => { setShowAddChar(false); setNewCharPhoto(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="hs-add-char-btn" onClick={() => setShowAddChar(true)}>+ Add a character</button>
          )}
        </div>

        {/* Continue */}
        <button className="create-continue-btn" disabled={!name.trim()} onClick={handleContinue}>
          Continue &rarr;
        </button>
      </div>
    </div>
  );
}
