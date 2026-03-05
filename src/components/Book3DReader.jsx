import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../App";
import EditDrawer from "./EditDrawer";
import { editPageText, generatePageImage, STYLE_GRADIENTS, STYLE_COVER_GRADIENTS } from "../api/story";

const Book3D = lazy(() => import("./Book3D"));

// ── Web Audio helpers ────────────────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playChime() {
  try {
    const ctx = getAudioCtx();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.7);
    });
  } catch {}
}

// ── Confetti ─────────────────────────────────────────────────────────────────
function spawnConfetti(container) {
  if (!container) return;
  const colors = ["#FFD700", "#FFFFFF", "#E8845A", "#F5E6C8"];
  for (let i = 0; i < 65; i++) {
    const el = document.createElement("div");
    const size = 4 + Math.random() * 7;
    const isCircle = Math.random() > 0.5;
    const angle = Math.random() * Math.PI * 2;
    const velocity = 120 + Math.random() * 200;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity - 100;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const dur = 1.8 + Math.random() * 0.4;
    el.style.cssText = `position:absolute;left:50%;top:50%;width:${size}px;height:${isCircle ? size : size * 0.5}px;background:${color};border-radius:${isCircle ? "50%" : "2px"};pointer-events:none;z-index:100;`;
    container.appendChild(el);
    const start = performance.now();
    function animate(now) {
      const t = (now - start) / 1000;
      if (t > dur) { el.remove(); return; }
      const x = vx * t;
      const y = vy * t + 400 * t * t;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${t * 360}deg)`;
      el.style.opacity = Math.max(0, 1 - t / dur);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Book3DReader({ data, cast, styleName, onReset }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const story = data.story || data;
  const images = data.images || {};
  const spreads = story.spreads || [];
  const dedication = data.dedication || story.dedication || null;
  const coverImageUrl = images.cover || story.coverImageUrl || null;
  const backCoverImageUrl = images.backCover || null;
  const heroName = cast.find((c) => c.isHero)?.name || cast[0]?.name || "your little one";
  const authorName = data.authorName || "A loving family";

  const [phase, setPhase] = useState("reveal");
  const [currentPage, setCurrentPage] = useState(0);
  const [activeEdit, setActiveEdit] = useState(null);
  const [localSpreads, setLocalSpreads] = useState(spreads);
  const [regeneratingImage, setRegeneratingImage] = useState(null);
  const [narrating, setNarrating] = useState(false);
  const [narratorVoice, setNarratorVoice] = useState("mom");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const narrationAudio = useRef(null);
  const narrationCache = useRef({});
  const confettiRef = useRef();

  const gradient = STYLE_GRADIENTS[styleName] || STYLE_GRADIENTS.Storybook;
  const coverGradient = STYLE_COVER_GRADIENTS[styleName] || STYLE_COVER_GRADIENTS.Storybook;

  // ── Build 3D page data ─────────────────────────────────────────────────────
  // In a physical book, each leaf has a front and back.
  // Page structure:
  //   Leaf 0 (cover - handled separately by Book3D)
  //   Leaf 1: front = dedication (or first spread left), back = first spread right (or left)
  //   Leaf 2..N: front = spread left, back = spread right
  //   Last leaf (back cover - handled separately)
  //
  // For spreads: each 4:3 landscape image is ONE spread shown across two pages.
  // In the 3D book, each spread image goes on the front of a leaf (right-hand page when open)
  // and the back shows the text or next content.
  //
  // Simplified approach: Each spread = one leaf. Front = spread image. Back = blank/next page.

  const book3DPages = useMemo(() => {
    const pages = [];

    // If there's a dedication, it becomes the first leaf's front
    // (visible when you open the cover)
    if (dedication) {
      pages.push({
        front: null, // Dedication page (blank/text — no image)
        back: null,  // Blank back
        type: "dedication",
      });
    }

    // Each spread becomes a leaf
    localSpreads.forEach((spread, i) => {
      const imgUrl = spread._overrideImageUrl || images[`spread_${i}`] || null;
      pages.push({
        front: imgUrl,  // The spread illustration
        back: null,     // Back of this leaf (blank)
        type: "spread",
        spreadIndex: i,
        leftText: spread.leftPageText,
        rightText: spread.rightPageText,
      });
    });

    return pages;
  }, [localSpreads, images, dedication]);

  // Total "pages" for navigation: cover + leaves + back cover
  const totalLeaves = book3DPages.length;
  const maxPage = totalLeaves + 2; // +2 for front and back cover

  // Map currentPage (leaf index) to spread info for narration
  function getSpreadInfo(pageIdx) {
    // pageIdx 0 = cover closed, 1 = cover open (first leaf visible)
    // Dedication leaf doesn't have narration text
    const leafIdx = pageIdx - 1; // 0-indexed leaf
    if (leafIdx < 0 || leafIdx >= book3DPages.length) return null;
    const leaf = book3DPages[leafIdx];
    if (leaf.type !== "spread") return null;
    return {
      spreadIndex: leaf.spreadIndex,
      side: "left", // In 3D mode, the whole spread is one page
      text: `${leaf.leftText || ""} ${leaf.rightText || ""}`.trim(),
    };
  }

  // ── Open book ────────────────────────────────────────────────────────────────
  function handleOpen() {
    setPhase("opening");
    playChime();
    setTimeout(() => spawnConfetti(confettiRef.current), 400);
    setTimeout(() => {
      setPhase("reading");
      setCurrentPage(0);
    }, 1200);
  }

  // ── Page navigation ──────────────────────────────────────────────────────────
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(Math.max(0, Math.min(maxPage, newPage)));
    setActiveEdit(null);
  }, [maxPage]);

  // Keyboard nav
  useEffect(() => {
    if (phase !== "reading") return;
    function handleKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        handlePageChange(currentPage + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePageChange(currentPage - 1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, currentPage, handlePageChange]);

  // ── Edit handlers ──────────────────────────────────────────────────────────
  async function handleEditSave(spreadIndex, instruction, type) {
    if (type === "story") {
      const spread = localSpreads[spreadIndex];
      const fullText = `${spread.leftPageText} ${spread.rightPageText}`;
      const newText = await editPageText(fullText, instruction, cast);
      const sentences = newText.match(/[^.!?]+[.!?]+/g) || [newText];
      const mid = Math.ceil(sentences.length / 2);
      const leftText = sentences.slice(0, mid).join("").trim();
      const rightText = sentences.slice(mid).join("").trim() || leftText;
      setLocalSpreads((prev) => prev.map((s, i) =>
        i === spreadIndex ? { ...s, leftPageText: leftText, rightPageText: rightText } : s
      ));
    } else {
      setRegeneratingImage(spreadIndex);
      try {
        const spread = localSpreads[spreadIndex];
        const sceneDesc = `${spread.leftPageText} ${spread.rightPageText}`;
        const newUrl = await generatePageImage(
          `${sceneDesc}. ${instruction}`,
          cast, styleName, data.heroPhotoUrl, "wonder"
        );
        setLocalSpreads((prev) => prev.map((s, i) =>
          i === spreadIndex ? { ...s, _overrideImageUrl: newUrl } : s
        ));
      } catch (err) { addToast("Failed to regenerate image", "error"); }
      setRegeneratingImage(null);
    }
    setActiveEdit(null);
  }

  // ── Narration ──────────────────────────────────────────────────────────────
  async function handleNarrate() {
    const info = getSpreadInfo(currentPage);
    if (!info || !info.text) return;

    if (narrating) {
      narrationAudio.current?.pause();
      setNarrating(false);
      return;
    }

    const text = info.text;
    const cacheKey = `spread_${info.spreadIndex}_${narratorVoice}`;

    try {
      let audioUrl = narrationCache.current[cacheKey];

      if (!audioUrl) {
        setNarrating(true);
        addToast("Preparing narration...", "info", 2000);

        const resp = await fetch("/api/narrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId: narratorVoice }),
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
        setTimeout(() => handlePageChange(currentPage + 1), 1500);
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

  // Stop narration on page change
  useEffect(() => {
    return () => {
      const audio = narrationAudio.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        narrationAudio.current = null;
      }
      setNarrating(false);
    };
  }, [currentPage]);

  // ── PDF Download ───────────────────────────────────────────────────────────
  async function handleDownloadPdf() {
    setPdfGenerating(true);
    addToast("Preparing your book...", "info", 3000);

    try {
      const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm");

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      // Add cover
      if (coverImageUrl) {
        pdf.addImage(coverImageUrl, "JPEG", 0, 0, pdfW, pdfH);
      }

      // Add spreads
      for (let i = 0; i < localSpreads.length; i++) {
        pdf.addPage("a4", "landscape");
        const imgUrl = localSpreads[i]._overrideImageUrl || images[`spread_${i}`];
        if (imgUrl) {
          const lW = pdf.internal.pageSize.getWidth();
          const lH = pdf.internal.pageSize.getHeight();
          pdf.addImage(imgUrl, "JPEG", 0, 0, lW, lH);
        }
        // Add text below
        const spread = localSpreads[i];
        const text = `${spread.leftPageText || ""} ${spread.rightPageText || ""}`.trim();
        if (text && !imgUrl) {
          pdf.setFontSize(14);
          pdf.text(text, 20, 30, { maxWidth: pdf.internal.pageSize.getWidth() - 40 });
        }
      }

      // Add back cover
      if (backCoverImageUrl) {
        pdf.addPage("a4", "portrait");
        pdf.addImage(backCoverImageUrl, "JPEG", 0, 0, pdfW, pdfH);
      }

      const title = story.title || "My Storytime Book";
      pdf.save(`${title} - Storytime.pdf`);

      try {
        const history = JSON.parse(localStorage.getItem("sk_activity") || "[]");
        history.unshift({ date: new Date().toISOString(), title, action: "PDF Download", status: "Complete" });
        localStorage.setItem("sk_activity", JSON.stringify(history.slice(0, 50)));
      } catch {}

      addToast("Your book is saved! Check your downloads.", "magic");
    } catch (err) {
      addToast("PDF generation failed — try again", "error");
    }
    setPdfGenerating(false);
  }

  // ── Share ──────────────────────────────────────────────────────────────────
  function handleShare() {
    try {
      const shareData = { story: { title: story.title, spreads: localSpreads.map(s => ({ leftPageText: s.leftPageText, rightPageText: s.rightPageText })) }, styleName, heroName, dedication };
      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      const url = `${window.location.origin}/shared?d=${encoded}`;
      navigator.clipboard.writeText(url);
      addToast("Link copied! Send it to grandma", "magic");
    } catch { addToast("Failed to copy link", "error"); }
  }

  // ── Current spread info for toolbar ────────────────────────────────────────
  const spreadInfo = getSpreadInfo(currentPage);
  const currentSpreadIndex = spreadInfo?.spreadIndex ?? null;

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: Cover Reveal Phase
  // ═════════════════════════════════════════════════════════════════════════════
  if (phase === "reveal" || phase === "opening") {
    return (
      <div className={`st-scene st-reveal-scene ${phase === "opening" ? "st-reveal-opening" : ""}`}>
        <div className="st-desk-vignette" />
        <div className="st-desk-glow" />
        <div ref={confettiRef} className="st-confetti-layer" />

        <div className={`st-closed-book ${phase === "opening" ? "st-book-flip" : "st-book-enter"}`}>
          <div className="st-cb-spine" />
          <div className="st-cb-face" style={{ background: coverImageUrl ? '#000' : coverGradient }}>
            {coverImageUrl && <img src={coverImageUrl} className="st-cb-img" alt="" />}
            {!coverImageUrl && (
              <>
                <div className="st-cb-overlay" />
                <h1 className="st-cb-title">{story.title}</h1>
                <div className="st-cb-line" />
                <p className="st-cb-for">A story for {heroName}</p>
                <p className="st-cb-author">By {authorName}</p>
              </>
            )}
          </div>
          <div className="st-cb-pages">
            <div className="st-cb-pg" style={{ right: 2 }} />
            <div className="st-cb-pg" style={{ right: 4 }} />
            <div className="st-cb-pg" style={{ right: 6 }} />
            <div className="st-cb-pg" style={{ right: 8 }} />
          </div>
        </div>

        {phase === "reveal" && (
          <button className="st-open-btn" onClick={handleOpen}>Open Your Book</button>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: 3D Reading Phase
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="st-scene st-3d-scene">
      {/* Toolbar */}
      <div className="st-toolbar">
        <button className="st-tool-btn" onClick={() => navigate("/library")}>&larr; Back to Library</button>
        <div className="st-tool-right">
          {spreadInfo && (
            <>
              <div className="st-voice-picker">
                <button className={`st-voice-btn${narratorVoice === "mom" ? " st-voice-active" : ""}`}
                  onClick={() => setNarratorVoice("mom")} title="Mom voice">👩</button>
                <button className={`st-voice-btn${narratorVoice === "dad" ? " st-voice-active" : ""}`}
                  onClick={() => setNarratorVoice("dad")} title="Dad voice">👨</button>
                <button className={`st-voice-btn${narratorVoice === "grandma" ? " st-voice-active" : ""}`}
                  onClick={() => setNarratorVoice("grandma")} title="Grandma voice">👵</button>
              </div>
              <button className="st-tool-icon" onClick={handleNarrate} title={narrating ? "Pause" : "Read to me"}>
                {narrating ? "⏸ Pause" : "🔊 Read to me"}
              </button>
            </>
          )}
          <button className="st-tool-icon" onClick={handleDownloadPdf} disabled={pdfGenerating} title="Save PDF">
            {pdfGenerating ? "⏳" : "⬇"} Save PDF
          </button>
          <button className="st-tool-icon" onClick={handleShare} title="Share">🔗 Share</button>
          <button className="st-tool-icon" onClick={onReset} title="New Story">✨ New</button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="st-3d-canvas-wrap">
        <Suspense fallback={
          <div className="st-3d-loading">
            <div className="gen-emoji gen-spin">📖</div>
            <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 12 }}>Loading 3D book...</div>
          </div>
        }>
          <Book3D
            pages={book3DPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            coverUrl={coverImageUrl}
            backCoverUrl={backCoverImageUrl}
          />
        </Suspense>
      </div>

      {/* Nav arrows */}
      <div className="st-nav-arrows">
        <button
          className="st-nav-arrow st-nav-prev"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 0}
          aria-label="Previous page"
        >&lsaquo;</button>
        <button
          className="st-nav-arrow st-nav-next"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= maxPage}
          aria-label="Next page"
        >&rsaquo;</button>
      </div>

      {/* Page indicator */}
      <div className="st-page-indicator">
        Page {currentPage} of {maxPage}
      </div>

      {/* Edit button overlay — visible when on a spread page */}
      {currentSpreadIndex !== null && (
        <button
          className="st-3d-edit-btn"
          onClick={() => setActiveEdit({ index: currentSpreadIndex, type: "art" })}
        >
          ✏️ Edit This Page
        </button>
      )}

      {/* Edit drawer */}
      {activeEdit && (
        <div className="st-edit-area">
          <EditDrawer
            type={activeEdit.type}
            onSave={(instruction) => handleEditSave(activeEdit.index, instruction, activeEdit.type)}
          />
        </div>
      )}
    </div>
  );
}
