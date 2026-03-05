import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CastStep from "../components/CastStep";
import StyleStep from "../components/StyleStep";
import ChatStep from "../components/ChatStep";
import BookReader from "../components/BookReader";
import { useAppContext } from "../App";
import { useToast } from "../App";

const DRAFT_KEY = "sk_draft";

function saveDraft(data) {
  try {
    // Don't save photo data URIs to avoid localStorage quota
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
  const heroName = draft?.cast?.find(c => c.isHero)?.name || draft?.cast?.[0]?.name || "someone special";
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
  const [step, setStep] = useState("cast");
  const [cast, setCast] = useState([]);
  const [style, setStyle] = useState(null);
  const [length, setLength] = useState(6);
  const [result, setResult] = useState(null);
  const [showResume, setShowResume] = useState(false);
  const [occasion, setOccasion] = useState(searchParams.get("occasion") || null);

  useEffect(() => { document.title = "Create Your Story — StoriKids"; }, []);

  // Check for draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.step && draft.step !== "cast") {
      setShowResume(true);
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (step !== "preview" && step !== "cast") {
      saveDraft({ step, cast, style, length, occasion });
    }
  }, [step, cast, style, length, occasion]);

  function handleResume() {
    const draft = loadDraft();
    if (draft) {
      if (draft.cast) setCast(draft.cast);
      if (draft.style) setStyle(draft.style);
      if (draft.length) setLength(draft.length);
      if (draft.occasion) setOccasion(draft.occasion);
      setStep(draft.step || "cast");
    }
    setShowResume(false);
  }

  function handleFresh() {
    clearDraft();
    setShowResume(false);
  }

  function handleStoryComplete(storyResult) {
    setResult(storyResult);
    clearDraft();
    // Save to library
    const id = addStory({
      ...storyResult,
      styleName: style,
      cast,
    });
    setStep("preview");
    // Update URL to book reader
    navigate(`/book/${id}`, { replace: true });
  }

  function reset() {
    clearDraft();
    setCast([]);
    setStyle(null);
    setResult(null);
    setStep("cast");
  }

  // If we navigated to /book/:id, render the book reader
  if (step === "preview" && result) {
    return <BookReader data={result} cast={cast} styleName={style} onReset={reset} />;
  }

  return (
    <div className="create-page">
      {showResume && <ResumeModal draft={loadDraft()} onResume={handleResume} onFresh={handleFresh} />}

      {step === "cast" && (
        <CastStep
          onNext={(characters) => { setCast(characters); setStep("style"); }}
          onBack={() => navigate("/")}
          initialCast={cast}
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
          onNext={handleStoryComplete}
          onBack={() => setStep("style")}
        />
      )}
    </div>
  );
}
