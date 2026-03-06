import { useState, useCallback } from "react";
import StoryChat from "./StoryChat";

function StorySidebar({ heroData, bookType, artStyle, collectedData }) {
  const heroName = heroData?.heroName || "Hero";
  const companions = heroData?.companions || [];
  const styleName = artStyle?.style?.name || "Classic Storybook";
  const toneName = artStyle?.tone?.label || null;

  // Count how many story details are filled
  const filledFields = [
    collectedData.storyIdea,
    collectedData.details,
    collectedData.dedication,
    collectedData.world,
    collectedData.theme,
    collectedData.occasion,
  ].filter(Boolean).length;
  const progressPct = Math.min(100, Math.round((filledFields / 3) * 100));

  return (
    <div className="ss-sidebar">
      <div className="ss-sidebar-section">
        <div className="ss-sidebar-label">Your Book</div>
        <div className="ss-sidebar-book-type">
          <span className="ss-sidebar-emoji">{bookType?.emoji || "📖"}</span>
          <span>{bookType?.title || "Story"}</span>
        </div>
      </div>

      <div className="ss-sidebar-section">
        <div className="ss-sidebar-label">Characters</div>
        <div className="ss-sidebar-characters">
          <div className="ss-sidebar-char ss-sidebar-hero">
            {heroData?.heroPhoto ? (
              <img src={heroData.heroPhoto} alt={heroName} className="ss-sidebar-char-photo" />
            ) : (
              <span className="ss-sidebar-char-icon">
                {heroData?.heroType === "pet" ? "🐾" : "⭐"}
              </span>
            )}
            <div className="ss-sidebar-char-info">
              <span className="ss-sidebar-char-name">{heroName}</span>
              <span className="ss-sidebar-char-role">Hero</span>
            </div>
          </div>
          {companions.map((c, i) => (
            <div key={i} className="ss-sidebar-char">
              {c.photo ? (
                <img src={c.photo} alt={c.name} className="ss-sidebar-char-photo" />
              ) : (
                <span className="ss-sidebar-char-icon">🤝</span>
              )}
              <div className="ss-sidebar-char-info">
                <span className="ss-sidebar-char-name">{c.name}</span>
                <span className="ss-sidebar-char-role">{c.relationship}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ss-sidebar-section">
        <div className="ss-sidebar-label">Style</div>
        <div className="ss-sidebar-style">
          <span>{styleName}</span>
          {toneName && <span className="ss-sidebar-tone">{toneName}</span>}
        </div>
      </div>

      {collectedData.storyIdea && (
        <div className="ss-sidebar-section">
          <div className="ss-sidebar-label">Story Idea</div>
          <p className="ss-sidebar-value">{collectedData.storyIdea}</p>
        </div>
      )}

      {collectedData.dedication && (
        <div className="ss-sidebar-section">
          <div className="ss-sidebar-label">Dedication</div>
          <p className="ss-sidebar-value ss-sidebar-dedication">"{collectedData.dedication}"</p>
        </div>
      )}

      <div className="ss-sidebar-section">
        <div className="ss-sidebar-label">Progress</div>
        <div className="ss-sidebar-progress">
          <div className="ss-sidebar-progress-bar">
            <div className="ss-sidebar-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="ss-sidebar-progress-text">{progressPct}% complete</span>
        </div>
      </div>
    </div>
  );
}

function MobileStatusStrip({ heroData, bookType, artStyle, collectedData }) {
  const [expanded, setExpanded] = useState(false);
  const heroName = heroData?.heroName || "Hero";
  const companions = heroData?.companions || [];
  const styleName = artStyle?.style?.name || "Classic Storybook";

  const filledFields = [
    collectedData.storyIdea,
    collectedData.details,
    collectedData.dedication,
    collectedData.world,
    collectedData.theme,
    collectedData.occasion,
  ].filter(Boolean).length;
  const progressPct = Math.min(100, Math.round((filledFields / 3) * 100));

  return (
    <div className="ss-mobile-strip">
      <button className="ss-mobile-strip-bar" onClick={() => setExpanded(!expanded)}>
        <div className="ss-mobile-strip-left">
          <span className="ss-mobile-strip-emoji">{bookType?.emoji || "📖"}</span>
          <span className="ss-mobile-strip-name">{heroName}'s {bookType?.title || "Story"}</span>
        </div>
        <div className="ss-mobile-strip-right">
          <span className="ss-mobile-strip-pct">{progressPct}%</span>
          <span className="ss-mobile-strip-arrow">{expanded ? "▼" : "▲"}</span>
        </div>
      </button>
      <div className="ss-mobile-strip-progress">
        <div className="ss-mobile-strip-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      {expanded && (
        <div className="ss-mobile-strip-detail">
          <div className="ss-mobile-strip-row">
            <span className="ss-mobile-strip-label">Characters</span>
            <div className="ss-mobile-strip-chips">
              <span className="ss-mobile-strip-chip ss-mobile-strip-chip-hero">{heroName}</span>
              {companions.map((c, i) => (
                <span key={i} className="ss-mobile-strip-chip">{c.name}</span>
              ))}
            </div>
          </div>
          <div className="ss-mobile-strip-row">
            <span className="ss-mobile-strip-label">Style</span>
            <span className="ss-mobile-strip-value">{styleName}</span>
          </div>
          {collectedData.storyIdea && (
            <div className="ss-mobile-strip-row">
              <span className="ss-mobile-strip-label">Idea</span>
              <span className="ss-mobile-strip-value ss-mobile-strip-idea">{collectedData.storyIdea}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StoryStudio({ bookType, heroData, artStyle, onComplete, onBack }) {
  const [ready, setReady] = useState(false);
  const [collectedData, setCollectedData] = useState({
    storyIdea: "",
    details: "",
    tone: "",
    dedication: "",
    authorName: "",
    occasion: "",
    theme: "",
    world: "",
    language: "en",
  });

  const handleDataUpdate = useCallback((update) => {
    setCollectedData((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(update)) {
        if (value !== undefined && value !== null && value !== "") {
          next[key] = value;
        }
      }
      return next;
    });
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  function handleCreateBook() {
    onComplete({
      ...collectedData,
      heroName: heroData.heroName,
      heroAge: heroData.heroAge,
      heroType: heroData.heroType,
      bookType: bookType.id,
    });
  }

  return (
    <div className="ss-container">
      <div className="ss-topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 className="ss-topbar-title">Story Details</h1>
        <div className="ss-topbar-spacer" />
      </div>

      {/* Mobile status strip */}
      <MobileStatusStrip
        heroData={heroData}
        bookType={bookType}
        artStyle={artStyle}
        collectedData={collectedData}
      />

      <div className="ss-content ss-content-full">
        <StorySidebar
          heroData={heroData}
          bookType={bookType}
          artStyle={artStyle}
          collectedData={collectedData}
        />
        <div className="ss-right">
          <StoryChat
            bookType={bookType}
            heroData={heroData}
            artStyle={artStyle}
            onDataUpdate={handleDataUpdate}
            onReady={handleReady}
          />
        </div>
      </div>

      {ready && (
        <div className="ss-float-create">
          <button className="ss-float-btn" onClick={handleCreateBook}>
            Create My Book →
          </button>
        </div>
      )}
    </div>
  );
}
