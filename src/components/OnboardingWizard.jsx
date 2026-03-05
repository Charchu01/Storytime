import { useState, useRef } from "react";
import { SPARKS, STYLES } from "../constants/data";
import ConsentCheckbox from "./ConsentCheckbox";

// ── Step configurations per mode ──────────────────────────────────────────────
const MODE_STEPS = {
  child: ["hero", "idea", "style", "review"],
  pet: ["hero", "idea", "style", "review"],
  family: ["hero", "idea", "style", "review"],
  special: ["hero", "idea", "style", "review"],
  imagination: ["idea", "style", "review"],
};

const MAX_PHOTOS = 3;
const PHOTO_MAX_DIM = 1024;
const PHOTO_QUALITY = 0.85;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

const CAST_ROLES = [
  { id: "mom", label: "Mom", emoji: "👩" },
  { id: "dad", label: "Dad", emoji: "👨" },
  { id: "sibling", label: "Sibling", emoji: "👧" },
  { id: "pet", label: "Pet", emoji: "🐾" },
  { id: "grandparent", label: "Grandparent", emoji: "👵" },
  { id: "friend", label: "Friend", emoji: "🤝" },
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

export default function OnboardingWizard({ mode, isGift, tier, onComplete, onBack }) {
  const steps = MODE_STEPS[mode] || MODE_STEPS.child;
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState("forward");

  // Hero data
  const [heroName, setHeroName] = useState("");
  const [heroAge, setHeroAge] = useState("");
  const [heroPhotos, setHeroPhotos] = useState([]);
  const [photoError, setPhotoError] = useState(null);

  // Cast
  const [cast, setCast] = useState([]);
  const [newCastName, setNewCastName] = useState("");
  const [newCastRole, setNewCastRole] = useState("mom");

  // Story idea
  const [selectedSpark, setSelectedSpark] = useState(null);
  const [storyIdea, setStoryIdea] = useState("");

  // Style
  const [style, setStyle] = useState("sb"); // Pre-select Storybook as default

  // Review extras (collapsed by default)
  const [dedication, setDedication] = useState("");
  const [authorName, setAuthorName] = useState("A loving family");
  const [tone, setTone] = useState("");
  const [format, setFormat] = useState("classic");
  const [secret, setSecret] = useState("");

  // Consent
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const photoRef = useRef();
  const currentStep = steps[stepIdx];
  const progress = ((stepIdx + 1) / steps.length) * 100;

  const showAge = mode !== "pet" && mode !== "special" && mode !== "imagination";

  function next() {
    if (stepIdx < steps.length - 1) {
      setDirection("forward");
      setStepIdx(stepIdx + 1);
    }
  }

  function prev() {
    if (stepIdx > 0) {
      setDirection("back");
      setStepIdx(stepIdx - 1);
    } else {
      onBack();
    }
  }

  function jumpTo(stepName) {
    const idx = steps.indexOf(stepName);
    if (idx >= 0) {
      setDirection(idx < stepIdx ? "back" : "forward");
      setStepIdx(idx);
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

  function addCastMember() {
    const trimmed = newCastName.trim();
    if (!trimmed) return;
    const roleInfo = CAST_ROLES.find((r) => r.id === newCastRole) || CAST_ROLES[0];
    setCast((prev) => [...prev, { name: trimmed, role: newCastRole, emoji: roleInfo.emoji }]);
    setNewCastName("");
  }

  function removeCast(idx) {
    setCast((prev) => prev.filter((_, i) => i !== idx));
  }

  function randomIdea() {
    const ideas = SPARKS.filter((s) => s.id !== "custom");
    const pick = ideas[Math.floor(Math.random() * ideas.length)];
    setSelectedSpark(pick.id);
    setStoryIdea(pick.title);
  }

  function canContinue() {
    switch (currentStep) {
      case "hero": return heroName.trim().length > 0;
      case "idea": return storyIdea.trim().length > 0;
      case "style": return !!style;
      case "review": return true;
      default: return true;
    }
  }

  function handleFinish() {
    if (!consentChecked && mode !== "imagination" && heroPhotos.length > 0) {
      setConsentError(true);
      return;
    }

    const length = tier === "premium" ? 10 : 6;
    const styleName = STYLES.find((s) => s.id === style)?.name || style;

    onComplete({
      heroName,
      heroAge,
      heroRole: mode === "pet" ? "pet" : "child",
      heroPhotos,
      cast,
      storyIdea,
      spark: selectedSpark || "custom",
      style: style,
      dedication: dedication || "",
      authorName: authorName || "A loving family",
      tone: tone || "",
      format: format || "classic",
      secret: secret || "",
      length,
    });
  }

  const modeLabel = mode === "pet" ? "your pet" :
                    mode === "special" ? "this person" :
                    mode === "family" ? "the main character" :
                    "your child";

  const animClass = direction === "forward" ? "wiz-slide-in-right" : "wiz-slide-in-left";

  // ── Render current step ─────────────────────────────────────────────────────
  function renderStep() {
    switch (currentStep) {
      case "hero":
        return (
          <div className={`wiz-step ${animClass}`} key={`hero-${stepIdx}`}>
            <h2 className="wiz-step-h">
              {mode === "pet" ? "What's your pet's name?" :
               mode === "special" ? "Who is this story for?" :
               mode === "family" ? "Who's the main character?" :
               "What's your child's name?"}
            </h2>

            <div className="wiz-hero-form">
              <input
                className="wiz-name-input"
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                placeholder={mode === "pet" ? "e.g. Buddy" : "e.g. Emma"}
                autoFocus
                maxLength={30}
              />
              {showAge && (
                <input
                  className="wiz-age-input"
                  value={heroAge}
                  onChange={(e) => setHeroAge(e.target.value)}
                  placeholder="Age"
                  type="number"
                  min={0}
                  max={99}
                />
              )}
            </div>

            {/* Photo upload — inline, not a modal */}
            <div className="wiz-photo-zone">
              <h3 className="wiz-photo-zone-h">Add a photo (optional)</h3>

              <div className="wiz-photo-grid">
                {heroPhotos.map((p, i) => (
                  <div key={i} className="wiz-photo-thumb">
                    <img src={p.dataUri} alt={`Photo ${i + 1}`} />
                    <button className="wiz-photo-rm" onClick={() => removePhoto(i)}>✕</button>
                    <div className={`wiz-photo-ring wiz-ring-${p.quality}`} />
                  </div>
                ))}
                {heroPhotos.length < MAX_PHOTOS && (
                  <button className="wiz-photo-add" onClick={() => photoRef.current?.click()}>
                    + Add photo
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

              {heroPhotos.length === 0 && (
                <p className="wiz-photo-skip-note">
                  Skip this for text-only illustrations
                </p>
              )}
            </div>

            {/* Supporting cast (expandable) */}
            {(mode === "family" || mode === "child") && (
              <details className="wiz-cast-expand">
                <summary>+ Add more people to the story</summary>
                <div className="wiz-cast-inline">
                  {cast.map((c, i) => (
                    <div key={i} className="wiz-cast-chip">
                      {c.emoji} {c.name}
                      <button onClick={() => removeCast(i)}>✕</button>
                    </div>
                  ))}
                  <div className="wiz-cast-add-row">
                    <input
                      placeholder="Name"
                      value={newCastName}
                      onChange={(e) => setNewCastName(e.target.value)}
                      maxLength={30}
                      onKeyDown={(e) => e.key === "Enter" && addCastMember()}
                    />
                    <select value={newCastRole} onChange={(e) => setNewCastRole(e.target.value)}>
                      {CAST_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                    <button onClick={addCastMember}>Add</button>
                  </div>
                </div>
              </details>
            )}
          </div>
        );

      case "idea":
        return (
          <div className={`wiz-step ${animClass}`} key={`idea-${stepIdx}`}>
            <h2 className="wiz-step-h">
              What should {heroName || "the hero"}'s story be about?
            </h2>
            <p className="wiz-step-sub">Pick an idea or describe your own</p>

            <div className="wiz-idea-grid">
              {SPARKS.filter((s) => s.id !== "custom").map((spark) => (
                <button
                  key={spark.id}
                  className={`wiz-idea-card${selectedSpark === spark.id ? " on" : ""}`}
                  onClick={() => {
                    setSelectedSpark(spark.id);
                    setStoryIdea(spark.title);
                  }}
                >
                  <span className="wiz-idea-em">{spark.emoji}</span>
                  <strong>{spark.title}</strong>
                  <span className="wiz-idea-sub">{spark.subtitle}</span>
                </button>
              ))}
            </div>

            <div className="wiz-idea-or">or</div>

            <textarea
              className="wiz-idea-text"
              value={selectedSpark === "custom" || (storyIdea && !SPARKS.find(s => s.id !== "custom" && s.title === storyIdea)) ? storyIdea : ""}
              onChange={(e) => {
                setStoryIdea(e.target.value);
                setSelectedSpark("custom");
              }}
              placeholder={`Describe your story idea... e.g. ${heroName || "Emma"} discovers a secret garden where every flower grants a different wish`}
              rows={3}
              maxLength={500}
            />

            <button className="wiz-surprise" onClick={randomIdea}>
              🎲 Surprise me
            </button>
          </div>
        );

      case "style":
        return (
          <div className={`wiz-step ${animClass}`} key={`style-${stepIdx}`}>
            <h2 className="wiz-step-h">Choose the art style</h2>
            <p className="wiz-step-sub">Every page will be illustrated in this style.</p>

            <div className="style-grid">
              {STYLES.map((s, index) => (
                <div
                  key={s.id}
                  className={`style-card${style === s.id ? " on" : ""}`}
                  style={{ animationDelay: `${index * 0.06}s`, animation: "msgIn .4s ease both" }}
                  onClick={() => setStyle(s.id)}
                >
                  <div className="sc-check">✓</div>
                  <div className={`sc-prev ${s.className}`}>
                    <span className="sc-em">{s.emoji}</span>
                  </div>
                  <div className="sc-info">
                    <div className="sc-name">{s.name}</div>
                    <div className="sc-tag">{s.tagline}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "review": {
        const styleName = STYLES.find((s) => s.id === style)?.name || style;
        const pageCount = tier === "premium" ? 10 : 6;
        const defaultDedication = `For ${heroName || "our little ones"}, who make every day magical.`;

        return (
          <div className={`wiz-step ${animClass}`} key={`review-${stepIdx}`}>
            <h2 className="wiz-step-h">Ready to create?</h2>

            {/* Summary card */}
            <div className="wiz-review-card">
              {heroName && (
                <div className="wiz-review-row">
                  <span className="wiz-review-label">Hero</span>
                  <span>{heroName}{heroAge ? `, age ${heroAge}` : ""}</span>
                  <button className="wiz-review-edit" onClick={() => jumpTo("hero")}>Edit</button>
                </div>
              )}
              <div className="wiz-review-row">
                <span className="wiz-review-label">Photos</span>
                <span>{heroPhotos.length} photo{heroPhotos.length !== 1 ? "s" : ""}</span>
                {steps.includes("hero") && (
                  <button className="wiz-review-edit" onClick={() => jumpTo("hero")}>Edit</button>
                )}
              </div>
              <div className="wiz-review-row">
                <span className="wiz-review-label">Story</span>
                <span>{storyIdea.length > 50 ? storyIdea.slice(0, 50) + "..." : storyIdea}</span>
                <button className="wiz-review-edit" onClick={() => jumpTo("idea")}>Edit</button>
              </div>
              <div className="wiz-review-row">
                <span className="wiz-review-label">Style</span>
                <span>{styleName}</span>
                <button className="wiz-review-edit" onClick={() => jumpTo("style")}>Edit</button>
              </div>
              <div className="wiz-review-row">
                <span className="wiz-review-label">Pages</span>
                <span>{pageCount} pages ({tier})</span>
              </div>
            </div>

            {/* Collapsible extras */}
            <details className="wiz-extras">
              <summary className="wiz-extras-toggle">
                Customize more (optional)
              </summary>
              <div className="wiz-extras-content">
                <label className="wiz-extras-label">Dedication</label>
                <textarea
                  className="wiz-extras-textarea"
                  value={dedication}
                  onChange={(e) => setDedication(e.target.value)}
                  placeholder={defaultDedication}
                  rows={2}
                />

                <label className="wiz-extras-label">Author name</label>
                <input
                  className="wiz-extras-input"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="A loving family"
                />

                <label className="wiz-extras-label">Tone</label>
                <div className="wiz-chip-row">
                  {["Cozy", "Exciting", "Heartfelt", "Funny"].map((t) => (
                    <button
                      key={t}
                      className={`wiz-chip${tone === t ? " on" : ""}`}
                      onClick={() => setTone(tone === t ? "" : t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <label className="wiz-extras-label">Writing style</label>
                <div className="wiz-chip-row">
                  {[
                    { id: "classic", label: "Classic" },
                    { id: "rhyming", label: "Rhyming" },
                    { id: "funny", label: "Funny & Silly" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      className={`wiz-chip${format === f.id ? " on" : ""}`}
                      onClick={() => setFormat(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <label className="wiz-extras-label">Secret ingredient (optional)</label>
                <input
                  className="wiz-extras-input"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="e.g. just lost their first tooth"
                  maxLength={200}
                />
              </div>
            </details>

            {/* Consent */}
            {heroPhotos.length > 0 && mode !== "imagination" && (
              <ConsentCheckbox
                checked={consentChecked}
                onChange={(v) => { setConsentChecked(v); setConsentError(false); }}
                error={consentError}
              />
            )}

            {/* CTA */}
            <button className="wiz-generate-btn" onClick={handleFinish}>
              Write My Storybook ✨
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  }

  const isLast = currentStep === "review";

  return (
    <div className="wiz-shell">
      {/* Progress bar — no step numbers */}
      <div className="wiz-topbar">
        <button className="back-btn" onClick={prev}>← Back</button>
        <div className="wiz-prog-wrap">
          <div className="wiz-prog">
            <div className="wiz-prog-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="wiz-content">
        {renderStep()}
      </div>

      {/* Bottom CTA */}
      {!isLast && (
        <div className="wiz-footer">
          <button
            className="big-btn"
            disabled={!canContinue()}
            onClick={next}
          >
            {currentStep === "hero" && heroPhotos.length === 0
              ? "Continue →"
              : "Continue →"}
          </button>
        </div>
      )}
    </div>
  );
}
