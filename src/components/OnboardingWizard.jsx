import { useState, useRef } from "react";
import {
  SPARKS,
  PERSONALITY_TRAITS,
  PET_TRAITS,
  LOVES,
  STORY_WORLDS,
  STORY_FORMATS,
  STORY_TONES,
  STORY_LESSONS,
  STYLES,
  COMPANION_TYPES,
  MAGICAL_GUIDES,
  SECRET_CHIPS,
  BOOK_LENGTHS,
  STORY_MODES,
} from "../constants/data";
import CharModal from "./CharModal";
import ConsentCheckbox from "./ConsentCheckbox";

// ── Occasions (moved from ChatStep) ──────────────────────────────────────────
const OCCASIONS = [
  { id: "birthday", emoji: "🎂", label: "Birthday" },
  { id: "school", emoji: "🏫", label: "First Day of School" },
  { id: "sibling", emoji: "👶", label: "New Baby Sibling" },
  { id: "tooth", emoji: "🦷", label: "Lost a Tooth" },
  { id: "fear", emoji: "😨", label: "Facing a Fear" },
  { id: "pet", emoji: "🐾", label: "Pet Story" },
  { id: "trip", emoji: "✈️", label: "Big Trip" },
  { id: "just_because", emoji: "🌟", label: "Just Because" },
];

// ── Step configurations per mode ──────────────────────────────────────────────
const MODE_STEPS = {
  child: ["hero", "photos", "personality", "loves", "cast", "world", "format", "secret", "style", "occasion", "spark", "length", "dedication", "author", "summary"],
  pet: ["hero", "photos", "pet_traits", "loves", "cast", "world", "format", "style", "occasion", "spark", "length", "dedication", "author", "summary"],
  family: ["cast", "photos", "personality", "loves", "world", "format", "secret", "style", "occasion", "spark", "length", "dedication", "author", "summary"],
  special: ["hero", "photos", "personality", "loves", "world", "format", "secret", "style", "occasion", "spark", "length", "dedication", "author", "summary"],
  imagination: ["world", "personality", "loves", "format", "secret", "style", "occasion", "spark", "length", "dedication", "author", "summary"],
};

const STEP_LABELS = {
  hero: "The Star",
  photos: "Add Photos",
  personality: "Personality",
  pet_traits: "Pet Personality",
  loves: "Favourite Things",
  cast: "Supporting Cast",
  world: "Story World",
  format: "Format & Tone",
  secret: "Secret Ingredient",
  style: "Art Style",
  occasion: "Occasion",
  spark: "Story Idea",
  length: "Book Length",
  dedication: "Dedication",
  author: "Author Name",
  summary: "Review & Create",
};

const MAX_PHOTOS = 3;
const PHOTO_MAX_DIM = 1024;
const PHOTO_QUALITY = 0.85;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

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

