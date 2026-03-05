import { useState, useEffect } from "react";
import {
  generateStoryAndVisualPlan,
  generateAllImages,
  analyzeCharacterPhotos,
  uploadHeroPhoto,
  STYLE_GRADIENTS,
  imageGenFlags,
} from "../api/story";
import {
  saveToVault,
} from "../api/client";

const WRITING_PHRASES = [
  "Crafting the perfect adventure...",
  "Adding just the right amount of magic...",
  "Making sure the hero saves the day...",
  "Choosing the most exciting moments...",
  "Sprinkling in some wonder...",
  "Building a world worth exploring...",
  "Designing every illustration...",
  "Planning the perfect page layouts...",
];

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
        <button className="st-back-btn" onClick={onRetry}>Try Again</button>
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
          <div className="gen-headline">Writing {heroName}'s story and designing every page...</div>
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
              const labels = ["Cover", ...Array.from({ length: pageCount - 2 }, (_, j) => `Spread ${j + 1}`), "Back"];
              return (
                <div key={i} className="gen-thumb-slot">
                  {hasImage ? (
                    <img className="gen-thumb-img gen-thumb-pop" src={imageUrl} alt={labels[i] || `Image ${i + 1}`} />
                  ) : (
                    <div className="gen-thumb-placeholder" style={{ background: gradient }}>
                      <div className="gen-thumb-shimmer" />
                      <span className="gen-thumb-num">{labels[i] || i + 1}</span>
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
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  // Auto-start generation on mount or after retry
  useEffect(() => {
    if (!started) {
      setStarted(true);
      handleGenerate();
    }
  }, [started]);

  // ── Main generation flow ───────────────────────────────────────────────────
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

      // Phase 2: Upload hero photo (one upload, used for all images)
      let heroPhotoUrl = null;
      if (hasPhotos) {
        heroPhotoUrl = await uploadHeroPhoto(enrichedCast);
      }

      // Phase 3: Claude writes story + designs all visual spreads
      setLoadPhase("writing");
      const storyPlan = await generateStoryAndVisualPlan(
        enrichedCast, style, {
          heroName: wizardData?.heroName || heroName,
          heroAge: wizardData?.heroAge || null,
          storyIdea: wizardData?.storyIdea || wizardData?.sparkText || wizardData?.spark || "A magical adventure",
          spark: wizardData?.spark || null,
          pageCount: length,
          storyFormat: wizardData?.storyFormat || "classic",
          personalIngredient: wizardData?.personalIngredient || null,
          tone: wizardData?.tone || null,
        }
      );

      // Phase 4: Generate all images (cover + spreads + back cover)
      setLoadPhase("illustrating");
      const totalImages = 1 + storyPlan.spreads.length + 1; // cover + spreads + back
      setPageCount(totalImages);
      setPageImages(new Array(totalImages).fill(undefined));

      const onImageReady = (key, url) => {
        setPageImages(prev => {
          const next = [...prev];
          if (key === "cover") next[0] = url;
          else if (key === "backCover") next[totalImages - 1] = url;
          else {
            const idx = parseInt(key.split("_")[1]) + 1;
            next[idx] = url;
          }
          return next;
        });
      };

      const images = await generateAllImages(
        storyPlan, heroPhotoUrl, onImageReady, tier
      );

      // Phase 5: Assemble final result
      setLoadPhase("finishing");
      await new Promise((r) => setTimeout(r, 500));

      // Save photo to vault for premium
      if (tier === "premium" && heroPhotoUrl) {
        try {
          const heroChar = enrichedCast.find((c) => c.isHero) || enrichedCast[0];
          await saveToVault({
            name: heroChar.name,
            photoUrl: heroPhotoUrl,
            thumbnailUrl: images.cover || images[`spread_0`],
          });
        } catch {
          // Vault save is non-critical
        }
      }

      // Notify if face reference was lost on some pages
      if (imageGenFlags.faceRefLostCount > 0) {
        console.warn(`Face reference lost on ${imageGenFlags.faceRefLostCount} page(s)`);
        imageGenFlags.faceRefLostCount = 0;
      }

      onNext({
        story: storyPlan,
        images,
        dedication: wizardData?.dedication || storyPlan.dedication || null,
        authorName: wizardData?.authorName || "A loving family",
        style,
        enrichedCast,
        heroPhotoUrl,
        tier,
      });
    } catch (err) {
      console.error("Generation error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
