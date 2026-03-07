import { useState, useEffect, useCallback } from "react";
import {
  generateStoryAndVisualPlan,
  generateAllImages,
  analyzeCharacterPhotos,
  uploadHeroPhoto,
  uploadCompanionPhotos,
  STYLE_GRADIENTS,
  imageGenFlags,
} from "../api/story";
import {
  saveToVault,
  logBookToAdmin,
  saveBookToSupabase,
} from "../api/client";

const PHASE_CONFIG = {
  photos: {
    emoji: "📷",
    phrases: [
      "Studying every freckle and curl...",
      "Memorising that smile...",
      "Learning what makes them unique...",
      "Capturing the details...",
    ],
  },
  writing: {
    emoji: "✍️",
    phrases: [
      "Crafting the perfect adventure...",
      "Adding just the right amount of magic...",
      "Making sure the hero saves the day...",
      "Choosing the most exciting moments...",
      "Sprinkling in some wonder...",
      "Building a world worth exploring...",
      "Designing every illustration...",
      "Planning the perfect page layouts...",
    ],
  },
  illustrating: {
    emoji: "🎨",
    phrases: [
      "Mixing the perfect colours...",
      "Painting the scenery...",
      "Bringing characters to life...",
      "Adding tiny details you'll love...",
      "Making the magic visible...",
    ],
  },
  finishing: {
    emoji: "✨",
    phrases: [
      "Binding the pages together...",
      "One last sprinkle of magic...",
    ],
  },
};

const HEADLINE = {
  photos: (name) => `Getting to know ${name}`,
  writing: (name) => `Writing ${name}'s story`,
  illustrating: (name) => `Illustrating every page`,
  finishing: (name) => `Almost there!`,
};

// Fun facts to show while waiting
const FUN_FACTS = [
  "The first children's picture book was published in 1658!",
  "Dr. Seuss wrote 'Green Eggs and Ham' using only 50 words.",
  "The most translated children's book is 'The Little Prince'.",
  "Beatrix Potter self-published 'Peter Rabbit' in 1901.",
  "The average children's book takes 2 years to illustrate by hand.",
  "Maurice Sendak drew 'Where the Wild Things Are' in just 2 months.",
  "Eric Carle painted tissue paper to create his illustrations.",
  "Children who are read to daily hear 1.4 million more words by age 5.",
  "The first pop-up book was created in the 13th century!",
  "Your book is being made with the same care as a real picture book.",
];

function ProgressRing({ progress, size = 120, stroke = 5 }) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (progress / 100) * circ;

  return (
    <svg className="gen-ring" width={size} height={size}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(200,93,42,0.1)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="url(#gen-ring-grad)" strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <defs>
        <linearGradient id="gen-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E07B3C" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Simple mini-game: Tic-tac-toe
function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [status, setStatus] = useState("Your turn! (You're X)");

  const checkWinner = useCallback((squares) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return null;
  }, []);

  // AI move
  const makeAiMove = useCallback((squares) => {
    const empty = squares.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    if (empty.length === 0) return;
    // Simple AI: try to win, then block, then random
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const piece of ["O", "X"]) {
      for (const [a,b,c] of lines) {
        const vals = [squares[a], squares[b], squares[c]];
        if (vals.filter(v => v === piece).length === 2 && vals.includes(null)) {
          const idx = [a,b,c][vals.indexOf(null)];
          return idx;
        }
      }
    }
    if (squares[4] === null) return 4;
    return empty[Math.floor(Math.random() * empty.length)];
  }, []);

  function handleClick(i) {
    if (board[i] || checkWinner(board) || !xIsNext) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);

    const winner = checkWinner(next);
    if (winner) { setStatus("You win! 🎉"); return; }
    if (next.every(Boolean)) { setStatus("It's a draw!"); return; }

    setXIsNext(false);
    setStatus("Thinking...");

    setTimeout(() => {
      const aiIdx = makeAiMove(next);
      if (aiIdx !== undefined) {
        const aiNext = [...next];
        aiNext[aiIdx] = "O";
        setBoard(aiNext);
        const aiWinner = checkWinner(aiNext);
        if (aiWinner) { setStatus("I win! 😄"); }
        else if (aiNext.every(Boolean)) { setStatus("It's a draw!"); }
        else { setStatus("Your turn!"); }
      }
      setXIsNext(true);
    }, 400);
  }

  function resetGame() {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setStatus("Your turn! (You're X)");
  }

  const winner = checkWinner(board);
  const isDraw = !winner && board.every(Boolean);

  return (
    <div className="gen-game">
      <div className="gen-game-title">While you wait... play a game!</div>
      <div className="gen-game-board">
        {board.map((cell, i) => (
          <button
            key={i}
            className={`gen-game-cell${cell ? ` gen-game-${cell.toLowerCase()}` : ""}`}
            onClick={() => handleClick(i)}
          >
            {cell}
          </button>
        ))}
      </div>
      <div className="gen-game-status">{status}</div>
      {(winner || isDraw) && (
        <button className="gen-game-reset" onClick={resetGame}>Play Again</button>
      )}
    </div>
  );
}

