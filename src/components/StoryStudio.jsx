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
      <div className="create-step-content ss-content">
        <h1 className="create-step-title">Let's build your story</h1>
        <p className="create-step-subtitle">Answer a few quick questions</p>

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
