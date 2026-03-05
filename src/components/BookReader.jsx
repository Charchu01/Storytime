import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import HTMLFlipBook from "react-pageflip";
import { useToast } from "../App";
import EditDrawer from "./EditDrawer";
import { editPageText, generatePageImage } from "../api/story";

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
      el.style.transform = `translate(${x}px, ${y}px) rotate(${t * 360}deg)`;
      el.style.opacity = Math.max(0, 1 - t / dur);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }
}

function isGeneratedImage(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http") || url.startsWith("blob:");
}

// ── Page Components (forwardRef required by react-pageflip) ──────────────────

const CoverPage = React.forwardRef(({ imageUrl }, ref) => (
  <div ref={ref} className="br-page br-page-hard" data-density="hard">
    {imageUrl ? (
      <img src={imageUrl} className="br-page-img" alt="Cover" />
    ) : (
      <div className="br-page-blank" style={{ background: "#263D5C" }} />
    )}
  </div>
));

const DedicationPage = React.forwardRef(({ text }, ref) => (
  <div ref={ref} className="br-page br-page-cream">
    <div className="br-dedication">
      <p className="br-dedication-text">{text}</p>
    </div>
  </div>
));

const SpreadLeftPage = React.forwardRef(({ imageUrl, text, pageNum, isRegenerating }, ref) => (
  <div ref={ref} className="br-page">
    {isRegenerating ? (
      <div className="br-page-loading">
        <span className="br-page-loading-emoji">🎨</span>
      </div>
    ) : imageUrl && isGeneratedImage(imageUrl) ? (
      <div className="br-page-art">
        <img src={imageUrl} className="br-spread-left" alt="" />
      </div>
    ) : (
      <div className="br-page-cream">
        {text && <p className="br-fallback-text">{text}</p>}
      </div>
    )}
    <div className="br-gutter-shadow br-gutter-right" />
    <span className="br-pagenum br-pagenum-left">{pageNum}</span>
  </div>
));

const SpreadRightPage = React.forwardRef(({ imageUrl, text, pageNum, isRegenerating, onEdit }, ref) => (
  <div ref={ref} className="br-page">
    {isRegenerating ? (
      <div className="br-page-loading">
        <span className="br-page-loading-emoji">🎨</span>
      </div>
    ) : imageUrl && isGeneratedImage(imageUrl) ? (
      <div className="br-page-art">
        <img src={imageUrl} className="br-spread-right" alt="" />
      </div>
    ) : (
      <div className="br-page-cream">
        {text && <p className="br-fallback-text">{text}</p>}
      </div>
    )}
    <div className="br-gutter-shadow br-gutter-left" />
    <span className="br-pagenum br-pagenum-right">{pageNum}</span>
    {onEdit && (
      <button className="br-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✏️</button>
    )}
  </div>
));

const EndpaperPage = React.forwardRef((_, ref) => (
  <div ref={ref} className="br-page br-page-cream" />
));