function ChipGrid({ items, selected, onSelect, multi = false }) {
  return (
    <div className="wiz-chip-grid">
      {items.map((item) => {
        const isOn = multi
          ? (selected || []).includes(item.id)
          : selected === item.id;
        return (
          <button
            key={item.id}
            className={`wiz-chip${isOn ? " wiz-chip-on" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            {item.emoji && <span className="wiz-chip-em">{item.emoji}</span>}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SurpriseButton({ onClick }) {
  return (
    <button className="wiz-surprise" onClick={onClick}>
      🎲 Surprise me
    </button>
  );
}

export default function OnboardingWizard({ mode, isGift, tier, onComplete, onBack }) {
  const steps = MODE_STEPS[mode] || MODE_STEPS.child;
  const modeInfo = STORY_MODES.find((m) => m.id === mode);
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState({
    heroName: "",
    heroAge: "",
    heroRole: mode === "pet" ? "pet" : "child",
    personality: [],
    loves: [],
    cast: [],
    world: null,
    format: "classic",
    tone: "cozy",
    lesson: null,
    secret: "",
    style: null,
    companion: null,
    magicalGuide: null,
    occasion: null,
    spark: null,
    sparkText: "",
    length: tier === "premium" ? 10 : 6,
    dedication: "",
    authorName: "A loving family",
  });
  const [heroPhotos, setHeroPhotos] = useState([]);
  const [photoError, setPhotoError] = useState(null);
  const [showCharModal, setShowCharModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const nameRef = useRef();
  const photoRef = useRef();

  const currentStep = steps[stepIdx];
  const progress = ((stepIdx + 1) / steps.length) * 100;

  function update(key, value) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMulti(key, id, max = 3) {
    setData((prev) => {
      const arr = prev[key] || [];
      if (arr.includes(id)) return { ...prev, [key]: arr.filter((x) => x !== id) };
      if (arr.length >= max) return prev;
      return { ...prev, [key]: [...arr, id] };
    });
  }

  function next() {
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
  }

  function prev() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
    else onBack();
  }

  function jumpToStep(stepName) {
    const idx = steps.indexOf(stepName);
    if (idx >= 0) setStepIdx(idx);
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function handleSurprise() {
    if (currentStep === "personality") {
      const traits = mode === "pet" ? PET_TRAITS : PERSONALITY_TRAITS;
      const picks = [];
      while (picks.length < 2) {
        const t = randomFrom(traits);
        if (!picks.includes(t.id)) picks.push(t.id);
      }
      update("personality", picks);
    } else if (currentStep === "loves") {
      const picks = [];
      while (picks.length < 2) {
        const l = randomFrom(LOVES);
        if (!picks.includes(l.id)) picks.push(l.id);
      }
      update("loves", picks);
    } else if (currentStep === "world") {
      update("world", randomFrom(STORY_WORLDS).id);
    } else if (currentStep === "format") {
      update("format", randomFrom(STORY_FORMATS).id);
      update("tone", randomFrom(STORY_TONES).id);
    } else if (currentStep === "secret") {
      update("secret", randomFrom(SECRET_CHIPS));
    } else if (currentStep === "spark") {
      const s = randomFrom(SPARKS.filter((x) => x.id !== "custom"));
      update("spark", s.id);
      update("sparkText", s.title);
    }
  }

  async function handlePhotoFile(file) {
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) { setPhotoError("Photo must be under 10 MB"); return; }
    if (heroPhotos.length >= MAX_PHOTOS) { setPhotoError(`Max ${MAX_PHOTOS} photos`); return; }
    setPhotoError(null);
    try {
      const compressed = await compressPhoto(file);
      setHeroPhotos((prev) => [...prev, { dataUri: compressed, quality: "fair", feedback: "" }]);
    } catch {
      setPhotoError("Failed to process photo");
    }
  }

  function removePhoto(idx) {
    setHeroPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function canContinue() {
    switch (currentStep) {
      case "hero": return data.heroName.trim().length > 0;
      case "photos": return true;
      case "personality":
      case "pet_traits": return data.personality.length > 0;
      case "loves": return data.loves.length > 0;
      case "cast": return true;
      case "world": return !!data.world;
      case "format": return !!data.format;
      case "secret": return true;
      case "style": return !!data.style;
      case "occasion": return true;
      case "spark": return !!(data.spark || data.sparkText.trim());
      case "length": return !!data.length;
      case "dedication": return true;
      case "author": return data.authorName.trim().length > 0;
      case "summary": return true;
      default: return true;
    }
  }

  // Initialize dedication text when we first reach that step
  function getDefaultDedication() {
    const names = data.heroName || "our little ones";
    return `For ${names}, who make every day magical.`;
  }

  function handleFinish() {
    if (!consentChecked && mode !== "imagination" && heroPhotos.length > 0) {
      setConsentError(true);
      return;
    }
    onComplete({ ...data, heroPhotos });
  }

  // ── Helper for summary display ────────────────────────────────────────────
  function getLabel(arr, id) {
    const item = arr.find((x) => x.id === id);
    return item ? (item.emoji ? `${item.emoji} ${item.label || item.name || item.title}` : item.label || item.name || item.title) : id;
  }

  // ── Render current step ─────────────────────────────────────────────────────
  function renderStep() {
    switch (currentStep) {
      case "hero":
        return (
          <div className="wiz-step wizard-step-enter" key="hero">
            <h2 className="wiz-step-h">
              {mode === "pet" ? "What's your pet's name?" :
               mode === "special" ? "Who is this story for?" :
               "Who's the star of this story?"}
            </h2>
            <p className="wiz-step-sub">
              {mode === "pet" ? "They'll be the hero of the whole adventure." :
               mode === "special" ? "This person will be the hero of their own book." :
               "This is the main character — they'll be on every page!"}
            </p>
            <input
              ref={nameRef}
              className="wiz-input"
              value={data.heroName}
              onChange={(e) => update("heroName", e.target.value)}
              placeholder={mode === "pet" ? "e.g. Buddy" : "e.g. Emma"}
              maxLength={30}
              autoFocus
            />
            {mode !== "pet" && mode !== "special" && (
              <input
                className="wiz-input wiz-input-sm"
                value={data.heroAge}
                onChange={(e) => update("heroAge", e.target.value)}
                placeholder="Age (optional)"
                type="number"
                min="0"
                max="99"
              />
            )}
          </div>
        );

      case "photos":
        return (
          <div className="wiz-step wizard-step-enter" key="photos">
            <h2 className="wiz-step-h">
              Add photos of {data.heroName || "the hero"}
            </h2>
            <p className="wiz-step-sub">
              Upload 1–3 clear face photos for custom illustrations.
              Skip this step if you prefer text-only generation.
            </p>

            <div className="wiz-photo-grid">
              {heroPhotos.map((p, i) => (
                <div key={i} className="wiz-photo-thumb">
                  <img src={p.dataUri} alt={`Photo ${i + 1}`} />
                  <button className="wiz-photo-rm" onClick={() => removePhoto(i)}>✕</button>
                </div>
              ))}
              {heroPhotos.length < MAX_PHOTOS && (
                <button
                  className="wiz-photo-add"
                  onClick={() => photoRef.current?.click()}
                >
                  <span className="wiz-photo-add-icon">+</span>
                  <span className="wiz-photo-add-label">Add photo</span>
                </button>
              )}
            </div>

            {photoError && <div className="wiz-photo-error">{photoError}</div>}

            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="user"
              style={{ display: "none" }}
              onChange={(e) => { handlePhotoFile(e.target.files[0]); e.target.value = ""; }}
            />

            <div className="wiz-photo-tips">
              <div className="wiz-photo-tip">Clear face, good lighting</div>
              <div className="wiz-photo-tip">Front-facing works best</div>
              <div className="wiz-photo-tip">No sunglasses or heavy filters</div>
            </div>

            {heroPhotos.length === 0 && (
              <p className="wiz-skip-note">
                No photos? No problem — we'll create beautiful illustrations from the story description alone.
              </p>
            )}
          </div>
        );

      case "personality":
      case "pet_traits": {
        const traits = mode === "pet" ? PET_TRAITS : PERSONALITY_TRAITS;
        return (
          <div className="wiz-step wizard-step-enter" key="personality">
            <h2 className="wiz-step-h">
              {mode === "pet" ? `What's ${data.heroName || "your pet"} like?` :
               `What's ${data.heroName || "their"} personality?`}
            </h2>
            <p className="wiz-step-sub">Pick up to 3 traits — they'll shape the story.</p>
            <SurpriseButton onClick={handleSurprise} />
            <ChipGrid
              items={traits}
              selected={data.personality}
              onSelect={(id) => toggleMulti("personality", id)}
              multi
            />
          </div>
        );
      }

      case "loves":
        return (
          <div className="wiz-step wizard-step-enter" key="loves">
            <h2 className="wiz-step-h">What do they love?</h2>
            <p className="wiz-step-sub">Pick up to 3 — we'll weave them into the story.</p>
            <SurpriseButton onClick={handleSurprise} />
            <ChipGrid
              items={LOVES}
              selected={data.loves}
              onSelect={(id) => toggleMulti("loves", id)}
              multi
            />
          </div>
        );

      case "cast":
        return (
          <div className="wiz-step wizard-step-enter" key="cast">
            <h2 className="wiz-step-h">Who else is in the story?</h2>
            <p className="wiz-step-sub">Add companions, family members, or skip to continue.</p>

            {data.cast.length > 0 && (
              <div className="wiz-cast-list">
                {data.cast.map((c, i) => (
                  <div key={i} className="wiz-cast-chip">
                    <span>{c.emoji} {c.name}</span>
                    <button onClick={() => update("cast", data.cast.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="wiz-companion-grid">
              {COMPANION_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  className="wiz-chip"
                  onClick={() => setShowCharModal(ct.id)}
                >
                  {ct.emoji} {ct.label}
                </button>
              ))}
            </div>

            {data.companion === "guide" && (
              <div className="wiz-guide-row">
                <p className="wiz-step-sub">Choose a magical guide:</p>
                <ChipGrid
                  items={MAGICAL_GUIDES}
                  selected={data.magicalGuide}
                  onSelect={(id) => update("magicalGuide", id)}
                />
              </div>
            )}

            {showCharModal && (
              <CharModal
                preset={showCharModal === "pet_companion" ? "pet" : (showCharModal === "guide" ? "other" : showCharModal)}
                onSave={(character) => {
                  update("cast", [...data.cast, character]);
                  setShowCharModal(false);
                }}
                onClose={() => setShowCharModal(false)}
              />
            )}
          </div>
        );

      case "world":
        return (
          <div className="wiz-step wizard-step-enter" key="world">
            <h2 className="wiz-step-h">Where does the story take place?</h2>
            <p className="wiz-step-sub">Pick a world — it sets the visual tone for every page.</p>
            <SurpriseButton onClick={handleSurprise} />
            <div className="wiz-world-grid">
              {STORY_WORLDS.map((w) => (
                <button
                  key={w.id}
                  className={`wiz-world-card${data.world === w.id ? " wiz-world-on" : ""}`}
                  onClick={() => update("world", w.id)}
                >
                  <span className="wiz-world-em">{w.emoji}</span>
                  <span className="wiz-world-lbl">{w.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case "format":
        return (
          <div className="wiz-step wizard-step-enter" key="format">
            <h2 className="wiz-step-h">How should the story be told?</h2>
            <p className="wiz-step-sub">Pick a format and a mood.</p>
            <SurpriseButton onClick={handleSurprise} />

            <div className="wiz-section-label">Format</div>
            <div className="wiz-format-grid">
              {STORY_FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={`wiz-format-card${data.format === f.id ? " wiz-format-on" : ""}`}
                  onClick={() => update("format", f.id)}
                >
                  <span className="wiz-format-em">{f.emoji}</span>
                  <strong>{f.label}</strong>
                  <span className="wiz-format-note">{f.note}</span>
                </button>
              ))}
            </div>

            <div className="wiz-section-label">Tone</div>
            <div className="wiz-tone-row">
              {STORY_TONES.map((t) => (
                <button
                  key={t.id}
                  className={`wiz-chip${data.tone === t.id ? " wiz-chip-on" : ""}`}
                  onClick={() => update("tone", t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="wiz-section-label">Lesson (optional)</div>
            <div className="wiz-tone-row">
              {STORY_LESSONS.map((l) => (
                <button
                  key={l.id}
                  className={`wiz-chip${data.lesson === l.id ? " wiz-chip-on" : ""}`}
                  onClick={() => {
                    update("lesson", data.lesson === l.id ? null : l.id);
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        );

      case "secret":
        return (
          <div className="wiz-step wizard-step-enter" key="secret">
            <h2 className="wiz-step-h">Any secret ingredient?</h2>
            <p className="wiz-step-sub">
              A personal detail that makes the story truly theirs. Optional but magical.
            </p>
            <SurpriseButton onClick={handleSurprise} />

            <div className="wiz-secret-chips">
              {SECRET_CHIPS.map((chip) => (
                <button
                  key={chip}
                  className={`wiz-chip${data.secret === chip ? " wiz-chip-on" : ""}`}
                  onClick={() => update("secret", data.secret === chip ? "" : chip)}
                >
                  {chip}
                </button>
              ))}
            </div>

            <textarea
              className="wiz-textarea"
              value={data.secret}
              onChange={(e) => update("secret", e.target.value)}
              placeholder="Or type something personal..."
              rows={2}
              maxLength={200}
            />
          </div>
        );

      case "style":
        return (
          <div className="wiz-step wizard-step-enter" key="style">
            <h2 className="wiz-step-h">Choose the art style</h2>
            <p className="wiz-step-sub">Every page will be illustrated in this style.</p>

            <div className="style-grid">
              {STYLES.map((style, index) => (
                <div
                  key={style.id}
                  className={`style-card${data.style === style.id ? " on" : ""}`}
                  style={{ animationDelay: `${index * 0.06}s`, animation: "msgIn .4s ease both" }}
                  onClick={() => update("style", style.id)}
                >
                  <div className="sc-check">✓</div>
                  <div className={`sc-prev ${style.className}`}>
                    <span className="sc-em">{style.emoji}</span>
                  </div>
                  <div className="sc-info">
                    <div className="sc-name">{style.name}</div>
                    <div className="sc-tag">{style.tagline}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      // ── New steps ─────────────────────────────────────────────────────────────

      case "occasion":
        return (
          <div className="wiz-step wizard-step-enter" key="occasion">
            <h2 className="wiz-step-h">What's the occasion?</h2>
            <p className="wiz-step-sub">Pick one, or skip if there's no specific occasion.</p>
            <div className="wiz-chip-grid">
              {OCCASIONS.map((o) => (
                <button
                  key={o.id}
                  className={`wiz-chip${data.occasion === o.id ? " wiz-chip-on" : ""}`}
                  onClick={() => update("occasion", data.occasion === o.id ? null : o.id)}
                >
                  <span className="wiz-chip-em">{o.emoji}</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case "spark":
        return (
          <div className="wiz-step wizard-step-enter" key="spark">
            <h2 className="wiz-step-h">What kind of adventure?</h2>
            <p className="wiz-step-sub">Pick an idea below — or describe your own.</p>
            <SurpriseButton onClick={handleSurprise} />

            <div className="wiz-spark-grid">
              {SPARKS.filter((s) => s.id !== "custom").map((s) => (
                <button
                  key={s.id}
                  className={`wiz-spark-card${data.spark === s.id ? " wiz-spark-on" : ""}`}
                  onClick={() => { update("spark", s.id); update("sparkText", s.title); }}
                >
                  <span className="wiz-spark-em">{s.emoji}</span>
                  <strong className="wiz-spark-ttl">{s.title}</strong>
                  <span className="wiz-spark-sub">{s.subtitle}</span>
                </button>
              ))}
            </div>

            <div className="wiz-section-label">Or describe your own idea</div>
            <textarea
              className="wiz-textarea"
              value={data.spark === "custom" ? data.sparkText : ""}
              onChange={(e) => { update("spark", "custom"); update("sparkText", e.target.value); }}
              placeholder="e.g. A treasure hunt through a chocolate factory..."
              rows={2}
              maxLength={300}
            />
          </div>
        );

      case "length":
        return (
          <div className="wiz-step wizard-step-enter" key="length">
            <h2 className="wiz-step-h">How long should the book be?</h2>
            <p className="wiz-step-sub">More pages = more adventure.</p>
            <div className="wiz-length-grid">
              {BOOK_LENGTHS.map((bl) => {
                if (bl.premium && tier !== "premium") return null;
                return (
                  <button
                    key={bl.id}
                    className={`wiz-length-card${data.length === bl.id ? " wiz-length-on" : ""}`}
                    onClick={() => update("length", bl.id)}
                  >
                    <span className="wiz-length-em">{bl.emoji}</span>
                    <strong>{bl.label}</strong>
                    <span className="wiz-length-desc">{bl.desc}</span>
                    {bl.premium && <span className="wiz-length-badge">Premium</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "dedication":
        return (
          <div className="wiz-step wizard-step-enter" key="dedication">
            <h2 className="wiz-step-h">Add a dedication?</h2>
            <p className="wiz-step-sub">A personal note on the first page. Edit below or skip.</p>
            <textarea
              className="wiz-textarea"
              value={data.dedication || getDefaultDedication()}
              onChange={(e) => update("dedication", e.target.value)}
              rows={3}
              maxLength={200}
            />
            <button
              className="wiz-skip-btn"
              onClick={() => { update("dedication", ""); next(); }}
            >
              Skip dedication
            </button>
          </div>
        );

      case "author":
        return (
          <div className="wiz-step wizard-step-enter" key="author">
            <h2 className="wiz-step-h">Author name for the cover</h2>
            <p className="wiz-step-sub">This will appear on the book's cover page.</p>
            <input
              className="wiz-input"
              value={data.authorName}
              onChange={(e) => update("authorName", e.target.value)}
              placeholder="e.g. The Johnson Family"
              maxLength={40}
              autoFocus
            />
          </div>
        );

      case "summary":
        return (
          <div className="wiz-step wizard-step-enter" key="summary">
            <h2 className="wiz-step-h">Everything looks good?</h2>
            <p className="wiz-step-sub">Review your story setup. Tap any section to edit.</p>

            <div className="wiz-summary">
              {data.heroName && (
                <SummaryRow label="Hero" value={`${data.heroName}${data.heroAge ? `, age ${data.heroAge}` : ""}`} onEdit={() => jumpToStep("hero")} />
              )}
              {heroPhotos.length > 0 && (
                <SummaryRow label="Photos" value={`${heroPhotos.length} photo${heroPhotos.length > 1 ? "s" : ""} uploaded`} onEdit={() => jumpToStep("photos")} />
              )}
              {data.personality.length > 0 && (
                <SummaryRow label="Personality" value={data.personality.map((id) => getLabel(mode === "pet" ? PET_TRAITS : PERSONALITY_TRAITS, id)).join(", ")} onEdit={() => jumpToStep(mode === "pet" ? "pet_traits" : "personality")} />
              )}
              {data.loves.length > 0 && (
                <SummaryRow label="Loves" value={data.loves.map((id) => getLabel(LOVES, id)).join(", ")} onEdit={() => jumpToStep("loves")} />
              )}
              {data.cast.length > 0 && (
                <SummaryRow label="Cast" value={data.cast.map((c) => `${c.emoji} ${c.name}`).join(", ")} onEdit={() => jumpToStep("cast")} />
              )}
              {data.world && (
                <SummaryRow label="World" value={getLabel(STORY_WORLDS, data.world)} onEdit={() => jumpToStep("world")} />
              )}
              <SummaryRow label="Format" value={getLabel(STORY_FORMATS, data.format)} onEdit={() => jumpToStep("format")} />
              {data.style && (
                <SummaryRow label="Art Style" value={STYLES.find((s) => s.id === data.style)?.name || data.style} onEdit={() => jumpToStep("style")} />
              )}
              {data.sparkText && (
                <SummaryRow label="Story Idea" value={data.sparkText} onEdit={() => jumpToStep("spark")} />
              )}
              <SummaryRow label="Pages" value={`${data.length} pages`} onEdit={() => jumpToStep("length")} />
              {data.dedication && (
                <SummaryRow label="Dedication" value={`"${data.dedication.slice(0, 50)}${data.dedication.length > 50 ? "..." : ""}"` } onEdit={() => jumpToStep("dedication")} />
              )}
              <SummaryRow label="Author" value={data.authorName} onEdit={() => jumpToStep("author")} />
              <SummaryRow label="Plan" value={tier === "premium" ? "Premium" : "Standard"} />
            </div>

            {mode !== "imagination" && heroPhotos.length > 0 && (
              <ConsentCheckbox
                checked={consentChecked}
                onChange={(v) => { setConsentChecked(v); setConsentError(false); }}
                error={consentError}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  }

  const isLast = currentStep === "summary";

  return (
    <div className="wiz-shell">
      {/* Top bar */}
      <div className="topbar">
        <button className="back-btn" onClick={prev}>← Back</button>
        <div className="prog-wrap">
          <div className="prog">
            <div className="prog-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="prog-lbl">
            Step {stepIdx + 1} of {steps.length} · {STEP_LABELS[currentStep]}
          </div>
        </div>
      </div>

      {/* Live story card (summary strip) */}
      <div className="wiz-live-strip">
        <span className="wiz-live-mode">{modeInfo?.emoji} {modeInfo?.label}</span>
        {data.heroName && <span className="wiz-live-tag">⭐ {data.heroName}</span>}
        {data.world && <span className="wiz-live-tag">{STORY_WORLDS.find((w) => w.id === data.world)?.emoji}</span>}
        {data.style && <span className="wiz-live-tag">🎨 {STYLES.find((s) => s.id === data.style)?.name}</span>}
        {data.sparkText && <span className="wiz-live-tag">💭 {data.sparkText.slice(0, 20)}</span>}
        {isGift && <span className="wiz-live-tag">🎁 Gift</span>}
      </div>

      {/* Step content */}
      <div className="wiz-content">
        {renderStep()}
      </div>

      {/* Bottom CTA */}
      <div className="wiz-footer">
        {isLast ? (
          <button
            className="big-btn"
            onClick={handleFinish}
          >
            Write My Storybook ✨
          </button>
        ) : (
          <button
            className="big-btn"
            disabled={!canContinue()}
            onClick={next}
          >
            {currentStep === "occasion" && !data.occasion ? "Skip — no occasion →" :
             currentStep === "photos" && heroPhotos.length === 0 ? "Skip — no photos →" :
             currentStep === "secret" && !data.secret ? "Skip →" :
             "Continue →"}
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, onEdit }) {
  return (
    <div className="wiz-summary-row">
      <div className="wiz-summary-label">{label}</div>
      <div className="wiz-summary-value">{value}</div>
      {onEdit && <button className="wiz-summary-edit" onClick={onEdit}>Edit</button>}
    </div>
  );
}
