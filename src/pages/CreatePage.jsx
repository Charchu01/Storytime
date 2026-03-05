import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ModeSelector from "../components/ModeSelector";
import TierSelector from "../components/TierSelector";
import OnboardingWizard from "../components/OnboardingWizard";
import CastStep from "../components/CastStep";
import StyleStep from "../components/StyleStep";
import ChatStep from "../components/ChatStep";
import BookReader from "../components/BookReader";
import { useAppContext } from "../App";
import { useToast } from "../App";
import { STYLES, STORY_WORLDS, STORY_TONES, STORY_LESSONS, STORY_FORMATS } from "../constants/data";

const DRAFT_KEY = "sk_draft";

function saveDraft(data) {
  try {
    const safe = { ...data, cast: data.cast?.map(c => ({
      ...c,
      photo: c.photo ? "has_photo" : null,
      photos: c.photos?.length ? c.photos.map(p => ({ quality: p.quality, feedback: p.feedback })) : undefined,
    })) };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
  } catch {}
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); }
  catch { return null; }
}

function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

function ResumeModal({ draft, onResume, onFresh }) {
  const heroName = draft?.cast?.find(c => c.isHero)?.name || draft?.cast?.[0]?.name || draft?.wizardData?.heroName || "someone special";
  return (
    <div className="overlay">
      <div className="modal resume-modal">
        <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>✍️</div>
        <h2 className="m-h" style={{ textAlign: "center" }}>Resume your story?</h2>
        <p className="m-s" style={{ textAlign: "center" }}>You were in the middle of creating a story for {heroName}.</p>
        <div className="resume-btns">
          <button className="big-btn" onClick={onResume}>Yes, pick up where I left off</button>
          <button className="big-btn big-btn-ghost" onClick={onFresh}>Start fresh</button>
        </div>
      </div>
    </div>
  );
}

