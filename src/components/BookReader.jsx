import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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


// Helper: check if a URL is a generated illustration (not a raw uploaded photo)
function isGeneratedImage(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("http") || url.startsWith("blob:");
}

// SAFETY: Never display the uploaded reference photo on a book page
function isReferencePhoto(url, heroPhotoUrl) {
  if (!url || !heroPhotoUrl) return false;
  // Check against both data URIs and uploaded URLs
  if (url === heroPhotoUrl) return true;
  if (url.startsWith("data:")) return true;
  return false;
}

// Render text with drop cap on first letter
function renderTextWithDropCap(text, pageIdx, narrating, narratingSentence) {
  if (!text) return null;

  if (narrating && narratingSentence >= 0) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map((sentence, i) => {
      if (i === 0) {
        const first = sentence.charAt(0);
        const rest = sentence.slice(1);
        return (
          <span key={i} className={`br-sentence${i === narratingSentence ? " br-sentence-active" : ""}`}>
            <span className="br-drop-cap">{first}</span>{rest}
          </span>
        );
      }
      return <span key={i} className={`br-sentence${i === narratingSentence ? " br-sentence-active" : ""}`}>{sentence}</span>;
    });
  }

  const first = text.charAt(0);
  const rest = text.slice(1);
  return <><span className="br-drop-cap">{first}</span>{rest}</>;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BookReader({ data, cast, styleName, onReset }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const story = data.story || data;
  const pages = story.pages || [];
  const dedication = data.dedication;
  const coverImageUrl = story.coverImageUrl || null;
  const heroName = cast.find((c) => c.isHero)?.name || cast[0]?.name || "your little one";
  const authorName = data.authorName || "A loving family";

  // State
  const [phase, setPhase] = useState("reveal"); // reveal | opening | reading
  const [currentPage, setCurrentPage] = useState(0); // 0 = cover, 1 = ded, 2+ = pages
  const [isFlipping, setIsFlipping] = useState(false);
  const [activeEdit, setActiveEdit] = useState(null);
  const [localPages, setLocalPages] = useState(pages);
  const [regeneratingImage, setRegeneratingImage] = useState(null);
  const [narrating, setNarrating] = useState(false);
  const [narratingSentence, setNarratingSentence] = useState(-1);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const narrationAudio = useRef(null);
  const narrationCache = useRef({});

  const bookRef = useRef();
  const confettiRef = useRef();
  const bookRotation = useMemo(() => (Math.random() * 2 - 1).toFixed(2), []);

  const gradient = STYLE_GRADIENTS[styleName] || STYLE_GRADIENTS.Storybook;
  const coverGradient = STYLE_COVER_GRADIENTS[styleName] || STYLE_COVER_GRADIENTS.Storybook;

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
        const sceneDesc = localPages[pageIndex].scene_description || localPages[pageIndex].text;
        const mood = localPages[pageIndex].mood || "wonder";
        const newUrl = await generatePageImage(
          `${sceneDesc}. ${instruction}`,
          cast, styleName, data.heroPhotoUrl, mood
        );
        setLocalPages((prev) => prev.map((p, i) => (i === pageIndex ? { ...p, imageUrl: newUrl } : p)));
      } catch (err) { addToast("Failed to regenerate image", "error"); }
      setRegeneratingImage(null);
    }
    setActiveEdit(null);
  }

  // ── Narration (ElevenLabs) ───────────────────────────────────────────
  async function handleNarrate() {
    const current = getPageData(currentPage);
    if (current.type !== "page" || !current.page?.text) return;

    if (narrating) {
      // Pause
      narrationAudio.current?.pause();
      setNarrating(false);
      setNarratingSentence(-1);
      return;
    }

    const text = current.page.text;
    const cacheKey = `page_${current.pageIdx}`;

    try {
      let audioUrl = narrationCache.current[cacheKey];

      if (!audioUrl) {
        const apiKey = import.meta.env.VITE_ELEVENLABS_KEY;
        if (!apiKey) { addToast("Audio unavailable — no API key configured", "info"); return; }

        setNarrating(true);
        setNarratingSentence(-1);
        addToast("Preparing narration...", "info", 2000);

        const resp = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM", {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
          body: JSON.stringify({ text, model_id: "eleven_turbo_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        });

        if (!resp.ok) throw new Error("ElevenLabs API error");
        const blob = await resp.blob();
        audioUrl = URL.createObjectURL(blob);
        narrationCache.current[cacheKey] = audioUrl;
      }

      const audio = new Audio(audioUrl);
      narrationAudio.current = audio;
      setNarrating(true);

      // Sentence highlighting — wait for metadata so duration is accurate
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const sentenceTimers = [];

      function startSentenceHighlighting() {
        const avgDuration = (audio.duration || 5) / sentences.length;
        sentences.forEach((_, i) => {
          sentenceTimers.push(setTimeout(() => setNarratingSentence(i), i * avgDuration * 1000));
        });
      }

      function cleanupTimers() {
        sentenceTimers.forEach(clearTimeout);
        sentenceTimers.length = 0;
      }

      function handlePlaying() {
        cleanupTimers();
        startSentenceHighlighting();
      }

      function handleEnded() {
        cleanupTimers();
        setNarrating(false);
        setNarratingSentence(-1);
        // Auto-advance after 1.5s
        setTimeout(() => { if (!isLastPage) goNext(); }, 1500);
      }

      audio.addEventListener("playing", handlePlaying);
      audio.addEventListener("ended", handleEnded);

      audio.play().catch(() => {
        setNarrating(false);
        addToast("Audio unavailable — try again later", "info");
      });
    } catch {
      setNarrating(false);
      setNarratingSentence(-1);
      addToast("Audio unavailable — try again later", "info");
    }
  }

  // Stop narration on page change — clean up audio and event listeners
  useEffect(() => {
    return () => {
      const audio = narrationAudio.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load(); // release resources
        narrationAudio.current = null;
      }
      setNarrating(false);
      setNarratingSentence(-1);
    };
  }, [currentPage]);

  // ── PDF Download ───────────────────────────────────────────────────────
  async function handleDownloadPdf() {
    setPdfGenerating(true);
    addToast("Preparing your book...", "info", 3000);

    try {
      // Dynamic import to avoid bundling unless needed
      const { default: html2canvas } = await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm");
      const { jsPDF } = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm");

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const bookEl = bookRef.current;
      if (!bookEl) throw new Error("Book element not found");

      const canvas = await html2canvas(bookEl, { scale: 2, useCORS: true, backgroundColor: null });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);

      const title = story.title || "My Storytime Book";
      pdf.save(`${title} - Storytime.pdf`);

      // Log activity
      try {
        const history = JSON.parse(localStorage.getItem("sk_activity") || "[]");
        history.unshift({ date: new Date().toISOString(), title, action: "PDF Download", status: "Complete" });
        localStorage.setItem("sk_activity", JSON.stringify(history.slice(0, 50)));
      } catch {}

      addToast("📚 Your book is saved! Check your downloads.", "magic");
    } catch (err) {
      // PDF generation failed — toast already shown
      addToast("PDF generation failed — try again", "error");
    }
    setPdfGenerating(false);
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
            <h1 className="br-cb-title">{story.title}</h1>
            <div className="br-cb-line" />
            <p className="br-cb-for">A story for {heroName}</p>
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
          <button className="br-open-btn" onClick={handleOpen}>Open Your Book</button>
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
      {/* Desk environment layers */}
      <div className="br-desk-vignette" />
      <div className="br-desk-glow" />
      <div className="br-desk-sparkles">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="br-sparkle"
            style={{
              left: `${8 + Math.random() * 84}%`,
              top: `${5 + Math.random() * 90}%`,
              '--dur': `${6 + Math.random() * 6}s`,
              '--delay': `${Math.random() * 8}s`,
            }}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div className="br-toolbar">
        <button className="br-tool-btn" onClick={() => navigate("/library")}>← Back to Library</button>
        <div className="br-tool-right">
          {current.type === "page" && (
            <button className="br-tool-icon" onClick={handleNarrate} title={narrating ? "Pause" : "Read to me"}>
              {narrating ? "⏸ Pause" : "🔊 Read to me"}
            </button>
          )}
          <button className="br-tool-icon" onClick={handleDownloadPdf} disabled={pdfGenerating} title="Save PDF">
            {pdfGenerating ? "⏳" : "⬇"} Save PDF
          </button>
          <button className="br-tool-icon" onClick={handleShare} title="Share">🔗</button>
          <button className="br-tool-icon" onClick={onReset} title="New Story">✨</button>
        </div>
      </div>

      {/* The book */}
      <div className="br-book-area">
        {/* Nav arrows */}
        <button className="br-nav-arrow br-nav-prev" onClick={goPrev} disabled={currentPage <= 0 || isFlipping} aria-label="Previous page">‹</button>
        <button className="br-nav-arrow br-nav-next" onClick={goNext} disabled={isLastPage || isFlipping} aria-label="Next page">›</button>

        <div
          className={`br-book ${isFlipping ? "br-flipping" : ""}`}
          ref={bookRef}
          style={{ transform: `rotate(${bookRotation}deg)` }}
        >
          {/* Cover page (full spread with cover image) */}
          {current.type === "cover" && (
            <div className="br-spread br-cover-spread" style={{ background: coverImageUrl ? '#000' : gradient }}>
              {coverImageUrl && (
                <>
                  <img className="br-cover-bg-img" src={coverImageUrl} alt="" />
                  <div className="br-cover-overlay" />
                </>
              )}
              <div className="br-noise" />
              <div className="br-cover-content">
                <h1 className="br-cc-title">{story.title}</h1>
                <div className="br-cc-line" />
                <p className="br-cc-for">A story written for</p>
                <p className="br-cc-name">{heroName}</p>
                <p className="br-cc-author">By {authorName}</p>
                <div className="br-cc-watermark">Storytime</div>
              </div>
            </div>
          )}

          {/* Dedication page */}
          {current.type === "dedication" && (() => {
            const coverEmoji = story.coverEmoji || story.pages?.[0]?.scene_emoji || "✨";
            const floatingEmojis = ["🌟", "💫", "✨", "🌙", "⭐", "💖", "🦋", "🌸", "🍃", "🌺"];
            return (
              <div className="br-spread">
                <div className="br-page-left br-ded-left" style={{ background: gradient }}>
                  <div className="br-noise" />
                  <div className="br-ded-hero-emoji">{coverEmoji}</div>
                  {floatingEmojis.map((em, i) => (
                    <div
                      key={i}
                      className="br-ded-float-emoji"
                      style={{
                        left: `${10 + Math.random() * 75}%`,
                        top: `${8 + Math.random() * 78}%`,
                        fontSize: `${20 + Math.random() * 16}px`,
                        opacity: 0.3 + Math.random() * 0.35,
                        animationDuration: `${3 + Math.random() * 4}s`,
                        animationDelay: `${Math.random() * 3}s`,
                      }}
                    >
                      {em}
                    </div>
                  ))}
                  <div className="br-pl-bottom" style={{ color: "rgba(255,255,255,0.25)" }}>✦</div>
                </div>
                <div className="br-spine" />
                <div className="br-page-right">
                  <div className="br-pr-inner br-ded-right-inner">
                    <div className="br-ded-flourish">✦</div>
                    <div className="br-ded-label">Dedication</div>
                    <p className="br-ded-text">{dedication}</p>
                    <div className="br-ded-heart">♥</div>
                    <div className="br-pr-pagenum">~ ♥ ~</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Story pages — text left, illustration right */}
          {current.type === "page" && (() => {
            const imgUrl = current.page.imageUrl;
            const isSafeImage = isGeneratedImage(imgUrl) && !isReferencePhoto(imgUrl, data.heroPhotoUrl);
            const pageEmoji = current.page.scene_emoji || current.page.emoji || "🌟";

            const moodColors = {
              wonder:     { bg: "#FFF8ED", accent: "#D4A76A" },
              adventure:  { bg: "#FFF5F0", accent: "#E8845A" },
              cozy:       { bg: "#FEF7ED", accent: "#C8956C" },
              tense:      { bg: "#F0F4FF", accent: "#7C8CC8" },
              triumphant: { bg: "#FFFFF0", accent: "#D4A020" },
              tender:     { bg: "#FFF0F5", accent: "#C87C95" },
            };
            const colors = moodColors[current.page.mood] || moodColors.wonder;

            return (
              <div className="br-spread">
                {/* LEFT — Text page */}
                <div className="br-page-left br-text-page" style={{ background: colors.bg }}>
                  <div className="br-noise" />
                  <div className="br-text-decor-top" style={{ color: colors.accent }}>&#10087;</div>
                  <div className="br-text-spot" style={{ color: colors.accent }}>{pageEmoji}</div>
                  <div className="br-text-block">
                    <p className="br-page-text">
                      {renderTextWithDropCap(current.page.text, current.pageIdx, narrating, narratingSentence)}
                    </p>
                  </div>
                  <div className="br-text-decor-bot" style={{ color: colors.accent }}>&#10022;</div>
                  <div className="br-text-pagenum" style={{ color: colors.accent }}>
                    &mdash; {current.pageIdx + 1} &mdash;
                  </div>
                  <button className="br-edit-toggle" onClick={() => setActiveEdit(activeEdit ? null : { index: current.pageIdx, type: "story" })}>
                    &#9999;&#65039;
                  </button>
                </div>

                {/* SPINE */}
                <div className="br-spine" />

                {/* RIGHT — Illustration page */}
                <div className="br-page-right br-illust-page">
                  {regeneratingImage === current.pageIdx ? (
                    <div className="br-illust-loading" style={{ background: gradient }}>
                      <div className="br-pl-emoji br-emoji-pulse">{pageEmoji}</div>
                      <div className="br-illustrating-badge">Illustrating...</div>
                    </div>
                  ) : isSafeImage ? (
                    <img
                      className="br-illust-img br-img-fadein"
                      src={imgUrl}
                      alt={current.page.scene_description || `Page ${current.pageIdx + 1}`}
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.parentElement.style.background = gradient;
                      }}
                    />
                  ) : (
                    <div className="br-illust-fallback" style={{ background: gradient }}>
                      <div className="br-pl-emoji br-emoji-pulse">{pageEmoji}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* End page */}
          {current.type === "end" && (
            <div className="br-spread br-cover-spread" style={{ background: '#0C0A09' }}>
              <div className="br-noise" />
              <div className="br-cover-content" style={{ justifyContent: 'center' }}>
                <h1 className="br-cc-title" style={{ fontSize: 32, opacity: 0.9 }}>The End</h1>
                <div className="br-cc-line" />
                <p className="br-cc-for">A Storytime Original</p>
                <div className="br-end-actions">
                  <button className="br-end-btn" onClick={handleShare}>Share</button>
                  <button className="br-end-btn" onClick={onReset}>New Story</button>
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
      <div className="br-dots" role="tablist" aria-label="Page navigation">
        {Array.from({ length: totalPages }).map((_, i) => (
          <div key={i} className={`br-dot${i === currentPage ? " br-dot-on" : ""}`} role="tab" aria-selected={i === currentPage} aria-label={`Page ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
