import { useState, useRef, useEffect } from "react";
import { ROLES } from "../constants/data";
import { analyzePhotoQuality } from "../api/client";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB raw input
const PHOTO_MAX_DIM = 1024;
const PHOTO_QUALITY = 0.85;
const MAX_PHOTOS = 3;

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

export default function CharModal({ preset, existing, onSave, onClose }) {
  const [role, setRole] = useState(existing?.role || preset || "child");
  const [name, setName] = useState(existing?.name || "");
  const [age, setAge] = useState(existing?.age || "");
  const [photos, setPhotos] = useState(() => {
    if (existing?.photos?.length) return existing.photos;
    if (existing?.photo) return [{ dataUri: existing.photo, quality: "good", feedback: "" }];
    return [];
  });
  const [primaryIndex, setPrimaryIndex] = useState(existing?.primaryPhotoIndex || 0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const nameRef = useRef();

  const currentRole = ROLES.find((r) => r.id === role);

  // Auto-focus name input when modal opens (if no existing name)
  useEffect(() => {
    if (!existing && nameRef.current) {
      setTimeout(() => nameRef.current.focus(), 350);
    }
  }, [existing]);

  async function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) { setError("Photo must be under 10 MB"); return; }
    if (photos.length >= MAX_PHOTOS) { setError(`Max ${MAX_PHOTOS} photos — remove one first`); return; }
    setError(null);
    try {
      const compressed = await compressPhoto(file);
      const newIndex = photos.length;
      setPhotos((prev) => [...prev, { dataUri: compressed, quality: null, feedback: "", analyzing: true }]);
      try {
        const result = await analyzePhotoQuality(compressed);
        setPhotos((prev) => prev.map((p, i) => i === newIndex ? { ...p, quality: result.quality, feedback: result.feedback, analyzing: false } : p));
        if (result.quality === "good") {
          setPhotos((cur) => {
            if (!cur[primaryIndex] || cur[primaryIndex].quality !== "good") setPrimaryIndex(newIndex);
            return cur;
          });
        }
      } catch {
        setPhotos((prev) => prev.map((p, i) => i === newIndex ? { ...p, quality: "fair", feedback: "", analyzing: false } : p));
      }
    } catch {
      setError("Failed to process photo");
    }
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (primaryIndex === index) setPrimaryIndex(0);
    else if (primaryIndex > index) setPrimaryIndex((p) => p - 1);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  function handleSave() {
    const trimmedName = name.trim().slice(0, 30);
    if (!trimmedName) return;
    const primary = photos[primaryIndex];
    if (primary?.quality === "poor" && photos.some((p, i) => i !== primaryIndex && p.quality !== "poor")) {
      const betterIdx = photos.findIndex((p) => p.quality === "good") ?? photos.findIndex((p) => p.quality === "fair");
      if (betterIdx >= 0) setPrimaryIndex(betterIdx);
    }
    const adjustedPrimary = primaryIndex < photos.length ? primaryIndex : 0;
    onSave({
      id: existing?.id || Date.now(),
      role,
      name: trimmedName,
      age,
      photos,
      primaryPhotoIndex: adjustedPrimary,
      photo: photos[adjustedPrimary]?.dataUri || null,
      emoji: currentRole.emoji,
    });
  }

  const hasPhotos = photos.length > 0;
  const heroPhoto = photos[primaryIndex] || photos[0];

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal cm-modal">
        <div className="modal-handle" />
        <button className="modal-x" onClick={onClose}>✕</button>

        {/* ── Hero photo area ─────────────────────────────── */}
        <div
          className={`cm-hero${dragOver ? " cm-hero-drag" : ""}${hasPhotos ? " cm-hero-has" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !hasPhotos && fileRef.current.click()}
        >
          {hasPhotos ? (
            <div className="cm-hero-photo">
              <img src={heroPhoto?.dataUri} alt="Character" />
              <div className="cm-hero-overlay">
                <div className="cm-thumbs">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className={`cm-thumb${i === primaryIndex ? " cm-thumb-active" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setPrimaryIndex(i); }}
                    >
                      <img src={p.dataUri} alt="" />
                      {p.analyzing && <div className="cm-thumb-spin" />}
                      {!p.analyzing && p.quality === "poor" && <div className="cm-thumb-warn">!</div>}
                      <button className="cm-thumb-rm" onClick={(e) => { e.stopPropagation(); removePhoto(i); }}>✕</button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button className="cm-thumb cm-thumb-add" onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}>
                      +
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="cm-hero-empty">
              <div className="cm-hero-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <div className="cm-hero-label">Add a photo</div>
              <div className="cm-hero-sub">Tap or drag a photo for custom illustrations</div>
            </div>
          )}
        </div>

        {/* ── Photo quality warning ───────────────────────── */}
        {photos.some((p) => p.quality === "poor") && (
          <div className="cm-warn">
            {photos.filter((p) => p.quality === "poor").map((p, i) => (
              <span key={i}>{p.feedback}</span>
            ))}
          </div>
        )}

        {/* ── Role chips (horizontal scroll) ─────────────── */}
        <div className="cm-roles">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`cm-role${role === r.id ? " cm-role-on" : ""}`}
              onClick={() => setRole(r.id)}
            >
              <span className="cm-role-em">{r.emoji}</span>
              <span className="cm-role-lb">{r.label}</span>
            </button>
          ))}
        </div>

        {/* ── Name & Age ─────────────────────────────────── */}
        <div className="cm-fields">
          <div className="cm-field-main">
            <input
              ref={nameRef}
              className="cm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder={role === "pet" ? "Name (e.g. Buddy)" : "Name (e.g. Emma)"}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSave()}
            />
          </div>
          {["child", "baby"].includes(role) && (
            <div className="cm-field-age">
              <input
                className="cm-age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                type="number"
                min="0"
                max="17"
                placeholder="Age"
                onKeyDown={(e) => e.key === "Enter" && name.trim() && handleSave()}
              />
            </div>
          )}
        </div>

        {error && <div className="cm-error">{error}</div>}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          style={{ display: "none" }}
          onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
        />

        {/* ── Save button ────────────────────────────────── */}
        <button className="cm-save" disabled={!name.trim()} onClick={handleSave}>
          {existing ? "Save changes" : `Add ${name.trim() || currentRole.label}`}
        </button>
      </div>
    </div>
  );
}
