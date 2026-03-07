import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../App";
import EditDrawer from "./EditDrawer";
import BookRating from "./BookRating";
import { editPageText, generatePageImage } from "../api/story";

function isGeneratedImage(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http") || url.startsWith("blob:");
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BookReader({ data, cast, styleName, onReset }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const story = data.story || data;
  const images = data.images || {};
  const spreads = story.spreads || [];
  const pages = story.pages || [];
  const dedication = data.dedication || story.dedication || null;
  const coverImageUrl = images.cover || story.coverImageUrl || null;
  const backCoverImageUrl = images.backCover || null;
  const heroName = cast.find((c) => c.isHero)?.name || cast[0]?.name || data.hero_name || story.heroName || "your little one";
  const authorName = data.authorName || "A loving family";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);
  const [activeEdit, setActiveEdit] = useState(null);
  const [localSpreads, setLocalSpreads] = useState(spreads);
  const [localPages, setLocalPages] = useState(pages);
  const [regeneratingImage, setRegeneratingImage] = useState(null);
  const [narrating, setNarrating] = useState(false);
  const [autoNarrate, setAutoNarrate] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingDismissed, setRatingDismissed] = useState(false);
  const [brokenImages, setBrokenImages] = useState(new Set());
  const narrationAudio = useRef(null);
  const narrationCache = useRef({});
  const touchStartX = useRef(null);
  const autoNarrateRef = useRef(false);

  // Build flat page array
  const flatPages = useMemo(() => {
    const result = [];

    // Cover (title overlaid in UI — no text baked into image)
    result.push({ type: "cover", imageUrl: coverImageUrl });

    // Content pages — support both spreads and flat pages format
    if (localSpreads.length > 0) {
      localSpreads.forEach((spread, i) => {
        const imageUrl = spread._overrideImageUrl || images[`spread_${i}`] || null;
        const text = [spread.leftPageText, spread.rightPageText].filter(Boolean).join(" ");
        result.push({
          type: "spread",
          imageUrl,
          text,
          pageNum: i + 1,
          spreadIndex: i,
        });
      });
    } else if (localPages.length > 0) {
      localPages.forEach((page, i) => {
        const imageUrl = page._overrideImageUrl || images[`page_${i}`] || images[`spread_${i}`] || null;
        result.push({
          type: "page",
          imageUrl,
          text: page.text || "",
          pageNum: i + 1,
          pageIndex: i,
          emoji: page.scene_emoji || page.sceneEmoji || null,
        });
      });
    }

    // Back cover (author + dedication overlaid in UI)
    result.push({ type: "back-cover", imageUrl: backCoverImageUrl });

    return result;
  }, [localSpreads, localPages, images, coverImageUrl, backCoverImageUrl]);

  // Navigation
  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= flatPages.length) return;
    setCurrentIndex(idx);
    setFadeKey((k) => k + 1);
    setActiveEdit(null);
  }, [flatPages.length]);

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  // Keyboard nav
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  // Touch swipe
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 50) return;
    if (diff < 0) goNext();
    else goPrev();
  }

  // ── Edit handlers ──────────────────────────────────────────────────────────
  async function handleEditSave(contentIndex, instruction, type) {
    const current = flatPages[contentIndex];
    if (type === "story") {
      if (current.type === "spread") {
        const spread = localSpreads[current.spreadIndex];
        const fullText = `${spread.leftPageText} ${spread.rightPageText}`;
        const newText = await editPageText(fullText, instruction, cast);
        const sentences = newText.match(/[^.!?]+[.!?]+/g) || [newText];
        const mid = Math.ceil(sentences.length / 2);
        const leftText = sentences.slice(0, mid).join("").trim();
        const rightText = sentences.slice(mid).join("").trim() || leftText;
        setLocalSpreads((prev) => prev.map((s, i) =>
          i === current.spreadIndex ? { ...s, leftPageText: leftText, rightPageText: rightText } : s
        ));
      } else if (current.type === "page") {
        const newText = await editPageText(current.text, instruction, cast);
        setLocalPages((prev) => prev.map((p, i) =>
          i === current.pageIndex ? { ...p, text: newText } : p
        ));
      }
    } else {
      const idx = current.spreadIndex ?? current.pageIndex;
      setRegeneratingImage(idx);
      try {
        const sceneDesc = current.text;
        const newUrl = await generatePageImage(
          `${sceneDesc}. ${instruction}`,
          cast, styleName, data.heroPhotoUrl, "wonder"
        );
        if (current.type === "spread") {
          setLocalSpreads((prev) => prev.map((s, i) =>
            i === current.spreadIndex ? { ...s, _overrideImageUrl: newUrl } : s
          ));
        } else {
          setLocalPages((prev) => prev.map((p, i) =>
            i === current.pageIndex ? { ...p, _overrideImageUrl: newUrl } : p
          ));
        }
      } catch { addToast("Failed to regenerate image", "error"); }
      setRegeneratingImage(null);
    }
    setActiveEdit(null);
  }

  // Keep ref in sync with state
  useEffect(() => { autoNarrateRef.current = autoNarrate; }, [autoNarrate]);

  // ── Narration ──────────────────────────────────────────────────────────────
  const VOICE_ID = "o5yhdpwO4YUK0MmUtJv5";

  async function narratePage(pageIdx) {
    const page = flatPages[pageIdx];
    if (!page?.text) return;

    const cacheKey = `page_${pageIdx}`;
    try {
      let audioUrl = narrationCache.current[cacheKey];
      if (!audioUrl) {
        setNarrating(true);
        const resp = await fetch("/api/narrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: page.text, voiceId: VOICE_ID }),
        });
        if (!resp.ok) throw new Error("Narration failed");
        const blob = await resp.blob();
        audioUrl = URL.createObjectURL(blob);
        narrationCache.current[cacheKey] = audioUrl;
      }
      const audio = new Audio(audioUrl);
      narrationAudio.current = audio;
      setNarrating(true);
      audio.addEventListener("ended", () => {
        setNarrating(false);
        if (autoNarrateRef.current) {
          setTimeout(() => goNext(), 1200);
        }
      });
      audio.play().catch(() => {
        setNarrating(false);
        addToast("Audio unavailable — try again later", "info");
      });
    } catch {
      setNarrating(false);
      addToast("Audio unavailable — try again later", "info");
    }
  }

  function toggleAutoNarrate() {
    if (autoNarrate) {
      // Turn off — stop current audio too
      narrationAudio.current?.pause();
      setNarrating(false);
      setAutoNarrate(false);
      addToast("Narration off", "info", 1500);
    } else {
      setAutoNarrate(true);
      addToast("Narration on — pages will be read aloud", "magic", 2000);
      // Start narrating current page immediately
      const current = flatPages[currentIndex];
      if (current?.text) narratePage(currentIndex);
    }
  }

  // Auto-narrate on page change
  useEffect(() => {
    if (autoNarrateRef.current) {
      const current = flatPages[currentIndex];
      if (current?.text) {
        narratePage(currentIndex);
      }
    }
    return () => {
      const audio = narrationAudio.current;
      if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); narrationAudio.current = null; }
      setNarrating(false);
    };
  }, [currentIndex]);

  // Revoke cached object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(narrationCache.current).forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });
      narrationCache.current = {};
    };
  }, []);

  // ── Share ──────────────────────────────────────────────────────────────────
  function handleShare() {
    try {
      const shareData = {
        story: { title: story.title, spreads: localSpreads, pages: localPages },
        images,
        styleName,
        heroName,
        dedication,
        authorName,
      };
      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      const url = `${window.location.origin}/shared?d=${encoded}`;
      if (navigator.share) {
        navigator.share({ title: `${heroName}'s Story`, text: `Check out this story made for ${heroName}!`, url });
      } else {
        navigator.clipboard.writeText(url);
        addToast("Link copied! Send it to grandma", "magic");
      }
    } catch { addToast("Failed to share", "error"); }
  }

  // ── Download PDF ──────────────────────────────────────────────────────────
  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    addToast("Preparing your PDF...", "info", 3000);
    try {
      const { jsPDF } = await import("jspdf");
      // Cover and back cover are portrait (2:3), interior spreads are landscape (4:3)
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });

      for (let i = 0; i < flatPages.length; i++) {
        const pg = flatPages[i];
        if (pg.type === "cover" || pg.type === "back-cover") {
          if (i > 0) pdf.addPage("a5", "portrait");
        } else {
          if (i > 0) pdf.addPage("a5", "landscape");
        }
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();

        // Try to load image
        if (pg.imageUrl && isGeneratedImage(pg.imageUrl)) {
          try {
            const resp = await fetch(pg.imageUrl);
            if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
            const blob = await resp.blob();
            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            pdf.addImage(dataUrl, "JPEG", 0, 0, pageW, pageH);
          } catch {
            pdf.setFillColor(254, 247, 237);
            pdf.rect(0, 0, pageW, pageH, "F");
          }
        } else {
          pdf.setFillColor(254, 247, 237);
          pdf.rect(0, 0, pageW, pageH, "F");
        }

        // Overlay text only for cover and back cover — spread images already have text baked in
        if (pg.type === "cover") {
          pdf.setFontSize(24);
          pdf.setTextColor(255, 255, 255);
          pdf.text(story.title || "", pageW / 2, pageH - 30, { align: "center", maxWidth: pageW - 20 });
          pdf.setFontSize(12);
          pdf.text(`A story for ${heroName}`, pageW / 2, pageH - 18, { align: "center" });
        } else if (pg.type === "back-cover") {
          pdf.setFontSize(18);
          pdf.setTextColor(255, 255, 255);
          pdf.text("The End", pageW / 2, pageH / 2 - 10, { align: "center" });
          if (dedication) {
            pdf.setFontSize(10);
            pdf.text(`"${dedication}"`, pageW / 2, pageH / 2 + 5, { align: "center", maxWidth: pageW - 30 });
          }
          pdf.setFontSize(9);
          pdf.text(`Written by ${authorName}`, pageW / 2, pageH - 15, { align: "center" });
        }
        // No text overlay for spreads/pages — the AI-generated images already contain text boxes
      }

      const filename = `${(story.title || "Storytime").replace(/[^a-zA-Z0-9 ]/g, "").trim()}.pdf`;
      pdf.save(filename);
      addToast("PDF downloaded!", "magic");
    } catch (err) {
      console.error("PDF error:", err);
      addToast("Failed to generate PDF", "error");
    }
    setDownloadingPdf(false);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Page-by-Page Viewer
  // ═══════════════════════════════════════════════════════════════════════════
  const current = flatPages[currentIndex] || flatPages[0] || { type: "cover", imageUrl: null };
  const canEdit = current?.type === "spread" || current?.type === "page";

  return (
    <div
      className="br-scene"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="br-ambient" />

      {/* Premium floating toolbar */}
      <div className="br-toolbar">
        <a className="br-toolbar-back" onClick={() => navigate("/library")}>
          &larr; Library
        </a>
        <div className="br-toolbar-actions">
          <button
            className={`br-toolbar-icon${autoNarrate ? " br-toolbar-icon--narrate-on" : ""}`}
            onClick={toggleAutoNarrate}
            title={autoNarrate ? "Turn off narration" : "Read aloud"}
          >
            <span className="br-toolbar-icon-emoji">{autoNarrate ? "\uD83D\uDD0A" : "\uD83D\uDD07"}</span>
            {narrating && (
              <span className="br-narrate-wave">
                <span /><span /><span />
              </span>
            )}
          </button>
          <button className="br-toolbar-icon" onClick={handleShare} title="Share">
            <span className="br-toolbar-icon-emoji">{"\uD83D\uDD17"}</span>
          </button>
          <button className="br-toolbar-icon" onClick={handleDownloadPdf} disabled={downloadingPdf} title="Download PDF">
            <span className="br-toolbar-icon-emoji">{downloadingPdf ? "\u23F3" : "\uD83D\uDCC4"}</span>
          </button>
          <button className="br-toolbar-icon" onClick={onReset} title="New story">
            <span className="br-toolbar-icon-emoji">{"\u2728"}</span>
          </button>
        </div>
      </div>

      {/* Main content area: [prev] [book] [next] */}
      <div className="br-stage">
        {/* Previous arrow */}
        <div className="br-nav-slot br-nav-slot--left">
          {currentIndex > 0 && (
            <button className="br-nav br-nav-prev" onClick={goPrev} aria-label="Previous page">&lsaquo;</button>
          )}
        </div>

        {/* Page display */}
        <div className={`br-page-display ${current.type === "spread" || current.type === "page" ? "br-landscape" : "br-portrait"}`} key={fadeKey}>
          {current.type === "cover" && (
            <div className="br-page-content br-page-cover">
              {current.imageUrl && !brokenImages.has(current.imageUrl) ? (
                <img src={current.imageUrl} className="br-page-image" alt={story.title}
                  onError={() => setBrokenImages(prev => new Set(prev).add(current.imageUrl))} />
              ) : (
                <div className="br-cover-fallback">
                  <h1 className="br-cover-title">{story.title}</h1>
                  <div className="br-cover-line" />
                  <p className="br-cover-for">A story for {heroName}</p>
                  <p className="br-cover-author">By {authorName}</p>
                </div>
              )}
            </div>
          )}

          {current.type === "spread" && (
            <div className="br-page-content br-page-spread">
              {regeneratingImage === current.spreadIndex ? (
                <div className="br-page-loading">
                  <span className="br-page-loading-emoji">{"\uD83C\uDFA8"}</span>
                  <span>Regenerating...</span>
                </div>
              ) : current.imageUrl && isGeneratedImage(current.imageUrl) && !brokenImages.has(current.imageUrl) ? (
                <img src={current.imageUrl} className="br-page-image" alt=""
                  onError={() => setBrokenImages(prev => new Set(prev).add(current.imageUrl))} />
              ) : current.text ? (
                <div className="br-page-text-fallback" style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', borderRadius: 12 }}>
                  <p style={{ fontSize: 20, fontFamily: 'Nunito', fontWeight: 700, color: '#92400E', textAlign: 'center', lineHeight: 1.6 }}>{current.text}</p>
                </div>
              ) : null}
            </div>
          )}

          {current.type === "page" && (
            <div className="br-page-content br-page-single">
              {regeneratingImage === current.pageIndex ? (
                <div className="br-page-loading">
                  <span className="br-page-loading-emoji">{"\uD83C\uDFA8"}</span>
                  <span>Regenerating...</span>
                </div>
              ) : current.imageUrl && isGeneratedImage(current.imageUrl) && !brokenImages.has(current.imageUrl) ? (
                <img src={current.imageUrl} className="br-page-image" alt=""
                  onError={() => setBrokenImages(prev => new Set(prev).add(current.imageUrl))} />
              ) : current.emoji ? (
                <div className="br-page-emoji">{current.emoji}</div>
              ) : null}
            </div>
          )}

          {current.type === "back-cover" && (
            <div className="br-page-content br-page-back">
              {current.imageUrl && !brokenImages.has(current.imageUrl) ? (
                <img src={current.imageUrl} className="br-page-image" alt="Back cover"
                  onError={() => setBrokenImages(prev => new Set(prev).add(current.imageUrl))} />
              ) : (
                <div className="br-back-fallback">
                  <h2 className="br-back-title">The End</h2>
                  <div className="br-back-line" />
                  {dedication && dedication.trim().length > 3 && (
                    <p className="br-back-ded-text">&ldquo;{dedication}&rdquo;</p>
                  )}
                  <p className="br-back-author-text">Written by {authorName}</p>
                  <p className="br-back-sub">A Storytime Original</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next arrow */}
        <div className="br-nav-slot br-nav-slot--right">
          {currentIndex < flatPages.length - 1 && (
            <button className="br-nav br-nav-next" onClick={goNext} aria-label="Next page">&rsaquo;</button>
          )}
        </div>
      </div>

      {/* Back cover actions — below the book image */}
      {current.type === "back-cover" && (
        <div className="br-back-actions">
          <button className="br-back-btn" onClick={handleShare}>{"\uD83D\uDD17"} Share</button>
          <button className="br-back-btn" onClick={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? "\u23F3 Saving..." : "\uD83D\uDCC4 Download PDF"}
          </button>
          <button className="br-back-btn br-back-btn--primary" onClick={onReset}>{"\u2728"} New Story</button>
          {!ratingDismissed && (
            <>
              {!showRating ? (
                <button className="br-back-btn" onClick={() => setShowRating(true)}>Rate this book</button>
              ) : (
                <div className="br-back-rating-wrap">
                  <BookRating
                    bookId={data.id || story.title}
                    onClose={() => { setShowRating(false); setRatingDismissed(true); }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Page indicator pill */}
      <div className="br-page-indicator">
        Page {currentIndex + 1} of {flatPages.length}
      </div>

      {/* Edit button */}
      {canEdit && (
        <button
          className="br-edit-floating"
          onClick={() => setActiveEdit({ index: currentIndex, type: "art" })}
        >
          {"\u270F\uFE0F"} Edit this page
        </button>
      )}

      {/* Edit drawer */}
      {activeEdit && (
        <div className="br-edit-area">
          <EditDrawer
            type={activeEdit.type}
            onSave={(instruction) => handleEditSave(activeEdit.index, instruction, activeEdit.type)}
          />
        </div>
      )}
    </div>
  );
}
