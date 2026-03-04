import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../App";
import EditDrawer from "./EditDrawer";
import { editPageText, generatePageImage } from "../api/story";

// ── Art style gradients ──────────────────────────────────────────────────────
const STYLE_GRADIENTS = {
  Watercolor: "linear-gradient(135deg, #F9C6D0, #FDDFC4, #FEF0E7)",
  "Pixar 3D": "linear-gradient(135deg, #1a1a4e, #2d1b6b, #0d0d2b)",
  "Storybook Sketch": "linear-gradient(135deg, #F5EDD6, #EDE0C4, #E5D5B0)",
  Anime: "linear-gradient(135deg, #C850C0, #4158D0, #FFCC70)",
  Realistic: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  "Soft Plush": "linear-gradient(135deg, #FFDEE9, #B5FFFC, #FFE9D9)",
};

const STYLE_COVER_GRADIENTS = {
  Watercolor: "linear-gradient(160deg, #E8A0B0, #F0C4A8, #F5DFC8)",
  "Pixar 3D": "linear-gradient(160deg, #1a1a5e, #3d2b8b, #1d1d4b)",
  "Storybook Sketch": "linear-gradient(160deg, #D8C8A0, #C4B498, #B8A888)",
  Anime: "linear-gradient(160deg, #A040A0, #3148C0, #D0A840)",
  Realistic: "linear-gradient(160deg, #1f1c49, #403b83, #34345e)",
  "Soft Plush": "linear-gradient(160deg, #E0C0D0, #90D8D4, #E0C8B0)",
};

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

