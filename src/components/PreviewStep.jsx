import { useState, useEffect, useCallback } from "react";
import { editPageText, generatePageImage } from "../api/story";
import EditDrawer from "./EditDrawer";

function PageImage({ imageUrl, pageIndex, isLoading }) {
  if (isLoading) {
    return (
      <div className="bk-page-art bk-page-art-loading">
        <div className="sp-art-spinner" />
        <div className="sp-art-loading-text">Regenerating…</div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className="bk-page-art">
        <img src={imageUrl} alt={`Page ${pageIndex + 1} illustration`} />
      </div>
    );
  }

  return (
    <div className="bk-page-art bk-page-art-empty">
      <div style={{ fontSize: 48 }}>🎨</div>
      <div style={{ fontSize: 12, color: "var(--lt)", fontWeight: 700 }}>Image unavailable</div>
    </div>
  );
}

export default function PreviewStep({ data, cast, onReset, onBack }) {
  const { story, dedication, style, enrichedCast } = data;
  // Use enriched cast (with appearance descriptions) if available, otherwise fall back to original
  const activeCast = enrichedCast || cast;
  const [pages, setPages] = useState(story.pages);
  const [activeEdit, setActiveEdit] = useState(null);
  const [regeneratingImage, setRegeneratingImage] = useState(null);
  const [currentSpread, setCurrentSpread] = useState(-1); // -1 = cover, 0+ = page spreads
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState("next");

  // Build spread layout: cover, dedication?, then page pairs
  const spreads = [];
  // Each spread is: { type: 'cover' } | { type: 'dedication' } | { type: 'pages', left: page, right: page|null, leftIdx, rightIdx }
  const hasDedication = !!dedication;

  for (let i = 0; i < pages.length; i += 2) {
    spreads.push({
      type: "pages",
      left: pages[i],
      right: pages[i + 1] || null,
      leftIdx: i,
      rightIdx: i + 1 < pages.length ? i + 1 : null,
    });
  }

  // -1 = cover, 0 = dedication (if exists) or first spread, 1+ = spreads
  const totalViews = 1 + (hasDedication ? 1 : 0) + spreads.length; // cover + ded? + spreads
  const viewIndex = currentSpread + 1; // 0-based: 0=cover, 1=ded/spread, ...
  const isLastView = viewIndex >= totalViews - 1;
  const isCover = currentSpread === -1;
  const isDedicationView = hasDedication && currentSpread === 0;
  const spreadIndex = hasDedication ? currentSpread - 1 : currentSpread;

  function flipTo(next) {
    if (isFlipping) return;
    setIsFlipping(true);
    setFlipDirection(next > currentSpread ? "next" : "prev");
    setTimeout(() => {
      setCurrentSpread(next);
      setIsFlipping(false);
      setActiveEdit(null);
    }, 400);
  }

  function goNext() {
    const maxSpread = (hasDedication ? 1 : 0) + spreads.length - 1;
    if (currentSpread < maxSpread) flipTo(currentSpread + 1);
  }

  function goPrev() {
    if (currentSpread > -1) flipTo(currentSpread - 1);
  }

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
  }, [currentSpread, isFlipping]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function toggleEdit(pageIndex, type) {
    setActiveEdit((current) =>
      current?.index === pageIndex && current?.type === type ? null : { index: pageIndex, type }
    );
  }

  async function handleEditSave(pageIndex, instruction, type) {
    if (type === "story") {
      const newText = await editPageText(pages[pageIndex].text, instruction, activeCast);
      setPages((prev) => prev.map((page, i) => (i === pageIndex ? { ...page, text: newText } : page)));
    } else {
      setRegeneratingImage(pageIndex);
      try {
        const newImageUrl = await generatePageImage(
          `${pages[pageIndex].imagePrompt || pages[pageIndex].text}. Additional direction: ${instruction}`,
          activeCast,
          style
        );
        setPages((prev) =>
          prev.map((page, i) => (i === pageIndex ? { ...page, imageUrl: newImageUrl } : page))
        );
      } catch (err) {
        console.error("Failed to regenerate image:", err);
      }
      setRegeneratingImage(null);
    }
    setActiveEdit(null);
  }

  async function handleRegenerateImage(pageIndex) {
    setRegeneratingImage(pageIndex);
    try {
      const newImageUrl = await generatePageImage(
        pages[pageIndex].imagePrompt || pages[pageIndex].text,
        activeCast,
        style
      );
      setPages((prev) =>
        prev.map((page, i) => (i === pageIndex ? { ...page, imageUrl: newImageUrl } : page))
      );
    } catch (err) {
      console.error("Failed to regenerate image:", err);
    }
    setRegeneratingImage(null);
  }

  // Render a single page panel (left or right side of a spread)
  function renderPagePanel(page, pageIndex, side) {
    if (!page) {
      // Empty right page (end of book)
      return (
        <div className={`bk-panel bk-panel-${side} bk-panel-end`}>
          <div className="bk-end-content">
            <div style={{ fontSize: 42, marginBottom: 12 }}>✨</div>
            <div className="bk-end-title">The End</div>
            <div className="bk-end-sub">A StoriKids Original</div>
          </div>
        </div>
      );
    }

    return (
      <div className={`bk-panel bk-panel-${side}`}>
        {side === "left" ? (
          // Left page = illustration
          <>
            <PageImage
              imageUrl={page.imageUrl}
              pageIndex={pageIndex}
              isLoading={regeneratingImage === pageIndex}
            />
            <div className="bk-page-actions">
              <button className="bk-pg-act" onClick={() => toggleEdit(pageIndex, "art")}>🎨 Edit art</button>
              <button
                className="bk-pg-act"
                onClick={() => handleRegenerateImage(pageIndex)}
                disabled={regeneratingImage === pageIndex}
              >
                🖼️ New image
              </button>
            </div>
          </>
        ) : (
          // Right page = text
          <div className="bk-text-panel">
            <div className="bk-page-num">Page {pageIndex + 1}</div>
            <div className="bk-page-story">{page.text}</div>
            <div className="bk-page-actions">
              <button className="bk-pg-act" onClick={() => toggleEdit(pageIndex, "story")}>✏️ Edit story</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Progress dots
  const totalDots = totalViews;

  return (
    <div className="bk-viewer">
      {/* Top bar */}
      <div className="bk-topbar">
        <button className="bk-top-btn" onClick={onBack}>← Back</button>
        <div className="bk-top-title">{story.title}</div>
        <div className="bk-top-actions">
          <button className="bk-top-btn" onClick={() => window.print()}>🖨️</button>
          <button className="bk-top-btn" onClick={onReset}>✨ New</button>
        </div>
      </div>

      {/* Book container */}
      <div className="bk-stage">
        <div className={`bk-book ${isCover ? "bk-book-closed" : "bk-book-open"} ${isFlipping ? `bk-flip-${flipDirection}` : ""}`}>

          {/* COVER VIEW */}
          {isCover && (
            <div className="bk-cover" onClick={goNext}>
              {pages[0]?.imageUrl && (
                <img className="bk-cover-bg" src={pages[0].imageUrl} alt="" />
              )}
              <div className="bk-cover-overlay" />
              <div className="bk-cover-inner">
                <div className="bk-cover-badge">✨ A StoriKids Original</div>
                <h1 className="bk-cover-title">{story.title}</h1>
                <div className="bk-cover-meta">
                  {style} · {pages.length} illustrated pages
                </div>
                <div className="bk-cover-cast">
                  {cast.map((character) => (
                    <span key={character.id} className="bk-cover-char">
                      {character.photo ? (
                        <img src={character.photo} alt="" className="bk-cover-char-photo" />
                      ) : (
                        character.emoji
                      )}{" "}
                      {character.name}
                    </span>
                  ))}
                </div>
                <div className="bk-cover-open">Tap to open →</div>
              </div>
            </div>
          )}

          {/* DEDICATION VIEW */}
          {isDedicationView && (
            <div className="bk-spread">
              <div className="bk-panel bk-panel-left bk-panel-ded">
                <div className="bk-ded-ornament">❦</div>
                <div className="bk-ded-label">Dedication</div>
                <div className="bk-ded-text">{dedication}</div>
                <div className="bk-ded-ornament">❦</div>
              </div>
              <div className="bk-spine" />
              <div className="bk-panel bk-panel-right bk-panel-ded-right">
                <div className="bk-ded-right-content">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
                  <div className="bk-ded-begin">Our story begins…</div>
                </div>
              </div>
            </div>
          )}

          {/* PAGE SPREADS */}
          {!isCover && !isDedicationView && spreadIndex >= 0 && spreadIndex < spreads.length && (
            <div className="bk-spread">
              {/* Left page - illustration */}
              {renderPagePanel(
                spreads[spreadIndex].left,
                spreads[spreadIndex].leftIdx,
                "left"
              )}
              <div className="bk-spine" />
              {/* Right page - text (same page) or next page text */}
              <div className="bk-panel bk-panel-right">
                <div className="bk-text-panel">
                  <div className="bk-page-num">
                    Page {spreads[spreadIndex].leftIdx + 1}
                    {spreads[spreadIndex].right && ` — ${spreads[spreadIndex].rightIdx + 1}`}
                  </div>
                  <div className="bk-page-story">{spreads[spreadIndex].left.text}</div>
                  {spreads[spreadIndex].right && (
                    <div className="bk-page-story bk-page-story-cont">
                      {spreads[spreadIndex].right.text}
                    </div>
                  )}
                  <div className="bk-page-actions">
                    <button className="bk-pg-act" onClick={() => toggleEdit(spreads[spreadIndex].leftIdx, "story")}>
                      ✏️ Edit
                    </button>
                    <button className="bk-pg-act" onClick={() => toggleEdit(spreads[spreadIndex].leftIdx, "art")}>
                      🎨 Art
                    </button>
                    <button
                      className="bk-pg-act"
                      onClick={() => handleRegenerateImage(spreads[spreadIndex].leftIdx)}
                      disabled={regeneratingImage === spreads[spreadIndex].leftIdx}
                    >
                      🖼️ New
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit drawer (below book) */}
      {activeEdit && (
        <div className="bk-edit-area">
          <EditDrawer
            type={activeEdit.type}
            onSave={(instruction) => handleEditSave(activeEdit.index, instruction, activeEdit.type)}
          />
        </div>
      )}

      {/* Navigation controls */}
      <div className="bk-nav">
        <button
          className="bk-nav-btn bk-nav-prev"
          onClick={goPrev}
          disabled={isCover || isFlipping}
        >
          ‹
        </button>

        <div className="bk-dots">
          {Array.from({ length: totalDots }).map((_, i) => (
            <div
              key={i}
              className={`bk-dot ${i === viewIndex ? "bk-dot-active" : ""}`}
            />
          ))}
        </div>

        <button
          className="bk-nav-btn bk-nav-next"
          onClick={goNext}
          disabled={isLastView || isFlipping}
        >
          ›
        </button>
      </div>

      {/* Final actions on last page */}
      {isLastView && !isCover && (
        <div className="bk-final">
          <button className="f-btn f-pri" onClick={() => window.print()}>🖨️ Print Book</button>
          <button className="f-btn f-sec" onClick={onReset}>✨ New Story</button>
        </div>
      )}
    </div>
  );
}