function LoadingScreen({ heroName, loadPhase, pageImages, pageCount, style, error, onRetry }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const completedCount = pageImages.filter((url) => url !== undefined).length;
  const config = PHASE_CONFIG[loadPhase] || PHASE_CONFIG.writing;

  // Rotate phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % config.phrases.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [loadPhase, config.phrases.length]);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Rotate fun facts
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIdx((prev) => (prev + 1) % FUN_FACTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const progress =
    loadPhase === "photos" ? 5 :
    loadPhase === "writing" ? 20 :
    loadPhase === "illustrating" ? 20 + Math.round((completedCount / Math.max(pageCount, 1)) * 65) :
    loadPhase === "finishing" ? 95 : 0;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  if (error) {
    return (
      <div className="gen-screen">
        <div className="gen-bg" />
        <div className="gen-content">
          <div className="gen-error-icon">😔</div>
          <h2 className="gen-headline">Something went wrong</h2>
          <p className="gen-error-msg">{error}</p>
          <button className="gen-retry-btn" onClick={onRetry}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gen-screen">
      <div className="gen-bg" />
      <div className="gen-orb gen-orb-1" />
      <div className="gen-orb gen-orb-2" />
      <div className="gen-orb gen-orb-3" />

      <div className="gen-content">
        {/* Progress ring with emoji */}
        <div className="gen-ring-wrap">
          <ProgressRing progress={progress} />
          <span className="gen-ring-emoji">{config.emoji}</span>
        </div>

        <h2 className="gen-headline">{HEADLINE[loadPhase](heroName)}</h2>
        <p className="gen-sub gen-phrase-fade" key={`${loadPhase}-${phraseIdx}`}>
          {config.phrases[phraseIdx]}
        </p>

        {/* Step pills */}
        <div className="gen-steps">
          {["photos", "writing", "illustrating", "finishing"].map((step, i) => {
            const done = ["photos", "writing", "illustrating", "finishing"].indexOf(loadPhase) > i;
            const active = loadPhase === step;
            return (
              <div key={step} className={`gen-step${done ? " gen-step-done" : ""}${active ? " gen-step-active" : ""}`}>
                <span className="gen-step-dot">{done ? "✓" : i + 1}</span>
                <span className="gen-step-label">
                  {step === "photos" ? "Analyze" : step === "writing" ? "Write" : step === "illustrating" ? "Illustrate" : "Finish"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Book pages progress (visual, no actual images shown) */}
        {loadPhase === "illustrating" && pageCount > 0 && (
          <div className="gen-pages-progress">
            {Array.from({ length: pageCount }).map((_, i) => {
              const hasImage = pageImages[i] && pageImages[i] !== "pending";
              const labels = ["Cover", ...Array.from({ length: pageCount - 2 }, (_, j) => `Pg ${j + 1}`), "Back"];
              return (
                <div key={i} className={`gen-page-dot${hasImage ? " gen-page-done" : ""}`}>
                  <span className="gen-page-dot-inner">{hasImage ? "✓" : ""}</span>
                  <span className="gen-page-dot-label">{labels[i]}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Progress bar + time */}
        <div className="gen-bar-wrap">
          <div className="gen-bar">
            <div className="gen-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="gen-bar-meta">
            <span className="gen-bar-pct">{progress}%</span>
            <span className="gen-bar-time">{timeStr}</span>
          </div>
        </div>

        {/* Fun content while waiting */}
        {(loadPhase === "illustrating" || loadPhase === "writing") && elapsed > 15 && (
          <TicTacToe />
        )}

        {/* Fun fact */}
        <div className="gen-fun-fact gen-phrase-fade" key={`fact-${factIdx}`}>
          <span className="gen-fun-fact-icon">💡</span>
          <span>{FUN_FACTS[factIdx]}</span>
        </div>
      </div>
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

  useEffect(() => {
    if (!started) {
      setStarted(true);
      handleGenerate();
    }
  }, [started]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPageImages([]);
    window.__genStartTime = Date.now();

    try {
      setLoadPhase("photos");
      const hasPhotos = cast.some((c) => c.photos?.length > 0 || c.photo);
      let enrichedCast = cast;
      if (hasPhotos) {
        enrichedCast = await analyzeCharacterPhotos(cast);
      }

      let heroPhotoUrl = null;
      let companionPhotoUrls = {};
      if (hasPhotos) {
        heroPhotoUrl = await uploadHeroPhoto(enrichedCast);
        if (!heroPhotoUrl) {
          throw new Error(
            "We couldn't upload the photo. Please check your connection and try again."
          );
        }
        console.log("Hero photo uploaded:", heroPhotoUrl.substring(0, 60));
        companionPhotoUrls = await uploadCompanionPhotos(enrichedCast);
      }

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

      setLoadPhase("illustrating");
      const totalImages = 1 + storyPlan.spreads.length + 1;
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

      const genResult = await generateAllImages(
        storyPlan, heroPhotoUrl, onImageReady, tier, companionPhotoUrls
      );
      const images = genResult.images || genResult; // backward compat
      const permanentImages = genResult.permanentImages || {};
      const tempBookId = genResult.tempBookId || null;
      const totalImageGenerations = genResult.totalImageGenerations || Object.keys(images).length;

      setLoadPhase("finishing");
      await new Promise((r) => setTimeout(r, 500));

      if (tier === "premium" && heroPhotoUrl) {
        try {
          const heroChar = enrichedCast.find((c) => c.isHero) || enrichedCast[0];
          await saveToVault({
            name: heroChar.name,
            photoUrl: heroPhotoUrl,
            thumbnailUrl: images.cover || images[`spread_0`],
          });
        } catch (err) {
          console.warn('VAULT_SAVE_FAILED:', err.message);
        }
      }

      if (imageGenFlags.faceRefLostCount > 0) {
        console.warn(`Face reference lost on ${imageGenFlags.faceRefLostCount} page(s)`);
        imageGenFlags.faceRefLostCount = 0;
      }

      // Save to Supabase — blocking, we need the UUID for navigation
      let supabaseBookId = null;
      try {
        const genDurationMs = Date.now() - (window.__genStartTime || Date.now());
        const clerkId = window.__clerk_user?.id || null;
        const bookMeta = {
          title: storyPlan.title || "Untitled",
          tier,
          style,
          book_type: wizardData?.bookType || "adventure",
          tone: wizardData?.tone || null,
          hero_name: heroName,
          hero_age: wizardData?.heroAge || null,
          hero_type: wizardData?.heroType || "child",
          has_photo: !!heroPhotoUrl,
          character_count: enrichedCast?.length || 1,
          dedication: wizardData?.dedication || storyPlan.dedication || null,
          author_name: wizardData?.authorName || "A loving family",
          story_idea: wizardData?.storyIdea || null,
          total_duration_ms: genDurationMs,
          total_cost: 0.05 + (totalImageGenerations * 0.045),
          story_plan: storyPlan,
          health_status: Object.values(images).every(Boolean) ? "healthy" : Object.values(images).some(Boolean) ? "warnings" : "failed",
        };
        const bookPages = [];
        if (images.cover) {
          bookPages.push({ page_type: "cover", page_index: 0, image_url: permanentImages.cover || images.cover });
        }
        (storyPlan.spreads || []).forEach((spread, i) => {
          bookPages.push({
            page_type: "spread",
            page_index: i + 1,
            left_page_text: spread.leftPageText || null,
            right_page_text: spread.rightPageText || null,
            scene_description: spread.visualDescription || spread.scene || null,
            layout_type: spread.layout || null,
            image_url: permanentImages[`spread_${i}`] || images[`spread_${i}`] || null,
          });
        });
        if (images.backCover) {
          bookPages.push({ page_type: "back_cover", page_index: bookPages.length, image_url: permanentImages.backCover || images.backCover });
        }
        supabaseBookId = await saveBookToSupabase(bookMeta, bookPages, clerkId);

        // Background: if any images were saved with temporary Replicate URLs,
        // wait for permanent saves to finish and update the DB pages
        if (supabaseBookId) {
          const savedWithTempUrls = bookPages.some(p =>
            p.image_url && !p.image_url.includes('supabase')
          );
          if (savedWithTempUrls) {
            // Fire-and-forget: update pages with permanent URLs once saves complete
            Promise.allSettled(genResult.savePromises || []).then(async () => {
              const latestPermanent = genResult.permanentImages || {};
              const updatedPages = bookPages.map(p => {
                let permUrl = null;
                if (p.page_type === 'cover') permUrl = latestPermanent.cover;
                else if (p.page_type === 'back_cover') permUrl = latestPermanent.backCover;
                else if (p.page_type === 'spread') permUrl = latestPermanent[`spread_${p.page_index - 1}`];
                return permUrl ? { ...p, image_url: permUrl } : p;
              });
              // Only re-save if we actually got new permanent URLs
              if (updatedPages.some((p, i) => p.image_url !== bookPages[i].image_url)) {
                saveBookToSupabase({ ...bookMeta }, updatedPages, clerkId, supabaseBookId)
                  .catch(err => console.warn('PERMANENT_URL_SAVE_FAILED:', err.message));
                console.log('PERMANENT_URL_UPDATE: Updated book pages with permanent Supabase URLs');
              }
            }).catch(err => console.warn('PERMANENT_URL_UPDATE_FAILED:', err.message));
          }
        }
      } catch (e) {
        console.warn("Supabase save failed:", e.message);
      }

      // Admin logging: log book to admin dashboard (after Supabase save so we have the ID)
      const genDuration = Date.now() - (window.__genStartTime || Date.now());
      const clerkUser = window.__clerk_user;
      logBookToAdmin({
        supabaseBookId,
        tempBookId,
        bookId: supabaseBookId || `book_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: clerkUser?.id || storySessionId || `anon_${Date.now().toString(36)}`,
        userEmail: clerkUser?.primaryEmailAddress?.emailAddress || null,
        title: storyPlan.title || "Untitled",
        tier,
        style,
        bookType: wizardData?.bookType || "adventure",
        tone: wizardData?.tone || null,
        heroName,
        heroAge: wizardData?.heroAge || null,
        heroType: wizardData?.heroType || "child",
        hasPhoto: !!heroPhotoUrl,
        characterCount: enrichedCast?.length || 1,
        pageCount: (storyPlan.spreads?.length || 0) + 2,
        totalDurationMs: genDuration,
        totalCost: 0.05 + (totalImageGenerations * 0.045),
        status: Object.values(images).every(Boolean) ? "healthy" : Object.values(images).some(Boolean) ? "warnings" : "failed",
        images,
        storyTexts: (storyPlan.spreads || []).map(s => ({ left: s.leftPageText, right: s.rightPageText })),
        dedication: wizardData?.dedication || storyPlan.dedication || null,
      }).catch((err) => console.warn("Admin log failed:", err.message));

      onNext({
        supabaseBookId,
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
