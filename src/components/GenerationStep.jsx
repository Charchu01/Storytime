import { useState, useEffect } from "react";
import {
  generateStory,
  generateAllImages,
  generatePageImage,
  analyzeCharacterPhotos,
  uploadHeroPhoto,
  STYLE_GRADIENTS,
  imageGenFlags,
} from "../api/story";
import {
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

  // Auto-start generation on mount or after retry
  useEffect(() => {
    if (!started) {
      setStarted(true);
      handleGenerate();
    }
  }, [started]);

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

      // Phase 2: Upload hero photo (one upload, used for all pages)
      let heroPhotoUrl = null;
      if (hasPhotos) {
        heroPhotoUrl = await uploadHeroPhoto(enrichedCast);
      }

      // Phase 3: Generate story text
      setLoadPhase("writing");
      const story = await generateStory(enrichedCast, style, {
        heroName: wizardData?.heroName || heroName,
        heroAge: wizardData?.heroAge || null,
        storyIdea: wizardData?.storyIdea || wizardData?.sparkText || wizardData?.spark || "A magical adventure",
        spark: wizardData?.spark || null,
        pageCount: length,
        storyFormat: wizardData?.storyFormat || "classic",
        personalIngredient: wizardData?.personalIngredient || null,
        tone: wizardData?.tone || null,
      });

      // Phase 4: Generate page 1 as preview
      setLoadPhase("illustrating");
      setPageCount(story.pages.length);
      setPageImages(new Array(story.pages.length).fill(undefined));

      const page1 = story.pages[0];
      const sceneDesc = page1.scene_description || page1.imagePrompt || page1.text;
      const mood = page1.mood || "wonder";

      const page1Url = await generatePageImage(
        sceneDesc, enrichedCast, style, heroPhotoUrl,
        mood, null, null, tier
      );

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
      console.error("Generation error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
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

      // Same flow for Standard AND Premium — tier controls which
      // Kontext model is used on the server side
      const finalResult = await generateAllImages(
        remainingPages, enrichedCast, style, pendingHeroPhotoUrl,
        onPageImage, story.coverScene, null, null, tier
      );

      const allPageImages = [previewImageUrl, ...finalResult.pageImages];

      setLoadPhase("finishing");
      await new Promise((r) => setTimeout(r, 500));

      const pagesWithImages = story.pages.map((page, i) => ({
        ...page,
        imageUrl: allPageImages[i] || null,
      }));

      // Save photo to vault for premium
      if (tier === "premium" && pendingHeroPhotoUrl) {
        try {
          const heroChar = enrichedCast.find((c) => c.isHero) || enrichedCast[0];
          await saveToVault({
            name: heroChar.name,
            photoUrl: pendingHeroPhotoUrl,
            thumbnailUrl: previewImageUrl,
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
        story: { ...story, pages: pagesWithImages, coverImageUrl: finalResult.coverImageUrl },
        dedication: wizardData?.dedication || null,
        authorName: wizardData?.authorName || "A loving family",
        style,
        enrichedCast,
        heroPhotoUrl: pendingHeroPhotoUrl,
        tier,
      });
    } catch (err) {
      console.error("Post-payment generation error:", err);
      setError(err.message || "Something went wrong generating the remaining pages.");
      setLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
