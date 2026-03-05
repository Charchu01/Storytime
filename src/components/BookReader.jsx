import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import HTMLFlipBook from "react-pageflip";
import { useToast } from "../App";
import EditDrawer from "./EditDrawer";
import { editPageText, generatePageImage, STYLE_GRADIENTS, STYLE_COVER_GRADIENTS } from "../api/story";

// ── Web Audio helpers ────────────────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playChime() {
  try {
    const ctx = getAudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
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

function playPageTurn() {
  try {
    const ctx = getAudioCtx();
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.18);
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
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
      const opacity = Math.max(0, 1 - t / dur);
      el.style.transform = `translate(${x}px, ${y}px) rotate(${t * 360}deg)`;
      el.style.opacity = opacity;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
}

// Helper: check if a URL is a generated illustration
function isGeneratedImage(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http") || url.startsWith("blob:");
}

function isReferencePhoto(url, heroPhotoUrl) {
  if (!url || !heroPhotoUrl) return false;
  if (url === heroPhotoUrl) return true;
  if (url.startsWith("data:")) return true;
  return false;
}

// ── Sparkles ─────────────────────────────────────────────────────────────────
function Sparkles({ count = 16 }) {
  const sparkles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${8 + Math.random() * 84}%`,
      top: `${5 + Math.random() * 90}%`,
      dur: `${6 + Math.random() * 6}s`,
      delay: `${Math.random() * 8}s`,
    })), [count]
  );
  return (
    <div className="st-sparkles">
      {sparkles.map(s => (
        <div key={s.id} className="st-sparkle" style={{
          left: s.left, top: s.top,
          '--dur': s.dur, '--delay': s.delay
        }} />
      ))}
    </div>
  );
}

// ── Page Components (forwardRef required by react-pageflip) ──────────────────

const CoverPage = React.forwardRef(({ title, heroName, authorName, coverGradient, coverImageUrl }, ref) => (
  <div ref={ref} className="st-page st-cover" data-density="hard">
    <div className="st-cover-inner" style={{ background: coverImageUrl ? '#000' : coverGradient }}>
      {coverImageUrl && <img src={coverImageUrl} className="st-cover-img" alt="" />}
      <div className="st-cover-overlay" />
      <div className="st-cover-content">
        <div className="st-cover-deco">✦</div>
        <h1 className="st-cover-title">{title}</h1>
        <div className="st-cover-line" />
        <p className="st-cover-for">A story for {heroName}</p>
        <p className="st-cover-author">By {authorName}</p>
      </div>
    </div>
  </div>
));

const DedicationPage = React.forwardRef(({ dedication, gradient }, ref) => (
  <div ref={ref} className="st-page st-ded-page">
    <div className="st-ded-inner" style={{ background: gradient }}>
      <div className="st-paper-texture" />
      <div className="st-ded-flourish">&#10022;</div>
      <div className="st-ded-label">Dedication</div>
      <p className="st-ded-text">{dedication}</p>
      <div className="st-ded-heart">&hearts;</div>
    </div>
  </div>
));

// Left half of a spread (shows left half of 4:3 landscape image)
const StorySpreadLeft = React.forwardRef(({ imageUrl, pageNum, gradient, emoji, heroPhotoUrl, isRegenerating }, ref) => {
  const isSafe = isGeneratedImage(imageUrl) && !isReferencePhoto(imageUrl, heroPhotoUrl);
  return (
    <div ref={ref} className="st-page st-story-page">
      <div className="st-page-illustration">
        {isRegenerating ? (
          <div className="st-illust-fallback" style={{ background: gradient }}>
            <span className="st-fallback-emoji st-emoji-pulse">{emoji}</span>
            <span className="st-illustrating-badge">Illustrating...</span>
          </div>
        ) : isSafe ? (
          <img src={imageUrl} className="st-spread-img st-spread-left" alt=""
            onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="st-illust-fallback" style={{ background: gradient }}>
            <span className="st-fallback-emoji">{emoji}</span>
          </div>
        )}
      </div>
      <div className="st-page-border" />
      <div className="st-page-texture" />
      <span className="st-page-number st-pn-left">{pageNum}</span>
      <div className="st-spine-shadow st-spine-right" />
    </div>
  );
});

// Right half of a spread
const StorySpreadRight = React.forwardRef(({ imageUrl, pageNum, gradient, emoji, heroPhotoUrl, isRegenerating, onEdit }, ref) => {
  const isSafe = isGeneratedImage(imageUrl) && !isReferencePhoto(imageUrl, heroPhotoUrl);
  return (
    <div ref={ref} className="st-page st-story-page">
      <div className="st-page-illustration">
        {isRegenerating ? (
          <div className="st-illust-fallback" style={{ background: gradient }}>
            <span className="st-fallback-emoji st-emoji-pulse">{emoji}</span>
          </div>
        ) : isSafe ? (
          <img src={imageUrl} className="st-spread-img st-spread-right" alt=""
            onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="st-illust-fallback" style={{ background: gradient }}>
            <span className="st-fallback-emoji">{emoji}</span>
          </div>
        )}
      </div>
      <div className="st-page-border" />
      <div className="st-page-texture" />
      <span className="st-page-number st-pn-right">{pageNum}</span>
      <div className="st-spine-shadow st-spine-left" />
      {onEdit && <button className="st-edit-toggle" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✏️</button>}
    </div>
  );
});

const BlankPage = React.forwardRef((_, ref) => (
  <div ref={ref} className="st-page st-blank-page">
    <div className="st-paper-texture" />
  </div>
));

const BackCover = React.forwardRef(({ onReset, onShare }, ref) => (
  <div ref={ref} className="st-page st-back-cover" data-density="hard">
    <div className="st-back-inner">
      <h2 className="st-back-title">The End</h2>
      <div className="st-back-line" />
      <p className="st-back-sub">A Storytime Original</p>
      <div className="st-back-actions">
        <button className="st-back-btn" onClick={onShare}>Share</button>
        <button className="st-back-btn" onClick={onReset}>New Story</button>
      </div>
    </div>
  </div>
));

// ── Main component ───────────────────────────────────────────────────────────
export default function BookReader({ data, cast, styleName, onReset }) {
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
  const bookRef = useRef();
  const confettiRef = useRef();

  const gradient = STYLE_GRADIENTS[styleName] || STYLE_GRADIENTS.Storybook;
  const coverGradient = STYLE_COVER_GRADIENTS[styleName] || STYLE_COVER_GRADIENTS.Storybook;

  // Build page array — each spread produces TWO flipbook pages (left + right)
  const bookPages = useMemo(() => {
    const result = [];
    result.push({ type: "cover" });
    if (dedication) {
      result.push({ type: "dedication" });
    }
    localSpreads.forEach((spread, i) => {
      const imageUrl = images[`spread_${i}`] || null;
      const pageNumLeft = (i * 2) + 2;
      const pageNumRight = (i * 2) + 3;
      result.push({
        type: "spread-left",
        imageUrl,
        text: spread.leftPageText,
        pageNum: pageNumLeft,
        spreadIndex: i,
      });
      result.push({
        type: "spread-right",
        imageUrl,
        text: spread.rightPageText,
        pageNum: pageNumRight,
        spreadIndex: i,
      });
    });
    // Pad with blank page if needed so back cover lands on a left (even) page
    if (result.length % 2 !== 0) {
      result.push({ type: "blank" });
    }
    result.push({ type: "back-cover" });
    return result;
  }, [localSpreads, dedication, images]);

  // Map flipbook page index to spread info for narration
  function getSpreadInfo(flipPage) {
    const bp = bookPages[flipPage];
    if (bp && (bp.type === "spread-left" || bp.type === "spread-right")) {
      return { spreadIndex: bp.spreadIndex, side: bp.type === "spread-left" ? "left" : "right", text: bp.text };
    }
    return null;
  }

  // ── Open book ──────────────────────────────────────────────────────────────
  function handleOpen() {
    setPhase("opening");
    playChime();
    setTimeout(() => spawnConfetti(confettiRef.current), 400);
    setTimeout(() => {
      setPhase("reading");
      setCurrentPage(0);
    }, 1200);
  }

  // ── Page flip handler ──────────────────────────────────────────────────────
  function handleFlip(e) {
    playPageTurn();
    setCurrentPage(e.data);
    setActiveEdit(null);
  }

  // Keyboard nav
  useEffect(() => {
    if (phase !== "reading") return;
    function handleKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        bookRef.current?.pageFlip()?.flipNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        bookRef.current?.pageFlip()?.flipPrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase]);

  // ── Edit handlers ──────────────────────────────────────────────────────────
  async function handleEditSave(spreadIndex, instruction, type) {
    if (type === "story") {
      const spread = localSpreads[spreadIndex];
      const fullText = `${spread.leftPageText} ${spread.rightPageText}`;
      const newText = await editPageText(fullText, instruction, cast);
      // Split the edited text roughly in half for left/right
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
        // Update the images object directly isn't possible via state, store on spread
        setLocalSpreads((prev) => prev.map((s, i) =>
          i === spreadIndex ? { ...s, _overrideImageUrl: newUrl } : s
        ));
      } catch (err) { addToast("Failed to regenerate image", "error"); }
      setRegeneratingImage(null);
    }
    setActiveEdit(null);
  }

  // ── Narration (server-side proxy) ─────────────────────────────────────────
  async function handleNarrate() {
    const info = getSpreadInfo(currentPage);
    if (!info || !info.text) return;

    if (narrating) {
      narrationAudio.current?.pause();
      setNarrating(false);
      return;
    }

    const text = info.text;
    const cacheKey = `spread_${info.spreadIndex}_${info.side}_${narratorVoice}`;

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
        setTimeout(() => bookRef.current?.pageFlip()?.flipNext(), 1500);
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
      const { default: html2canvas } = await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm");
      const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm");

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const flipbook = document.querySelector(".st-flipbook");
      if (!flipbook) throw new Error("Book element not found");

      const canvas = await html2canvas(flipbook, { scale: 2, useCORS: true, backgroundColor: null });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);

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

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: Cover Reveal Phase
  // ═════════════════════════════════════════════════════════════════════════════
  if (phase === "reveal" || phase === "opening") {
    return (
      <div className={`st-scene st-reveal-scene ${phase === "opening" ? "st-reveal-opening" : ""}`}>
        <div className="st-desk-vignette" />
        <div className="st-desk-glow" />
        <Sparkles count={16} />
        <div ref={confettiRef} className="st-confetti-layer" />

        <div className={`st-closed-book ${phase === "opening" ? "st-book-flip" : "st-book-enter"}`}>
          <div className="st-cb-spine" />
          <div className="st-cb-face" style={{ background: coverImageUrl ? '#000' : coverGradient }}>
            {coverImageUrl && <img src={coverImageUrl} className="st-cb-img" alt="" />}
            <div className="st-cb-overlay" />
            <h1 className="st-cb-title">{story.title}</h1>
            <div className="st-cb-line" />
            <p className="st-cb-for">A story for {heroName}</p>
            <p className="st-cb-author">By {authorName}</p>
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
  // RENDER: Reading Phase — react-pageflip
  // ═════════════════════════════════════════════════════════════════════════════
  const spreadInfo = getSpreadInfo(currentPage);

  return (
    <div className="st-scene">
      <div className="st-desk-vignette" />
      <div className="st-desk-glow" />
      <Sparkles count={16} />

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

      {/* Physical book wrapper */}
      <div className="st-book-wrapper">
        <HTMLFlipBook
          ref={bookRef}
          width={550}
          height={733}
          size="stretch"
          minWidth={280}
          maxWidth={700}
          minHeight={373}
          maxHeight={933}
          showCover={true}
          maxShadowOpacity={0.6}
          drawShadow={true}
          flippingTime={800}
          usePortrait={true}
          mobileScrollSupport={false}
          swipeDistance={30}
          className="st-flipbook"
          onFlip={handleFlip}
        >
          {bookPages.map((bp, i) => {
            // For spreads, check for regenerated image override
            const spreadImageUrl = bp.spreadIndex != null
              ? (localSpreads[bp.spreadIndex]?._overrideImageUrl || bp.imageUrl)
              : null;

            switch (bp.type) {
              case "cover":
                return <CoverPage key={`cover-${i}`} title={story.title}
                  heroName={heroName} authorName={authorName}
                  coverGradient={coverGradient}
                  coverImageUrl={coverImageUrl} />;
              case "dedication":
                return <DedicationPage key={`ded-${i}`}
                  dedication={dedication}
                  gradient={gradient} />;
              case "spread-left":
                return <StorySpreadLeft key={`sl-${bp.spreadIndex}`}
                  imageUrl={spreadImageUrl}
                  pageNum={bp.pageNum}
                  gradient={gradient} emoji="🌟"
                  heroPhotoUrl={data.heroPhotoUrl}
                  isRegenerating={regeneratingImage === bp.spreadIndex} />;
              case "spread-right":
                return <StorySpreadRight key={`sr-${bp.spreadIndex}`}
                  imageUrl={spreadImageUrl}
                  pageNum={bp.pageNum}
                  gradient={gradient} emoji="🌟"
                  heroPhotoUrl={data.heroPhotoUrl}
                  isRegenerating={regeneratingImage === bp.spreadIndex}
                  onEdit={() => setActiveEdit({ index: bp.spreadIndex, type: "art" })} />;
              case "blank":
                return <BlankPage key={`blank-${i}`} />;
              case "back-cover":
                return <BackCover key={`back-${i}`}
                  onReset={onReset} onShare={handleShare} />;
              default:
                return null;
            }
          })}
        </HTMLFlipBook>

        {/* Hardcover binding */}
        <div className="st-binding" />
        {/* Page stack edges */}
        <div className="st-page-stack" />
      </div>

      {/* Nav arrows */}
      <div className="st-nav-arrows">
        <button className="st-nav-arrow st-nav-prev"
          onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
          aria-label="Previous page">&lsaquo;</button>
        <button className="st-nav-arrow st-nav-next"
          onClick={() => bookRef.current?.pageFlip()?.flipNext()}
          aria-label="Next page">&rsaquo;</button>
      </div>

      {/* Page indicator */}
      <div className="st-page-indicator">
        Page {Math.floor(currentPage / 2) + 1} of {Math.ceil(bookPages.length / 2)}
      </div>

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
