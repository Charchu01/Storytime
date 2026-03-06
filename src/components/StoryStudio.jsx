import { useState, useCallback } from "react";
import StoryChat from "./StoryChat";

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

  const heroName = heroData?.heroName || "Hero";
  const styleName = artStyle?.style?.name || "Classic Storybook";
  const toneName = artStyle?.tone?.label || null;

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
    <div className="create-step ss-step">
      <div className="create-step-header">
        <button className="create-back" onClick={onBack}>&larr; Back</button>
      </div>
      <div className="ss-content">
        {/* Context card — shows journey so far */}
        <div className="ss-context-card">
          {heroData?.heroPhoto && (
            <div className="ss-context-photo">
              <img src={heroData.heroPhoto} alt={heroData.heroName} />
            </div>
          )}
          <div className="ss-context-item">
            <span className="ss-context-label">Book</span>
            <span className="ss-context-value">{bookType?.emoji} {bookType?.title}</span>
          </div>
          <div className="ss-context-divider" />
          <div className="ss-context-item">
            <span className="ss-context-label">Hero</span>
            <span className="ss-context-value">{heroData?.heroName}</span>
          </div>
          <div className="ss-context-divider" />
          <div className="ss-context-item">
            <span className="ss-context-label">Style</span>
            <span className="ss-context-value">{artStyle?.style?.name}</span>
          </div>
          {artStyle?.tone && (
            <>
              <div className="ss-context-divider" />
              <div className="ss-context-item">
                <span className="ss-context-label">Mood</span>
                <span className="ss-context-value">{artStyle.tone.emoji} {artStyle.tone.label}</span>
              </div>
            </>
          )}
        </div>

        <div className="ss-chat-area">
          <StoryChat
            bookType={bookType}
            heroData={heroData}
            artStyle={artStyle}
            onDataUpdate={handleDataUpdate}
            onReady={handleReady}
          />
        </div>

        {ready && (
          <div className="ss-create-footer">
            <p className="ss-create-summary">
              {bookType?.title || "Story"} {"\u00B7"} {heroName} {"\u00B7"} {styleName}{toneName ? ` \u00B7 ${toneName}` : ""}
            </p>
            <button className="ss-create-btn" onClick={handleCreateBook}>
              {"\u2728"} Create My Book
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
