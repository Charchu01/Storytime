import { useState, useRef } from "react";
import {
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

// ── Step configurations per mode ──────────────────────────────────────────────
const MODE_STEPS = {
  child: ["hero", "personality", "loves", "cast", "world", "format", "secret", "style"],
  pet: ["hero", "pet_traits", "loves", "cast", "world", "format", "style"],
  family: ["cast", "personality", "loves", "world", "format", "secret", "style"],
  special: ["hero", "personality", "loves", "world", "format", "secret", "style"],
  imagination: ["world", "personality", "loves", "format", "secret", "style"],
};

const STEP_LABELS = {
  hero: "The Star",
  personality: "Personality",
  pet_traits: "Pet Personality",
  loves: "Favourite Things",
  cast: "Supporting Cast",
  world: "Story World",
  format: "Format & Tone",
  secret: "Secret Ingredient",
  style: "Art Style",
};

function ChipGrid({ items, selected, onSelect, multi = false, max = 3 }) {
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
  });
  const [showCharModal, setShowCharModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const nameRef = useRef();

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
    }
  }

  function canContinue() {
    switch (currentStep) {
      case "hero": return data.heroName.trim().length > 0;
      case "personality":
      case "pet_traits": return data.personality.length > 0;
      case "loves": return data.loves.length > 0;
      case "cast": return true; // optional
      case "world": return !!data.world;
      case "format": return !!data.format;
      case "secret": return true; // optional
      case "style": return !!data.style;
      default: return true;
    }
  }

  function handleFinish() {
    if (!consentChecked && mode !== "imagination") {
      setConsentError(true);
      return;
    }
    onComplete(data);
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

            {mode !== "imagination" && (
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

  const isLast = stepIdx === steps.length - 1;

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
            disabled={!canContinue()}
            onClick={handleFinish}
          >
            Continue to Story Builder ✨
          </button>
        ) : (
          <button
            className="big-btn"
            disabled={!canContinue()}
            onClick={next}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
