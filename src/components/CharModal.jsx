import { useState, useRef } from "react";
import { ROLES } from "../constants/data";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

export default function CharModal({ preset, existing, onSave, onClose }) {
  const [role, setRole] = useState(existing?.role || preset || "child");
  const [name, setName] = useState(existing?.name || "");
  const [age, setAge] = useState(existing?.age || "");
  const [photo, setPhoto] = useState(existing?.photo || null);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const currentRole = ROLES.find((r) => r.id === role);

  function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) {
      setError("Photo must be under 5MB");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => setPhoto(event.target.result);
    reader.onerror = () => setError("Failed to read photo");
    reader.readAsDataURL(file);
  }

  function handleSave() {
    const trimmedName = name.trim().slice(0, 30);
    if (!trimmedName) return;
    onSave({
      id: existing?.id || Date.now(),
      role,
      name: trimmedName,
      age,
      photo,
      emoji: currentRole.emoji,
    });
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <button className="modal-x" onClick={onClose}>✕</button>

        <div className="m-h">{existing ? "Edit character" : "Add a character"}</div>
        <div className="m-s">Add a photo to make illustrations extra special ✨</div>

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

        <div
          className={`pdrop${photo ? " has" : ""}`}
          onClick={() => fileRef.current.click()}
        >
          {photo ? (
            <>
              <img src={photo} alt="Character" />
              <button
                className="pd-ch"
                onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}
              >
                Change
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{currentRole?.emoji}</div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Add a photo (optional)</div>
              <div style={{ fontSize: 12, color: "var(--lt)", marginTop: 3 }}>
                Makes illustrations much more personal
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

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
