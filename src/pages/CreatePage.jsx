import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BookTypePicker from "../components/BookTypePicker";
import HeroSetup from "../components/HeroSetup";
import StylePicker from "../components/StylePicker";
import StoryStudio from "../components/StoryStudio";
import Paywall from "../components/Paywall";
import GenerationStep from "../components/GenerationStep";
import { useAppContext } from "../App";
import { STYLES, BOOK_TYPES } from "../constants/data";

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

  // Flow: bookType → hero → style → studio → payment → generate
  const [step, setStep] = useState("bookType");
  const [bookType, setBookType] = useState(null);
  const [heroData, setHeroData] = useState(null);
  const [artStyle, setArtStyle] = useState(null);
  const [wizardData, setWizardData] = useState(null);
  const [tier, setTier] = useState(null);
  const [cast, setCast] = useState([]);
  const [style, setStyle] = useState(null);
  const [length, setLength] = useState(6);
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
          // Pre-fill hero data and jump to style selection
          setBookType(BOOK_TYPES[0]); // default to adventure
          setHeroData({
            heroName: stored.name,
            heroType: "child",
            heroAge: "",
            heroPhoto: stored.photoUrl || null,
            companions: [],
          });
          setStep("style");
        }
      } catch {}
    }
  }, []);

  useEffect(() => { document.title = "Create Your Story — Storytime"; }, []);

  // Screen 1: Book type selected
  function handleBookTypeSelect(type) {
    setBookType(type);
    setStep("hero");
  }

  // Screen 2: Hero setup complete
  function handleHeroComplete(data) {
    setHeroData(data);
    setStep("style");
  }

  // Screen 3: Style + tone selected
  function handleStyleSelect(styleData) {
    setArtStyle(styleData);
    setStep("studio");
  }

  // Screen 4: Studio (chat) complete — has story details
  function handleStudioComplete(studioData) {
    // Build cast from heroData
    const heroPhotos = heroData.heroPhoto
      ? [{ dataUri: heroData.heroPhoto, quality: "fair", feedback: "" }]
      : [];

    const heroCast = [];
    if (heroData.heroName) {
      heroCast.push({
        id: Date.now(),
        name: heroData.heroName,
        role: heroData.heroType === "pet" ? "pet" : "child",
        age: heroData.heroAge || "",
        isHero: true,
        emoji: heroData.heroType === "pet" ? "🐾" : "🧒",
        photo: heroData.heroPhoto || null,
        photos: heroPhotos,
        primaryPhotoIndex: 0,
      });
    }

    // Add companions
    if (heroData.companions?.length > 0) {
      heroCast.push(...heroData.companions.map((c) => ({
        id: Date.now() + Math.random(),
        name: c.name,
        role: c.relationship || "friend",
        emoji: c.relationship === "pet" ? "🐾" : "🤝",
        isHero: false,
      })));
    }

    setCast(heroCast);

    // Resolve art style name
    const selectedStyle = artStyle?.style;
    const styleName = selectedStyle?.name || "Classic Storybook";
    setStyle(styleName);

    // Determine page count from book type
    const pageCount = bookType?.pageCount?.standard || 6;
    setLength(pageCount);

    // Build enriched wizard data for generation
    const enrichedData = {
      heroName: heroData.heroName,
      heroAge: heroData.heroAge,
      heroType: heroData.heroType || "child",
      storyIdea: studioData.storyIdea || "",
      spark: "custom",
      storyFormat: bookType?.id === "nursery_rhyme" ? "rhyming" :
                   bookType?.id === "superhero" ? "classic" : "classic",
      personalIngredient: studioData.personalIngredient || studioData.details || null,
      dedication: studioData.dedication || null,
      authorName: studioData.authorName || "A loving family",
      tone: artStyle?.tone?.label || studioData.tone || null,
      details: studioData.details || null,
      bookType: bookType?.id || "adventure",
      bookTypeFormat: bookType?.claudeFormat || "",
      world: studioData.world || null,
      theme: studioData.theme || null,
      occasion: studioData.occasion || null,
      language: studioData.language || "en",
      pageCount,
    };

    setWizardData(enrichedData);
    setStep("payment");
  }

  // Screen 5: Payment complete
  function handlePaid(selectedTier) {
    setTier(selectedTier);

    // Update length based on tier
    const newLength = selectedTier === "premium"
      ? (bookType?.pageCount?.premium || 10)
      : (bookType?.pageCount?.standard || 6);
    setLength(newLength);

    // Update wizardData with correct page count
    setWizardData((prev) => prev ? { ...prev, pageCount: newLength } : prev);

    setStep("generate");
  }

  function handleStoryComplete(storyResult) {
    clearDraft();
    // Strip base64 photo data from cast before saving
    const lightCast = cast.map(({ photo, photos, ...rest }) => ({
      ...rest,
      photo: null,
      photos: (photos || []).map(({ dataUri, ...p }) => ({ ...p, dataUri: null })),
    }));
    const storyEntry = {
      ...storyResult,
      styleName: style,
      cast: lightCast,
      tier,
      mode: heroData?.heroType || "child",
      bookType: bookType?.id,
    };
    const id = addStory(storyEntry);
    navigate(`/book/${id}`, { replace: true });
  }

  function reset() {
    clearDraft();
    setBookType(null);
    setHeroData(null);
    setArtStyle(null);
    setWizardData(null);
    setTier(null);
    setCast([]);
    setStyle(null);
    setStep("bookType");
  }

  return (
    <div className="create-page">
      {step === "bookType" && (
        <BookTypePicker
          onSelect={handleBookTypeSelect}
          onBack={() => navigate("/")}
        />
      )}
      {step === "hero" && (
        <HeroSetup
          bookType={bookType}
          onComplete={handleHeroComplete}
          onBack={() => setStep("bookType")}
        />
      )}
      {step === "style" && (
        <StylePicker
          onSelect={handleStyleSelect}
          onBack={() => setStep("hero")}
        />
      )}
      {step === "studio" && (
        <StoryStudio
          bookType={bookType}
          heroData={heroData}
          artStyle={artStyle}
          onComplete={handleStudioComplete}
          onBack={() => setStep("style")}
        />
      )}
      {step === "payment" && (
        <Paywall
          bookType={bookType}
          artStyle={artStyle}
          heroData={heroData}
          wizardData={wizardData}
          onPaid={handlePaid}
          storySessionId={storySessionId}
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
          onBack={() => setStep("studio")}
        />
      )}
    </div>
  );
}
