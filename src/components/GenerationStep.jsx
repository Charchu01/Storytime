import { useState, useEffect, useRef } from "react";
import {
  generateStory,
  generateAllImages,
  generateAllPremiumImages,
  generatePageImage,
  generatePremiumPageImage,
  analyzeCharacterPhotos,
  uploadHeroPhoto,
  STYLE_GRADIENTS,
} from "../api/story";
import {
  uploadPhoto,
  zipPhotos,
  trainLora,
  checkTraining,
  saveToVault,
} from "../api/client";
import Paywall from "./Paywall";

const WRITING_PHRASES = [
  "Crafting the perfect adventure...",
  "Adding just the right amount of magic...",
  "Making sure the hero saves the day...",
  "Choosing the most exciting moments...",
  "Sprinkling in some wonder...",
  "Building a world worth exploring...",
];

function TrainingScreen({ childName, progress }) {
  return (
    <div className="gen-screen">
      <div className="gen-emoji train-sparkle">✨</div>
      <div className="gen-headline">Teaching the AI {childName}'s face...</div>
      <div className="train-bar-wrap">
        <div className="train-bar">
          <div className="train-bar-fill" style={{ width: `${Math.min(progress, 95)}%` }} />
        </div>
      </div>
      <div className="gen-sub">This creates perfect face consistency across all pages</div>
      <div className="train-fine">Usually takes 1-3 minutes</div>
    </div>
  );
}

