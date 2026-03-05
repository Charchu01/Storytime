import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ModeSelector from "../components/ModeSelector";
import TierSelector from "../components/TierSelector";
import OnboardingWizard from "../components/OnboardingWizard";
import GenerationStep from "../components/GenerationStep";
import BookReader from "../components/BookReader";
import { useAppContext } from "../App";
import { STYLES, STORY_WORLDS, STORY_TONES, STORY_LESSONS, STORY_FORMATS, LOVES } from "../constants/data";

const DRAFT_KEY = "sk_draft";

function saveDraft(data) {
  try {
    const safe = { ...data };
    // Don't store photo data URIs in localStorage (too large)
    delete safe.cast;
    delete safe.wizardData;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
  } catch {}
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); }
  catch { return null; }
}

function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

export default function CreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addStory } = useAppContext();

  // Flow: mode → tier → wizard → generate → preview
  const [step, setStep] = useState("mode");
  const [mode, setMode] = useState(searchParams.get("mode") || null);
  const [isGift, setIsGift] = useState(false);
  const [tier, setTier] = useState(null);
  const [cast, setCast] = useState([]);
  const [style, setStyle] = useState(null);
  const [length, setLength] = useState(6);
  const [result, setResult] = useState(null);
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
          // Skip mode selector — go straight to wizard with child mode
          setMode("child");
          setStep("wizard");
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

  function handleWizardComplete(allData) {
    setWizardData(allData);

    // Build cast from wizard data, including uploaded photos
    const heroPhotos = allData.heroPhotos || [];
    const heroCast = [];
    if (allData.heroName) {
      heroCast.push({
        id: Date.now(),
        name: allData.heroName,
        role: allData.heroRole || "child",
        age: allData.heroAge || "",
        isHero: true,
        emoji: mode === "pet" ? "🐾" : "🧒",
        photo: heroPhotos[0]?.dataUri || null,
        photos: heroPhotos,
        primaryPhotoIndex: 0,
      });
    }

    // Add companions from wizard
    if (allData.cast?.length > 0) {
      heroCast.push(...allData.cast.map((c) => ({ ...c, isHero: false })));
    }

    setCast(heroCast);

    // Set style from wizard
    const styleName = STYLES.find((s) => s.id === allData.style)?.name || allData.style;
    setStyle(styleName);

    // Set length from wizard
    if (allData.length) setLength(allData.length);

    // Build enriched story data for generation
    const enrichedStoryData = {
      heroName: allData.heroName,
      storyWorld: STORY_WORLDS.find((w) => w.id === allData.world)?.label || null,
      storyTone: STORY_TONES.find((t) => t.id === allData.tone)?.label || null,
      storyFormat: allData.format || "classic",
      storyLesson: STORY_LESSONS.find((l) => l.id === allData.lesson)?.label || null,
      personalIngredient: allData.secret || null,
      personality: allData.personality || [],
      loves: allData.loves?.map((id) => {
        const found = LOVES.find((l) => l.id === id);
        return found ? found.label : id;
      }) || [],
      occasion: allData.occasion || null,
      spark: allData.spark,
      sparkText: allData.sparkText,
      dedication: allData.dedication || null,
      authorName: allData.authorName || "A loving family",
    };

    setWizardData(enrichedStoryData);
    setStep("generate");
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

  return (
    <div className="create-page">
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
      {step === "generate" && (
        <GenerationStep
          cast={cast}
          style={style}
          length={length}
          tier={tier}
          storySessionId={storySessionId}
          vaultChar={vaultChar}
          wizardData={wizardData}
          onNext={handleStoryComplete}
          onBack={() => setStep("wizard")}
        />
      )}
    </div>
  );
}
