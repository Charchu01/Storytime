import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

  const [phase, setPhase] = useState("reveal");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);
  const [activeEdit, setActiveEdit] = useState(null);
  const [localSpreads, setLocalSpreads] = useState(spreads);
  const [localPages, setLocalPages] = useState(pages);
  const [regeneratingImage, setRegeneratingImage] = useState(null);
  const [narrating, setNarrating] = useState(false);
  const [narratorVoice, setNarratorVoice] = useState("mom");
  const narrationAudio = useRef(null);
  const narrationCache = useRef({});
  const confettiRef = useRef();
  const touchStartX = useRef(null);

  // Build flat page array
  const flatPages = useMemo(() => {
    const result = [];

    // Cover
    result.push({ type: "cover", imageUrl: coverImageUrl });

    // Dedication
    if (dedication) {
      result.push({ type: "dedication", text: dedication });
    }

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

    // Back cover
    result.push({ type: "back-cover", imageUrl: backCoverImageUrl });

    return result;
  }, [localSpreads, localPages, dedication, images, coverImageUrl, backCoverImageUrl]);

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
    if (phase !== "reading") return;
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
  }, [phase, goNext, goPrev]);

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

  // ── Open book ──────────────────────────────────────────────────────────────
  function handleOpen() {
    setPhase("opening");
    playChime();
    setTimeout(() => spawnConfetti(confettiRef.current), 400);
    setTimeout(() => {
      setPhase("reading");
      setCurrentIndex(0);
    }, 1200);
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

  // ── Narration ──────────────────────────────────────────────────────────────
  async function handleNarrate() {
    const current = flatPages[currentIndex];
    if (!current?.text) return;
    if (narrating) {
      narrationAudio.current?.pause();
      setNarrating(false);
      return;
    }
    const cacheKey = `page_${currentIndex}_${narratorVoice}`;
    try {
      let audioUrl = narrationCache.current[cacheKey];
      if (!audioUrl) {
        setNarrating(true);
        addToast("Preparing narration...", "info", 2000);
        const resp = await fetch("/api/narrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: current.text, voiceId: narratorVoice }),
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
        setTimeout(() => goNext(), 1500);
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
  }, [currentIndex]);

  // ── Share ──────────────────────────────────────────────────────────────────
  function handleShare() {
    try {
      const shareData = { story: { title: story.title }, styleName, heroName, dedication };
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
  // RENDER: Reading Phase — Simple Page-by-Page Viewer
  // ═══════════════════════════════════════════════════════════════════════════
  const current = flatPages[currentIndex] || flatPages[0];
  const hasText = current?.text;
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
          {hasText && (
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

      {/* Page display */}
      <div className="br-page-display" key={fadeKey}>
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

        {current.type === "dedication" && (
          <div className="br-page-content br-dedication-card">
            <p className="br-dedication-text">{current.text}</p>
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
            <div className="br-page-text-overlay">
              <p>{current.text}</p>
            </div>
            <span className="br-pagenum">{current.pageNum}</span>
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
            <div className="br-page-text-overlay">
              <p>{current.text}</p>
            </div>
            <span className="br-pagenum">{current.pageNum}</span>
          </div>
        )}

        {current.type === "back-cover" && (
          <div className="br-page-content br-page-back">
            {current.imageUrl ? (
              <img src={current.imageUrl} className="br-page-image" alt="Back cover" />
            ) : (
              <div className="br-back-fallback">
                <h2 className="br-back-title">The End</h2>
                <div className="br-back-line" />
                <p className="br-back-sub">A Storytime Original</p>
              </div>
            )}
            <div className="br-back-actions">
              <button className="br-back-btn" onClick={handleShare}>🔗 Share</button>
              <button className="br-back-btn" onClick={onReset}>✨ New Story</button>
            </div>
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