// ── Main component ───────────────────────────────────────────────────────────
export default function BookReader({ data, cast, styleName, onReset }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const story = data.story || data;
  const pages = story.pages || [];
  const dedication = data.dedication;
  const heroName = cast.find((c) => c.isHero)?.name || cast[0]?.name || "your little one";
  const authorName = data.authorName || "A loving family";

  // State
  const [phase, setPhase] = useState("reveal"); // reveal | opening | reading
  const [currentPage, setCurrentPage] = useState(0); // 0 = cover, 1 = ded, 2+ = pages
  const [isFlipping, setIsFlipping] = useState(false);
  const [activeEdit, setActiveEdit] = useState(null);
  const [localPages, setLocalPages] = useState(pages);
  const [regeneratingImage, setRegeneratingImage] = useState(null);

  const bookRef = useRef();
  const confettiRef = useRef();
  const bookRotation = useMemo(() => (Math.random() * 2 - 1).toFixed(2), []);

  const gradient = STYLE_GRADIENTS[styleName] || STYLE_GRADIENTS.Watercolor;
  const coverGradient = STYLE_COVER_GRADIENTS[styleName] || STYLE_COVER_GRADIENTS.Watercolor;

  const hasDedication = !!dedication;
  const totalPages = 1 + (hasDedication ? 1 : 0) + localPages.length; // cover + ded? + pages
  const isLastPage = currentPage >= totalPages - 1;

  // Get page content for a given index
  function getPageData(idx) {
    if (idx === 0) return { type: "cover" };
    if (hasDedication && idx === 1) return { type: "dedication" };
    const pageIdx = idx - 1 - (hasDedication ? 1 : 0);
    if (pageIdx >= 0 && pageIdx < localPages.length) return { type: "page", page: localPages[pageIdx], pageIdx };
    return { type: "end" };
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

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goNext() {
    if (isFlipping || isLastPage) return;
    setIsFlipping(true);
    playPageTurn();
    setTimeout(() => {
      setCurrentPage((p) => p + 1);
      setIsFlipping(false);
      setActiveEdit(null);
    }, 500);
  }

  function goPrev() {
    if (isFlipping || currentPage <= 0) return;
    setIsFlipping(true);
    playPageTurn();
    setTimeout(() => {
      setCurrentPage((p) => p - 1);
      setIsFlipping(false);
      setActiveEdit(null);
    }, 500);
  }

  // Keyboard nav
  useEffect(() => {
    if (phase !== "reading") return;
    function handleKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, currentPage, isFlipping, isLastPage]);

  // Touch/swipe
  const touchStart = useRef(null);
  function handleTouchStart(e) { touchStart.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (dx < -40) goNext();
    else if (dx > 40) goPrev();
  }

  // ── Edit handlers ──────────────────────────────────────────────────────────
  async function handleEditSave(pageIndex, instruction, type) {
    if (type === "story") {
      const newText = await editPageText(localPages[pageIndex].text, instruction, cast);
      setLocalPages((prev) => prev.map((p, i) => (i === pageIndex ? { ...p, text: newText } : p)));
    } else {
      setRegeneratingImage(pageIndex);
      try {
        const newUrl = await generatePageImage(
          `${localPages[pageIndex].imagePrompt || localPages[pageIndex].text}. ${instruction}`,
          cast, styleName, data.heroPhotoUrl
        );
        setLocalPages((prev) => prev.map((p, i) => (i === pageIndex ? { ...p, imageUrl: newUrl } : p)));
      } catch (err) { addToast("Failed to regenerate image", "error"); }
      setRegeneratingImage(null);
    }
    setActiveEdit(null);
  }

  // ── Share ──────────────────────────────────────────────────────────────────
  function handleShare() {
    try {
      const shareData = { story: { title: story.title, pages: localPages.map(p => ({ text: p.text })) }, styleName, heroName, dedication };
      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      const url = `${window.location.origin}/shared?d=${encoded}`;
      navigator.clipboard.writeText(url);
      addToast("Link copied! Send it to grandma 👵", "magic");
    } catch { addToast("Failed to copy link", "error"); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Cover Reveal Phase
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "reveal" || phase === "opening") {
    return (
      <div className={`br-reveal ${phase === "opening" ? "br-reveal-opening" : ""}`}>
        <div className="br-reveal-bg" />
        <div ref={confettiRef} className="br-confetti-layer" />

        <div className={`br-closed-book ${phase === "opening" ? "br-book-flip" : "br-book-enter"}`}>
          {/* Spine */}
          <div className="br-cb-spine" style={{ background: `linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.2))` }} />

          {/* Cover face */}
          <div className="br-cb-face" style={{ background: coverGradient }}>
            <div className="br-cb-badge">{styleName}</div>
            <h1 className="br-cb-title">{story.title}</h1>
            <p className="br-cb-for">A story written for {heroName}</p>
            <div className="br-cb-emoji">
              <span className="br-cb-emoji-glow">{story.pages?.[0]?.emoji || "⭐"}</span>
            </div>
            <p className="br-cb-author">By {authorName}</p>
          </div>

          {/* Page stack */}
          <div className="br-cb-pages">
            <div className="br-cb-pg" style={{ right: 2 }} />
            <div className="br-cb-pg" style={{ right: 4 }} />
            <div className="br-cb-pg" style={{ right: 6 }} />
            <div className="br-cb-pg" style={{ right: 8 }} />
          </div>
        </div>

        {phase === "reveal" && (
          <button className="br-open-btn" onClick={handleOpen}>Open Your Book ✨</button>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: Reading Phase
  // ═══════════════════════════════════════════════════════════════════════════
  const current = getPageData(currentPage);

  return (
    <div className="br-scene" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Toolbar */}
      <div className="br-toolbar">
        <button className="br-tool-btn" onClick={() => navigate("/library")}>← Back to Library</button>
        <div className="br-tool-right">
          <button className="br-tool-icon" onClick={handleShare} title="Share">🔗</button>
          <button className="br-tool-icon" onClick={onReset} title="New Story">✨</button>
        </div>
      </div>

      {/* The book */}
      <div className="br-book-area">
        {/* Nav arrows */}
        <button className="br-nav-arrow br-nav-prev" onClick={goPrev} disabled={currentPage <= 0 || isFlipping}>‹</button>
        <button className="br-nav-arrow br-nav-next" onClick={goNext} disabled={isLastPage || isFlipping}>›</button>

        <div
          className={`br-book ${isFlipping ? "br-flipping" : ""}`}
          ref={bookRef}
          style={{ transform: `rotate(${bookRotation}deg)` }}
        >
          {/* Cover page (full spread) */}
          {current.type === "cover" && (
            <div className="br-spread br-cover-spread" style={{ background: gradient }}>
              <div className="br-noise" />
              <div className="br-cover-content">
                <div className="br-cc-badge">{styleName}</div>
                <h1 className="br-cc-title">{story.title}</h1>
                <div className="br-cc-line" />
                <div className="br-cc-emoji">{story.pages?.[0]?.emoji || "⭐"}</div>
                <p className="br-cc-for">A story written for</p>
                <p className="br-cc-name">{heroName}</p>
                <p className="br-cc-author">By {authorName}</p>
              </div>
            </div>
          )}

          {/* Dedication page */}
          {current.type === "dedication" && (
            <div className="br-spread">
              <div className="br-page-left" style={{ background: gradient }}>
                <div className="br-noise" />
                <div className="br-pl-inner">
                  <div className="br-pl-flourish">❦</div>
                  <div className="br-pl-label">Dedication</div>
                  <div className="br-pl-flourish">❦</div>
                </div>
                <div className="br-pl-mat" />
              </div>
              <div className="br-spine" />
              <div className="br-page-right">
                <div className="br-pr-inner">
                  <div className="br-pr-flourish">✦</div>
                  <p className="br-pr-text" style={{ fontStyle: "italic" }}>{dedication}</p>
                  <div className="br-pr-pagenum">~ ❤️ ~</div>
                </div>
                <div className="br-dogear" />
              </div>
            </div>
          )}

          {/* Story pages */}
          {current.type === "page" && (
            <div className="br-spread">
              <div className="br-page-left" style={{ background: gradient }}>
                <div className="br-noise" />
                {regeneratingImage === current.pageIdx ? (
                  <div className="br-pl-inner"><div className="br-img-loading">Regenerating…</div></div>
                ) : current.page.imageUrl ? (
                  <img className="br-pl-img" src={current.page.imageUrl} alt={`Page ${current.pageIdx + 1}`} />
                ) : (
                  <div className="br-pl-inner">
                    <div className="br-pl-emoji">{current.page.emoji || "🌟"}</div>
                  </div>
                )}
                <div className="br-pl-mat" />
                <div className="br-pl-bottom">✦</div>
              </div>
              <div className="br-spine" />
              <div className="br-page-right">
                <div className="br-pr-inner">
                  <div className="br-pr-flourish">✦</div>
                  <p className="br-pr-text">{current.page.text}</p>
                  <div className="br-pr-pagenum">~ {current.pageIdx + 1} ~</div>
                </div>
                <div className="br-dogear" />
                <button className="br-edit-toggle" onClick={() => setActiveEdit(activeEdit ? null : { index: current.pageIdx, type: "story" })}>
                  ✏️ Edit
                </button>
              </div>
            </div>
          )}

          {/* End page */}
          {current.type === "end" && (
            <div className="br-spread br-cover-spread" style={{ background: gradient }}>
              <div className="br-noise" />
              <div className="br-cover-content">
                <div className="br-cc-emoji">✨</div>
                <h1 className="br-cc-title" style={{ fontSize: 28 }}>The End</h1>
                <p className="br-cc-for">A StoriKids Original</p>
                <div className="br-end-actions">
                  <button className="br-end-btn" onClick={handleShare}>🔗 Share</button>
                  <button className="br-end-btn" onClick={onReset}>✨ New Story</button>
                </div>
              </div>
            </div>
          )}
        </div>
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

      {/* Progress dots */}
      <div className="br-dots">
        {Array.from({ length: totalPages }).map((_, i) => (
          <div key={i} className={`br-dot${i === currentPage ? " br-dot-on" : ""}`} />
        ))}
      </div>
    </div>
  );
}
