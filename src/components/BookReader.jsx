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
  const heroName = cast.find((c) => c.isHero)?.name || cast[0]?.name || "your little one";
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
  const narrationAudio = useRef(null);
  const narrationCache = useRef({});
  const touchStartX = useRef(null);
  const autoNarateRef = useRef(false);

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
    const current = flatPages[currentIndex];
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
  useEffect(() => { autoNarateRef.current = autoNarrate; }, [autoNarrate]);

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
        if (autoNarateRef.current) {
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
    if (autoNarateRef.current) {
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
      // A5 landscape-ish: 210 x 148mm
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < flatPages.length; i++) {
        const pg = flatPages[i];
        if (i > 0) pdf.addPage();

        // Try to load image
        if (pg.imageUrl && isGeneratedImage(pg.imageUrl)) {
          try {
            const resp = await fetch(pg.imageUrl);
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

        // Overlay text
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
        } else if (pg.text) {
          // Story text at bottom with semi-transparent background
          const textLines = pdf.splitTextToSize(pg.text, pageW - 20);
          const textBlockH = textLines.length * 5 + 8;
          pdf.setFillColor(0, 0, 0);
          pdf.setGlobalAlpha?.(0.5);
          pdf.rect(0, pageH - textBlockH - 4, pageW, textBlockH + 4, "F");
          pdf.setGlobalAlpha?.(1);
          pdf.setFontSize(10);
          pdf.setTextColor(255, 255, 255);
          pdf.text(textLines, pageW / 2, pageH - textBlockH + 2, { align: "center" });
        }
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
  const current = flatPages[currentIndex] || flatPages[0];
  const canEdit = current?.type === "spread" || current?.type === "page";

  return (
    <div
      className="br-scene"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="br-ambient" />

      {/* Toolbar */}
      <div className="br-toolbar">
        <button className="br-toolbar-btn" onClick={() => navigate("/library")}>&larr; Library</button>
        <div className="br-toolbar-right">
          <button
            className={`br-narrate-toggle${autoNarrate ? " br-narrate-on" : ""}`}
            onClick={toggleAutoNarrate}
            title={autoNarrate ? "Turn off narration" : "Turn on narration"}
          >
            <span className="br-narrate-icon">{narrating ? "🔊" : autoNarrate ? "🔊" : "🔇"}</span>
            <span className="br-narrate-label">{autoNarrate ? "Narration On" : "Narration Off"}</span>
          </button>
          <button className="br-toolbar-btn" onClick={handleShare}>🔗 Share</button>
          <button className="br-toolbar-btn" onClick={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? "⏳" : "📄"} PDF
          </button>
          <button className="br-toolbar-btn" onClick={onReset}>✨ New</button>
        </div>
      </div>

      {/* Page display */}
      <div className={`br-page-display ${current.type === "spread" || current.type === "page" ? "br-landscape" : "br-portrait"}`} key={fadeKey}>
        {current.type === "cover" && (
          <div className="br-page-content br-page-cover">
            {current.imageUrl ? (
              <img src={current.imageUrl} className="br-page-image" alt={story.title} />
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
                <span className="br-page-loading-emoji">🎨</span>
                <span>Regenerating...</span>
              </div>
            ) : current.imageUrl && isGeneratedImage(current.imageUrl) ? (
              <img src={current.imageUrl} className="br-page-image" alt="" />
            ) : null}
          </div>
        )}

        {current.type === "page" && (
          <div className="br-page-content br-page-single">
            {regeneratingImage === current.pageIndex ? (
              <div className="br-page-loading">
                <span className="br-page-loading-emoji">🎨</span>
                <span>Regenerating...</span>
              </div>
            ) : current.imageUrl && isGeneratedImage(current.imageUrl) ? (
              <img src={current.imageUrl} className="br-page-image" alt="" />
            ) : current.emoji ? (
              <div className="br-page-emoji">{current.emoji}</div>
            ) : null}
          </div>
        )}

        {current.type === "back-cover" && (
          <div className="br-page-content br-page-back">
            {current.imageUrl ? (
              <>
                <img src={current.imageUrl} className="br-page-image" alt="Back cover" />
                <div className="br-back-overlay">
                  {dedication && dedication.trim().length > 3 && (
                    <p className="br-back-dedication">"{dedication}"</p>
                  )}
                  <p className="br-back-author">Written by {authorName}</p>
                  <div className="br-back-brand">A Storytime Original</div>
                </div>
              </>
            ) : (
              <div className="br-back-fallback">
                <h2 className="br-back-title">The End</h2>
                <div className="br-back-line" />
                {dedication && dedication.trim().length > 3 && (
                  <p className="br-back-ded-text">"{dedication}"</p>
                )}
                <p className="br-back-author-text">Written by {authorName}</p>
                <p className="br-back-sub">A Storytime Original</p>
              </div>
            )}
            <div className="br-back-actions">
              <button className="br-back-btn" onClick={handleShare}>🔗 Share</button>
              <button className="br-back-btn" onClick={handleDownloadPdf} disabled={downloadingPdf}>
                {downloadingPdf ? "⏳ Saving..." : "📄 Download PDF"}
              </button>
              <button className="br-back-btn" onClick={onReset}>✨ New Story</button>
            </div>
            {!ratingDismissed && (
              <div style={{ marginTop: 16 }}>
                {!showRating ? (
                  <button onClick={() => setShowRating(true)} style={{
                    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff", padding: "8px 16px", borderRadius: 10, fontSize: 13,
                    cursor: "pointer", backdropFilter: "blur(4px)",
                  }}>
                    Rate this book
                  </button>
                ) : (
                  <div style={{ background: "rgba(255,255,255,0.95)", borderRadius: 14, overflow: "hidden" }}>
                    <BookRating
                      bookId={data.id || story.title}
                      onClose={() => { setShowRating(false); setRatingDismissed(true); }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button className="br-nav br-nav-prev" onClick={goPrev}>&lsaquo;</button>
      )}
      {currentIndex < flatPages.length - 1 && (
        <button className="br-nav br-nav-next" onClick={goNext}>&rsaquo;</button>
      )}

      {/* Page indicator */}
      <div className="br-page-indicator">
        {currentIndex + 1} / {flatPages.length}
      </div>

      {/* Edit button */}
      {canEdit && (
        <button
          className="br-edit-floating"
          onClick={() => setActiveEdit({ index: currentIndex, type: "art" })}
        >
          ✏️ Edit
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
