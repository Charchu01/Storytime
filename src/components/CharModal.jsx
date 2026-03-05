import { useState, useRef } from "react";
import { ROLES } from "../constants/data";
import { analyzePhotoQuality } from "../api/client";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB raw input
const PHOTO_MAX_DIM = 1024; // Resize to max 1024px on longest side
const PHOTO_QUALITY = 0.85; // JPEG quality
const MAX_PHOTOS = 3;

// Resize and compress photo to keep data URLs manageable for API calls
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
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

const QUALITY_ICONS = { good: "✅", fair: "⚠️", poor: "❌" };
const QUALITY_COLORS = { good: "#16a34a", fair: "#d97706", poor: "#dc2626" };

export default function CharModal({ preset, existing, onSave, onClose }) {
  const [role, setRole] = useState(existing?.role || preset || "child");
  const [name, setName] = useState(existing?.name || "");
  const [age, setAge] = useState(existing?.age || "");
  // Photos array: [{ dataUri, quality, feedback, analyzing }]
  const [photos, setPhotos] = useState(() => {
    if (existing?.photos?.length) return existing.photos;
    if (existing?.photo) return [{ dataUri: existing.photo, quality: "good", feedback: "" }];
    return [];
  });
  const [primaryIndex, setPrimaryIndex] = useState(existing?.primaryPhotoIndex || 0);
  const [error, setError] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const fileRef = useRef();

  const currentRole = ROLES.find((r) => r.id === role);

  async function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) {
      setError("Photo must be under 10MB");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos — remove one first`);
      return;
    }
    setError(null);
    try {
      const compressed = await compressPhoto(file);
      const newIndex = photos.length;

      // Add photo with "analyzing" state
      setPhotos((prev) => [...prev, { dataUri: compressed, quality: null, feedback: "", analyzing: true }]);

      // Show tips on first photo upload
      if (photos.length === 0 && !localStorage.getItem("sk_photo_tips_seen")) {
        setShowTips(true);
        localStorage.setItem("sk_photo_tips_seen", "1");
        setTimeout(() => setShowTips(false), 5000);
      }

      // Run quality analysis in background
      try {
        const result = await analyzePhotoQuality(compressed);
        setPhotos((prev) =>
          prev.map((p, i) =>
            i === newIndex ? { ...p, quality: result.quality, feedback: result.feedback, analyzing: false } : p
          )
        );
        // If this is the first "good" photo and current primary isn't good, auto-select it
        if (result.quality === "good") {
          setPhotos((current) => {
            const currentPrimary = current[primaryIndex];
            if (!currentPrimary || currentPrimary.quality !== "good") {
              setPrimaryIndex(newIndex);
            }
            return current;
          });
        }
      } catch {
        // Quality check failed — still keep the photo, just mark as fair
        setPhotos((prev) =>
          prev.map((p, i) =>
            i === newIndex ? { ...p, quality: "fair", feedback: "Couldn't analyze — we'll do our best!", analyzing: false } : p
          )
        );
      }
    } catch {
      setError("Failed to process photo");
    }
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    // Adjust primary index
    if (primaryIndex === index) {
      setPrimaryIndex(0);
    } else if (primaryIndex > index) {
      setPrimaryIndex((prev) => prev - 1);
    }
  }

  function handleSave() {
    const trimmedName = name.trim().slice(0, 30);
    if (!trimmedName) return;

    // Warn if primary photo is poor quality
    const primary = photos[primaryIndex];
    if (primary?.quality === "poor" && photos.some((p, i) => i !== primaryIndex && p.quality !== "poor")) {
      // Auto-switch to best available
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
      // Backward compat: photo = primary photo's dataUri
      photo: photos[adjustedPrimary]?.dataUri || null,
      emoji: currentRole.emoji,
    });
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <button className="modal-x" onClick={onClose}>✕</button>

        <div className="m-h">{existing ? "Edit character" : "Add a character"}</div>
        <div className="m-s">Add up to {MAX_PHOTOS} photos for the best illustrations</div>

        <div className="rtabs">
          {ROLES.map((r) => (
            <button
              key={r.id}
              className={`rtab${role === r.id ? " on" : ""}`}
              onClick={() => setRole(r.id)}
            >
              <span className="rt-em">{r.emoji}</span>
              <span className="rt-lb">{r.label}</span>
            </button>
          ))}
        </div>

        {/* Photo grid */}
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div
              key={i}
              className={`photo-slot photo-slot-filled${i === primaryIndex ? " photo-primary" : ""}`}
              onClick={() => setPrimaryIndex(i)}
            >
              <img src={p.dataUri} alt={`Photo ${i + 1}`} />
              <button className="photo-rm" onClick={(e) => { e.stopPropagation(); removePhoto(i); }}>✕</button>
              {i === primaryIndex && <div className="photo-star-badge">★</div>}
              {p.analyzing ? (
                <div className="photo-quality-badge photo-q-analyzing">
                  <span className="photo-q-spinner" />
                </div>
              ) : p.quality && (
                <div className="photo-quality-badge" style={{ color: QUALITY_COLORS[p.quality] }}>
                  {QUALITY_ICONS[p.quality]}
                </div>
              )}
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <div
              className="photo-slot photo-slot-empty"
              onClick={() => fileRef.current.click()}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>
                {photos.length === 0 ? currentRole?.emoji : "＋"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 11 }}>
                {photos.length === 0 ? "Add photo" : "Add more"}
              </div>
            </div>
          )}
        </div>

        {/* Quality feedback for current photos */}
        {photos.length > 0 && (
          <div className="photo-feedback">
            {photos.some((p) => p.quality === "poor") && (
              <div className="pf-warning">
                {photos.filter((p) => p.quality === "poor").map((p, i) => (
                  <div key={i}>❌ {p.feedback}</div>
                ))}
              </div>
            )}
            {photos.length > 1 && (
              <div className="pf-hint">★ = primary face reference · tap to change</div>
            )}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
        />

        {showTips && (
          <div className="photo-tips" onClick={() => setShowTips(false)}>
            <strong>📸 Tips for the best results:</strong>
            <div>✓ Clear face, looking forward</div>
            <div>✓ Good natural lighting</div>
            <div>✓ Just this person in the frame</div>
            <div>✓ Multiple angles help a lot!</div>
          </div>
        )}

        {error && (
          <div style={{ color: "#e53e3e", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {error}
          </div>
        )}

        <label className="f-lbl">Name *</label>
        <input
          className="f-inp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder={
            role === "pet" ? "e.g. Buddy" : role === "mom" ? "e.g. Sarah" : "e.g. Emma"
          }
        />

        {["child", "baby"].includes(role) && (
          <>
            <label className="f-lbl">Age</label>
            <input
              className="f-inp"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              type="number"
              min="0"
              max="17"
              placeholder="e.g. 5"
            />
          </>
        )}

        <button
          className="m-save"
          disabled={!name.trim()}
          onClick={handleSave}
        >
          {existing ? "Save changes ✓" : `Add ${name || currentRole.label} to story ✨`}
        </button>
      </div>
    </div>
  );
}