function LoadingScreen({ heroName, loadPhase, pageImages, pageCount, style, error, onRetry }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const gradient = STYLE_GRADIENTS[style] || STYLE_GRADIENTS["Storybook"];
  const completedCount = pageImages.filter((url) => url !== undefined).length;

  useEffect(() => {
    if (loadPhase !== "writing") return;
    const interval = setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % WRITING_PHRASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loadPhase]);

  if (error) {
    return (
      <div className="gen-screen">
        <div style={{ fontSize: 56 }}>😔</div>
        <div className="gen-headline">Something went wrong</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 16, lineHeight: 1.6, maxWidth: 400, textAlign: "center", wordBreak: "break-word" }}>
          {error}
        </div>
        <button className="br-end-btn" onClick={onRetry}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="gen-screen">
      {loadPhase === "photos" && (
        <>
          <div className="gen-emoji">📷</div>
          <div className="gen-headline">Studying {heroName}'s photos...</div>
          <div className="gen-sub">Learning every freckle and curl</div>
        </>
      )}

      {loadPhase === "writing" && (
        <>
          <div className="gen-emoji gen-spin">📖</div>
          <div className="gen-headline">Writing {heroName}'s story...</div>
          <div className="gen-sub gen-phrase-fade" key={phraseIdx}>{WRITING_PHRASES[phraseIdx]}</div>
        </>
      )}

      {loadPhase === "illustrating" && (
        <>
          <div className="gen-emoji">🎨</div>
          <div className="gen-headline">Now illustrating...</div>

          <div className="gen-thumbs">
            {Array.from({ length: pageCount }).map((_, i) => {
              const imageUrl = pageImages[i];
              const hasImage = imageUrl && imageUrl !== "pending";
              return (
                <div key={i} className="gen-thumb-slot">
                  {hasImage ? (
                    <img className="gen-thumb-img gen-thumb-pop" src={imageUrl} alt={`Page ${i + 1}`} />
                  ) : (
                    <div className="gen-thumb-placeholder" style={{ background: gradient }}>
                      <div className="gen-thumb-shimmer" />
                      <span className="gen-thumb-num">{i + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="gen-progress-text">
            {completedCount} of {pageCount} illustrations complete
          </div>
        </>
      )}

      {loadPhase === "finishing" && (
        <>
          <div className="gen-emoji">✨</div>
          <div className="gen-headline">Adding the finishing touches...</div>
        </>
      )}
    </div>
  );
}

export default function GenerationStep({ cast, style, length = 6, tier, storySessionId, vaultChar, wizardData, onNext, onBack }) {
  const hero = cast.find((c) => c.isHero) || cast[0];
  const heroName = wizardData?.heroName || hero?.name || "your hero";

  const [loading, setLoading] = useState(false);
  const [loadPhase, setLoadPhase] = useState("photos");
  const [pageImages, setPageImages] = useState([]);
  const [pageCount, setPageCount] = useState(length);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  // Paywall state
  const [showPaywall, setShowPaywall] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [pendingStory, setPendingStory] = useState(null);
  const [pendingEnrichedCast, setPendingEnrichedCast] = useState(null);
  const [pendingHeroPhotoUrl, setPendingHeroPhotoUrl] = useState(null);

  // LoRA training state
  const loraUrlRef = useRef(vaultChar?.loraUrl || null);
  const triggerWordRef = useRef(vaultChar?.triggerWord || null);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [showTraining, setShowTraining] = useState(false);

  // Auto-start generation on mount
  useEffect(() => {
    if (!started) {
      setStarted(true);
      handleGenerate();
    }
  }, []);

  // ── Premium LoRA training ───────────────────────────────────────────────────
  function startLoraTraining(enrichedCast) {
    return new Promise(async (resolve) => {
      const heroChar = enrichedCast.find((c) => c.isHero) || enrichedCast[0];
      if (!heroChar) { resolve(false); return; }

      if (loraUrlRef.current && triggerWordRef.current) {
        resolve(true);
        return;
      }

      setShowTraining(true);
      setTrainingProgress(0);

      try {
        const photos = heroChar.photos?.filter((p) => p.dataUri) || [];
        const singlePhoto = heroChar.photo && heroChar.photo !== "has_photo" ? [heroChar.photo] : [];
        const photoDataUris = photos.length > 0 ? photos.map((p) => p.dataUri) : singlePhoto;

        if (photoDataUris.length === 0) {
          setShowTraining(false);
          resolve(false);
          return;
        }

        const uploadedUrls = await Promise.all(photoDataUris.map((uri) => uploadPhoto(uri)));
        const zipUrl = await zipPhotos(uploadedUrls);

        const { trainingId, triggerWord: tw } = await trainLora(
          zipUrl,
          heroChar.name,
          storySessionId
        );

        triggerWordRef.current = tw;

        const startTime = Date.now();
        const pollInterval = setInterval(async () => {
          const elapsed = (Date.now() - startTime) / 1000;
          setTrainingProgress(Math.min((elapsed / 120) * 100, 95));

          try {
            const result = await checkTraining(trainingId);
            if (result.status === "succeeded") {
              clearInterval(pollInterval);
              loraUrlRef.current = result.loraUrl;
              setTrainingProgress(100);
              setShowTraining(false);
              resolve(true);
            } else if (result.status === "failed") {
              clearInterval(pollInterval);
              setShowTraining(false);
              resolve(false);
            }
          } catch {
            // Poll error — will retry on next interval
          }
        }, 5000);
      } catch {
        setShowTraining(false);
        resolve(false);
      }
    });
  }

  // ── Main generation flow ────────────────────────────────────────────────────
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPageImages([]);

    try {
      // Phase 1: Analyze character photos
      setLoadPhase("photos");
      const hasPhotos = cast.some((c) => c.photos?.length > 0 || c.photo);
      let enrichedCast = cast;
      if (hasPhotos) {
        enrichedCast = await analyzeCharacterPhotos(cast);
      }

      // For Premium: train LoRA
      let useLoRA = false;
      if (tier === "premium") {
        useLoRA = await startLoraTraining(enrichedCast);
      }

      // Phase 2: Generate story text
      setLoadPhase("writing");
      const story = await generateStory(enrichedCast, style, {
        hero: heroName,
        spark: wizardData?.sparkText || wizardData?.spark,
        loves: wizardData?.loves?.join(", ") || "",
        mood: wizardData?.tone || "cozy",
        pageCount: length,
        storyWorld: wizardData?.storyWorld || null,
        storyTone: wizardData?.storyTone || null,
        storyFormat: wizardData?.storyFormat || "classic",
        storyLesson: wizardData?.storyLesson || null,
        personalIngredient: wizardData?.personalIngredient || null,
        personality: wizardData?.personality || [],
        occasion: wizardData?.occasion || null,
      });

      // Phase 3: Generate page 1 as preview
      setLoadPhase("illustrating");
      setPageCount(story.pages.length);
      setPageImages(new Array(story.pages.length).fill(undefined));

      let heroPhotoUrl = null;
      if (!useLoRA) {
        heroPhotoUrl = await uploadHeroPhoto(enrichedCast);
      }

      const page1 = story.pages[0];
      const sceneDesc = page1.scene_description || page1.imagePrompt || page1.text;
      const mood = page1.mood || "wonder";

      let page1Url;
      if (useLoRA && loraUrlRef.current) {
        page1Url = await generatePremiumPageImage(sceneDesc, enrichedCast, style, loraUrlRef.current, triggerWordRef.current, mood);
      } else {
        page1Url = await generatePageImage(sceneDesc, enrichedCast, style, heroPhotoUrl, mood);
      }

      setPageImages((prev) => {
        const next = [...prev];
        next[0] = page1Url;
        return next;
      });
      setPreviewImageUrl(page1Url);

      setPendingStory(story);
      setPendingEnrichedCast(enrichedCast);
      setPendingHeroPhotoUrl(heroPhotoUrl);

      // Show paywall
      setShowPaywall(true);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  // ── After payment: generate remaining pages ─────────────────────────────────
  async function handlePaymentSuccess() {
    setShowPaywall(false);
    setLoading(true);
    setLoadPhase("illustrating");
    setError(null);

    try {
      const story = pendingStory;
      const enrichedCast = pendingEnrichedCast;

      const remainingPages = story.pages.slice(1);
      const onPageImage = (pageIdx, url) => {
        setPageImages((prev) => {
          const next = [...prev];
          next[pageIdx + 1] = url || null;
          return next;
        });
      };

      let finalResult;
      if (tier === "premium" && loraUrlRef.current && triggerWordRef.current) {
        finalResult = await generateAllPremiumImages(
          remainingPages, enrichedCast, style, loraUrlRef.current, triggerWordRef.current,
          onPageImage, story.coverScene
        );
      } else {
        finalResult = await generateAllImages(
          remainingPages, enrichedCast, style, pendingHeroPhotoUrl,
          onPageImage, story.coverScene
        );
      }

      const allPageImages = [previewImageUrl, ...finalResult.pageImages];

      setLoadPhase("finishing");
      await new Promise((r) => setTimeout(r, 500));

      const pagesWithImages = story.pages.map((page, i) => ({
        ...page,
        imageUrl: allPageImages[i] || null,
      }));

      // Save LoRA to vault for premium
      if (tier === "premium" && loraUrlRef.current && triggerWordRef.current) {
        try {
          const heroChar = enrichedCast.find((c) => c.isHero) || enrichedCast[0];
          await saveToVault({
            name: heroChar.name,
            loraUrl: loraUrlRef.current,
            triggerWord: triggerWordRef.current,
            thumbnailUrl: previewImageUrl,
          });
        } catch {
          // Vault save is non-critical
        }
      }

      onNext({
        story: { ...story, pages: pagesWithImages, coverImageUrl: finalResult.coverImageUrl },
        dedication: wizardData?.dedication || null,
        authorName: wizardData?.authorName || "A loving family",
        style,
        enrichedCast,
        heroPhotoUrl: pendingHeroPhotoUrl,
        tier,
      });
    } catch (err) {
      setError(err.message || "Something went wrong generating the remaining pages.");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (showTraining) {
    return (
      <TrainingScreen
        childName={heroName}
        progress={trainingProgress}
      />
    );
  }

  if (showPaywall) {
    return (
      <Paywall
        tier={tier}
        previewImageUrl={previewImageUrl}
        pageCount={length}
        price={tier === "premium" ? "$19.99" : "$9.99"}
        storySessionId={storySessionId}
        onPaid={handlePaymentSuccess}
      />
    );
  }

  return (
    <LoadingScreen
      heroName={heroName}
      loadPhase={loadPhase}
      pageImages={pageImages}
      pageCount={pageCount}
      style={style}
      error={error}
      onRetry={() => { setError(null); setLoading(false); setStarted(false); }}
    />
  );
}