export default function CreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addStory } = useAppContext();
  const { addToast } = useToast();

  // Flow: mode → tier → wizard → chat → preview
  const [step, setStep] = useState("mode");
  const [mode, setMode] = useState(searchParams.get("mode") || null);
  const [isGift, setIsGift] = useState(false);
  const [tier, setTier] = useState(null);
  const [cast, setCast] = useState([]);
  const [style, setStyle] = useState(null);
  const [length, setLength] = useState(6);
  const [result, setResult] = useState(null);
  const [showResume, setShowResume] = useState(false);
  const [occasion, setOccasion] = useState(searchParams.get("occasion") || null);
  const [wizardData, setWizardData] = useState(null);
  const [storySessionId] = useState(() => Date.now().toString(36) + Math.random().toString(36).slice(2));

  // Check for vault character from Family Vault
  const [vaultChar, setVaultChar] = useState(null);
  useEffect(() => {
    if (searchParams.get("vaultChar")) {
      try {
        const stored = JSON.parse(sessionStorage.getItem("sk_vault_char"));
        if (stored) {
          setVaultChar(stored);
          sessionStorage.removeItem("sk_vault_char");
          setTier("premium");
          setStep("cast");
        }
      } catch {}
    }
  }, []);

  // If mode is passed via URL, skip mode selector
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode && ["child", "pet", "family", "special", "imagination"].includes(urlMode)) {
      setMode(urlMode);
      setStep("tier");
    }
  }, []);

  useEffect(() => { document.title = "Create Your Story — Storytime"; }, []);

  // Check for draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.step && draft.step !== "mode" && draft.step !== "tier") {
      setShowResume(true);
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (!["preview", "mode", "tier"].includes(step)) {
      saveDraft({ step, mode, tier, cast, style, length, occasion, wizardData });
    }
  }, [step, mode, tier, cast, style, length, occasion, wizardData]);

  function handleResume() {
    const draft = loadDraft();
    if (draft) {
      if (draft.mode) setMode(draft.mode);
      if (draft.tier) setTier(draft.tier);
      if (draft.cast) setCast(draft.cast);
      if (draft.style) setStyle(draft.style);
      if (draft.length) setLength(draft.length);
      if (draft.occasion) setOccasion(draft.occasion);
      if (draft.wizardData) setWizardData(draft.wizardData);
      setStep(draft.step || "mode");
    }
    setShowResume(false);
  }

  function handleFresh() {
    clearDraft();
    setShowResume(false);
  }

  function handleModeSelect(selectedMode, gift) {
    setMode(selectedMode);
    setIsGift(gift);
    setStep("tier");
  }

  function handleTierSelect(selectedTier) {
    setTier(selectedTier);
    setLength(selectedTier === "premium" ? 10 : 6);
    setStep("wizard");
  }

  function handleWizardComplete(data) {
    setWizardData(data);

    // Build cast from wizard data, including uploaded photos
    const heroPhotos = data.heroPhotos || [];
    const heroCast = [];
    if (data.heroName) {
      heroCast.push({
        id: Date.now(),
        name: data.heroName,
        role: data.heroRole || "child",
        age: data.heroAge || "",
        isHero: true,
        emoji: mode === "pet" ? "🐾" : "🧒",
        photo: heroPhotos[0]?.dataUri || null,
        photos: heroPhotos,
        primaryPhotoIndex: 0,
      });
    }

    // Add companions from wizard
    if (data.cast?.length > 0) {
      heroCast.push(...data.cast.map((c) => ({ ...c, isHero: false })));
    }

    setCast(heroCast);

    // Set style from wizard
    const styleName = STYLES.find((s) => s.id === data.style)?.name || data.style;
    setStyle(styleName);

    // Go directly to chat with enriched data
    setStep("chat");
  }

  function handleStoryComplete(storyResult) {
    setResult(storyResult);
    clearDraft();
    const id = addStory({
      ...storyResult,
      styleName: style,
      cast,
      tier,
      mode,
    });
    setStep("preview");
    navigate(`/book/${id}`, { replace: true });
  }

  function reset() {
    clearDraft();
    setMode(null);
    setTier(null);
    setCast([]);
    setStyle(null);
    setResult(null);
    setWizardData(null);
    setStep("mode");
  }

  if (step === "preview" && result) {
    return <BookReader data={result} cast={cast} styleName={style} onReset={reset} />;
  }

  // Build enriched storyData for ChatStep from wizard selections
  const enrichedStoryData = wizardData ? {
    storyWorld: STORY_WORLDS.find((w) => w.id === wizardData.world)?.label || null,
    storyTone: STORY_TONES.find((t) => t.id === wizardData.tone)?.label || null,
    storyFormat: wizardData.format || "classic",
    storyLesson: STORY_LESSONS.find((l) => l.id === wizardData.lesson)?.label || null,
    personalIngredient: wizardData.secret || null,
    personality: wizardData.personality || [],
    loves: wizardData.loves || [],
  } : {};

  return (
    <div className="create-page">
      {showResume && <ResumeModal draft={loadDraft()} onResume={handleResume} onFresh={handleFresh} />}

      {step === "mode" && (
        <ModeSelector
          onSelect={handleModeSelect}
          onBack={() => navigate("/")}
        />
      )}
      {step === "tier" && (
        <TierSelector
          onSelect={handleTierSelect}
          onBack={() => setStep("mode")}
        />
      )}
      {step === "wizard" && (
        <OnboardingWizard
          mode={mode}
          isGift={isGift}
          tier={tier}
          onComplete={handleWizardComplete}
          onBack={() => setStep("tier")}
        />
      )}
      {step === "cast" && (
        <CastStep
          onNext={(characters) => { setCast(characters); setStep("style"); }}
          onBack={() => setStep(wizardData ? "wizard" : "tier")}
          initialCast={cast}
          tier={tier}
          vaultChar={vaultChar}
        />
      )}
      {step === "style" && (
        <StyleStep
          onNext={(styleName) => { setStyle(styleName); setStep("chat"); }}
          onBack={() => setStep("cast")}
        />
      )}
      {step === "chat" && (
        <ChatStep
          cast={cast}
          style={style}
          length={length}
          occasion={occasion}
          tier={tier}
          storySessionId={storySessionId}
          vaultChar={vaultChar}
          onNext={handleStoryComplete}
          onBack={() => setStep(wizardData ? "wizard" : "style")}
          wizardData={enrichedStoryData}
        />
      )}
    </div>
  );
}
