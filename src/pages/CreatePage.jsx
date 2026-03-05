import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ModeAndTierSelector from "../components/ModeAndTierSelector";
import OnboardingWizard from "../components/OnboardingWizard";
import GenerationStep from "../components/GenerationStep";
import BookReader from "../components/BookReader";
import { useAppContext } from "../App";
import { STYLES } from "../constants/data";

const DRAFT_KEY = "sk_draft";

function saveDraft(data) {
  try {
    const safe = { ...data };
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

  // Flow: modeAndTier → wizard → generate → preview
  const [step, setStep] = useState("modeAndTier");
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
          setMode("child");
          setStep("wizard");
        }
      } catch {}
    }
  }, []);

  // If mode is passed via URL, skip to modeAndTier with mode pre-selected
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode && ["child", "pet", "family", "special", "imagination"].includes(urlMode)) {
      setMode(urlMode);
    }
  }, []);

  useEffect(() => { document.title = "Create Your Story — Storytime"; }, []);

  function handleModeAndTierSelect(selectedMode, selectedTier, gift) {
    setMode(selectedMode);
    setTier(selectedTier);
    setIsGift(gift);
    setLength(selectedTier === "premium" ? 10 : 6);
    setStep("wizard");
  }

  function handleWizardComplete(allData) {
    setWizardData(allData);

    // Build cast from wizard data
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
      heroCast.push(...allData.cast.map((c) => ({
        ...c,
        id: Date.now() + Math.random(),
        isHero: false,
      })));
    }

    setCast(heroCast);

    // Set style from wizard
    const styleName = STYLES.find((s) => s.id === allData.style)?.name || allData.style;
    setStyle(styleName);

    // Set length from wizard
    if (allData.length) setLength(allData.length);

    // Build enriched story data for generation — now simplified with storyIdea
    const enrichedStoryData = {
      heroName: allData.heroName,
      heroAge: allData.heroAge,
      storyIdea: allData.storyIdea || "",
      spark: allData.spark,
      storyFormat: allData.format || "classic",
      personalIngredient: allData.secret || null,
      dedication: allData.dedication || null,
      authorName: allData.authorName || "A loving family",
      tone: allData.tone || null,
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
    setStep("modeAndTier");
  }

  if (step === "preview" && result) {
    return <BookReader data={result} cast={cast} styleName={style} onReset={reset} />;
  }

  return (
    <div className="create-page">
      {step === "modeAndTier" && (
        <ModeAndTierSelector
          onSelect={handleModeAndTierSelect}
          onBack={() => navigate("/")}
        />
      )}
      {step === "wizard" && (
        <OnboardingWizard
          mode={mode}
          isGift={isGift}
          tier={tier}
          onComplete={handleWizardComplete}
          onBack={() => setStep("modeAndTier")}
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
