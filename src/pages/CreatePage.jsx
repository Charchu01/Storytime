import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation, Outlet } from "react-router-dom";
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

// ── Wizard context shared across all /create/* routes ──────────────────────
const CreateWizardContext = createContext();
export function useCreateWizard() { return useContext(CreateWizardContext); }

// ── Progress bar steps ──────────────────────────────────────────────────────
const STEPS = [
  { path: "/create", label: "Book Type" },
  { path: "/create/hero", label: "Hero" },
  { path: "/create/style", label: "Style" },
  { path: "/create/studio", label: "Story" },
  { path: "/create/checkout", label: "Checkout" },
];

const STEP_SUBTITLES = [
  "What shall we make?",
  "Who's the star?",
  "Choose the look",
  "Build your story",
  "Almost there!",
];

function ProgressBar({ currentPath }) {
  const currentIdx = STEPS.findIndex(s =>
    currentPath === s.path || currentPath === s.path + "/"
  );
  const activeStep = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="create-progress">
      <div className="create-progress-bar">
        {STEPS.map((step, i) => (
          <div key={i} className="create-progress-step">
            {i > 0 && (
              <div className={`create-progress-line${i <= activeStep ? " create-progress-line--done" : ""}`} />
            )}
            <div className={`create-progress-circle${
              i < activeStep ? " create-progress-circle--done" :
              i === activeStep ? " create-progress-circle--active" : ""
            }`}>
              {i < activeStep ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span className={`create-progress-label${i === activeStep ? " create-progress-label--active" : ""}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <div className="create-progress-mobile-label">
        Step {activeStep + 1} of {STEPS.length} — {STEP_SUBTITLES[activeStep]}
      </div>
    </div>
  );
}

export default function CreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [bookType, setBookType] = useState(null);
  const [heroData, setHeroData] = useState(null);
  const [artStyle, setArtStyle] = useState(null);
  const [wizardData, setWizardData] = useState(null);
  const [tier, setTier] = useState(null);
  const [cast, setCast] = useState([]);
  const [style, setStyle] = useState(null);
  const [length, setLength] = useState(6);
  const [storySessionId] = useState(() => Date.now().toString(36) + Math.random().toString(36).slice(2));
  const [vaultChar, setVaultChar] = useState(null);

  // Check for vault character from Family Vault
  useEffect(() => {
    if (searchParams.get("vaultChar")) {
      try {
        const stored = JSON.parse(sessionStorage.getItem("sk_vault_char"));
        if (stored) {
          setVaultChar(stored);
          sessionStorage.removeItem("sk_vault_char");
          setBookType(BOOK_TYPES[0]);
          setHeroData({
            heroName: stored.name,
            heroType: "child",
            heroAge: "",
            heroPhoto: stored.photoUrl || null,
            companions: [],
          });
          navigate("/create/style", { replace: true });
        }
      } catch {}
    }
  }, []);

  useEffect(() => { document.title = "Create Your Story — Storytime"; }, []);

  // ── Step handlers (navigate instead of setStep) ──────────────────────────

  const handleBookTypeSelect = useCallback((type) => {
    setBookType(type);
    navigate("/create/hero");
  }, [navigate]);

  const handleHeroComplete = useCallback((data) => {
    setHeroData(data);
    navigate("/create/style");
  }, [navigate]);

  const handleStyleSelect = useCallback((styleData) => {
    setArtStyle(styleData);
    navigate("/create/studio");
  }, [navigate]);

  const handleStudioComplete = useCallback((studioData) => {
    // Build cast from heroData
    const heroPhotos = heroData.heroPhoto
      ? [{ dataUri: heroData.heroPhoto, quality: "fair", feedback: "" }]
      : [];

    const heroCast = [];
    if (heroData.heroName) {
      heroCast.push({
        id: Date.now(),
        name: heroData.heroName,
        role: heroData.heroType || "child",
        age: heroData.heroAge || "",
        isHero: true,
        emoji: heroData.heroType === "pet" ? "🐾" : heroData.heroType === "adult" ? "🧑" : "🧒",
        photo: heroData.heroPhoto || null,
        photos: heroPhotos,
        primaryPhotoIndex: 0,
      });
    }

    if (heroData.companions?.length > 0) {
      heroCast.push(...heroData.companions.map((c) => ({
        id: Date.now() + Math.random(),
        name: c.name,
        role: c.relationship || "friend",
        emoji: c.relationship === "pet" ? "🐾" : "🤝",
        isHero: false,
        photo: c.photo || null,
        photos: c.photo ? [{ dataUri: c.photo, quality: "fair", feedback: "" }] : [],
      })));
    }

    setCast(heroCast);

    const selectedStyle = artStyle?.style;
    const styleName = selectedStyle?.name || "Classic Storybook";
    setStyle(styleName);

    const pageCount = bookType?.pageCount?.standard || 6;
    setLength(pageCount);

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
    navigate("/create/checkout");
  }, [heroData, artStyle, bookType, navigate]);

  const handlePaid = useCallback((selectedTier) => {
    setTier(selectedTier);

    const newLength = selectedTier === "premium"
      ? (bookType?.pageCount?.premium || 10)
      : (bookType?.pageCount?.standard || 6);
    setLength(newLength);

    setWizardData((prev) => prev ? { ...prev, pageCount: newLength } : prev);
    navigate("/create/generating");
  }, [bookType, navigate]);

  const handleStoryComplete = useCallback((storyResult) => {
    clearDraft();
    // storyResult.supabaseBookId is the UUID from Supabase
    const bookId = storyResult.supabaseBookId;
    if (bookId) {
      navigate(`/book/${bookId}`, { replace: true });
    } else {
      // Fallback: use a local ID if Supabase save failed
      const fallbackId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      navigate(`/book/${fallbackId}`, { replace: true, state: { storyData: { ...storyResult, id: fallbackId } } });
    }
  }, [navigate]);

  const reset = useCallback(() => {
    clearDraft();
    setBookType(null);
    setHeroData(null);
    setArtStyle(null);
    setWizardData(null);
    setTier(null);
    setCast([]);
    setStyle(null);
    navigate("/create");
  }, [navigate]);

  // ── Route guard: redirect to earliest incomplete step ────────────────────
  useEffect(() => {
    const path = location.pathname;
    if (path === "/create" || path === "/create/") return;
    if (path === "/create/hero" && !bookType) { navigate("/create", { replace: true }); return; }
    if (path === "/create/style" && !heroData) { navigate("/create", { replace: true }); return; }
    if (path === "/create/studio" && !artStyle) { navigate("/create", { replace: true }); return; }
    if (path === "/create/checkout" && !wizardData) { navigate("/create", { replace: true }); return; }
    if (path === "/create/generating" && !tier) { navigate("/create/checkout", { replace: true }); return; }
  }, [location.pathname, bookType, heroData, artStyle, wizardData, tier, navigate]);

  const ctx = {
    bookType, heroData, artStyle, wizardData, tier, cast, style, length,
    storySessionId, vaultChar,
    handleBookTypeSelect, handleHeroComplete, handleStyleSelect,
    handleStudioComplete, handlePaid, handleStoryComplete, reset,
  };

  // Don't show progress bar on generating step
  const showProgress = !location.pathname.includes("/generating");

  return (
    <CreateWizardContext.Provider value={ctx}>
      <div className="create-page">
        <div className="create-magic-bg" aria-hidden="true">
          <div className="create-magic-dots" />
        </div>
        {showProgress && <ProgressBar currentPath={location.pathname} />}
        <Outlet />
      </div>
    </CreateWizardContext.Provider>
  );
}