const BackCoverPage = React.forwardRef(({ imageUrl, onReset, onShare }, ref) => (
  <div ref={ref} className="br-page br-page-hard" data-density="hard">
    {imageUrl ? (
      <>
        <img src={imageUrl} className="br-page-img" alt="Back cover" />
        <div className="br-back-actions">
          <button className="br-back-btn" onClick={onShare}>Share</button>
          <button className="br-back-btn" onClick={onReset}>New Story</button>
        </div>
      </>
    ) : (
      <div className="br-back-fallback">
        <h2 className="br-back-title">The End</h2>
        <div className="br-back-line" />
        <p className="br-back-sub">A Storytime Original</p>
        <div className="br-back-actions">
          <button className="br-back-btn" onClick={onShare}>Share</button>
          <button className="br-back-btn" onClick={onReset}>New Story</button>
        </div>
      </div>
    )}
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
  const narrationAudio = useRef(null);
  const narrationCache = useRef({});
  const bookRef = useRef();
  const confettiRef = useRef();

  // Build page array
  const bookPages = useMemo(() => {
    const result = [];
    result.push({ type: "cover" });
    if (dedication) {
      result.push({ type: "dedication" });
    }
    localSpreads.forEach((spread, i) => {
      const imageUrl = images[`spread_${i}`] || null;
      result.push({
        type: "spread-left",
        imageUrl,
        text: spread.leftPageText,
        pageNum: (i * 2) + 2,
        spreadIndex: i,
      });
      result.push({
        type: "spread-right",
        imageUrl,
        text: spread.rightPageText,
        pageNum: (i * 2) + 3,
        spreadIndex: i,
      });
    });
    if (result.length % 2 !== 0) {
      result.push({ type: "endpaper" });
    }
    result.push({ type: "back-cover" });
    return result;
  }, [localSpreads, dedication, images]);

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

  useEffect(() => {
    return () => {
      const audio = narrationAudio.current;
      if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); narrationAudio.current = null; }
      setNarrating(false);
    };
  }, [currentPage]);

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

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Cover Reveal Phase
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "reveal" || phase === "opening") {
    return (
      <div className={`br-scene br-reveal-scene ${phase === "opening" ? "br-reveal-opening" : ""}`}>
        <div className="br-ambient" />
        <div ref={confettiRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100 }} />

        <div className={`br-closed-book ${phase === "opening" ? "br-book-flip" : "br-book-enter"}`}>
          <div className="br-closed-spine" />
          <div className="br-closed-face">
            {coverImageUrl ? (
              <img src={coverImageUrl} className="br-closed-img" alt={story.title} />
            ) : (
              <div className="br-closed-fallback">
                <h1 className="br-closed-title">{story.title}</h1>
                <div className="br-closed-line" />
                <p className="br-closed-for">A story for {heroName}</p>
                <p className="br-closed-author">By {authorName}</p>
              </div>
            )}
          </div>
          <div className="br-closed-pages">
            <div className="br-closed-pg" style={{ right: 2 }} />
            <div className="br-closed-pg" style={{ right: 4 }} />
            <div className="br-closed-pg" style={{ right: 6 }} />
          </div>
        </div>

        {phase === "reveal" && (
          <button className="br-open-btn" onClick={handleOpen}>Open Your Book</button>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Reading Phase
  // ═══════════════════════════════════════════════════════════════════════════
  const spreadInfo = getSpreadInfo(currentPage);

  return (
    <div className="br-scene">
      <div className="br-ambient" />

      {/* Toolbar */}
      <div className="br-toolbar">
        <button className="br-toolbar-btn" onClick={() => navigate("/library")}>&larr; Library</button>
        <div className="br-toolbar-right">
          {spreadInfo && (
            <>
              <div className="br-voice-picker">
                <button className={`br-voice-btn${narratorVoice === "mom" ? " active" : ""}`} onClick={() => setNarratorVoice("mom")} title="Mom voice">👩</button>
                <button className={`br-voice-btn${narratorVoice === "dad" ? " active" : ""}`} onClick={() => setNarratorVoice("dad")} title="Dad voice">👨</button>
                <button className={`br-voice-btn${narratorVoice === "grandma" ? " active" : ""}`} onClick={() => setNarratorVoice("grandma")} title="Grandma voice">👵</button>
              </div>
              <button className="br-toolbar-btn" onClick={handleNarrate}>
                {narrating ? "⏸ Pause" : "🔊 Read to me"}
              </button>
            </>
          )}
          <button className="br-toolbar-btn" onClick={handleShare}>🔗 Share</button>
          <button className="br-toolbar-btn" onClick={onReset}>✨ New</button>
        </div>
      </div>

      {/* The physical book */}
      <div className="br-book-shell">
        {/* Page stack edges (visible book thickness) */}
        <div className="br-page-stack br-stack-left" />
        <div className="br-page-stack br-stack-right" />

        {/* The hardcover edge */}
        <div className="br-hardcover" />

        {/* The flipbook inside */}
        <div className="br-flipbook-wrapper">
          <HTMLFlipBook
            ref={bookRef}
            width={500}
            height={660}
            size="stretch"
            minWidth={260}
            maxWidth={600}
            minHeight={340}
            maxHeight={800}
            showCover={true}
            maxShadowOpacity={0.5}
            drawShadow={true}
            flippingTime={700}
            usePortrait={false}
            mobileScrollSupport={false}
            swipeDistance={30}
            className="br-flipbook"
            onFlip={handleFlip}
            startZIndex={5}
          >
            {bookPages.map((bp, i) => {
              const spreadImageUrl = bp.spreadIndex != null
                ? (localSpreads[bp.spreadIndex]?._overrideImageUrl || bp.imageUrl)
                : null;

              switch (bp.type) {
                case "cover":
                  return <CoverPage key="cover" imageUrl={coverImageUrl} />;
                case "dedication":
                  return <DedicationPage key="ded" text={dedication} />;
                case "spread-left":
                  return <SpreadLeftPage key={`sl-${bp.spreadIndex}`}
                    imageUrl={spreadImageUrl} text={bp.text} pageNum={bp.pageNum}
                    isRegenerating={regeneratingImage === bp.spreadIndex} />;
                case "spread-right":
                  return <SpreadRightPage key={`sr-${bp.spreadIndex}`}
                    imageUrl={spreadImageUrl} text={bp.text} pageNum={bp.pageNum}
                    isRegenerating={regeneratingImage === bp.spreadIndex}
                    onEdit={() => setActiveEdit({ index: bp.spreadIndex, type: "art" })} />;
                case "endpaper":
                  return <EndpaperPage key={`end-${i}`} />;
                case "back-cover":
                  return <BackCoverPage key="back" imageUrl={backCoverImageUrl}
                    onReset={onReset} onShare={handleShare} />;
                default:
                  return null;
              }
            })}
          </HTMLFlipBook>
        </div>

        {/* Spine */}
        <div className="br-spine" />
      </div>

      {/* Book shadow on surface */}
      <div className="br-shadow" />

      {/* Navigation */}
      <button className="br-nav br-nav-prev" onClick={() => bookRef.current?.pageFlip()?.flipPrev()}>&lsaquo;</button>
      <button className="br-nav br-nav-next" onClick={() => bookRef.current?.pageFlip()?.flipNext()}>&rsaquo;</button>

      {/* Page indicator */}
      <div className="br-page-indicator">
        Page {Math.floor(currentPage / 2) + 1} of {Math.ceil(bookPages.length / 2)}
      </div>

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
